import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function testGemini() {
    console.log("Testing Gemini API...");
    console.log("API Key present:", !!process.env.GEMINI_API_KEY);

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ No API Key found in .env");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Try Flash first
        console.log("Attempting with model: gemini-1.5-flash");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Test");
            console.log("✅ Success with gemini-1.5-flash! Response:", result.response.text());
            return;
        } catch (e) {
            console.log("❌ Failed with gemini-1.5-flash. Error status:", e.status, e.statusText);
            // console.log(JSON.stringify(e, null, 2));
        }

        // Try Pro as fallback
        console.log("Attempting with model: gemini-pro");
        const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
        const resultPro = await modelPro.generateContent("Test");
        console.log("✅ Success with gemini-pro! Response:", resultPro.response.text());

    } catch (error) {
        console.error("❌ Fatal Error testing Gemini:");
        console.log(JSON.stringify(error, null, 2));
    }
}

testGemini();
