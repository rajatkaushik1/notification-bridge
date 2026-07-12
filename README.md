# CallBridge PRO — 24/7 Cloud & Local Call Notification Bridge with Database & Catch-Up Sync

CallBridge PRO connects your Android/iOS mobile phone to your laptop so that whenever an incoming call arrives:
1. **24/7 Cloud or Local Database:** Calls are stored persistently in a database ([calls.db](file:///C:/Users/Dell/Desktop/notification-bridge/calls.db) SQLite locally, or **Cloudflare D1 Serverless SQLite** in the cloud) so calls are recorded 24/7 even when your laptop is turned off!
2. **Offline Catch-Up Sync:** When your laptop turns on and connects, it automatically checks if any calls arrived while your laptop was asleep and syncs them to your laptop database.
3. **Live Desktop Notification:** Instant OS popup alert (`plyer`) on Windows/Mac/Linux + audible chime on the Web Dashboard.

---

## 📱 Connecting Your Phone (NO Android Studio Required!)

You do **NOT** need Android Studio installed on your computer. Choose either of these **100% FREE** methods:

### Option 1: Automatic Cloud APK Builder via GitHub Actions (Zero Android Studio!)
We added a GitHub Actions automated builder ([.github/workflows/build-apk.yml](file:///C:/Users/Dell/Desktop/notification-bridge/.github/workflows/build-apk.yml)).
1. Push this folder to your GitHub repository.
2. Go to your GitHub repository → **Actions** tab → **Build CallBridge PRO Android APK**.
3. GitHub's cloud servers automatically compile `CallBridgePro.apk` for you in 60 seconds!
4. Click **Download APK Artifact** and install `CallBridgePro.apk` directly on your phone!

---

### Option 2: Run Python Script Directly on Your Phone via Termux (Takes 1 minute!)
If you don't want to install an APK at all, you can run [termux_call_bridge.py](file:///C:/Users/Dell/Desktop/notification-bridge/termux_call_bridge.py) directly on your Android phone:
1. Install **Termux** & **Termux:API** (Free apps from F-Droid or Google Play Store).
2. Open Termux on your phone and run:
   ```bash
   pkg install python termux-api
   python termux_call_bridge.py
   ```
*✨ Your phone will now listen for incoming calls 24/7 and save them straight to your Cloudflare database!*

---

### Option 3: Easer (100% Free & Open Source App on F-Droid)
1. Install **Easer** from [F-Droid](https://f-droid.org/packages/ryey.easer/).
2. Create **Event:** `Call` → state `Ringing`.
3. Create **Operation:** `HTTP Request` → Method `POST` → URL: `https://callbridge-pro.rajatrajkaushik1.workers.dev/api/call`.
4. Link them in a Script and activate!

---

## ⚡ Cloudflare Edge Dashboard & Endpoints
- **Web Dashboard:** `https://callbridge-pro.rajatrajkaushik1.workers.dev/`
- **Webhook Endpoint:** `https://callbridge-pro.rajatrajkaushik1.workers.dev/api/call`
