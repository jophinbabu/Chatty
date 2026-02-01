import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkModels() {
    if (!process.env.GEMINI_API_KEY) {
        console.error("No API KEY");
        return;
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const candidates = [
        "gemini-1.5-pro",
        "gemini-1.5-pro-latest",
        "gemini-1.0-pro",
        "gemini-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b"
    ];

    console.log("Checking models availability...");

    for (const modelName of candidates) {
        try {
            // process.stdout.write(`Testing ${modelName}... `);
            const model = genAI.getGenerativeModel({ model: modelName });
            await model.generateContent("Hi");
            console.log(`${modelName}: ✅ AVAILABLE`);
        } catch (e) {
            if (e.status === 429) {
                console.log(`${modelName}: ⚠️  QUOTA EXCEEDED (Exists but busy)`);
            } else if (e.status === 404) {
                console.log(`${modelName}: ❌ NOT FOUND`);
            } else {
                console.log(`${modelName}: ❓ ERROR ${e.status} ${e.message}`);
            }
        }
    }
}

checkModels();
