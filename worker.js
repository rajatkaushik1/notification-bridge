// CallBridge PRO — Cloudflare Worker Edge Server + Cloudflare D1 Serverless SQLite Database
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Auto-initialize D1 SQLite table if needed
    if (env.DB) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS calls (
            id TEXT PRIMARY KEY,
            number TEXT,
            contact_name TEXT,
            status TEXT,
            message TEXT,
            timestamp TEXT,
            notes TEXT,
            tag TEXT
          );
        `).run();
      } catch (err) {
        console.error('D1 Table Init Error:', err);
      }
    }

    // JSON Helper
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    };

    // 1. POST /api/call - Webhook Trigger from Mobile Phone (MacroDroid / Tasker / Android)
    if (url.pathname === '/api/call' && method === 'POST') {
      try {
        const body = await request.json();
        const callRecord = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7),
          number: body.number || 'Unknown Number',
          contactName: body.contactName || 'Unknown Contact',
          status: body.status || 'Ringing',
          message: body.message || 'Incoming Call',
          timestamp: new Date().toISOString(),
          notes: body.notes || '',
          tag: body.tag || 'General'
        };

        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO calls (id, number, contact_name, status, message, timestamp, notes, tag)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            callRecord.id,
            callRecord.number,
            callRecord.contactName,
            callRecord.status,
            callRecord.message,
            callRecord.timestamp,
            callRecord.notes,
            callRecord.tag
          ).run();
        }

        return jsonResponse({ success: true, record: callRecord });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // 2. GET /api/history - Retrieve Stored Call History
    if (url.pathname === '/api/history' && method === 'GET') {
      if (!env.DB) {
        return jsonResponse({ error: 'Cloudflare D1 Database binding (DB) not configured.' }, 500);
      }
      try {
        const { results } = await env.DB.prepare(`
          SELECT id, number, contact_name AS "contactName", status, message, timestamp, notes, tag
          FROM calls
          ORDER BY timestamp DESC
          LIMIT 500
        `).all();
        return jsonResponse(results || []);
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // 3. GET /api/missed?since=TIMESTAMP - Offline Laptop Catch-Up Sync
    if (url.pathname === '/api/missed' && method === 'GET') {
      if (!env.DB) return jsonResponse([]);
      const since = url.searchParams.get('since');
      if (!since) return jsonResponse([]);
      try {
        const { results } = await env.DB.prepare(`
          SELECT id, number, contact_name AS "contactName", status, message, timestamp, notes, tag
          FROM calls
          WHERE timestamp > ?
          ORDER BY timestamp DESC
        `).bind(since).all();
        return jsonResponse(results || []);
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // 4. PATCH /api/history/:id - Update Note / Tag
    if (url.pathname.startsWith('/api/history/') && method === 'PATCH') {
      const id = url.pathname.split('/').pop();
      const { notes, tag } = await request.json();
      if (env.DB) {
        if (notes !== undefined) {
          await env.DB.prepare(`UPDATE calls SET notes = ? WHERE id = ?`).bind(notes, id).run();
        }
        if (tag !== undefined) {
          await env.DB.prepare(`UPDATE calls SET tag = ? WHERE id = ?`).bind(tag, id).run();
        }
        const { results } = await env.DB.prepare(`
          SELECT id, number, contact_name AS "contactName", status, message, timestamp, notes, tag
          FROM calls WHERE id = ?
        `).bind(id).all();
        return jsonResponse({ success: true, record: results[0] });
      }
      return jsonResponse({ error: 'DB missing' }, 500);
    }

    // 5. DELETE /api/history/:id - Delete record or clear all
    if (url.pathname.startsWith('/api/history/') && method === 'DELETE') {
      const id = url.pathname.split('/').pop();
      if (env.DB) {
        if (id === 'all') {
          await env.DB.prepare(`DELETE FROM calls`).run();
        } else {
          await env.DB.prepare(`DELETE FROM calls WHERE id = ?`).bind(id).run();
        }
      }
      return jsonResponse({ success: true });
    }

    // 6. GET / - Serve Web Dashboard HTML
    if (url.pathname === '/') {
      const html = getDashboardHtml();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          ...corsHeaders
        }
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CallBridge PRO — Cloudflare Edge Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0e1a; --glass: rgba(26,34,56,0.7); --accent: #6366f1; --text: #f9fafb; --muted: #9ca3af;
    }
    body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; margin: 0; padding: 2rem; }
    .container { max-width: 1100px; margin: auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1.5rem; margin-bottom: 2rem; }
    .badge { background: #f59e0b; color: #000; font-weight: bold; padding: 0.3rem 0.8rem; border-radius: 99px; font-size: 0.8rem; }
    .card { background: var(--glass); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.5rem; backdrop-filter: blur(12px); }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
    th { color: var(--muted); font-size: 0.85rem; text-transform: uppercase; }
    code { font-family: 'JetBrains Mono', monospace; color: #a5b4fc; }
    .btn { background: var(--accent); color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>⚡ CallBridge PRO <span style="color:#a5b4fc;font-size:1rem;">Cloudflare Workers + D1 SQLite Edge</span></h1>
        <p style="color:var(--muted);margin:0;">24/7 Serverless Call Notification & Database Hub</p>
      </div>
      <span class="badge">CLOUDFLARE EDGE ACTIVE</span>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3>📋 Stored Call History (D1 SQLite Database)</h3>
        <button class="btn" onclick="fetchCalls()">🔄 Refresh Log</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Caller Name</th>
            <th>Phone Number</th>
            <th>Status</th>
            <th>Tag</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody id="callsBody">
          <tr><td colspan="6">Loading D1 Database records...</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-top:2rem;">
      <h3>📱 100% FREE Android Setup (Automate or Easer)</h3>
      <p style="color:var(--muted);">Use either <strong>Automate</strong> (Free on Google Play) or <strong>Easer</strong> (100% Free & Open Source on F-Droid) to send an HTTP POST request on incoming calls to your Cloudflare Webhook:</p>
      <code style="background:rgba(0,0,0,0.4);padding:0.8rem;display:block;border-radius:8px;" id="urlBox"></code>
      <div style="margin-top:1rem;color:var(--muted);font-size:0.9rem;">
        <strong>Automate Flow:</strong> Call incoming &rarr; HTTP request (POST JSON body: <code>{"number": caller_number, "contactName": "Incoming Call"}</code>)
      </div>
    </div>
  </div>
  <script>
    document.getElementById('urlBox').innerText = window.location.origin + '/api/call';
    async function fetchCalls() {
      const res = await fetch('/api/history');
      const data = await res.json();
      const tbody = document.getElementById('callsBody');
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);">No calls stored yet.</td></tr>';
        return;
      }
      tbody.innerHTML = data.map(c => {
        return '<tr>' +
          '<td>' + new Date(c.timestamp).toLocaleString() + '</td>' +
          '<td><strong>' + (c.contactName || 'Unknown') + '</strong></td>' +
          '<td><code>' + c.number + '</code></td>' +
          '<td>' + c.status + '</td>' +
          '<td>' + c.tag + '</td>' +
          '<td>' + (c.notes || '-') + '</td>' +
        '</tr>';
      }).join('');
    }
    fetchCalls();
  </script>
</body>
</html>`;
}
