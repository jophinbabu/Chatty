import webpush from "web-push";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

// Configure VAPID (Will be set once we get the keys)
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || "BKoXL-qyfNqGnll4Pht0HwCWvzuWaDG5DEP4su9lOJ5FfpQysquPZskJXkaPoJGOxkbJxYkX3uf8krKXk7yEEEk";
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "4R1E_k3_79r-KQGDsVnkgNRPuDWhrqBoWzsywVEg18Q";

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        "mailto:example@yourdomain.org",
        publicVapidKey,
        privateVapidKey
    );
}

export const sendPushToUser = async (subscriptions, payload) => {
    if (!subscriptions || subscriptions.length === 0) return;

    const notifications = subscriptions.map((sub) => {
        return webpush.sendNotification(sub, payload).catch((err) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription is gone, remove it from DB (fire and forget cleanup)
                // We need the User ID to remove it properly? Or just by sub match?
                // Updating requires User ID context if doing $pull, but we passed "subscriptions" array only.
                // For robust cleanup, we might need to handle this differently, but for now log it.
                console.log("Subscription expired/invalid: ", err.statusCode);
            } else {
                console.error("Error sending push:", err);
            }
        });
    });

    await Promise.all(notifications);
};
