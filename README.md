# 🚨 Hostage: Social Accountability for the Attention Economy

**Built for Insomniac '26 Hackathon**\
**Theme A: Attention Economy on Campus**

[![Hackathon](https://img.shields.io/badge/Hackathon-Insomniac_'26-blueviolet)](https://hacksprint.com)\
[![Status](https://img.shields.io/badge/Status-MVP_Incomplete-success)]()

------------------------------------------------------------------------

## 📖 The Pitch

College isn't short on time --- it's short on attention.

Traditional app blockers fail because it's too easy to bypass personal
restrictions.\
**Hostage** fixes this by weaponizing peer pressure.

Hostage is a browser extension where study partners lock into a
synchronized focus session.\
If **anyone** in the group opens a blacklisted distracting site (like
YouTube or Instagram) before the timer finishes:

-   ❌ The entire session breaks for everyone\
-   🔔 The group is notified\
-   👀 The distractor is publicly exposed

Focus becomes a shared responsibility.

------------------------------------------------------------------------

## ✨ Core Features (24-Hour MVP)

-   🔄 **Real-Time Sync**\
    WebSockets ensure all participants share the exact same countdown
    experience.

-   👁️ **Active Tab Monitoring**\
    Continuously tracks opened URLs against a customizable blacklist.

-   🚨 **The "Shame" Trigger**\
    Instantly terminates the session and sends group notifications when
    a distraction occurs.

-   🌐 **Graceful Disconnects**\
    Handles Wi-Fi drops by pausing the timer instead of failing the
    session.

------------------------------------------------------------------------

## 🚀 How to Run and Test Locally

Because this is a Chrome Extension, it cannot be hosted on a standard
web domain.\
Follow the steps below to run both the backend server and the extension
locally.

------------------------------------------------------------------------

### 🖥️ Part 1: Start the Backend Server

The Node.js server handles WebSocket connections (the multiplayer
aspect).

1.  Clone the repository:

``` bash
git clone https://github.com/mohammad-ali-bit/hostage.git
cd hostage-study-app/backend
```

2.  Install dependencies:

``` bash
npm install
```

3.  Start the server:

``` bash
node server.js
```

The server should now be running at:

    http://localhost:3000

------------------------------------------------------------------------

### 🧩 Part 2: Install the Chrome Extension

1.  Open Google Chrome and go to:

```{=html}
<!-- -->
```
    chrome://extensions/

2.  Enable **Developer Mode** (top right corner)

3.  Click **Load unpacked**

4.  Select the `extension` folder inside the cloned repository

5.  Pin the Hostage extension to your browser toolbar

------------------------------------------------------------------------

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
-   A failure alert appears

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

(Optional) Add your Render/Railway backend deployment link here

------------------------------------------------------------------------

## 👨‍💻 Team

**\[Mohammad Ali]**\
Solo Developer
