require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

// Allow cross-origin requests so your Python script, Android app, and dashboard can connect
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Initialize Database on startup
db.initDB().catch(err => {
    console.error('[!] Database initialization error:', err);
});

io.on('connection', (socket) => {
    console.log(`[+] New client connected: ${socket.id}`);

    // Listen for a 'phone_ringing' event from the Android app via Socket.IO
    socket.on('phone_ringing', async (data) => {
        console.log(`[!] Call incoming via Socket.IO! Broadcasting to laptop... Data:`, data);

        const callRecord = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7),
            message: data?.message || "Incoming Call",
            number: data?.number || "Unknown Number",
            contactName: data?.contactName || "Unknown Contact",
            status: data?.status || "Ringing",
            timestamp: new Date().toISOString(),
            notes: data?.notes || "",
            tag: data?.tag || "General"
        };

        // Save persistently in Database (SQLite / Postgres)
        try {
            await db.insertCall(callRecord);
        } catch (err) {
            console.error('[!] DB Save Error:', err.message);
        }

        // Broadcast the event to all connected clients
        io.emit('trigger_laptop_notification', callRecord);
    });

    socket.on('disconnect', () => {
        console.log(`[-] Client disconnected: ${socket.id}`);
    });
});

// HTTP Webhook Endpoint: Easy trigger from mobile apps (MacroDroid, Tasker, Automate, Shortcuts)
app.post('/api/call', async (req, res) => {
    const { number, contactName, message, status, notes, tag } = req.body;

    const callRecord = {
        id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7),
        message: message || "Incoming Call",
        number: number || "Unknown Number",
        contactName: contactName || "Unknown Contact",
        status: status || "Ringing",
        timestamp: new Date().toISOString(),
        notes: notes || "",
        tag: tag || "General"
    };

    console.log(`[!] Incoming Call triggered via HTTP Webhook! Caller: ${callRecord.number}`);

    // Save persistently in Database
    try {
        await db.insertCall(callRecord);
    } catch (err) {
        console.error('[!] DB Save Error:', err.message);
    }

    // Broadcast to laptop Python script and web dashboard
    io.emit('trigger_laptop_notification', callRecord);

    res.status(200).json({ success: true, record: callRecord });
});

// Get all stored call history from Database
app.get('/api/history', async (req, res) => {
    try {
        const history = await db.getCalls(500);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get calls received since a timestamp (Offline Missed Calls Catch-up)
app.get('/api/missed', async (req, res) => {
    try {
        const { since } = req.query;
        if (!since) return res.json([]);
        const missed = await db.getCallsSince(since);
        res.json(missed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update notes or tag for a specific call record
app.patch('/api/history/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { notes, tag } = req.body;
        const updated = await db.updateCall(id, notes, tag);
        if (updated) {
            return res.json({ success: true, record: updated });
        }
        res.status(404).json({ success: false, message: 'Record not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a single call or clear history
app.delete('/api/history/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.deleteCall(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// A simple health-check endpoint
app.get('/health', (req, res) => {
    res.send('CallBridge PRO Database Server is running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});