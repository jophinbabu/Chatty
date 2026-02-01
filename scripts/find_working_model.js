import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function findWorkingModel() {
    if (!process.env.GEMINI_API_KEY) {
        console.error("No API KEY");
        return;
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const candidates = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite-preview-02-05",
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-1.5-pro-001",
        "gemini-1.5-pro-002",
        "gemini-1.0-pro",
        "gemini-pro",
        "gemini-pro-vision"
    ];

    console.log("Searching for a working model...");

    const workingModels = [];

    for (const modelName of candidates) {
        try {
            // console.log(`Testing ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            await model.generateContent("Hi");
            console.log(`✅ MATCH FOUND: ${modelName}`);
            workingModels.push(modelName);
        } catch (e) {
            if (e.status === 429) {
                console.log(`⚠️  ${modelName}: QUOTA EXCEEDED (Valid Model)`);
                workingModels.push(modelName); // It exists, just busy
            } else if (e.status === 404) {
                console.log(`❌ ${modelName}: NOT FOUND`);
            } else {
                console.log(`❌ ${modelName}: ERROR ${e.status || e.message}`);
            }
        }
    }

    console.log("\n--- SUMMARY ---");
    if (workingModels.length > 0) {
        console.log("Use one of these models in your controller:");
        workingModels.forEach(m => console.log(`- "${m}"`));
    } else {
        console.log("NO WORKING MODELS FOUND. Check API Key permissions.");
    }
}

findWorkingModel();
