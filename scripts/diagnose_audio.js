// Comprehensive Audio Diagnostic Script
// Tests: S3 access, CORS, file integrity

const testUrl = "https://chat-app-storage-jophin-2026.s3.ap-south-1.amazonaws.com/chat-audio/1769923670362-890.webm";
const origin = "http://localhost:5173";

async function diagnose() {
    console.log("=== AUDIO PLAYBACK DIAGNOSTIC ===\n");
    console.log(`Testing URL: ${testUrl}`);
    console.log(`Origin: ${origin}\n`);

    // Test 1: Basic HEAD request with Origin header
    console.log("--- Test 1: CORS Headers Check ---");
    try {
        const headRes = await fetch(testUrl, {
            method: "HEAD",
            headers: { "Origin": origin }
        });

        console.log(`Status: ${headRes.status}`);
        console.log(`Content-Type: ${headRes.headers.get("content-type")}`);
        console.log(`Content-Length: ${headRes.headers.get("content-length")}`);
        console.log(`Access-Control-Allow-Origin: ${headRes.headers.get("access-control-allow-origin") || "MISSING!"}`);

        if (headRes.headers.get("access-control-allow-origin")) {
            console.log("✅ CORS header present");
        } else {
            console.log("❌ CORS header MISSING - this will block browser playback!");
        }
    } catch (e) {
        console.log(`❌ HEAD request failed: ${e.message}`);
    }

    // Test 2: OPTIONS preflight (what browser does)
    console.log("\n--- Test 2: Preflight OPTIONS Check ---");
    try {
        const optionsRes = await fetch(testUrl, {
            method: "OPTIONS",
            headers: {
                "Origin": origin,
                "Access-Control-Request-Method": "GET"
            }
        });

        console.log(`Status: ${optionsRes.status}`);
        console.log(`Access-Control-Allow-Origin: ${optionsRes.headers.get("access-control-allow-origin") || "MISSING!"}`);
        console.log(`Access-Control-Allow-Methods: ${optionsRes.headers.get("access-control-allow-methods") || "MISSING!"}`);

    } catch (e) {
        console.log(`❌ OPTIONS request failed: ${e.message}`);
    }

    // Test 3: Actual GET request
    console.log("\n--- Test 3: GET File Content ---");
    try {
        const getRes = await fetch(testUrl, {
            method: "GET",
            headers: { "Origin": origin }
        });

        console.log(`Status: ${getRes.status}`);
        const buffer = await getRes.arrayBuffer();
        console.log(`Downloaded bytes: ${buffer.byteLength}`);

        if (buffer.byteLength > 0) {
            // Check if it starts with WebM header
            const header = new Uint8Array(buffer.slice(0, 4));
            const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`File header (hex): ${headerHex}`);

            // WebM files start with 0x1A 0x45 0xDF 0xA3 (EBML header)
            if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
                console.log("✅ Valid WebM file header detected");
            } else {
                console.log("⚠️ Did not detect standard WebM header - file may be corrupted or wrong format");
            }
        } else {
            console.log("❌ File is empty!");
        }
    } catch (e) {
        console.log(`❌ GET request failed: ${e.message}`);
    }

    console.log("\n=== DIAGNOSIS COMPLETE ===");
}

diagnose();
