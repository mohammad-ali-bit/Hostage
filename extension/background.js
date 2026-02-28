// Import the Socket.io client script. 
// Note: In a production build, you'd use a bundler, but for this vanilla MVP, we use importScripts
importScripts('socket.io.js');

const SERVER_URL = 'https://hostage-qj13.onrender.com';
console.log('[Hostage] Socket attempt: Connecting to ' + SERVER_URL);

// Connect to the local Node.js WebSocket server
// { transports: ['websocket'] } is critical for Manifest V3 Service Workers
const socket = io(SERVER_URL, {
  transports: ['websocket'],
});

let currentRoom = null;
let userName = 'A PARTNER';
let hasCausedFailure = false;
let currentMode = 'work'; // Default to work mode

// The Heartbeat: send a ping every 20 seconds to prevent the Service Worker from sleeping
setInterval(() => {
  if (socket && socket.connected) {
    socket.emit('ping', 'heartbeat');
  }
}, 20000);

// Keep track of the current room from storage
chrome.storage.local.get(['roomCode', 'userName'], (result) => {
  if (result.roomCode) {
    currentRoom = result.roomCode;
  }
  if (result.userName) {
    userName = result.userName;
  }
});

// Update the current room when it's changed from the popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.roomCode) {
      currentRoom = changes.roomCode.newValue;
      // Reset failure state if we left the room
      if (!currentRoom) hasCausedFailure = false;
    }
    if (changes.userName) {
      userName = changes.userName.newValue;
    }
  }
});

socket.on('connect', () => {
  console.log('[Hostage] Socket connected! ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Hostage] Socket disconnected from server');
});

socket.on('timer_update', (data) => {
  currentMode = data.mode; // 'work' or 'break'
  console.log("Syncing Extension Mode:", currentMode);

  // Update the extension badge text so the user can see the timer on the icon!
  const mins = Math.floor(data.timeLeft / 60);
  chrome.action.setBadgeText({ text: mins.toString() });
  chrome.action.setBadgeBackgroundColor({ color: data.mode === 'break' ? '#22c55e' : '#ef4444' });
});

// Top-Level Listener for session failure
socket.on('session_failed', (siteInfo) => {
  console.log('[Hostage] Event received: session_failed', siteInfo);

  if (hasCausedFailure) return; // The culprit already got their specific notification

  const siteName = siteInfo.site.replace('.com', '');
  const formattedSite = siteName.charAt(0).toUpperCase() + siteName.slice(1);

  try {
    // Simplified Notification WITHOUT a custom ID, letting Chrome generate it
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'image_3.png',
      title: 'SESSION KILLED',
      message: `${siteInfo.culprit || 'A PARTNER'} was caught on ${formattedSite}!`,
      priority: 2
    }, (notificationId) => {
      console.log('[Hostage] Notification triggered with ID:', notificationId);

      // Fallback: Set extension icon badge if notification fails
      if (chrome.runtime.lastError || !notificationId) {
        console.warn('Notification failed, using fallback badge', chrome.runtime.lastError);
        if (chrome.action) {
          chrome.action.setBadgeText({ text: 'FAIL' });
          chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        }
      }
    });
  } catch (err) {
    console.error('[Hostage] Caught error creating notification:', err);
    if (chrome.action) {
      chrome.action.setBadgeText({ text: 'FAIL' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    }
  }
});

socket.on('vote_needed', (data) => {
  console.log(`[Hostage] Received vote_needed for ${data.culprit} on ${data.siteTitle}`);

  // Notify the user they need to go vote
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'image_3.png',
      title: 'VOTE REQUIRED!',
      message: `${data.culprit} is requesting an exception for ${data.siteTitle}!`,
      priority: 2
    });
  } catch (err) {
    console.error('[Hostage] Caught err creating vote notification:', err);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // CRITICAL: Check the mode first
    if (currentMode === 'break') {
      console.log("On break - allowing distraction");
      return;
    }

    const BLACKLIST = ['youtube.com', 'netflix.com', 'instagram.com', 'facebook.com'];
    if (BLACKLIST.some(site => tab.url.includes(site))) {
      chrome.storage.local.get(['userName', 'roomCode'], (data) => {
        if (data.userName && data.roomCode) {
          socket.emit('join_room', { name: data.userName, room: data.roomCode });
          socket.emit('distraction_attempt', { name: data.userName, room: data.roomCode, site: tab.url });
        }
      });
    }
  }
});

// Listener for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'open_study_hub') {
    chrome.tabs.create({ url: request.url });
  }
});
// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check if the message is specifically for updating the timer
  if (request.action === "updateTimerBadge") {

    // Update the text on the badge (e.g., "19")
    chrome.action.setBadgeText({
      text: request.minutes
    });

    // Set the background color to match your UI's red alert color
    chrome.action.setBadgeBackgroundColor({
      color: "#E53935"
    });
  }
});
