document.addEventListener('DOMContentLoaded', () => {
    // Connect to the backend server immediately for checks and events
    const SERVER_URL = 'http://10.17.46.239:3000';
    const socket = io(SERVER_URL);
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
        if (Notification.permission !== 'granted') Notification.requestPermission();
        authView.style.display = 'none';
        hubView.style.display = 'flex'; // This now overrides the 'display: none' in CSS

        const roomDisplay = document.getElementById('room-display');
        if (roomDisplay) {
            roomDisplay.textContent = `Room: ${data.room}`;
            roomDisplay.style.color = 'var(--success-color)';
        }

        appendSystemMessage('👑 HOST SECRETS: Type /block [domain.com], /unblock [domain.com], /work [mins], or /break [mins] in chat to manage distractions and time.');

        // Link the Excalidraw iframe securely to the synced room code
        const excalidrawFrame = document.getElementById('excalidrawFrame');
        if (excalidrawFrame) {
            excalidrawFrame.src = `https://excalidraw.com/#room=${data.room}`;
        }

    });

    socket.on('timer_update', (data) => {
        const display = document.getElementById('pomodoro-display');
        if (!display) return;

        const mins = Math.floor(data.timeLeft / 60).toString().padStart(2, '0');
        const secs = (data.timeLeft % 60).toString().padStart(2, '0');

        display.innerText = data.mode.toUpperCase() + ': ' + mins + ':' + secs;
        display.style.color = data.mode === 'break' ? '#22c55e' : '#ef4444'; // Green for break, Red for work
    });

    socket.on('break_warning', () => {
        // Re-use our Toast notification logic
        const toastBox = document.getElementById('toast-container');
        if (toastBox) {
            const toast = document.createElement('div');
            toast.style.cssText = 'background: #1e1e24; border-left: 5px solid #f59e0b; color: white; padding: 15px 20px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 10000;';
            toast.innerHTML = '<strong style="color: #f59e0b;">⚠️ BREAK ENDING</strong><br>30s left! Close your distractions now.';
            toastBox.appendChild(toast);
            setTimeout(() => toast.remove(), 8000);
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
    // 2. Chat Sync & Magic Whiteboard Sync
    // 2. Chat Sync & Magic Whiteboard Sync
    socket.on('chat_message', (payload) => {

        if (payload.message && payload.message.includes('excalidraw.com/#room=')) {
            const exactUrl = payload.message.match(/(https:\/\/[^\s]+)/)[0];
            const panel = document.getElementById('excalidraw-container');

            if (panel) {
                // 1. Physically empty the panel
                panel.innerHTML = '';

                // 2. Construct a sleek, dark-mode div overlay
                const overlay = document.createElement('div');
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = '#1e1e24';
                overlay.style.color = 'white';
                overlay.style.padding = '40px';
                overlay.style.boxSizing = 'border-box';
                overlay.style.textAlign = 'center';

                overlay.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 20px; animation: pulse 2s infinite;">🔴</div>
                    <h2 style="margin: 0 0 10px 0; color: #fdfdfd;">LIVE SESSION ACTIVE</h2>
                    <p style="color: #aaa; margin-bottom: 30px; font-size: 16px; max-width: 400px;">A synchronized whiteboard session has been started by a peer. Due to browser security, it must be opened in a dedicated window.</p>
                `;

                // 3. Create the prominent launch button
                const btn = document.createElement('button');
                btn.textContent = 'Launch Collaborative Board';
                btn.className = 'btn-lock'; // Reuse our primary button style
                btn.style.padding = '15px 30px';
                btn.style.fontSize = '16px';
                btn.style.backgroundColor = 'var(--accent-color)';
                btn.style.width = 'auto'; // Don't full-width it here

                // 4. Bind the new tab launch logic
                btn.addEventListener('click', () => {
                    window.open(exactUrl, '_blank');
                });

                overlay.appendChild(btn);

                // 5. Inject it into the page
                panel.appendChild(overlay);
            }

            payload.message = "🎨 <i>Whiteboard session launched!</i>";
        }

        // Append the message to the chat
        appendMessage(payload.name, payload.message, payload.time);
    });

    socket.on('vote_needed', (data) => {
        appendSystemMessage('⚖️ VOTE TRIGGERED: ' + data.culprit + ' is trying to access ' + data.siteTitle + '!');

        // 1. Play a clean, synthetic audible ping (requires no external MP3 files)
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine'; // Smooth beep sound
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch (A5)
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Keep volume reasonable
            oscillator.start();
            setTimeout(() => oscillator.stop(), 300);
        } catch (e) { console.log("Audio play failed", e); }

        // 2. Start flashing the browser tab title
        if (!window.flashInterval) {
            let isFlash = false;
            const originalTitle = "Hostage Study Hub";
            window.flashInterval = setInterval(() => {
                document.title = isFlash ? "🚨 VOTE NEEDED! 🚨" : originalTitle;
                isFlash = !isFlash;
            }, 1000);
        }

        const toastBox = document.getElementById('toast-container');
        if (toastBox) {
            const toast = document.createElement('div');
            toast.style.cssText = 'background: #1e1e24; border-left: 5px solid #ef4444; color: white; padding: 15px 20px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif; transition: opacity 0.3s;';
            toast.innerHTML = '<strong style="color: #ef4444;">🚨 DEMOCRATIC EXCEPTION</strong><br><span style="font-size: 0.9em;">' + data.culprit + ' is trying to access ' + data.siteTitle + '</span>';
            toastBox.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        }

        const modal = document.getElementById('votingModal');
        const text = document.getElementById('voteModalText');
        const btnSubmit = document.getElementById('btnSubmitVote');

        if (modal && text) {
            modal.style.display = 'flex';
            text.textContent = data.culprit + ' wants to watch: ' + data.siteTitle + '. Allow?';
            if (btnSubmit) {
                btnSubmit.style.opacity = '1';
                btnSubmit.style.pointerEvents = 'auto';
                btnSubmit.textContent = 'Cast Vote';
                document.getElementById('voteMinutes').value = '';
            }
        }
    });

    socket.on('exception_granted', (data) => {
        votingModal.style.display = 'none';
        appendSystemMessage('⚖️ CONSENSUS REACHED: ' + data.culprit + ' was granted ' + data.minutes + ' minutes for ' + data.site + ' strictly.');
    });

    socket.on('session_failed', (data) => {
        votingModal.style.display = 'none';
        appendSystemMessage(`🚨 SESSION FAILED: ${data.culprit} distracted the room via ${data.site}!`);

        document.body.style.animation = 'pulse-intense 0.8s infinite';
        setTimeout(() => { document.body.style.animation = ''; }, 3000);

        // Inject the offender into the Wall of Shame
        addShameCard(data.culprit, data.site);
    });

    function addShameCard(name, siteUrl) {
        const shameList = document.getElementById('shame-list');
        const emptyShame = document.getElementById('empty-shame');
        if (!shameList) return;

        // Remove the empty placeholder if it exists
        if (emptyShame) emptyShame.remove();

        // Clean the URL for display
        let cleanSite = siteUrl;
        try { cleanSite = new URL(siteUrl).hostname.replace('www.', ''); } catch (e) { }

        // Generate a unique robot avatar based on the user's name
        const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;

        // Create and prepend the card
        const card = document.createElement('div');
        card.style.cssText = 'background: #2a0808; border: 1px solid #ef4444; border-radius: 8px; padding: 10px; text-align: center; width: 110px; box-shadow: 0 4px 6px rgba(0,0,0,0.5);';

        card.innerHTML = `
            <img src="${avatarUrl}" alt="DP" style="width: 50px; height: 50px; border-radius: 50%; background: #222; margin-bottom: 8px; border: 2px solid #ef4444;">
            <div style="font-weight: bold; color: white; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</div>
            <div style="color: #ef4444; font-size: 11px; margin-top: 5px; word-wrap: break-word;">Caught on:<br><strong>${cleanSite}</strong></div>
        `;

        shameList.prepend(card);
    }

    function sendMessage() {
        if (!socket || !currentRoomCode) return;
        const msg = chatInput.value.trim();
        if (msg) {
            if (msg.startsWith('/block ')) {
                socket.emit('update_blacklist', { room: currentRoomCode, action: 'blocked', site: msg.split(' ')[1] });
                chatInput.value = '';
                return;
            }
            if (msg.startsWith('/unblock ')) {
                socket.emit('update_blacklist', { room: currentRoomCode, action: 'unblocked', site: msg.split(' ')[1] });
                chatInput.value = '';
                return;
            }
            if (msg.trim().startsWith('/work') || msg.trim().startsWith('/break')) {
                const parts = msg.trim().split(' ');
                const command = parts[0].substring(1);
                const mins = parseInt(parts[1]) || (command === 'work' ? 25 : 5);

                // CRITICAL: Ensure currentRoomCode is correctly defined in your scope
                if (currentRoomCode) {
                    socket.emit('set_timer', {
                        room: currentRoomCode,
                        mode: command,
                        minutes: mins
                    });
                } else {
                    console.error("No room code found. Cannot start timer.");
                }
                chatInput.value = '';
                return;
            }
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

    document.getElementById('btnSubmitVote').addEventListener('click', () => {
        const minsInput = document.getElementById('voteMinutes').value;
        const mins = parseInt(minsInput) || 0; // Default to 0 (reject) if empty
        socket.emit('submit_vote', { room: currentRoomCode, vote: mins });

        // Hide modal and show waiting status in chat
        document.getElementById('votingModal').style.display = 'none';
        appendSystemMessage('⏳ Vote cast (' + mins + ' mins). Waiting for room consensus...');

        // Stop flashing tab title and reset
        if (window.flashInterval) {
            clearInterval(window.flashInterval);
            window.flashInterval = null;
            document.title = "Hostage Study Hub";
        }
    });
});
