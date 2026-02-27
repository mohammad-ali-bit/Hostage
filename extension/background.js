// Import the Socket.io client script. 
// Note: In a production build, you'd use a bundler, but for this vanilla MVP, we use importScripts
importScripts('socket.io.js');

console.log('[Hostage] Socket attempt: Connecting to http://localhost:3000');

// Connect to the local Node.js WebSocket server
// { transports: ['websocket'] } is critical for Manifest V3 Service Workers
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

let currentRoom = null;
let userName = 'A PARTNER';
let hasCausedFailure = false;

// Simple red 1x1 pixel base64 image to prevent "Unable to download" errors
const FALLBACK_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
      iconUrl: FALLBACK_ICON,
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
      iconUrl: FALLBACK_ICON,
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
