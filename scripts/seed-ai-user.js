import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const seedAIUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB for seeding...");

        const aiEmail = "gemini@ai.com"; // Fixed email for the AI

        let aiUser = await User.findOne({ email: aiEmail });

        if (!aiUser) {
            console.log("AI User not found. Creating...");
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash("ai-secure-password-" + Date.now(), salt);

            aiUser = await User.create({
                fullName: "Gemini AI",
                email: aiEmail,
                password: hashedPassword,
                profilePic: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg" // Generic Gemini Logo found online or use a placeholder
            });
            console.log("AI User created successfully!");
        } else {
            console.log("AI User already exists.");
        }

        const fs = await import('fs');
        fs.writeFileSync('ai_user_id.txt', aiUser._id.toString());

        console.log("\n==================================================");
        console.log("ADD THIS TO YOUR .env FILE:");
        console.log(`AI_USER_ID=${aiUser._id.toString()}`);
        console.log("==================================================\n");

        process.exit(0);
    } catch (error) {
        console.error("Error seeding AI user:", error);
        process.exit(1);
    }
};

seedAIUser();
