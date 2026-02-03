import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { createGroup, getGroups } from "../controllers/group.controller.js";

const router = express.Router();

router.post("/create", protect, createGroup);
router.get("/", protect, getGroups);

export default router;
