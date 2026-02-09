// test_report.js
const io = require("socket.io-client");

// 1. Connect to your Backend
const socket = io("http://localhost:5001");

const SESSION_ID = "test-session-dev-1";

console.log("🔌 Connecting to backend...");

socket.on("connect", () => {
    console.log("✅ Connected! ID:", socket.id);

    // 2. Start a Fake Session
    console.log("🚀 Starting Fake Session...");
    socket.emit("start_voice_interview", { sessionId: SESSION_ID });

    // 3. Simulate Fake Conversation (Wait 1s to ensure session is created)
    setTimeout(() => {
        console.log("🗣️ Sending Fake Chat History...");
        // User says something smart
        socket.emit("user_speak", { 
            text: "I am a software engineer with 4 years of experience in React and Node.js. I understand that a HashMap uses a key-value pair system for O(1) retrieval.", 
            sessionId: SESSION_ID 
        });
    }, 1000);

    // 4. Simulate Fake Coding Result (Wait 3s for AI to reply to chat)
    setTimeout(() => {
        console.log("💾 Sending Fake Coding Score...");
        socket.emit("submit_code_result", { 
            sessionId: SESSION_ID, 
            result: { 
                score: 100, 
                verdict: "Accepted", 
                feedback: "Excellent solution.", 
                improvements: ["None"] 
            } 
        });
    }, 4000);

    // 5. Trigger the Report Card (Wait 5s)
    setTimeout(() => {
        console.log("🏁 Requesting Final Report Card...");
        socket.emit("end_interview", { sessionId: SESSION_ID });
    }, 6000);
});

// --- LISTEN FOR RESULTS ---

socket.on("feedback_processing", (data) => {
    console.log("⏳ Backend Status:", data.message);
});

socket.on("interview_results", (report) => {
    console.log("\n========================================");
    console.log("🎉 REPORT CARD RECEIVED!");
    console.log("========================================");
    console.dir(report, { depth: null }); // Print full JSON object
    console.log("========================================");
    
    // Check if it worked
    if (report.score > 0) {
        console.log("✅ SUCCESS: You got a score!");
    } else {
        console.log("❌ FAIL: Score is still 0. Check Backend Logs.");
    }
    
    process.exit(0);
});

socket.on("error", (err) => {
    console.error("❌ Error:", err);
});