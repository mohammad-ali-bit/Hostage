// content.js

// This function acts as the bridge, reading the webpage and updating the extension
function syncTimerToBadge() {

    // 1. FIND THE TIMER:
    // IMPORTANT: You MUST change '.your-timer-class' to the actual class or ID 
    // that your webpage uses for the "WORK: 19:19" text element.
    // E.g., if your HTML is <div id="pomodoro-timer">WORK: 19:19</div>, 
    // change this to document.querySelector('#pomodoro-timer');
    const timerElement = document.querySelector('.your-timer-class');

    // If the timer element exists on the page, proceed
    if (timerElement) {

        // Grab the raw text (e.g., "WORK: 19:19")
        const timerText = timerElement.innerText;

        // 2. EXTRACT THE MINUTES:
        // This regular expression looks for digits immediately preceding a colon ":"
        const match = timerText.match(/(\d+):\d+/);

        if (match && match[1]) {
            // This isolates the "19" from the rest of the text
            const minutes = match[1];

            // 3. SEND THE DATA TO THE EXTENSION:
            // Send a message to background.js with the extracted minutes
            chrome.runtime.sendMessage({
                action: "updateTimerBadge",
                minutes: minutes
            });
        }
    }
}

// Run this check every 1000 milliseconds (1 second) to keep the badge synced
setInterval(syncTimerToBadge, 1000);