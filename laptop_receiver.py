import asyncio
import socketio
import json
import os
import sys
import urllib.request
from datetime import datetime
from plyer import notification

# Local storage paths on your laptop
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_HISTORY_FILE = os.path.join(LOCAL_DIR, 'laptop_call_history.json')
LAST_SEEN_FILE = os.path.join(LOCAL_DIR, '.last_seen_timestamp')

def get_last_seen():
    if os.path.exists(LAST_SEEN_FILE):
        try:
            with open(LAST_SEEN_FILE, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except Exception:
            pass
    return None

def set_last_seen():
    try:
        with open(LAST_SEEN_FILE, 'w', encoding='utf-8') as f:
            f.write(datetime.utcnow().isoformat() + "Z")
    except Exception:
        pass

def load_local_history():
    if not os.path.exists(LOCAL_HISTORY_FILE):
        return []
    try:
        with open(LOCAL_HISTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        return []

def save_local_history(record):
    history = load_local_history()
    # avoid duplicates
    if not any(item.get('id') == record.get('id') for item in history):
        history.insert(0, record)
        history = history[:1000] # Keep recent 1000 records
        try:
            with open(LOCAL_HISTORY_FILE, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[!] Could not save local history: {e}")

def display_history():
    history = load_local_history()
    print("\n" + "="*70)
    print("                    LAPTOP CALL HISTORY LOG                    ")
    print("="*70)
    if not history:
        print("  No calls stored yet.")
    else:
        for i, call in enumerate(history[:20], 1):
            dt = call.get('timestamp', '')[:19].replace('T', ' ')
            num = call.get('number', 'Unknown')
            name = call.get('contactName', '')
            status = call.get('status', 'Ringing')
            display_caller = f"{name} ({num})" if name and name != "Unknown Contact" else num
            print(f" {i:2d}. [{dt}]  {display_caller:<25} | Status: {status}")
    print("="*70 + "\n")

# Initialize the async Socket.IO client
sio = socketio.AsyncClient()

@sio.event
async def connect():
    print("\n[+] Connected to the Notification Bridge Server!")
    print("[*] Listening for incoming phone calls in real-time...")
    set_last_seen()

@sio.event
async def disconnect():
    print("[-] Disconnected from the Bridge.")
    set_last_seen()

@sio.on('trigger_laptop_notification')
async def on_message(data):
    num = data.get('number', 'Unknown Number')
    name = data.get('contactName', '')
    title = data.get('message', 'Incoming Call')
    display_name = f"{name} ({num})" if name and name != "Unknown Contact" else num
    
    print(f"\n[!] INCOMING CALL DETECTED!")
    print(f"    Caller:    {display_name}")
    print(f"    Timestamp: {data.get('timestamp', datetime.now().isoformat())}")

    save_local_history(data)
    set_last_seen()

    try:
        notification.notify(
            title=title,
            message=f"Call from: {display_name}",
            app_name='CallBridge PRO',
            timeout=10
        )
    except Exception as e:
        print(f"[!] Notification popup failed: {e}")

def check_missed_calls(server_url):
    last_seen = get_last_seen()
    if not last_seen:
        return
    url = f"{server_url.rstrip('/')}/api/missed?since={urllib.parse.quote(last_seen)}"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and len(data) > 0:
                print(f"\n[⚡] CATCH-UP SYNC: {len(data)} call(s) arrived while your laptop was offline!")
                for call in data:
                    save_local_history(call)
                    num = call.get('number', 'Unknown Number')
                    name = call.get('contactName', '')
                    display_name = f"{name} ({num})" if name and name != "Unknown Contact" else num
                    print(f"    - Missed Call: {display_name} at {call.get('timestamp', '')[:19].replace('T', ' ')}")
                
                try:
                    notification.notify(
                        title=f"{len(data)} Missed Call(s) While Offline",
                        message="Call logs synchronized to your laptop database.",
                        app_name='CallBridge PRO',
                        timeout=8
                    )
                except Exception:
                    pass
    except Exception as e:
        pass

async def main(server_url):
    print(f"[*] Connecting to Bridge Server at: {server_url} ...")
    # First check if any calls arrived while laptop was asleep/offline
    check_missed_calls(server_url)

    try:
        await sio.connect(server_url)
        await sio.wait()
    except Exception as e:
        print(f"[!] Connection failed: {e}")

if __name__ == '__main__':
    server_url = 'http://localhost:3000'
    for i, arg in enumerate(sys.argv):
        if arg in ('--server', '-s') and i + 1 < len(sys.argv):
            server_url = sys.argv[i + 1]

    if len(sys.argv) > 1 and sys.argv[1] in ('--history', '-h', 'history'):
        display_history()
    else:
        asyncio.run(main(server_url))
