// Import the Socket.io client script. 
// Note: In a production build, you'd use a bundler, but for this vanilla MVP, we use importScripts
importScripts('socket.io.js');

const SERVER_URL = 'http://10.17.46.239:3000';
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

// Comprehensive list of distraction domains
const BLACKLIST = ['youtube.com', 'instagram.com', 'tiktok.com', 'facebook.com', 'twitter.com', 'x.com', 'reddit.com', 'netflix.com'];
const WHITELIST_TITLES = ['Khan Academy', 'MIT OpenCourseWare', 'Veritasium', '3Blue1Brown', 'Coursera', 'Udemy'];

// Listen to tab updates to catch users navigating to distracting sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Wait for the page to fully load so the title is available
  if (changeInfo.status === 'complete' && tab.url && currentRoom) {

    // If we are on a break, ignore all distraction attempts
    if (currentMode === 'break') {
      console.log("Break active. Ignoring distraction.");
      return;
    }

    try {
      const url = new URL(tab.url);
      const fullUrlStr = url.href.toLowerCase();
      const pageTitle = (tab.title || '').toLowerCase();

      // Intelligence: Title-Based Early Return Exception
      // Check Whitelist BEFORE Blacklist
      const isWhitelisted = WHITELIST_TITLES.some(keyword => pageTitle.includes(keyword.toLowerCase()));

      if (isWhitelisted) {
        console.log(`[Hostage] Educational content detected via Title: ${tab.title}. Exception granted.`);
        return; // Do not trigger distraction, exit immediately
      }

      // Only check the Blacklist if NOT whitelisted
      const isDistracted = BLACKLIST.some(domain => url.hostname.includes(domain));

      if (isDistracted && !hasCausedFailure) {
        console.warn(`[Hostage] Distraction detected (${url.hostname})! Requesting Exception...`);
        // We do NOT set hasCausedFailure = true yet, because they might be pardoned!

        // Notify the server to start a vote
        socket.emit('request_exception', {
          room: currentRoom,
          name: userName,
          url: url.hostname,
          siteTitle: tab.title || url.hostname
        });
      }
    } catch (e) {
      console.error('Invalid URL error:', e);
    }
  }
});

// Listener for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'open_study_hub') {
    chrome.tabs.create({ url: request.url });
  }
});
