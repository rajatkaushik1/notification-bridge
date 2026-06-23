const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Allow cross-origin requests so your Python script and Android app can connect
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`[+] New client connected: ${socket.id}`);

    // Listen for a 'phone_ringing' event from the Android app
    socket.on('phone_ringing', (data) => {
        console.log(`[!] Call incoming! Broadcasting to laptop... Data:`, data);

        // Broadcast the event to all other connected clients (the laptop)
        socket.broadcast.emit('trigger_laptop_notification', {
            message: "Incoming Call",
            number: data?.number || "Unknown Number",
            timestamp: new Date().toISOString()
        });
    });

    socket.on('disconnect', () => {
        console.log(`[-] Client disconnected: ${socket.id}`);
    });
});

// A simple health-check endpoint for Render/Koyeb deployments
app.get('/', (req, res) => {
    res.send('WebSocket Bridge is running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});