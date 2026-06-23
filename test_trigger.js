const { io } = require("socket.io-client");

// Connect to the local Bridge
const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("[+] Test client connected. Simulating a phone call...");

    // Simulate the Android app sending a ringing event
    socket.emit("phone_ringing", {
        number: "+91-9876543210"
    });

    console.log("[+] Fake call sent! Check your laptop for a notification.");

    // Close the script after a brief delay
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

socket.on("connect_error", (err) => {
    console.error("[!] Connection Error:", err.message);
    process.exit(1);
});