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

export const sendPushToUser = async (subscriptions, payload, userId = null) => {
    console.log("🔔 sendPushToUser called with", subscriptions?.length || 0, "subscriptions");

    if (!subscriptions || subscriptions.length === 0) {
        console.log("🔔 No subscriptions found, skipping push");
        return;
    }

    // Deduplicate subscriptions by endpoint
    const uniqueSubscriptions = [];
    const seenEndpoints = new Set();

    for (const sub of subscriptions) {
        if (!seenEndpoints.has(sub.endpoint)) {
            seenEndpoints.add(sub.endpoint);
            uniqueSubscriptions.push(sub);
        }
    }

    // If duplicates were found, update DB if userId is available
    if (uniqueSubscriptions.length < subscriptions.length) {
        console.log(`⚠️ Found ${subscriptions.length - uniqueSubscriptions.length} duplicate subscriptions. Cleaning up...`);
        if (userId) {
            try {
                await User.findByIdAndUpdate(userId, { pushSubscriptions: uniqueSubscriptions });
                console.log("✅ Database updated with unique subscriptions");
            } catch (error) {
                console.error("❌ Failed to clean up duplicate subscriptions:", error);
            }
        }
    }

    const notifications = uniqueSubscriptions.map((sub, index) => {
        return webpush.sendNotification(sub, payload)
            .then(() => {
                console.log(`✅ Push sent successfully to subscription ${index + 1}`);
            })
            .catch(async (err) => {
                console.error(`❌ Push failed for subscription ${index + 1}:`, err.statusCode, err.message);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log("Subscription expired/invalid (410/404). Removing from DB...");
                    try {
                        await User.updateOne(
                            { "pushSubscriptions.endpoint": sub.endpoint },
                            { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } }
                        );
                        console.log("🗑️ Removed dead subscription from DB");
                    } catch (dbErr) {
                        console.error("Failed to remove dead subscription:", dbErr);
                    }
                }
            });
    });

    await Promise.all(notifications);
    console.log("🔔 All push notifications processed");
};
