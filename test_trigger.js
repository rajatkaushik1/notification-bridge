const { io } = require("socket.io-client");

// Connect to the local Bridge
const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("[+] Test client connected. Simulating an incoming phone call...");

    // Simulate the Android app sending a ringing event
    const payload = {
        number: "+91-9876543210",
        contactName: "Alex Rivera (Work)",
        status: "Ringing",
        message: "Incoming Mobile Call",
        tag: "Work"
    };

    socket.emit("phone_ringing", payload);

    console.log("[+] Fake call sent!", payload);
    console.log("[*] Check your laptop for a notification and check your web dashboard / history log!");

    // Close the script after a brief delay
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

socket.on("connect_error", (err) => {
    console.error("[!] Connection Error:", err.message);
    process.exit(1);
});