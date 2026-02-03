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

        // Find user
        const user = await User.findById(userId);
        if (user) {
            // Remove any existing subscription with the same endpoint to prevent duplicates
            user.pushSubscriptions = user.pushSubscriptions.filter(
                (sub) => sub.endpoint !== subscription.endpoint
            );

            // Add the new subscription
            user.pushSubscriptions.push(subscription);
            await user.save();

            console.log("Saved push subscription for user (duplicates removed):", userId);
            res.status(201).json({ message: "Subscribed to push notifications" });
        } else {
            res.status(404).json({ message: "User not found" });
        }
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
