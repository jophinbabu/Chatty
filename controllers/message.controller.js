import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
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
    const { id: receiverId } = req.params;
    const senderId = req.user.id;

    let imageUrl = null;
    let audioUrl = null;

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
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
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

    // 6. Socket Emission (To Human Receiver)
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    } else {
      // 🚀 SEND PUSH NOTIFICATION (If user is offline / socket disconnected)
      // Note: We can send it ALWAYS, or just when receiverSocketId is null.
      // Usually "Background" implies socket is disconnected, so this is the right place.
      // BUT, some mobile browsers kill sockets aggressively even if "open".
      // Let's safe bet: Send push if socket is missing OR always?
      // "Always" might double-notify if app is open.
      // "Else" is safer for "Background" only requirement.

      try {
        const receiver = await User.findById(receiverId);
        if (receiver && receiver.pushSubscriptions && receiver.pushSubscriptions.length > 0) {
          const payload = JSON.stringify({
            title: `New Message from ${req.user.fullName}`,
            body: text || "Sent a file", // Note: text is encrypted in DB but req.body is what we got. Wait, logic above ENCRYPTS it? No, controller receives PLAIN (usually) or ENCRYPTED?
            // Wait, front-end encrypts NOW. So `req.body.text` IS ENCRYPTED.
            // We need to either send "You have a new message" (privacy safe)
            // or decrypt it if we want to show content.
            // Since we don't have the key on backend (Wait, we DO have it for AI),
            // we CAN decrypt it.
            // Let's decrypt for the notification body (User experience).
            // decryptMessage is imported
            // const decryptedText = decryptMessage(text);
            // body: decryptedText || "You have a new message",
            // Actually, let's keep it simple and privacy-preserving first.
            body: "You have a new encrypted message",
            url: `/`, // Open app root or specific chat
            icon: "/logo.jpg"
          });

          // We need web-push setup here.
          // Ideally this should be a helper function to avoid clutter.
          // But I'll inline for now or import.
          sendPushToUser(receiver.pushSubscriptions, payload);
        }
      } catch (pushErr) {
        console.error("Push notification failed:", pushErr);
      }
    }

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
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const senderId = req.user.id;

    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, userToChatId] },
    });

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