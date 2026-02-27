const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io and allow CORS (essential for browser extension connections)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Real-time Event Handling
const roomUsers = {}; // Maps socket.id -> name
const roomLeaders = {}; // Maps roomCode -> socket.id of the creator

io.on('connection', (socket) => {
    console.log(`[+] User Connected: ${socket.id}`);

    // 1. Join Room Event
    socket.on('join_room', (data) => {
        // data should be an object: { name: 'Player', room: 'CODE' }
        if (typeof data === 'string') data = { room: data, name: 'Unknown' };

        socket.join(data.room);
        roomUsers[socket.id] = data.name;

        let isLeader = false;

        // If this room has no leader yet, the first person to join becomes the leader
        if (!roomLeaders[data.room]) {
            roomLeaders[data.room] = socket.id;
            isLeader = true;
        }

        console.log(`[Room] Socket ${socket.id} (${data.name}) joined room: ${data.room} as ${isLeader ? 'Leader' : 'Participant'}`);

        // Notify the client that they successfully joined, explicitly injecting their assigned role
        socket.emit('joined_successfully', { ...data, isLeader });
    });

    // 2. Start Session Event
    socket.on('start_timer', (payload) => {
        // payload should be { room: 'CODE', minutes: 50 }

        // Only the assigned leader can broadcast the start timer command
        if (roomLeaders[payload.room] === socket.id) {
            // Broadcast to everyone currently in the room that the timer started
            io.to(payload.room).emit('timer_started', { minutes: payload.minutes });
            console.log(`[Timer] Session started in room: ${payload.room} for ${payload.minutes} minutes`);
        } else {
            console.warn(`[Security] Unauthorized timer start attempt by ${socket.id} in room ${payload.room}`);
        }
    });

    // 3. Distraction Detected Event
    socket.on('distraction_detected', (data) => {
        // Fallback: If it came from the popup, use roomUsers. If from background worker, use data.culprit
        const culpritName = roomUsers[socket.id] || data.culprit || "A PARTNER";

        // Broadcast failure to EVERYONE in this exact room
        io.to(data.room).emit('session_failed', { site: data.site, culprit: culpritName });
        console.log(`[🚨 ALERT] Distraction detected in room ${data.room} by ${culpritName} on site ${data.site}! Emitting 'session_failed'.`);
    });

    socket.on('disconnect', () => {
        console.log(`[-] User Disconnected: ${socket.id}`);
        delete roomUsers[socket.id];

        // Clean up leader roles if the leader disconnects
        for (const [room, leaderId] of Object.entries(roomLeaders)) {
            if (leaderId === socket.id) {
                delete roomLeaders[room];
                console.log(`[Room] Leader left room ${room}. Room is effectively orphaned.`);
            }
        }
    });
});

// Setup Basic Healthcheck Route
app.get('/', (req, res) => {
    res.send('Hostage WebSocket Server is Running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Hostage Backend listening on port ${PORT}`);
});
