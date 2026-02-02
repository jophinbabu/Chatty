import User from "../models/User.js";

// Save a new subscription
export const subscribeToNotifications = async (req, res) => {
    try {
        const { subscription } = req.body;
        const userId = req.user._id;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ message: "Invalid subscription data" });
        }

        console.log("Received push subscription:", subscription);

        // Add subscription to user if it doesn't exist
        await User.findByIdAndUpdate(userId, {
            $addToSet: { pushSubscriptions: subscription },
        });

        console.log("Saved push subscription for user:", userId);

        res.status(201).json({ message: "Subscribed to push notifications" });
    } catch (error) {
        console.error("Error subscribing to notifications:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Remove a subscription (optional for now, but good practice)
export const unsubscribeFromNotifications = async (req, res) => {
    try {
        const { endpoint } = req.body;
        const userId = req.user._id;

        await User.findByIdAndUpdate(userId, {
            $pull: { pushSubscriptions: { endpoint } },
        });

        res.status(200).json({ message: "Unsubscribed from push notifications" });
    } catch (error) {
        console.error("Error unsubscribing from notifications:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
