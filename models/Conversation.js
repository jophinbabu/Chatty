// models/Conversation.js
import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessage: {
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: Date,
    },
    isGroup: { type: Boolean, default: false },
    groupName: { type: String },
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    groupImage: { type: String },
  },
  { timestamps: true },
);

// Indexing for performance
conversationSchema.index({ participants: 1 });

export default mongoose.model("Conversation", conversationSchema);
