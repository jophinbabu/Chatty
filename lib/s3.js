import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

export const uploadToS3 = async (fileBuffer, path, mimetype) => {
    const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: path,
        Body: fileBuffer,
        ContentType: mimetype, // Important for browser to display it correctly
    };

    try {
        await s3Client.send(new PutObjectCommand(uploadParams));
        // Return the standard public URL
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${path}`;
    } catch (error) {
        console.error("S3 Upload Error:", error);
        throw error;
    }
};
