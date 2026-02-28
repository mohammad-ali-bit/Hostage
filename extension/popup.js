const SERVER_URL = 'https://hostage-hub.onrender.com';
const socket = io(SERVER_URL
    , {
        transports: ["websocket", "polling"] // Ensures compatibility
    });


document.getElementById('btnCreate').onclick = () => {
    const room = document.getElementById('extRoom').value;
    const name = document.getElementById('extName').value;
    if (!room || !name) return alert("Enter Name and Room Code!");
    socket.emit('check_room', { roomCode: room, action: 'create' });
};

document.getElementById('btnJoin').onclick = () => {
    const room = document.getElementById('extRoom').value;
    const name = document.getElementById('extName').value;
    if (!room || !name) return alert("Enter Name and Room Code!");
    socket.emit('check_room', { roomCode: room, action: 'join' });
};

document.getElementById('btnStart').onclick = () => {
    const room = document.getElementById('extRoom').value;
    const name = document.getElementById('extName').value;
    const work = document.getElementById('extWork').value || 25;
    const breakTime = document.getElementById('extBreak').value || 5;

    chrome.storage.local.set({ userName: name, roomCode: room }, () => {
        const webUrl = `${SERVER_URL}/?name=${name}&room=${room}&action=create&work=${work}&break=${breakTime}`;
        chrome.tabs.create({ url: webUrl });
    });
};

socket.on('room_status', (data) => {
    if (data.action === 'create') {
        if (data.exists) {
            alert("Pick another code. This room exists.");
        } else {
            document.getElementById('action-buttons').style.display = 'none';
            document.getElementById('start-section').style.display = 'block';
        }
    } else if (data.action === 'join') {
        if (!data.exists) {
            alert("Room doesn't exist.");
        } else {
            const name = document.getElementById('extName').value;
            const room = document.getElementById('extRoom').value;
            chrome.storage.local.set({ userName: name, roomCode: room }, () => {
                const webUrl = `${SERVER_URL}/?name=${name}&room=${room}&action=join`;
                chrome.tabs.create({ url: webUrl });
            });
        }
    }
});
