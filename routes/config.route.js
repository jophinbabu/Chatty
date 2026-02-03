import express from "express";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

router.get("/vapid-public-key", (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY || "BKoXL-qyfNqGnll4Pht0HwCWvzuWaDG5DEP4su9lOJ5FfpQysquPZskJXkaPoJGOxkbJxYkX3uf8krKXk7yEEEk";
    res.status(200).json({ publicKey });
});

export default router;
