import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const dropIndex = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const collections = await db.listCollections({ name: "users" }).toArray();

        if (collections.length > 0) {
            await db.collection("users").dropIndex("username_1");
            console.log("Successfully dropped index: username_1");
        } else {
            console.log("Collection 'users' not found.");
        }

        process.exit(0);
    } catch (error) {
        if (error.codeName === "IndexNotFound") {
            console.log("Index 'username_1' already dropped or doesn't exist.");
        } else {
            console.error("Error dropping index:", error);
        }
        process.exit(1);
    }
};

dropIndex();
