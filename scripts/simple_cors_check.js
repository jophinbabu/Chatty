// Simple CORS check
const testUrl = "https://chat-app-storage-jophin-2026.s3.ap-south-1.amazonaws.com/chat-audio/1769923670362-890.webm";

async function check() {
    const res = await fetch(testUrl, {
        method: "HEAD",
        headers: { "Origin": "http://localhost:5173" }
    });

    console.log("Status:", res.status);
    console.log("CORS Header:", res.headers.get("access-control-allow-origin") || "MISSING");
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Content-Length:", res.headers.get("content-length"));
}

check().catch(console.error);
