import asyncio
import socketio
from plyer import notification

# Initialize the async Socket.IO client
sio = socketio.AsyncClient()

@sio.event
async def connect():
    print("[+] Connected to the WebSocket Bridge!")
    print("[*] Waiting for incoming calls...")

@sio.event
async def disconnect():
    print("[-] Disconnected from the Bridge.")

@sio.on('trigger_laptop_notification')
async def on_message(data):
    print(f"[!] Notification triggered! Data received: {data}")
    
    # Trigger Windows/Mac native desktop notification
    notification.notify(
        title=data.get('message', 'Incoming Call'),
        message=f"Ringing from: {data.get('number', 'Unknown Number')}",
        app_name='Call Notifier',
        timeout=10
    )

async def main():
    try:
        # Connect to the local Node.js server (We will change this to Render/Koyeb later)
        await sio.connect('http://localhost:3000')
        await sio.wait()
    except Exception as e:
        print(f"[!] Connection failed: {e}")

if __name__ == '__main__':
    # Run the async event loop
    asyncio.run(main())