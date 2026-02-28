# 🚨 Hostage: Social Accountability for the Attention Economy

**Built for Insomniac '26 Hackathon**\
**Theme A: Attention Economy on Campus**

[![Hackathon](https://img.shields.io/badge/Hackathon-Insomniac_'26-blueviolet)](https://hacksprint.com)\
[![Status](https://img.shields.io/badge/Status-MVP_Complete-success)]()

------------------------------------------------------------------------

## 📖 The Pitch

College isn't short on time --- it's short on attention.

Traditional app blockers fail because it's too easy to bypass personal
restrictions.
**Hostage** fixes this by weaponizing peer pressure.

Hostage is a browser extension where study partners lock into a
synchronized focus session.
If **anyone** in the group opens a blacklisted distracting site (like
YouTube or Instagram) before the timer finishes:

-   ❌ The entire session breaks for everyone
-   🔔 The group is notified
-   👀 The distractor is publicly exposed

Focus becomes a shared responsibility.

------------------------------------------------------------------------

## ✨ Core Features (24-Hour MVP)

-   🔄 **Real-Time Sync**
    WebSockets ensure all participants share the exact same countdown
    experience.

-   👁️ **Active Tab Monitoring**
    Continuously tracks opened URLs against a customizable blacklist.

-   🚨 **The "Shame" Trigger**
    Instantly terminates the session and sends group notifications when
    a distraction occurs and the violator into the **wall of Shame**.

-   ⚖️ **The Jury is summoned**
    Peers must vote in real-time to allow a break or deny it.


------------------------------------------------------------------------

## 🚀 How to Run and Test Locally

Because this is a Chrome Extension, it cannot be hosted on a standard
web domain.
Follow the steps below to run both the backend server and the extension
locally.

------------------------------------------------------------------------

### 🖥️ Part 1: Start the Backend Server

The Node.js server handles WebSocket connections (the multiplayer
aspect).

- Visit the live dashboard to join or create a study room:
    [hostage](https://hostage-qj13.onrender.com)

### 🧩 Part 2: Install the Enforcer (Chrome Extension)
- Download the /extension folder from this repository.

- Open ```chrome://extensions/``` in Google Chrome.

- Enable Developer Mode.

- Click Load unpacked and select the folder.

The extension is pre-configured to communicate with the Render cloud production server.

## 💻 Tech Stack
### Frontend & Extension
- Vanilla JavaScript & HTML5: Optimized for zero-latency DOM manipulation.

- Chrome Extensions API (Manifest V3): Utilizing Service Workers for background tab monitoring.

### Backend (The Brain)
- Node.js & Express: Unified monorepo serving both the API and the static web assets.

- Socket.io: Full-duplex WebSocket communication for real-time state synchronization.

## 🔒 Engineering Highlights
Cross-Platform Sync: Solved the "Mixed Content" hurdle by enforcing WSS (Secure WebSockets) and unified domain routing, allowing the extension to talk to the web hub seamlessly.
---

## 🧪 How to Demo the "Hostage" Mechanic

To simulate two users:

1.  Open the Hostage extension popup in your current browser window.
2.  Enter a Room ID (e.g., `math2`) and click **Lock In**.
3.  Open a new Chrome window (or Incognito window).
4.  Open the extension again.
5.  Enter the same Room ID (`math2`) and click **Lock In**.

The timers will now sync.

------------------------------------------------------------------------

### 🔥 The Test

In one of the windows:

-   Open a new tab\
-   Navigate to `youtube.com`

You'll see:

-   The session instantly terminates in both windows\
-   A voting alert appears

The distraction affects everyone.

------------------------------------------------------------------------

## 💻 Tech Stack

### Frontend (Extension)

-   HTML\
-   CSS\
-   Vanilla JavaScript\
-   Chrome Extensions API (Manifest V3)

### Backend (Server)

-   Node.js\
-   Express\
-   Socket.io

### Deployment

 Render backend deployment link here (https://hostage-qj13.onrender.com)

------------------------------------------------------------------------

## 👨‍💻 Team

**\[Mohammad Ali]**\
Solo Developer
IIT Jodhpur
