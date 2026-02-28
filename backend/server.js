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

function startTimer(room, minutes, mode) {
    if (roomTimers[room]?.interval) clearInterval(roomTimers[room].interval);
    roomTimers[room] = {
        timeLeft: minutes * 60,
        mode: mode,
        interval: setInterval(() => {
            if (roomTimers[room].timeLeft > 0) {
                roomTimers[room].timeLeft--;
                io.to(room).emit('timer_update', { timeLeft: roomTimers[room].timeLeft, mode: roomTimers[room].mode });
            } else {
                clearInterval(roomTimers[room].interval);
                io.to(room).emit('timer_finished', { mode: roomTimers[room].mode });
            }
        }, 1000)
    };
}

io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        socket.join(data.room);
        console.log(`User ${data.name} joined ${data.room}`);
    });

    socket.on('set_timer', (data) => {
        startTimer(data.room, data.minutes, data.mode);
    });

    socket.on('distraction_attempt', (data) => {
        const room = data.room;
        const clients = io.sockets.adapter.rooms.get(room);
        const numVoters = (clients ? clients.size : 1) - 1;
        activeVotes[room] = { site: data.site, culprit: data.name, votes: [], required: numVoters > 0 ? numVoters : 1 };
        io.to(room).emit('vote_needed', { culprit: data.name, site: data.site });
    });

    socket.on('submit_vote', (data) => {
        const voteData = activeVotes[data.room];
        if (!voteData) return;
        voteData.votes.push(data.vote);
        if (voteData.votes.length >= voteData.required) {
            const avg = Math.round(voteData.votes.reduce((a, b) => a + b, 0) / voteData.required);
            if (avg > 0) {
                io.to(data.room).emit('exception_granted', { culprit: voteData.culprit, site: voteData.site, minutes: avg });
            } else {
                io.to(data.room).emit('session_failed', { culprit: voteData.culprit, site: voteData.site });
            }
            delete activeVotes[data.room];
        }
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Server running on port 3000');
});
