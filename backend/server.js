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
                roomUsers[room].splice(index, 1);
                const names = roomUsers[room].map(u => u.name);
                io.to(room).emit('room_users', names);
                io.to(room).emit('room_users_update', names);
            }
        }
    });

    socket.on('check_room', (data) => {
        const exists = existingRooms.has(data.roomCode);
        socket.emit('room_status', { exists: exists, action: data.action });
    });

    socket.on('create_room', (data) => {
        if (existingRooms.has(data.room)) {
            socket.emit('error', 'Room already exists!');
        } else {
            existingRooms.add(data.room);
            socket.join(data.room);
            if (!roomUsers[data.room]) roomUsers[data.room] = [];
            roomUsers[data.room].push({ id: socket.id, name: data.name });
            const names = roomUsers[data.room].map(u => u.name);
            io.to(data.room).emit('room_users', names);
            io.to(data.room).emit('room_users_update', names);
            startTimer(data.room, data.workMins, 'work');
            socket.emit('joined_successfully', { room: data.room, name: data.name });
            console.log(`[JOIN] create_room: socket=${socket.id} name=${data.name} room=${data.room} roomSize=${io.sockets.adapter.rooms.get(data.room)?.size}`);
        }
    });

    socket.on('join_existing_room', (data) => {
        if (!existingRooms.has(data.room)) {
            socket.emit('error', 'Room does not exist!');
        } else {
            socket.join(data.room);
            if (!roomUsers[data.room]) roomUsers[data.room] = [];
            roomUsers[data.room].push({ id: socket.id, name: data.name });
            const names = roomUsers[data.room].map(u => u.name);
            io.to(data.room).emit('room_users', names);
            io.to(data.room).emit('room_users_update', names);
            socket.emit('joined_successfully', { room: data.room, name: data.name });
            console.log(`[JOIN] join_existing_room: socket=${socket.id} name=${data.name} room=${data.room} roomSize=${io.sockets.adapter.rooms.get(data.room)?.size}`);
        }
    });

    socket.on('join_room', (data) => {
        socket.join(data.room);
        if (!roomUsers[data.room]) roomUsers[data.room] = [];
        if (!roomUsers[data.room].find(u => u.id === socket.id)) {
            roomUsers[data.room].push({ id: socket.id, name: data.name });
            const names = roomUsers[data.room].map(u => u.name);
            io.to(data.room).emit('room_users', names);
            io.to(data.room).emit('room_users_update', names);
        }
        console.log(`[JOIN] join_room (extension): socket=${socket.id} name=${data.name} room=${data.room} roomSize=${io.sockets.adapter.rooms.get(data.room)?.size}`);
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
