document.addEventListener('DOMContentLoaded', () => {
    // Check and request Notification permissions immediately
    chrome.notifications.getPermissionLevel((level) => {
        console.log('Notification permission level:', level);
        if (level !== 'granted') {
            Notification.requestPermission().then((permission) => {
                console.log('Requested permission:', permission);
            });
        }
    });

    let socket = null;

    const roomInput = document.getElementById('roomCode');
    const nameInput = document.getElementById('userName');
    const lockInBtn = document.getElementById('lockInBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const statusBox = document.getElementById('statusBox');
    const authView = document.getElementById('auth-view');
    const sessionView = document.getElementById('session-view');
    const votingView = document.getElementById('voting-view');
    const voteQuestion = document.getElementById('voteQuestion');
    const btnVoteApprove = document.getElementById('btnVoteApprove');
    const btnVoteReject = document.getElementById('btnVoteReject');
    const leaderControls = document.getElementById('leaderControls');
    const studySpaceBtn = document.getElementById('studySpaceBtn');
    const studyMinutesInput = document.getElementById('studyMinutes');
    const startTimerBtn = document.getElementById('startTimerBtn');

    let currentRoomCode = null; // Store room code locally for the start button

    // Load saved room if the user was already in a session
    chrome.storage.local.get(['roomCode', 'userName'], (result) => {
        if (result.userName) {
            nameInput.value = result.userName;
        }
        if (result.roomCode) {
            roomInput.value = result.roomCode;
            joinSession(result.userName || 'Unknown', result.roomCode);
        }
    });

    // Handle the 'Lock In' button click
    lockInBtn.addEventListener('click', () => {
        const code = roomInput.value.trim().toUpperCase();
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter your name.');
            return;
        }
        if (!code) {
            alert('Please enter a room code.');
            return;
        }

        // Save to local storage for background.js to access and for persistence
        chrome.storage.local.set({ roomCode: code, userName: name }, () => {
            joinSession(name, code);
            // Let the server know to start/broadcast the timer
            if (socket) socket.emit('start_session', code);

            // Intelligence: Auto-Open Web Hub via Background Script
            chrome.runtime.sendMessage({ action: 'open_study_hub', url: 'http://localhost:3000/?name=' + encodeURIComponent(name) + '&room=' + encodeURIComponent(code) });
        });
    });

    // --- Socket Event Listeners ---

    // When a user successfully joins the room
    function joinSession(name, code) {
        if (!socket) {
            socket = io('http://localhost:3000', {
                transports: ['websocket'],
            });

            // Set up listeners only once when connecting
            socket.on('joined_successfully', (data) => {
                authView.style.display = 'none';
                sessionView.style.display = 'block';

                if (data.isLeader) {
                    showStatus("You are the Leader. Set time and lock in.", true);
                    leaderControls.style.display = 'block';
                } else {
                    showStatus("Waiting for Leader to start...", false);
                    leaderControls.style.display = 'none';
                }
            });

            socket.on('timer_started', (payload) => {
                leaderControls.style.display = 'none';
                startCountdown(payload.minutes);
            });

            socket.on('vote_needed', (data) => {
                console.log('Vote started!', data);
                sessionView.style.display = 'none';
                votingView.style.display = 'block';
                voteQuestion.textContent = `${data.culprit} wants to watch: ${data.siteTitle}. Allow?`;

                // Re-enable buttons in case they were disabled from a previous vote
                btnVoteApprove.style.opacity = '1';
                btnVoteApprove.style.pointerEvents = 'auto';
                btnVoteReject.style.opacity = '1';
                btnVoteReject.style.pointerEvents = 'auto';
            });

            socket.on('exception_granted', (data) => {
                console.log('Exception granted for', data.culprit);
                votingView.style.display = 'none';
                sessionView.style.display = 'block';
                showStatus(`User ${data.culprit} was granted a 10-min pass.`, true);
            });

            socket.on('session_failed', (siteInfo) => {
                console.log('Session failed from server broadcast!', siteInfo);

                const siteName = siteInfo.site.replace('.com', '');
                const formattedSite = siteName.charAt(0).toUpperCase() + siteName.slice(1);

                // Trigger the red alert UI
                document.body.classList.add('failed-state');
                statusBox.innerHTML = `
                    <div class="status-large">SESSION KILLED BY ${siteInfo.culprit || 'A PARTNER'}</div>
                    <div class="status-reason">Reason: Watching ${formattedSite} instead of studying.</div>
                `;
                statusBox.className = 'status-box visible';

                votingView.style.display = 'none'; // Ensure voting view is closed if Open
                newSessionBtn.style.display = 'block';
            });
        }

        currentRoomCode = code;
        socket.emit('join_room', { name, room: code });

        // Reset any failed states visually
        document.body.classList.remove('failed-state');
        authView.style.display = 'none';
        votingView.style.display = 'none';
        sessionView.style.display = 'block';
    }

    // --- Button Event Listeners ---

    function submitVote(voteValue) {
        if (socket && currentRoomCode) {
            socket.emit('submit_vote', { room: currentRoomCode, vote: voteValue });

            // Give visual feedback that vote was cast and prevent double voting
            btnVoteApprove.style.opacity = '0.5';
            btnVoteApprove.style.pointerEvents = 'none';
            btnVoteReject.style.opacity = '0.5';
            btnVoteReject.style.pointerEvents = 'none';
            voteQuestion.textContent = `Vote submitted! Waiting for others...`;
        }
    }

    if (btnVoteApprove) btnVoteApprove.addEventListener('click', () => submitVote('yes'));
    if (btnVoteReject) btnVoteReject.addEventListener('click', () => submitVote('no'));

    // Leader starting the Timer
    startTimerBtn.addEventListener('click', () => {
        const minutes = parseInt(studyMinutesInput.value, 10);

        if (isNaN(minutes) || minutes < 1) {
            alert('Please enter a valid number of minutes.');
            return;
        }

        if (socket && currentRoomCode) {
            socket.emit('start_timer', { room: currentRoomCode, minutes: minutes });
            leaderControls.style.display = 'none';
        }
    });

    // Handle Open Study Space
    if (studySpaceBtn) {
        studySpaceBtn.addEventListener('click', () => {
            const name = nameInput.value.trim() || 'Unknown';
            const roomID = currentRoomCode;
            if (roomID) {
                chrome.runtime.sendMessage({ action: 'open_study_hub', url: 'http://localhost:3000/?name=' + encodeURIComponent(name) + '&room=' + encodeURIComponent(roomID) });
            }
        });
    }

    // Handle Start New Session
    newSessionBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['roomCode'], () => {
            document.body.classList.remove('failed-state');
            statusBox.className = 'status-box';
            statusBox.innerHTML = '';

            authView.style.display = 'block';
            sessionView.style.display = 'none';
            leaderControls.style.display = 'none';
            roomInput.value = '';
            studyMinutesInput.value = '';
            currentRoomCode = null;
            clearInterval(countdownInterval);

            if (socket) {
                socket.disconnect();
                socket = null;
            }
        });
    });

    // Utility to show messages in the UI
    function showStatus(text, isActive) {
        statusBox.textContent = text;
        if (isActive) {
            statusBox.classList.add('status-active');
        } else {
            statusBox.classList.remove('status-active');
        }
    }

    let countdownInterval;
    function startCountdown(minutes) {
        clearInterval(countdownInterval);

        let secondsRemaining = minutes * 60;

        const tick = () => {
            if (secondsRemaining <= 0) {
                clearInterval(countdownInterval);
                showStatus('SESSION COMPLETE! Great job.', true);
                newSessionBtn.style.display = 'block';
                return;
            }

            const m = Math.floor(secondsRemaining / 60);
            const s = secondsRemaining % 60;
            showStatus(`LOCKED IN: ${m}:${s.toString().padStart(2, '0')}`, true);
            secondsRemaining--;
        };

        tick(); // Call immediately to avoid 1s delay
        countdownInterval = setInterval(tick, 1000);
    }
});
