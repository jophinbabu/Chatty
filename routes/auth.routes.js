// routes/auth.routes.js
import express from "express";
import { checkAuth, login, logout, signup, updateProfile, verifyEmail } from "../controllers/auth.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/logout", logout);
router.put("/update-profile", protect, updateProfile);
router.get("/check", protect, checkAuth);
export default router;
