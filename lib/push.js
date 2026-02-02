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
    console.log("🔔 sendPushToUser called with", subscriptions?.length || 0, "subscriptions");

    if (!subscriptions || subscriptions.length === 0) {
        console.log("🔔 No subscriptions found, skipping push");
        return;
    }

    const notifications = subscriptions.map((sub, index) => {
        console.log(`🔔 Sending push to subscription ${index + 1}:`, sub.endpoint?.substring(0, 50) + "...");
        return webpush.sendNotification(sub, payload)
            .then(() => {
                console.log(`✅ Push sent successfully to subscription ${index + 1}`);
            })
            .catch((err) => {
                console.error(`❌ Push failed for subscription ${index + 1}:`, err.statusCode, err.message);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log("Subscription expired/invalid: ", err.statusCode);
                }
            });
    });

    await Promise.all(notifications);
    console.log("🔔 All push notifications processed");
};
