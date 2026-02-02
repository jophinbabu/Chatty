import CryptoJS from "crypto-js";

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || "default-secret-key-123";

export const encryptMessage = (text) => {
    if (!text) return text;
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

export const decryptMessage = (cipherText) => {
    if (!cipherText) return cipherText;
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText || cipherText;
    } catch (error) {
        // console.warn("Failed to decrypt message in backend:", error.message);
        return cipherText;
    }
};
