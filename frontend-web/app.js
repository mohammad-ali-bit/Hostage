document.addEventListener('DOMContentLoaded', () => {
    if (Notification.permission !== 'granted') Notification.requestPermission();

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
    let myName = null;

    // Lobby Logic Overhaul
    const urlParams = new URLSearchParams(window.location.search);
    const autoName = urlParams.get('name');
    const autoRoom = urlParams.get('room');
    const autoAction = urlParams.get('action');

    if (autoName && autoRoom) {
        currentRoomCode = autoRoom.toUpperCase();
        if (autoAction === 'create') {
            const work = parseInt(urlParams.get('work')) || 25;
            const breakMins = parseInt(urlParams.get('break')) || 5;
            socket.emit('create_room', { room: currentRoomCode, name: autoName, workMins: work, breakMins: breakMins });
        } else {
            socket.emit('join_existing_room', { room: currentRoomCode, name: autoName });
        }
    } else {
        authView.style.display = 'flex';
        hubView.style.display = 'none';
    }

    joinRoomBtn.innerText = 'Join Study Space';
    createRoomBtn.innerText = 'Start New Session';

    joinRoomBtn.onclick = () => {
        const room = prompt("Enter Room ID to join:");
        if (!room) return;
        const name = prompt("Enter your Name:");
        if (!name) return;
        currentRoomCode = room.toUpperCase();
        socket.emit('join_existing_room', { room: currentRoomCode, name: name });
    };

    createRoomBtn.onclick = () => {
        const name = prompt("Enter your Name:");
        if (!name) return;
        const workMins = parseInt(prompt("Enter Work Mins (e.g., 25):")) || 25;
        const breakMins = parseInt(prompt("Enter Break Mins (e.g., 5):")) || 5;
        currentRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        socket.emit('create_room', { room: currentRoomCode, name: name, workMins: workMins, breakMins: breakMins });
    };

    socket.on('error', (msg) => alert(msg));

    socket.on('room_users', (users) => {
        const userList = document.getElementById('active-hostages-list');
        if (userList) userList.innerHTML = users.map(u => `<li style="margin-bottom: 5px;">👤 ${u}</li>`).join('');
    });


    socket.on('connect', () => {
        console.log('Connected to server!');
    });

    socket.on('joined_successfully', (data) => {
        myName = data.name;
        if (Notification.permission !== 'granted') Notification.requestPermission();
        authView.style.display = 'none';
        hubView.style.display = 'flex'; // This now overrides the 'display: none' in CSS

        const roomDisplay = document.getElementById('room-display');
        if (roomDisplay) {
            roomDisplay.textContent = `Room: ${data.room} `;
            roomDisplay.style.color = 'var(--success-color)';

            const editBtn = document.createElement('button');
            editBtn.innerText = "✏️ Edit Profile";
            editBtn.style.marginLeft = "10px";
            editBtn.style.padding = "4px 8px";
            editBtn.style.fontSize = "12px";
            editBtn.style.background = "#3b82f6";
            editBtn.style.color = "white";
            editBtn.style.border = "none";
            editBtn.style.borderRadius = "4px";
            editBtn.style.cursor = "pointer";
            editBtn.onclick = () => {
                const newName = prompt("Enter new name:", data.name);
                const newRoom = prompt("Enter new Room ID:", data.room);
                if (newName && newRoom) window.location.search = `?name=${newName}&room=${newRoom}`;
            };
            roomDisplay.appendChild(editBtn);
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
        const ul = document.getElementById('active-hostages-list');
        if (!ul) return;
        ul.innerHTML = '';
        users.forEach(name => {
            const li = document.createElement('li');
            li.style.marginBottom = '5px';
            li.textContent = '\uD83D\uDC64 ' + name;
            ul.appendChild(li);
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
        console.log('[VOTE_NEEDED] Received:', data);
        const modal = document.getElementById('votingModal');
        if (modal) {
            modal.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 99999 !important; position: fixed !important; top: 0; left: 0; width: 100%; height: 100%; align-items: center; justify-content: center; background: rgba(0,0,0,0.8);";
            document.getElementById('voteModalText').textContent = data.culprit + " is on " + data.siteTitle + ". Allow?";

            const btnSubmit = document.getElementById('btnSubmitVote');
            if (btnSubmit) {
                btnSubmit.style.display = 'block';
                btnSubmit.style.opacity = '1';
                btnSubmit.style.pointerEvents = 'auto';
                btnSubmit.textContent = 'Cast Vote';
            }
            const voteMinutes = document.getElementById('voteMinutes');
            if (voteMinutes) { voteMinutes.style.display = ''; voteMinutes.value = ''; }
        }

        // TRIGGER BROWSER NOTIFICATION
        if (Notification.permission === 'granted') {
            new Notification("🚨 VOTE TRIGGERED", { body: data.culprit + " is distracted!", icon: "image_3.png" });
        }

        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.connect(gain);
            gain.connect(context.destination);
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.1, context.currentTime);
            osc.start();
            setTimeout(() => osc.stop(), 200);
        } catch (e) { console.error('Audio failed', e); }
    });

    socket.on('vote_passed', (data) => {
        document.getElementById('votingModal').style.display = 'none';
        try { appendSystemMessage('⚖️ CONSENSUS REACHED: ' + data.culprit + ' was granted ' + data.mins + ' minutes for ' + data.site + ' strictly.'); } catch (e) { }
    });

    socket.on('vote_shamed', (data) => {
        document.getElementById('votingModal').style.display = 'none';

        console.log("SHAME CARD TRIGGERED for: " + data.culprit);
        addShameCard(data.culprit, data.site);

        document.body.style.animation = 'pulse-intense 0.8s infinite';
        setTimeout(() => { document.body.style.animation = ''; }, 3000);

        try { appendSystemMessage('🚨 SESSION FAILED: ' + data.culprit + ' distracted the room via ' + data.site + '!'); } catch (e) { }
    });

    function addShameCard(name, siteUrl) {
        const shameList = document.getElementById('shame-list');
        const emptyShame = document.getElementById('empty-shame');
        if (!shameList) return;

        if (emptyShame) emptyShame.remove();

        let cleanSite = siteUrl;
        try { cleanSite = new URL(siteUrl).hostname.replace('www.', ''); } catch (e) { }

        const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;

        const card = document.createElement('div');
        card.style.cssText = `
            background: linear-gradient(145deg, #1a0505, #2a0808);
            border: 2px solid #ef4444;
            border-radius: 6px;
            padding: 12px;
            text-align: center;
            width: 140px;
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
            position: relative;
            overflow: hidden;
            animation: slideInShame 0.5s cubic-bezier(0.25, 1, 0.5, 1);
            margin-bottom: 10px;
        `;

        card.innerHTML = `
            <div style="background: #ef4444; color: white; font-weight: 900; font-size: 14px; letter-spacing: 2px; margin: -12px -12px 10px -12px; padding: 4px 0; border-bottom: 2px solid #991b1b; text-shadow: 1px 1px 0 #000;">BUSTED</div>
            <div style="background: repeating-linear-gradient(0deg, #333, #333 2px, #222 2px, #222 15px); padding: 5px; border-radius: 4px; margin-bottom: 8px; border: 1px solid #000;">
                <img src="${avatarUrl}" alt="Mugshot" style="width: 60px; height: 60px; border-radius: 4px; background: #ddd; filter: grayscale(30%) contrast(120%); border: 2px solid #111;">
            </div>
            <div style="font-weight: 900; color: #fff; font-size: 15px; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px;">${name}</div>
            <div style="color: #fca5a5; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Crime:</div>
            <div style="color: #ef4444; font-size: 12px; font-weight: bold; word-wrap: break-word; background: #000; padding: 2px; border-radius: 3px;">${cleanSite}</div>
        `;

        // Inject dynamic animation keyframes if they don't exist
        if (!document.getElementById('shame-animations')) {
            const style = document.createElement('style');
            style.id = 'shame-animations';
            style.innerHTML = `
                @keyframes slideInShame {
                    0% { transform: scale(0.8) translateY(-20px) rotate(-5deg); opacity: 0; }
                    50% { transform: scale(1.05) rotate(2deg); }
                    100% { transform: scale(1) translateY(0) rotate(0deg); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

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

    document.getElementById('btnSubmitVote').onclick = () => {
        const val = document.getElementById('voteMinutes').value;
        const mins = parseInt(val) || 0;

        if (currentRoomCode) {
            socket.emit('submit_vote', {
                room: currentRoomCode,
                vote: mins
            });
            document.getElementById('votingModal').style.display = 'none';
            console.log(`BALLOT CAST: ${mins} mins for Room ${currentRoomCode}`);

            appendSystemMessage('⏳ Vote cast (' + mins + ' mins). Waiting for room consensus...');

            // Stop flashing tab title and reset
            if (window.flashInterval) {
                clearInterval(window.flashInterval);
                window.flashInterval = null;
                document.title = "Hostage Study Hub";
            }
        }
    };
});
