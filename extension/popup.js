const socket = io('http://10.17.46.239:3000');

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
    const work = document.getElementById('extWork').value;
    const breakTime = document.getElementById('extBreak').value;

    // In a real flow, the web app will emit create_room when it loads, 
    // but the extension should save the storage.
    chrome.storage.local.set({ userName: name, roomCode: room }, () => {
        const webUrl = `http://localhost:3000/?name=${name}&room=${room}&action=create&work=${work}&break=${breakTime}`;
        chrome.tabs.create({ url: webUrl });
        chrome.runtime.sendMessage({ type: 'START_SESSION', name, room });
    });
};

socket.on('room_status', (data) => {
    if (data.action === 'create') {
        if (data.exists) {
            alert("Pick another code. This room exists.");
        } else {
            document.getElementById('setup-section').style.display = 'none';
            document.getElementById('start-section').style.display = 'block';
        }
    } else if (data.action === 'join') {
        if (!data.exists) {
            alert("Room doesn't exist.");
        } else {
            const name = document.getElementById('extName').value;
            const room = document.getElementById('extRoom').value;
            chrome.storage.local.set({ userName: name, roomCode: room }, () => {
                const webUrl = `http://localhost:3000/?name=${name}&room=${room}&action=join`;
                chrome.tabs.create({ url: webUrl });
                chrome.runtime.sendMessage({ type: 'START_SESSION', name, room });
            });
        }
    }
});
