#!/usr/bin/env python3
"""
CallBridge PRO — Termux Phone Script (Run directly on Android without Android Studio!)

Requirements on your Android Phone:
1. Install "Termux" & "Termux:API" apps (free from F-Droid or Play Store)
2. Inside Termux terminal run:
   pkg install python termux-api
   python termux_call_bridge.py
"""

import subprocess
import json
import time
import urllib.request

WEBHOOK_URL = "https://callbridge-pro.rajatrajkaushik1.workers.dev/api/call"

def send_to_cloud(number):
    print(f"[!] Incoming call detected from: {number} -> Sending to Cloudflare...")
    payload = {
        "number": number,
        "contactName": f"Mobile Call ({number})",
        "status": "Ringing",
        "tag": "General"
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(WEBHOOK_URL, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            print(f"[+] Successfully saved to cloud database! Server response: {res.status}")
    except Exception as e:
        print(f"[-] Error sending webhook: {e}")

def monitor_calls():
    print("="*60)
    print(" 📱 CallBridge PRO — Termux Phone Listener Active")
    print(f" 🌐 Webhook URL: {WEBHOOK_URL}")
    print("="*60)
    print("[*] Listening for incoming phone calls...")

    last_call_id = None

    while True:
        try:
            # Check latest call log using Termux API
            output = subprocess.check_output(["termux-call-log", "-l", "1"], stderr=subprocess.DEVNULL)
            logs = json.loads(output.decode('utf-8'))
            if logs and len(logs) > 0:
                latest = logs[0]
                call_id = f"{latest.get('number')}-{latest.get('date')}"
                call_type = latest.get('type', '').upper()

                if call_id != last_call_id and (call_type in ("INCOMING", "MISSED", "REJECTED")):
                    last_call_id = call_id
                    send_to_cloud(latest.get('number', 'Unknown'))
        except Exception:
            pass

        time.sleep(2)

if __name__ == "__main__":
    monitor_calls()
