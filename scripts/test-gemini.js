import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API KEY found!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-1.0-pro"
];

async function testModels() {
    console.log("Testing Gemini Models with API Key:", apiKey.substring(0, 10) + "...");

    for (const modelName of modelsToTest) {
        console.log(`\n--- Testing Model: ${modelName} ---`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello, are you working?");
            const response = await result.response;
            console.log(`✅ SUCCESS! Model '${modelName}' is working.`);
            console.log("Response:", response.text());
            return; // Exit after finding first working model
        } catch (error) {
            console.error(`❌ FAILED '${modelName}':`, error.message.split('\n')[0]);
        }
    }
    console.log("\n❌ All models failed.");
}

testModels();
