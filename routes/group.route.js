import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createGroup, getGroups } from "../controllers/group.controller.js";

const router = express.Router();

router.post("/create", protectRoute, createGroup);
router.get("/", protectRoute, getGroups);

export default router;
