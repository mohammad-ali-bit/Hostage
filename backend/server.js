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
const activeVotes = {}; // Maps roomCode -> { culprit, siteTitle, yesVotes, noVotes, totalVoters, timer }
const chatHistory = {}; // Maps roomCode -> Array of message objects

// Serve the frontend web app statically from /frontend-web
app.use(express.static(__dirname + '/../frontend-web'));

io.on('connection', (socket) => {
    console.log(`[+] User Connected: ${socket.id}`);

    // 0. Check Room Existence Before Joining
    socket.on('check_room', (data, callback) => {
        const exists = io.sockets.adapter.rooms.has(data.roomCode);
        if (data.action === 'create') {
            callback({ success: !exists, error: exists ? 'Room already exists!' : null });
        } else if (data.action === 'join') {
            callback({ success: exists, error: !exists ? 'Room not found!' : null });
        }
    });

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

        // Initialize chat history tracking for this room if missing
        if (!chatHistory[data.room]) {
            chatHistory[data.room] = [];
        }

        // Send limited history directly to the joining socket (last 50 messages)
        const roomHistory = chatHistory[data.room];
        socket.emit('history_load', roomHistory.slice(-50));

        // Broadcast updated user list to everyone in the room
        broadcastRoomUsers(data.room);
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

    // 3. Request Exception (Voting) Event
    socket.on('request_exception', (data) => {
        const culpritName = roomUsers[socket.id] || data.name || "A PARTNER";
        const roomCode = data.room;

        if (activeVotes[roomCode]) {
            console.log(`[Vote] Vote already in progress for room ${roomCode}. Ignoring new request.`);
            return;
        }

        // Calculate total voters currently in the room using Socket.io adapter
        const roomSockets = io.sockets.adapter.rooms.get(roomCode);
        const totalVoters = roomSockets ? roomSockets.size : 1;

        console.log(`[Vote] Exception requested in room ${roomCode} by ${culpritName} for ${data.siteTitle}. Total voters: ${totalVoters}`);

        activeVotes[roomCode] = {
            culprit: culpritName,
            siteTitle: data.siteTitle,
            url: data.url,
            yesVotes: 0,
            noVotes: 0,
            totalVoters: totalVoters,
            votedSockets: new Set(),
            timer: setTimeout(() => {
                // If the 30 seconds run out without a majority, the session fails
                if (activeVotes[roomCode]) {
                    console.log(`[Vote] Timeout in room ${roomCode}. Session Failed.`);
                    io.to(roomCode).emit('session_failed', { site: data.url, culprit: culpritName });
                    delete activeVotes[roomCode];
                }
            }, 30000)
        };

        // Broadcast to everyone to start the voting UI
        io.to(roomCode).emit('vote_needed', { culprit: culpritName, siteTitle: data.siteTitle });
    });

    // 4. Submit Vote Event
    socket.on('submit_vote', (payload) => {
        // payload: { room: 'CODE', vote: 'yes' | 'no' }
        const voteSession = activeVotes[payload.room];

        if (!voteSession) return;
        if (voteSession.votedSockets.has(socket.id)) return; // Prevent double voting

        voteSession.votedSockets.add(socket.id);

        if (payload.vote === 'yes') voteSession.yesVotes++;
        else voteSession.noVotes++;

        console.log(`[Vote] Room ${payload.room}: Yes(${voteSession.yesVotes}) No(${voteSession.noVotes}) / Total(${voteSession.totalVoters})`);

        // Check if a majority threshold is hit
        const majority = Math.floor(voteSession.totalVoters / 2) + 1;

        if (voteSession.yesVotes >= majority) {
            console.log(`[Vote] Exception GRANTED in room ${payload.room}`);
            clearTimeout(voteSession.timer);
            io.to(payload.room).emit('exception_granted', { culprit: voteSession.culprit });
            delete activeVotes[payload.room];
        }
        else if (voteSession.noVotes >= majority || (voteSession.yesVotes + voteSession.noVotes === voteSession.totalVoters)) {
            // If 'No' hits majority, or everyone voted but 'Yes' didn't win
            console.log(`[Vote] Exception REJECTED in room ${payload.room}. Session Failed.`);
            clearTimeout(voteSession.timer);
            io.to(payload.room).emit('session_failed', { site: voteSession.url, culprit: voteSession.culprit });
            delete activeVotes[payload.room];
        }
    });

    // 5. Chat Message Event (Web App Integration)
    socket.on('chat_message', (payload) => {
        // payload: { room: 'CODE', message: 'Hello' }
        const senderName = roomUsers[socket.id] || "Unknown";

        const messageData = {
            name: senderName,
            message: payload.message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Persist message to room history
        if (!chatHistory[payload.room]) {
            chatHistory[payload.room] = [];
        }
        chatHistory[payload.room].push(messageData);

        // Broadcast using io.in to ensure all clients in room receive it
        io.in(payload.room).emit('chat_message', messageData);
    });

    // 6. Hard Distraction Detected (Legacy / Fallback)
    socket.on('distraction_detected', (data) => {
        const culpritName = roomUsers[socket.id] || data.culprit || "A PARTNER";
        io.to(data.room).emit('session_failed', { site: data.site, culprit: culpritName });
        console.log(`[🚨 ALERT] Hard Distraction in room ${data.room} by ${culpritName}! Emitting 'session_failed'.`);
    });

    socket.on('disconnect', () => {
        console.log(`[-] User Disconnected: ${socket.id}`);
        const userName = roomUsers[socket.id];
        delete roomUsers[socket.id];

        // Find which rooms this socket was in to broadcast the disconnect
        // (Socket.io automatically removes them from rooms upon disconnect, so we check leaders/manual state)
        for (const [room, leaderId] of Object.entries(roomLeaders)) {
            // Clean up leader roles if the leader disconnects
            if (leaderId === socket.id) {
                delete roomLeaders[room];
                console.log(`[Room] Leader left room ${room}. Room is effectively orphaned.`);
            }
            // Always try to broadcast a user list update for any room they might have been in
            broadcastRoomUsers(room);
        }
    });
});

// Helper Function: Broadcast active users in a room
function broadcastRoomUsers(roomCode) {
    const roomSockets = io.sockets.adapter.rooms.get(roomCode);
    if (!roomSockets) return; // Room is empty

    const currentUsers = [];
    for (const sid of roomSockets) {
        if (roomUsers[sid]) {
            currentUsers.push({ id: sid, name: roomUsers[sid], isLeader: roomLeaders[roomCode] === sid });
        }
    }

    io.to(roomCode).emit('room_users_update', currentUsers);
    console.log(`[Room Sync] Broadcasted ${currentUsers.length} users to room ${roomCode}`);
}

// Setup Basic Healthcheck Route
app.get('/health', (req, res) => {
    res.send('Hostage WebSocket Server is Running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Hostage Backend listening on port ${PORT}`);
});
