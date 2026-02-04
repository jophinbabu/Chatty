// models/PendingUser.js
import mongoose from "mongoose";

const pendingUserSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        otp: {
            type: String,
            required: true,
        },
        otpExpires: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

// TTL index to auto-delete documents after 1 hour of creation
pendingUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model("PendingUser", pendingUserSchema);
