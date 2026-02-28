const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const path = require('path');
// Serve all files from the frontend-web folder
app.use(express.static(path.join(__dirname, '../frontend-web')));

// Ensure that navigating to the root loads index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend-web/index.html'));
});

const roomTimers = {};
const activeVotes = {};
const existingRooms = new Set();
const roomUsers = {};

function startTimer(room, minutes, mode) {
    if (roomTimers[room]?.interval) clearInterval(roomTimers[room].interval);
    roomTimers[room] = {
        timeLeft: minutes * 60,
        mode: mode,
        interval: setInterval(() => {
            if (roomTimers[room].timeLeft > 0) {
                roomTimers[room].timeLeft--;
                io.to(room).emit('timer_update', { timeLeft: roomTimers[room].timeLeft, mode: roomTimers[room].mode });
                if (roomTimers[room].mode === 'break' && roomTimers[room].timeLeft === 30) {
                    io.to(room).emit('break_warning');
                }
            } else {
                clearInterval(roomTimers[room].interval);
                const nextMode = roomTimers[room].mode === 'work' ? 'break' : 'work';
                const nextMins = nextMode === 'break' ? 5 : 25;
                io.to(room).emit('chat_message', { name: '🚨 SYSTEM', message: `Session over! Auto-starting ${nextMins}m ${nextMode}...` });
                startTimer(room, nextMins, nextMode); // Auto-start the next phase
            }
        }, 1000)
    };
}

io.on('connection', (socket) => {
    socket.on('disconnect', () => {
        for (const room in roomUsers) {
            const index = roomUsers[room].findIndex(u => u.id === socket.id);
            if (index !== -1) {
                const wasLeader = roomUsers[room][index].isLeader;
                roomUsers[room].splice(index, 1);
                // Reassign leader if the host leaves
                if (wasLeader && roomUsers[room].length > 0) roomUsers[room][0].isLeader = true;
                io.to(room).emit('room_users_update', roomUsers[room]);
            }
        }
    });

    socket.on('check_room', (data) => {
        const roomCode = (data.roomCode || data.room || '').toUpperCase();
        const exists = existingRooms.has(roomCode);
        socket.emit('room_status', { exists: exists, action: data.action });
    });

    socket.on('create_room', (data) => {
        const roomCode = (data.room || '').toUpperCase();
        if (existingRooms.has(roomCode)) {
            socket.emit('error', 'Room already exists!');
        } else {
            existingRooms.add(roomCode);
            socket.join(roomCode);
            // Add user as leader
            roomUsers[roomCode] = [{ name: data.name, isLeader: true, id: socket.id }];

            startTimer(roomCode, data.workMins || 25, 'work');
            socket.emit('joined_successfully', { room: roomCode, name: data.name });
            io.to(roomCode).emit('room_users_update', roomUsers[roomCode]);
        }
    });

    socket.on('join_existing_room', (data) => {
        const roomCode = (data.room || '').toUpperCase();
        if (!existingRooms.has(roomCode)) {
            socket.emit('error', 'Room does not exist!');
        } else {
            socket.join(roomCode);
            if (!roomUsers[roomCode]) roomUsers[roomCode] = [];
            // Add user as regular member
            roomUsers[roomCode].push({ name: data.name, isLeader: roomUsers[roomCode].length === 0, id: socket.id });

            socket.emit('joined_successfully', { room: roomCode, name: data.name });
            io.to(roomCode).emit('room_users_update', roomUsers[roomCode]);
        }
    });

    socket.on('chat_message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.to(data.room).emit('chat_message', { name: data.name, message: data.message, time: time });
    });

    socket.on('join_room', (data) => {
        const roomCode = (data.room || '').toUpperCase();
        socket.join(roomCode);
    });

    socket.on('set_timer', (data) => {
        startTimer(data.room, data.minutes, data.mode);
    });

    socket.on('distraction_attempt', (data) => {
        // FORCE UPPERCASE to match the web app's formatting
        const room = (data.room || '').toUpperCase();
        const participants = io.sockets.adapter.rooms.get(room);
        // Required votes is everyone in the room except the person who triggered the block.
        const requiredVotes = (participants ? participants.size : 1) - 1;

        activeVotes[room] = {
            site: data.site,
            culprit: data.name,
            votes: [],
            required: requiredVotes > 0 ? requiredVotes : 1 // Ensure at least 1 vote is needed
        };
        console.log(`VOTE START: Room ${room} needs ${activeVotes[room].required} votes for ${data.name}`);

        // MATCH FRONTEND KEY: use 'siteTitle' instead of 'site', and revert emit key to vote_needed
        io.to(room).emit('vote_needed', { culprit: data.name, siteTitle: data.site });
    });

    socket.on('submit_vote', (data) => {
        const room = (data.room || '').toUpperCase();
        const v = activeVotes[room];
        if (!v) return;

        v.votes.push(Number(data.vote));

        if (v.votes.length >= v.required) {
            const sum = v.votes.reduce((a, b) => a + b, 0);
            const avg = Math.round(sum / v.required);

            if (avg > 0) {
                console.log(`VOTE COMPLETE: Avg ${avg} mins. Result: Success`);
                io.to(room).emit('vote_passed', { mins: avg, culprit: v.culprit, site: v.site });
            } else {
                console.log(`VOTE COMPLETE: Avg ${avg} mins. Result: Fail`);
                io.to(room).emit('vote_shamed', { culprit: v.culprit, site: v.site });
            }
            delete activeVotes[room];
        }
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Server running on port 3000');
});
