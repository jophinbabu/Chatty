import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js"; // Added for push notifications
import { getReceiverSocketId, io } from "../socket/socket.js";
import { uploadToS3 } from "../lib/s3.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { encryptMessage, decryptMessage } from "../lib/encryption.js";
import { sendPushToUser } from "../lib/push.js"; // Import helper

console.log("🔄 Message Controller Loaded"); // Trigger restart

dotenv.config();

// --- Helper: Process Base64 ---
const processBase64 = (base64String) => {
  // Updated regex to handle mimeTypes with parameters like audio/webm;codecs=opus
  const matches = base64String.match(/^data:([A-Za-z-+\/;=\w]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 string");
  }

  const mimetype = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  // Extract base type without codec params (e.g., "webm" from "audio/webm;codecs=opus")
  const baseMimetype = mimetype.split(";")[0]; // Remove codec params
  const type = baseMimetype.split("/")[1]; // Get extension
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1000)}.${type}`;

  return { buffer, fileName, mimetype: baseMimetype }; // Use base mimetype for S3
};

// --- Controller: Send Message ---
export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, duration } = req.body;
    const { id: inputId } = req.params; // receiving User ID OR Conversation ID
    const senderId = req.user.id;

    let imageUrl = null;
    let audioUrl = null;

    // Decrypt text for notification payload (if text exists)
    // We do this early so we can use it in the push notification
    const decryptedText = text ? decryptMessage(text) : "";

    // 1. Handle Image Upload
    if (image) {
      const { buffer, fileName, mimetype } = processBase64(image);
      imageUrl = await uploadToS3(buffer, `chat-images/${fileName}`, mimetype);
    }

    // 2. Handle Audio Upload
    if (audio) {
      const { buffer, fileName, mimetype } = processBase64(audio);
      audioUrl = await uploadToS3(buffer, `chat-audio/${fileName}`, mimetype);
    }

    // 3. Find or Create Conversation
    let conversation;
    let receiverId = null;

    // Check if inputId is a valid User (DM)
    const potentialUser = await User.findById(inputId);

    if (potentialUser) {
      // It's a DM
      receiverId = inputId;
      conversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId], $size: 2 }, // strict size check to avoid grabbing group chats? Actually our schema separates them? 
        // We should add { isGroup: false } to be safe
        isGroup: false
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, receiverId],
          isGroup: false
        });
      }
    } else {
      // It might be a Group ID
      conversation = await Conversation.findById(inputId).populate("participants");
      if (!conversation) {
        return res.status(404).json({ message: "Conversation/User found" });
      }
      // Verify Sender is participant
      if (!conversation.participants.some(p => p._id.toString() === senderId)) {
        return res.status(403).json({ message: "Not a participant" });
      }
    }

    // 4. Create User Message
    const newMessage = new Message({
      conversationId: conversation._id,
      sender: senderId,
      text,
      image: imageUrl,
      audioUrl: audioUrl,
      duration: duration || 0, // Save duration
      isRead: false,
    });

    // 5. Update Conversation
    conversation.lastMessage = {
      text: text || (image ? "Sent an image" : "Sent a voice note"),
      sender: senderId,
      createdAt: new Date(),
    };

    await Promise.all([conversation.save(), newMessage.save()]);

    // 6. Socket Emission & Notification
    // Iterate through ALL participants (except sender)
    // If it's a group, participants are populated objects or IDs?
    // If we populated earlier (Group case), we have objects.
    // If DM, we didn't populate.

    // Let's rely on stored IDs.
    const recipientIds = conversation.participants.map(p => (p._id ? p._id.toString() : p.toString())).filter(id => id !== senderId);

    recipientIds.forEach(async (recipientId) => {
      // A. Socket
      const socketId = getReceiverSocketId(recipientId);
      if (socketId) {
        io.to(socketId).emit("newMessage", newMessage);
      }

      // B. Push Notification
      try {
        const userToNotify = await User.findById(recipientId);
        if (userToNotify && userToNotify.pushSubscriptions?.length > 0) {
          const title = conversation.isGroup
            ? `${conversation.groupName}: ${req.user.fullName}`
            : `New Message from ${req.user.fullName}`;

          const payload = JSON.stringify({
            title,
            body: decryptedText ? (decryptedText.length > 50 ? decryptedText.substring(0, 50) + "..." : decryptedText) : "Sent an attachment",
            url: `/`, // Deep link logic could be improved
            icon: "/logo.jpg"
          });
          sendPushToUser(userToNotify.pushSubscriptions, payload, userToNotify._id);
        }
      } catch (err) {
        console.error("Push failed for", recipientId, err);
      }
    });

    // 7. Send Response to Client
    res.status(201).json(newMessage);

    // ---------------------------------------------------------
    // 🚀 AI INTEGRATION LOGIC
    // ---------------------------------------------------------
    // Check if the receiver is the AI User ID AND we have an API Key
    if (receiverId === process.env.AI_USER_ID && text && process.env.GEMINI_API_KEY) {
      try {
        // Decrypt the user's message to get the actual prompt for AI
        const promptText = decryptMessage(text);
        if (!promptText) throw new Error("Failed to decrypt message for AI processing");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        let aiResponseText = "";

        try {
          // Fallback list based on available models for this specific API key
          const modelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-pro-latest"];
          let lastError = null;

          for (const modelName of modelsToTry) {
            try {
              console.log(`🤖 Attempting AI generation with model: ${modelName}`);
              const model = genAI.getGenerativeModel({ model: modelName });
              const result = await model.generateContent(promptText);
              aiResponseText = result.response.text();
              console.log(`✅ Success with ${modelName}`);
              break; // Success! Exit loop
            } catch (e) {
              console.warn(`⚠️ Model ${modelName} failed: ${e.message}`);
              lastError = e;
              // Continue to next model
            }
          }

          if (!aiResponseText && lastError) {
            throw lastError;
          }
        } catch (finalError) {
          throw finalError;
        }

        // Encrypt the AI's response before storing
        const encryptedAiResponse = encryptMessage(aiResponseText);

        // B. Create AI Message Object
        const aiMessage = new Message({
          conversationId: conversation._id,
          sender: receiverId, // AI is the sender
          text: encryptedAiResponse,
          isRead: false,
        });

        // C. Update Conversation again with AI's reply
        conversation.lastMessage = {
          text: encryptedAiResponse,
          sender: receiverId,
          createdAt: new Date(),
        };

        await Promise.all([conversation.save(), aiMessage.save()]);

        // D. Emit Socket Event (Send AI reply back to the User)
        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("newMessage", aiMessage);
        }

      } catch (aiError) {
        console.error("❌ All AI Models Failed:", aiError);

        const errorMessage = "I'm having trouble connecting to AI. Error: " + (aiError.message || "Unknown Error");
        const encryptedErrorMessage = encryptMessage(errorMessage);

        // Fallback message with debug info
        const fallbackMessage = new Message({
          conversationId: conversation._id,
          sender: receiverId,
          text: encryptedErrorMessage,
          isRead: false,
        });

        await fallbackMessage.save();
        conversation.lastMessage = {
          text: fallbackMessage.text,
          sender: receiverId,
          createdAt: new Date(),
        };
        await conversation.save();

        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("newMessage", fallbackMessage);
        }
      }
    }

  } catch (error) {
    console.error("Error in sendMessage controller:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- Controller: Get Messages ---
// --- Controller: Get Messages ---
export const getMessages = async (req, res) => {
  try {
    const { id: inputId } = req.params; // User ID or Group ID
    const senderId = req.user.id;

    let conversation;

    // Check if inputId is a Group (Conversation)
    // We can optimization: assume if it fails User check or based on prefix, but simplest is:
    // Try to find if inputId is a valid User to maintain backward compat for DMs
    const potentialUser = await User.findById(inputId);

    if (potentialUser) {
      // It's a DM, find conversation by participants
      conversation = await Conversation.findOne({
        participants: { $all: [senderId, inputId] },
        isGroup: false
      });
    } else {
      // It's likely a group ID
      conversation = await Conversation.findOne({
        _id: inputId,
        participants: senderId // Ensure user is in group
      });
    }

    if (!conversation) return res.status(200).json([]);

    const messages = await Message.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Controller: Mark as Read ---
export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const receiverId = req.user._id;

    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      return res.status(200).json({ message: "No conversation found, nothing to read." });
    }

    await Message.updateMany(
      { conversationId: conversation._id, sender: senderId, isRead: false },
      { $set: { isRead: true } },
    );

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesRead", {
        readBy: receiverId,
        conversationId: conversation._id
      });
    }

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    console.log("Error in markMessagesAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Controller: Transcribe Audio ---
export const transcribeAudio = async (req, res) => {
  try {
    const { audio } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "No audio data provided" });
    }

    // 1. Process Base64
    // We expect "data:audio/webm;base64,..."
    const { buffer, mimetype } = processBase64(audio);

    // 2. Prepare Gemini Prompt
    const prompt = "Generate a transcription of the audio file. Return ONLY the transcribed text, no explanation.";

    // 3. Call Gemini (Reusing our robust fallback logic)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Fallback list based on availablity
    const modelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-pro-latest"];
    let transcription = "";
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🎙️ Attempting transcription with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: mimetype
            }
          }
        ]);
        transcription = result.response.text();
        console.log(`✅ Transcription success with ${modelName}`);
        break;
      } catch (e) {
        console.warn(`⚠️ Model ${modelName} failed transcription: ${e.message}`);
        lastError = e;
      }
    }

    if (!transcription && lastError) {
      throw lastError; // Re-throw if all failed
    }

    res.status(200).json({ text: transcription.trim() });

  } catch (error) {
    console.error("Error in transcribeAudio controller:", error);
    res.status(500).json({ error: "Transcription failed", details: error.message });
  }
};