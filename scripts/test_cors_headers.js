
// Native fetch is available in Node.js 18+

// URL from the user's error log
const fileUrl = "https://chat-app-storage-jophin-2026.s3.ap-south-1.amazonaws.com/chat-audio/1769923670362-890.webm";
const origin = "http://localhost:5173";

async function checkCors() {
    console.log(`Checking CORS for: ${fileUrl}`);
    console.log(`Simulating Origin: ${origin}`);

    try {
        const response = await fetch(fileUrl, {
            method: "HEAD",
            headers: {
                "Origin": origin,
                "Access-Control-Request-Method": "GET"
            }
        });

        console.log("--- Response Headers ---");
        const acao = response.headers.get("access-control-allow-origin");
        console.log(`Access-Control-Allow-Origin: ${acao || "(MISSING)"}`);
        console.log(`Content-Type: ${response.headers.get("content-type")}`);

        if (acao === origin || acao === "*") {
            console.log("\n✅ SUCCESS: S3 is correctly returning CORS headers.");
            console.log("Suggestion: clear browser cache or use cache-busting.");
        } else {
            console.log("\n❌ FAILURE: S3 is NOT returning the correct CORS header.");
            console.log("Possible reasons: Bucket config hasn't propagated, wrong Origin in config, or wrong bucket.");
        }

    } catch (e) {
        console.error("Error making request:", e.message);
    }
}

checkCors();
