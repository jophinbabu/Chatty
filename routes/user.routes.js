import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getUsersForSidebar } from "../controllers/user.controller.js";

const router = express.Router();

// Only authenticated users can see the user list
// Only authenticated users can see the user list
router.get("/", protect, getUsersForSidebar);

import { subscribeToNotifications, unsubscribeFromNotifications } from "../controllers/notification.controller.js";
router.post("/subscribe", protect, subscribeToNotifications);
router.post("/unsubscribe", protect, unsubscribeFromNotifications);

export default router;
