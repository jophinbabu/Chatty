import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import { uploadToS3 } from "../lib/s3.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// --- AI Configuration ---
let model;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
} else {
  console.warn("⚠️ GEMINI_API_KEY is missing. AI features will not work.");
}

// --- Helper: Process Base64 ---
const processBase64 = (base64String) => {
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 string");
  }

  const mimetype = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");
  const type = mimetype.split("/")[1];
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1000)}.${type}`;

  return { buffer, fileName, mimetype };
};

// --- Controller: Send Message ---
export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio } = req.body;
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
    }

    // 7. Send Response to Client
    res.status(201).json(newMessage);

    // ---------------------------------------------------------
    // 🚀 AI INTEGRATION LOGIC
    // ---------------------------------------------------------
    // Check if the receiver is the AI User ID (Set this in your .env)
    if (receiverId === process.env.AI_USER_ID && text && model) {
      try {
        // A. Generate AI Response
        const result = await model.generateContent(text);
        const aiResponseText = result.response.text();

        // B. Create AI Message Object
        const aiMessage = new Message({
          conversationId: conversation._id,
          sender: receiverId, // AI is the sender
          text: aiResponseText,
          isRead: false,
        });

        // C. Update Conversation again with AI's reply
        conversation.lastMessage = {
          text: aiResponseText,
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
        console.error("❌ AI Generation Failed:", aiError);
        // Optional: Send a fallback message if AI fails
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
      return res.status(404).json({ message: "Conversation not found" });
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