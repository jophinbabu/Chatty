import Conversation from "../models/Conversation.js";
import { io, getReceiverSocketId } from "../socket/socket.js";

export const createGroup = async (req, res) => {
    try {
        const { name, members } = req.body;
        const adminId = req.user._id;

        if (!name || !members || members.length < 2) {
            return res.status(400).json({ message: "Group must have a name and at least 2 other members." });
        }

        // Add admin to members if not already included (frontend might send just the others)
        // We expect 'members' to be an array of User IDs.
        const allParticipants = [...new Set([...members, adminId])];

        const newGroup = new Conversation({
            participants: allParticipants,
            isGroup: true,
            groupName: name,
            groupAdmin: adminId,
            groupImage: "", // Could calculate a default or handle upload later
            lastMessage: {
                text: `Group "${name}" created`,
                sender: adminId,
                createdAt: new Date(),
            }
        });

        await newGroup.save();

        // Populate participants to return full user objects (consistent with other endpoints)
        const populatedGroup = await Conversation.findById(newGroup._id).populate("participants", "-password");

        // Socket Emission: Notify all members that they've been added to a group
        allParticipants.forEach(memberId => {
            // Don't notify the admin (sender) via socket if they just created it, 
            // but usually the frontend updates immediately. The admin IS in the list so we can emit to them too.
            const socketId = getReceiverSocketId(memberId);
            if (socketId) {
                io.to(socketId).emit("newGroup", populatedGroup);
            }
        });

        res.status(201).json(populatedGroup);

    } catch (error) {
        console.error("Error in createGroup:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getGroups = async (req, res) => {
    try {
        const userId = req.user._id;
        const groups = await Conversation.find({
            participants: userId,
            isGroup: true
        }).populate("participants", "-password").sort({ updatedAt: -1 });

        res.status(200).json(groups);
    } catch (error) {
        console.error("Error in getGroups:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
