// Import the Socket.io client script. 
// Note: In a production build, you'd use a bundler, but for this vanilla MVP, we use importScripts
importScripts('socket.io.js');

// Connect to the local Node.js WebSocket server
// { transports: ['websocket'] } is critical for Manifest V3 Service Workers
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

let currentRoom = null;
let userName = 'A PARTNER';
let hasCausedFailure = false;

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
      if (!currentRoom) {
        hasCausedFailure = false;
        chrome.alarms.clear('wakeLock');
      } else {
        // Create an alarm to keep the service worker alive when in a room
        chrome.alarms.create('wakeLock', { periodInMinutes: 0.5 });
      }
    }
    if (changes.userName) {
      userName = changes.userName.newValue;
    }
  }
});

socket.on('connect', () => {
  console.log('Hostage Extension Service Worker connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Hostage Extension Service Worker disconnected from server');
});

// Periodic alarm to keep the service worker awake
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wakeLock') {
    console.log('Hostage Wake Lock: Ping.');
    // Optional: send a heartbeat to socket here if necessary
  }
});

socket.on('session_failed', (siteInfo) => {
  if (hasCausedFailure) return; // The culprit already got their specific notification

  const siteName = siteInfo.site.replace('.com', '');
  const formattedSite = siteName.charAt(0).toUpperCase() + siteName.slice(1);

  chrome.notifications.create(Date.now().toString(), {
    type: 'basic',
    iconUrl: 'icon.png', // The extension logo acts as the warning icon
    title: 'SESSION TERMINATED!',
    message: `SESSION KILLED: ${siteInfo.culprit || 'A PARTNER'} was caught on ${formattedSite}!`,
    priority: 2
  });
});

// Comprehensive list of distraction domains
const BLACKLIST = ['youtube.com', 'instagram.com', 'tiktok.com', 'facebook.com', 'twitter.com', 'x.com', 'reddit.com', 'netflix.com'];

// Listen to tab updates to catch users navigating to distracting sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log(`[Hostage] User visited: ${changeInfo.url}`);
  }

  // Only check when the URL changes and we are in a room
  if (changeInfo.url && currentRoom) {
    try {
      const url = new URL(changeInfo.url);
      const isDistracted = BLACKLIST.some(domain => url.hostname.includes(domain));

      if (isDistracted) {
        console.warn(`[Hostage] Distraction detected (${url.hostname})! Snitching to server...`);

        hasCausedFailure = true;

        // Notify the user they broke the session
        chrome.notifications.create(Date.now().toString(), {
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Hostage Alert!',
          message: 'You broke the session! Your group has been notified.',
          priority: 2
        });

        // Notify the server about the distraction
        socket.emit('distraction_detected', { room: currentRoom, site: url.hostname, culprit: userName });
      }
    } catch (e) {
      console.error('Invalid URL error:', e);
    }
  }
});
