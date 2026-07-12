// CallBridge Pro Web Application Controller
const socket = io();

let allCalls = [];

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    fetchHistory();
    requestDesktopNotificationPermission();
    setupHostnameDisplay();
    setupSearchAndFilter();
    setupTestForm();
});

// Socket.IO Connection & Live Notification Events
socket.on('connect', () => {
    const pill = document.getElementById('connectionStatus');
    pill.classList.add('connected');
    pill.querySelector('.status-label').textContent = 'Connected to Bridge';
});

socket.on('disconnect', () => {
    const pill = document.getElementById('connectionStatus');
    pill.classList.remove('connected');
    pill.querySelector('.status-label').textContent = 'Disconnected';
});

// Listen for incoming call broadcast from phone/server
socket.on('trigger_laptop_notification', (data) => {
    console.log('[!] Incoming Call Alert:', data);
    
    // Play Web Audio Chime
    playCallRingChime();

    // Show Live Call Popup Modal
    showIncomingCallModal(data);

    // Show Browser Native Desktop Notification
    triggerBrowserNotification(data);

    // Refresh history table
    fetchHistory();
});

// Tabs Navigation
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.add('hidden'));

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const targetPane = document.getElementById(`tab-${tabId}`);
            if (targetPane) targetPane.classList.remove('hidden');
        });
    });
}

// Fetch Call History from Laptop/Server Storage
async function fetchHistory() {
    try {
        const res = await fetch('/api/history');
        if (!res.ok) throw new Error('Failed to fetch history');
        allCalls = await res.json();
        renderCallsTable();
        updateStats();
    } catch (err) {
        console.error('Error fetching call history:', err);
    }
}

// Render Table with Filtering & Search
function renderCallsTable() {
    const tbody = document.getElementById('callsTableBody');
    const searchQuery = (document.getElementById('searchInput').value || '').toLowerCase();
    const tagFilter = document.getElementById('tagFilter').value;

    const filtered = allCalls.filter(call => {
        const matchesQuery = !searchQuery || 
            (call.contactName && call.contactName.toLowerCase().includes(searchQuery)) ||
            (call.number && call.number.toLowerCase().includes(searchQuery)) ||
            (call.notes && call.notes.toLowerCase().includes(searchQuery)) ||
            (call.tag && call.tag.toLowerCase().includes(searchQuery));

        const matchesTag = tagFilter === 'all' || call.tag === tagFilter;
        return matchesQuery && matchesTag;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No call records found matching criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(call => {
        const timeFormatted = new Date(call.timestamp || Date.now()).toLocaleString();
        const tag = call.tag || 'General';
        const notes = call.notes || '<span style="color:var(--text-muted);font-style:italic;">No notes</span>';
        
        return `
            <tr>
                <td><span style="font-size:0.85rem;color:var(--text-secondary);">${timeFormatted}</span></td>
                <td>
                    <div class="caller-info">
                        <span class="caller-name">${call.contactName || 'Unknown Contact'}</span>
                        <span class="caller-number">${call.number || 'Unknown Number'}</span>
                    </div>
                </td>
                <td>
                    <span class="status-badge status-ringing">${call.status || 'Ringing'}</span>
                </td>
                <td>
                    <span class="tag-badge tag-${tag}">${tag}</span>
                </td>
                <td>${notes}</td>
                <td>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-outline" style="padding:0.4rem 0.8rem;font-size:0.8rem;" onclick="openNoteModal('${call.id}')">✏️ Edit</button>
                        <button class="btn btn-danger-outline" style="padding:0.4rem 0.8rem;font-size:0.8rem;" onclick="deleteCallRecord('${call.id}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Stats Updater
function updateStats() {
    document.getElementById('statTotalCalls').textContent = allCalls.length;
    if (allCalls.length > 0) {
        const latest = allCalls[0];
        document.getElementById('statLastCall').textContent = latest.contactName || latest.number || 'Incoming Call';
    } else {
        document.getElementById('statLastCall').textContent = 'None yet';
    }
}

// Search & Filter event handlers
function setupSearchAndFilter() {
    document.getElementById('searchInput').addEventListener('input', renderCallsTable);
    document.getElementById('tagFilter').addEventListener('change', renderCallsTable);
}

// Live Modal UI
function showIncomingCallModal(data) {
    document.getElementById('modalCallerName').textContent = data.contactName || 'Unknown Contact';
    document.getElementById('modalCallerNumber').textContent = data.number || 'Unknown Number';
    document.getElementById('modalCallTime').textContent = new Date().toLocaleTimeString();
    document.getElementById('incomingCallModal').classList.remove('hidden');
}

function closeCallModal() {
    document.getElementById('incomingCallModal').classList.add('hidden');
}

// Browser Desktop Notification
function requestDesktopNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}

function triggerBrowserNotification(data) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Incoming Call: ${data.contactName || data.number}`, {
            body: `Phone ringing from ${data.number || 'Unknown'}`,
            icon: '📞'
        });
    }
}

// Web Audio Synthesizer Chime
function playCallRingChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;

        // Two-tone chime (high-low phone alert)
        [587.33, 880, 587.33, 880].forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.15, now + idx * 0.18);
            gain.gain.exponentialRampToValueAtTime(0.001, now + (idx + 1) * 0.18);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now + idx * 0.18);
            osc.stop(now + (idx + 1) * 0.18);
        });
    } catch (e) {
        // Audio playback might be blocked until user interaction
    }
}

// Setup Hostname display for Webhook URL
function setupHostnameDisplay() {
    const host = window.location.hostname || 'localhost';
    const port = window.location.port || '3000';
    const display = document.getElementById('webhookUrlDisplay');
    if (display) {
        display.textContent = `http://${host}:${port}/api/call`;
    }
}

function copyWebhookUrl() {
    const text = document.getElementById('webhookUrlDisplay').textContent;
    navigator.clipboard.writeText(text);
    alert('Copied Webhook URL to clipboard!');
}

// Note Edit Modal
function openNoteModal(callId) {
    const call = allCalls.find(c => c.id === callId);
    if (!call) return;
    document.getElementById('editCallId').value = callId;
    document.getElementById('editCallTag').value = call.tag || 'General';
    document.getElementById('editCallNotes').value = call.notes || '';
    document.getElementById('noteModal').classList.remove('hidden');
}

function closeNoteModal() {
    document.getElementById('noteModal').classList.add('hidden');
}

async function saveCallNote() {
    const id = document.getElementById('editCallId').value;
    const tag = document.getElementById('editCallTag').value;
    const notes = document.getElementById('editCallNotes').value;

    try {
        const res = await fetch(`/api/history/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag, notes })
        });
        if (res.ok) {
            closeNoteModal();
            fetchHistory();
        }
    } catch (e) {
        console.error('Failed to save note:', e);
    }
}

// Delete call record
async function deleteCallRecord(id) {
    try {
        const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
        if (res.ok) fetchHistory();
    } catch (e) {
        console.error('Failed to delete call:', e);
    }
}

async function clearAllHistory() {
    if (!confirm('Are you sure you want to clear all stored call notifications?')) return;
    try {
        const res = await fetch('/api/history/all', { method: 'DELETE' });
        if (res.ok) fetchHistory();
    } catch (e) {
        console.error('Failed to clear history:', e);
    }
}

// Export CSV
function exportCSV() {
    if (allCalls.length === 0) {
        alert('No call history to export.');
        return;
    }

    const headers = ['Timestamp', 'Contact Name', 'Phone Number', 'Status', 'Tag', 'Notes'];
    const rows = allCalls.map(c => [
        `"${c.timestamp}"`,
        `"${c.contactName || ''}"`,
        `"${c.number || ''}"`,
        `"${c.status || ''}"`,
        `"${c.tag || ''}"`,
        `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `call_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Test Form Handler
function setupTestForm() {
    const form = document.getElementById('testCallForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            number: document.getElementById('testNumber').value,
            contactName: document.getElementById('testName').value,
            tag: document.getElementById('testTag').value,
            notes: document.getElementById('testNotes').value,
            status: 'Ringing'
        };

        try {
            const res = await fetch('/api/call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                // Switch back to history tab to show the recorded call
                document.querySelector('.tab-btn[data-tab="history"]').click();
            }
        } catch (err) {
            console.error('Error simulating call:', err);
        }
    });
}
