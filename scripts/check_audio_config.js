import { uploadToS3 } from "../lib/s3.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const processBase64 = (base64String) => {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error("Invalid base64 string");
    }
    const mimetype = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    const type = mimetype.split("/")[1];
    const fileName = `debug-audio-${Date.now()}.${type}`;
    return { buffer, fileName, mimetype };
};

async function testAudioPipeline() {
    console.log("🚀 Testing Audio Upload Pipeline...");

    // 1. Simulate Frontend Base64 (WebM Audio)
    // Small valid WebM header snippet (just enough to be recognized as not-empty, hopefully)
    // Or just random bytes, S3 doesn't care validation-wise, but we want to check Content-Type.
    const mockBase64 = "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRCh4ECGFOAZwEAAAAAAIxICAPAAAAAAAAREU2b66AAAAAA";

    try {
        const { buffer, fileName, mimetype } = processBase64(mockBase64);
        console.log(`parsed mime: ${mimetype}`);

        const url = await uploadToS3(buffer, `chat-audio/${fileName}`, mimetype);
        console.log(`✅ Uploaded to: ${url}`);

        // 2. Fetch Back to check Headers
        console.log("Fetching headers...");
        const res = await fetch(url, { method: "HEAD" });

        console.log(`Status: ${res.status}`);
        console.log(`Content-Type: ${res.headers.get("content-type")}`);
        console.log(`Content-Length: ${res.headers.get("content-length")}`);

        if (res.status === 200 && res.headers.get("content-type") === "audio/webm") {
            console.log("🎉 SUCCESS: File is public and has correct Content-Type.");
        } else {
            console.error("⚠️ FAILURE: Check status or content-type.");
        }

    } catch (e) {
        console.error("❌ Pipeline Failed:", e);
    }
}

testAudioPipeline();
