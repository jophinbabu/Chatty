import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getUsersForSidebar } from "../controllers/user.controller.js";

const router = express.Router();

// Only authenticated users can see the user list
router.get("/", protect, getUsersForSidebar);

export default router;
