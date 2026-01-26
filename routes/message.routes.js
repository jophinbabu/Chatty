import express from "express";
import {
  sendMessage,
  getMessages,
  markMessagesAsRead,
} from "../controllers/message.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get chat history between current user and user with :id
router.get("/:id", protect, getMessages);

// Send a message to user with :id
router.post("/send/:id", protect, sendMessage);
router.put("/read/:id", protect, markMessagesAsRead);

export default router;
