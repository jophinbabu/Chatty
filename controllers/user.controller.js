import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import fs from "fs";
import path from "path";

const logDebug = (msg) => {
  const logFile = path.join(process.cwd(), "backend_debug.log");
  fs.appendFileSync(logFile, `${new Date().toISOString()} - ${msg}\n`);
};

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const { search } = req.query;

    logDebug(`User=${loggedInUserId}, Search="${search || ''}"`);

    // Case 1: Global Search
    if (search) {
      logDebug("Executing Search...");
      const users = await User.find({
        _id: { $ne: loggedInUserId },
        fullName: { $regex: search, $options: "i" },
      }).select("-password");
      logDebug(`Found ${users.length} users matching search`);
      return res.status(200).json(users);
    }

    // Case 2: Recent Chats (Default)
    logDebug("Fetching Recent Conversations...");

    // Find conversations where the current user is a participant
    const conversations = await Conversation.find({
      participants: loggedInUserId,
    }).sort({ updatedAt: -1 });

    logDebug(`Found ${conversations.length} conversations`);

    // Extract the OTHER participant ID from each conversation
    const contactIds = [];
    conversations.forEach((conv) => {
      const otherParticipant = conv.participants.find(
        (id) => id.toString() !== loggedInUserId.toString()
      );
      if (otherParticipant) {
        contactIds.push(otherParticipant);
      }
    });

    // Fetch user details for these contacts
    // Use find().where('_id').in(contactIds) to get users
    // We want to preserve the order of conversations (most recent first)
    const contacts = await User.find({
      _id: { $in: contactIds },
    }).select("-password");

    // Re-sort contacts based on conversation order
    const contactMap = new Map(contacts.map(c => [c._id.toString(), c]));
    const sortedContacts = [];
    contactIds.forEach(id => {
      const contact = contactMap.get(id.toString());
      if (contact) sortedContacts.push(contact);
    });

    res.status(200).json(sortedContacts);


  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
