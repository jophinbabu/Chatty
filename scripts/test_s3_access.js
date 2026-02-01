import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function testS3() {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;
    const fileName = `test-access-${Date.now()}.txt`;
    const fileContent = "Hello S3 Public Access";

    console.log(`Bucket: ${bucketName}`);
    console.log(`Region: ${region}`);

    // 1. Upload
    try {
        console.log("Uploading test file...");
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: fileContent,
            ContentType: "text/plain"
        }));
        console.log("✅ Upload successful.");
    } catch (e) {
        console.error("❌ Upload failed:", e.message);
        return;
    }

    // 2. Access
    const url = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
    console.log(`Testing access to: ${url}`);

    try {
        const res = await fetch(url);
        console.log(`Status Code: ${res.status}`);
        if (res.status === 200) {
            console.log("✅ File is PUBLICLY accessible.");
            const text = await res.text();
            console.log(`Content: "${text}"`);
        } else if (res.status === 403) {
            console.error("❌ 403 Forbidden. Bucket is PRIVATE.");
        } else {
            console.error(`❌ Returned status ${res.status}`);
        }
    } catch (e) {
        console.error("❌ Fetch failed:", e.message);
    }
}

testS3();
