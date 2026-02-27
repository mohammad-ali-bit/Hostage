document.addEventListener('DOMContentLoaded', () => {
    // Connect to the backend server immediately for checks and events
    const socket = io('http://localhost:3000');
    let currentRoomCode = null;

    // DOM Elements
    const authView = document.getElementById('auth-view');
    const hubView = document.getElementById('hub-view');
    const roomStatus = document.getElementById('roomStatus');

    // Auth
    const userNameInput = document.getElementById('userName');
    const roomCodeInput = document.getElementById('roomCode');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');

    // Hub
    const userList = document.getElementById('active-hostages-list');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    // Voting Modal
    const votingModal = document.getElementById('votingModal');
    const voteModalText = document.getElementById('voteModalText');
    const btnVoteYes = document.getElementById('btnVoteYes');
    const btnVoteNo = document.getElementById('btnVoteNo');

    // Auto-Join from URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlName = urlParams.get('name');
    const urlRoom = urlParams.get('room');

    if (urlName && urlRoom) {
        currentRoomCode = urlRoom;
        socket.emit('join_room', { name: urlName, room: urlRoom });
    }

    // Join logic with Validation
    function attemptRoom(action) {
        const name = userNameInput.value.trim();
        const room = roomCodeInput.value.trim().toUpperCase();

        if (!name || !room) {
            alert('Please enter both name and room code.');
            return;
        }

        socket.emit('check_room', { action, roomCode: room }, (response) => {
            if (response.success) {
                currentRoomCode = room;
                socket.emit('join_room', { name, room });
            } else {
                alert(response.error);
            }
        });
    }

    createRoomBtn.addEventListener('click', () => attemptRoom('create'));
    joinRoomBtn.addEventListener('click', () => attemptRoom('join'));

    socket.on('connect', () => {
        console.log('Connected to server!');
    });

    socket.on('joined_successfully', (data) => {
        authView.style.display = 'none';
        hubView.style.display = 'flex'; // This now overrides the 'display: none' in CSS

        const roomDisplay = document.getElementById('room-display');
        if (roomDisplay) {
            roomDisplay.textContent = `Room: ${data.room}`;
            roomDisplay.style.color = 'var(--success-color)';
        }

        // Link the Excalidraw iframe securely to the synced room code
        const excalidrawFrame = document.getElementById('excalidrawFrame');
        if (excalidrawFrame) {
            excalidrawFrame.src = `https://excalidraw.com/#room=${data.room}`;
        }
    });

    // 1. Sync User Roster
    socket.on('room_users_update', (users) => {
        userList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.className = `user-item ${user.isLeader ? 'leader' : ''}`;
            li.innerHTML = `
                    <span style="font-size: 18px;">${user.isLeader ? '👑' : '👤'}</span>
                    ${user.name}
                `;
            userList.appendChild(li);
        });
    });

    // 1.5 Sync Chat History
    socket.on('history_load', (history) => {
        history.forEach(msg => {
            appendMessage(msg.name, msg.message, msg.time);
        });
    });

    // 2. Chat Sync
    socket.on('chat_message', (payload) => {
        appendMessage(payload.name, payload.message, payload.time);
    });

    // 3. Voting System
    socket.on('vote_needed', (data) => {
        console.log('Vote needed for:', data.siteTitle);
        votingModal.style.display = 'flex';
        voteModalText.textContent = `${data.culprit} wants to watch: ${data.siteTitle}. Allow?`;

        // Reset buttons
        btnVoteYes.style.opacity = '1';
        btnVoteYes.style.pointerEvents = 'auto';
        btnVoteNo.style.opacity = '1';
        btnVoteNo.style.pointerEvents = 'auto';
    });

    socket.on('exception_granted', (data) => {
        votingModal.style.display = 'none';
        appendSystemMessage(`Exception Granted: ${data.culprit} received a 10-minute pass.`);
    });

    socket.on('session_failed', (data) => {
        votingModal.style.display = 'none';
        appendSystemMessage(`🚨 SESSION FAILED: ${data.culprit} distracted the room via ${data.site}!`);
        document.body.style.animation = 'pulse-intense 0.8s infinite';
        setTimeout(() => { document.body.style.animation = ''; }, 3000);
    });

    // Chat functionality
    function sendMessage() {
        if (!socket || !currentRoomCode) return;
        const msg = chatInput.value.trim();
        if (msg) {
            socket.emit('chat_message', { room: currentRoomCode, message: msg });
            chatInput.value = '';
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    function appendMessage(name, message, time) {
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `
            <div class="message-header">${name} • ${time}</div>
            <div class="message-body">${message}</div>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'message system';
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Vote passing
    function submitVote(voteValue) {
        if (socket && currentRoomCode) {
            socket.emit('submit_vote', { room: currentRoomCode, vote: voteValue });
            voteModalText.textContent = `Vote cast. Waiting for room consensus...`;
            btnVoteYes.style.opacity = '0.5';
            btnVoteYes.style.pointerEvents = 'none';
            btnVoteNo.style.opacity = '0.5';
            btnVoteNo.style.pointerEvents = 'none';
        }
    }

    btnVoteYes.addEventListener('click', () => submitVote('yes'));
    btnVoteNo.addEventListener('click', () => submitVote('no'));
});
