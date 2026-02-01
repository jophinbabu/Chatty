import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    console.log(`Listing Models...`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        fs.writeFileSync("models.json", JSON.stringify(data, null, 2));
        console.log("Wrote models to models.json");

    } catch (e) {
        console.error("Fetch error:", e);
    }
}

listModels();
