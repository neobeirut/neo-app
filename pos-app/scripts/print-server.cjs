/**
 * FLOW Print Server – Standalone Windows Print Server & Hardware Dispatcher
 * Version: 2.1.0
 * Architecture: True 24/7 Service, Outbound Cloud Pull, Unified LAN/Cloud Queue,
 *               Capability-Based Hardware Reporting & Win32 Spooler Integration.
 */

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const { exec, execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// Load Configuration
const CONFIG_FILE = path.join(__dirname, 'config.json');
let config = {
  restaurant_id: '79256f11-a9f8-4fec-901d-69baf929762d',
  branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94',
  branch_name: 'Badaro',
  supabase_url: 'https://ilrlychrraagugntqdfr.supabase.co',
  supabase_anon_key: 'sb_publishable_kOFvZiJuLPN9uliL649IHg_Z-CESFMg',
  http_port: 9191,
  poll_interval_ms: 3500,
  journal_path: './data/print_jobs_journal.json',
  enable_realtime: true,
  allow_lan_direct: true,
  machine_id: 'FLOW-WIN-SVC-01'
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...loaded };
  } catch (e) {
    console.warn('[PrintServer] Could not parse config.json, using defaults:', e.message);
  }
}

// Ensure data directory exists
const DATA_DIR = path.dirname(path.resolve(__dirname, config.journal_path));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize Supabase Client
const supabase = createClient(config.supabase_url, config.supabase_anon_key, {
  auth: { persistSession: false }
});

// ESC/POS Constants
const ESC = '\x1B';
const GS  = '\x1D';
const INIT         = ESC + '@';
const ALIGN_LEFT   = ESC + 'a\x00';
const ALIGN_CENTER = ESC + 'a\x01';
const ALIGN_RIGHT  = ESC + 'a\x02';
const BOLD_ON      = ESC + 'E\x01';
const BOLD_OFF     = ESC + 'E\x00';
const DOUBLE_SIZE  = ESC + '!\x30';
const DOUBLE_WIDTH = ESC + '!\x20';
const NORMAL       = ESC + '!\x00';
const CUT          = GS  + 'V\x41\x00';
const FEED         = '\n\n\n\n';
const DLE_EOT_1    = '\x10\x04\x01'; // Query printer real-time status

const LINE_WIDTH = 42; // Standard 80mm roll width

// Persistent Local Deduplication Journal
const JOURNAL_FILE = path.resolve(__dirname, config.journal_path);
let journalEntries = new Map();

function loadJournal() {
  try {
    if (fs.existsSync(JOURNAL_FILE)) {
      const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.idempotency_key) {
            journalEntries.set(item.idempotency_key, item);
          }
        }
      }
    }
    console.log(`[Journal] Loaded ${journalEntries.size} entries from ${JOURNAL_FILE}`);
  } catch (e) {
    console.warn('[Journal] Could not load journal file:', e.message);
  }
}

function recordJournalEntry(entry) {
  if (!entry || !entry.idempotency_key) return;
  journalEntries.set(entry.idempotency_key, {
    ...entry,
    recorded_at: new Date().toISOString()
  });

  try {
    const list = Array.from(journalEntries.values()).slice(-3000); // retain last 3000 entries
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Journal] Could not persist journal to disk:', e.message);
  }
}

loadJournal();

// Helper Formatter Functions
function divider(c = '-', len = LINE_WIDTH) {
  return c.repeat(len) + '\n';
}

function padLine(left, right, width = LINE_WIDTH) {
  const l = String(left || '');
  const r = String(right || '');
  const spaces = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(spaces) + r + '\n';
}

/**
 * Formats a preparation ticket (Kitchen, Bar, Pastry, Bakery).
 * Strictly excludes prices and payment details.
 */
function formatPreparationTicket(json) {
  let out = INIT;
  const isCancelled = json.isCancellation === true || json.title?.includes('CANCELLED');
  const isReprint = json.is_reprint === true || json.title?.includes('REPRINT');

  out += ALIGN_CENTER + BOLD_ON;
  if (isCancelled) {
    out += DOUBLE_SIZE + '*** CANCELLED ***\n' + NORMAL + BOLD_ON;
    if (json.reason) out += `REASON: ${json.reason}\n`;
  } else if (isReprint) {
    out += DOUBLE_SIZE + '*** REPRINT ***\n' + NORMAL + BOLD_ON;
    out += (json.title || 'PREPARATION TICKET') + '\n';
  } else {
    out += DOUBLE_SIZE + (json.title || 'PREPARATION TICKET') + '\n';
  }
  out += NORMAL + divider('=');

  if (json.printer_name) {
    out += ALIGN_CENTER + BOLD_ON + `STATION: ${json.printer_name.toUpperCase()}\n` + BOLD_OFF;
  }

  out += ALIGN_LEFT;
  const tableStr = json.table_label || json.table_code || json.table || 'N/A';
  out += BOLD_ON + DOUBLE_WIDTH + padLine(`TABLE: ${tableStr}`, json.order_id ? `#${json.order_id}` : '') + NORMAL;
  out += padLine(`Server: ${json.waiter_name || json.waiter || 'Staff'}`, `Guests: ${json.guest_count || 1}`);
  out += padLine(`Time: ${json.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, `Round: #${json.fire_round || 1}`);

  out += divider('-');
  out += BOLD_ON + padLine('QTY  ITEM', 'STATION') + BOLD_OFF;
  out += divider('-');

  let currentCombo = null;

  for (const item of (json.items || [])) {
    if (item.is_bundle_component && item.bundle_parent_name && item.bundle_parent_name !== currentCombo) {
      currentCombo = item.bundle_parent_name;
      out += BOLD_ON + `[COMBO: ${currentCombo.toUpperCase()}]\n` + BOLD_OFF;
    } else if (!item.is_bundle_component) {
      currentCombo = null;
    }

    const qtyStr = String(item.quantity || item.qty || 1).padEnd(4);
    const nameStr = item.name || item.product_name || 'Item';
    const indent = item.is_bundle_component ? '  -> ' : '';

    out += BOLD_ON + `${qtyStr} ${indent}${nameStr}\n` + BOLD_OFF;

    if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modName = typeof mod === 'string' ? mod : (mod.name || mod.ingredient || '');
        if (modName) out += `       + ${modName}\n`;
      }
    }

    if (item.note || item.comment || item.notes) {
      out += BOLD_ON + `       NOTE: ${item.note || item.comment || item.notes}\n` + BOLD_OFF;
    }
  }

  out += divider('=');
  out += ALIGN_CENTER + `FLOW POS Intelligent Routing • #${json.order_id || 'Chit'}\n`;
  out += FEED + CUT;
  return out;
}

/**
 * Formats a customer bill (Guest Check / Tax Invoice / Receipt) for the Main printer.
 * Contains all commercial items (including Store / Retail and combos).
 */
function formatCustomerBill(json) {
  let out = INIT;
  const isPreCheck = json.isPreCheck === true || json.title?.includes('PRE-CHECK') || json.title?.includes('GUEST CHECK');

  out += ALIGN_CENTER + BOLD_ON;
  out += (json.restaurant_name || 'NEO BEIRUT').toUpperCase() + '\n';
  out += NORMAL;
  if (json.company_legal_name) out += `${json.company_legal_name}\n`;
  if (json.mof_number) out += `MOF: ${json.mof_number}\n`;

  out += divider('=');
  out += BOLD_ON + DOUBLE_SIZE;
  out += isPreCheck ? 'GUEST CHECK\n' : 'TAX INVOICE\n';
  out += NORMAL + BOLD_ON;
  if (isPreCheck) out += '(NOT A TAX RECEIPT — PLEASE PAY AT CASHIER)\n';
  out += NORMAL + divider('=');

  out += ALIGN_LEFT;
  out += padLine(`Order: #${json.order_id || json.id || 'N/A'}`, json.table_label ? `Table: ${json.table_label}` : 'Direct');
  out += padLine(`Server: ${json.waiter_name || json.server_name || 'Staff'}`, `Guests: ${json.guest_count || 1}`);
  out += padLine(`Date: ${new Date().toLocaleDateString()}`, `Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

  out += divider('-');
  out += BOLD_ON + padLine('QTY  DESCRIPTION', 'TOTAL (USD)') + BOLD_OFF;
  out += divider('-');

  let subtotal = 0;
  for (const item of (json.items || [])) {
    const qty = Number(item.qty || item.quantity || 1);
    const unitPrice = Number(item.unit_price || item.price || 0);
    const lineTotal = Number(item.total_price !== undefined ? item.total_price : (unitPrice * qty));
    subtotal += lineTotal;

    const qtyStr = String(qty).padEnd(4);
    const nameStr = item.name || item.product_name || 'Item';
    const priceStr = `$${lineTotal.toFixed(2)}`;

    out += padLine(`${qtyStr} ${nameStr}`, priceStr);

    if (Array.isArray(item.customizations_print_text) && item.customizations_print_text.length > 0) {
      for (const line of item.customizations_print_text) {
        out += `       ${line}\n`;
      }
    }
  }

  out += divider('-');
  out += padLine('Subtotal:', `$${(Number(json.subtotal || json.subtotal_amount || subtotal)).toFixed(2)}`);

  const discount = Number(json.discount_amount || json.discount || 0);
  if (discount > 0) {
    out += padLine(`Discount:`, `-$${discount.toFixed(2)}`);
  }

  const deliveryFee = Number(json.delivery_fee || 0);
  if (deliveryFee > 0) {
    out += padLine(`Delivery Fee:`, `$${deliveryFee.toFixed(2)}`);
  }

  const vat = Number(json.vat_amount || 0);
  if (vat > 0) {
    out += padLine(`VAT (11%):`, `$${vat.toFixed(2)}`);
  }

  const total = Number(json.total || json.total_amount || (subtotal - discount + deliveryFee + vat));
  out += divider('=');
  out += BOLD_ON + DOUBLE_SIZE + padLine('TOTAL:', `$${total.toFixed(2)}`) + NORMAL;

  const rate = Number(json.exchange_rate || 90000);
  const totalLbp = Math.round(total * rate);
  out += BOLD_ON + padLine('Total LBP:', `${totalLbp.toLocaleString()} L.L.`) + BOLD_OFF;
  out += padLine('Exchange Rate:', `1 USD = ${rate.toLocaleString()} LBP`);

  out += divider('-');
  out += ALIGN_CENTER;
  out += (json.footer || json.footer_message || 'Thank you for dining with us! Come back soon.') + '\n';
  out += FEED + CUT;
  return out;
}

// Hardware Dispatcher
async function sendToNetworkPrinter(host, port, payloadString) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3500);

    let confirmedCut = false;

    socket.connect(port, host, () => {
      // Send print bytes
      socket.write(payloadString, 'binary', () => {
        // Attempt bidirectional telemetry query (DLE EOT 1)
        try {
          socket.write(DLE_EOT_1, 'binary');
        } catch (e) {}

        setTimeout(() => {
          socket.destroy();
          resolve({
            success: true,
            status: confirmedCut ? 'confirmed' : 'sent',
            transport: 'network_raw',
            host,
            port
          });
        }, 300);
      });
    });

    socket.on('data', (data) => {
      // If printer responds with status byte, cutter confirmed
      if (data && data.length > 0) {
        confirmedCut = true;
      }
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({
        success: false,
        status: 'failed',
        error: err.message,
        transport: 'network_raw',
        host,
        port
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        success: false,
        status: 'uncertain',
        error: 'Socket transmission timed out after 3.5s',
        transport: 'network_raw',
        host,
        port
      });
    });
  });
}

async function sendToWindowsSpooler(printerName, payloadString) {
  return new Promise((resolve) => {
    try {
      const tempFile = path.join(__dirname, 'data', `spool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.bin`);
      fs.writeFileSync(tempFile, payloadString, 'binary');

      // Use PowerShell to stream raw bytes to Windows Print Spooler (RAW datatype)
      const psScript = `
        $printer = "${printerName}";
        $path = "${tempFile.replace(/\\/g, '\\\\')}";
        if (Get-Printer -Name $printer -ErrorAction SilentlyContinue) {
          [System.IO.File]::ReadAllBytes($path) | Out-Printer -Name $printer;
          Exit 0;
        } else {
          Exit 1;
        }
      `;

      exec(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/\n/g, ' ')}"`, (err) => {
        try { fs.unlinkSync(tempFile); } catch (e) {}

        if (!err) {
          resolve({
            success: true,
            status: 'accepted', // Windows Spooler accepted RAW job
            transport: 'windows_driver',
            printerName
          });
        } else {
          resolve({
            success: false,
            status: 'failed',
            error: err.message || 'Spooler failed to accept job',
            transport: 'windows_driver',
            printerName
          });
        }
      });
    } catch (e) {
      resolve({
        success: false,
        status: 'failed',
        error: e.message,
        transport: 'windows_driver',
        printerName
      });
    }
  });
}

/**
 * Unified Job Dispatcher:
 * Handles deduplication, rendering, physical transmission, and capability-based status reporting.
 */
async function processPrintJob(jobPayload, source = 'cloud') {
  const idempKey = jobPayload.idempotency_key || jobPayload.content?.idempotency_key;

  // 1. Deduplication Check
  if (idempKey && journalEntries.has(idempKey)) {
    const existing = journalEntries.get(idempKey);
    console.log(`[PrintServer] Deduplication: Skipping previously processed job key "${idempKey}" (Status: ${existing.status})`);
    return {
      success: true,
      duplicate: true,
      status: existing.status || 'confirmed',
      message: 'Job previously executed'
    };
  }

  // 2. Identify Target Printer & Transport
  const printerInfo = jobPayload.printer || {};
  const isWindowsDriver = printerInfo.connection_type === 'windows_driver' || Boolean(printerInfo.windows_printer_name);
  const targetIp = printerInfo.host || printerInfo.ip_address || '192.168.18.10';
  const targetPort = Number(printerInfo.port) || 9100;
  const windowsPrinterName = printerInfo.windows_printer_name || printerInfo.name;

  // 3. Render Appropriate Format
  const content = jobPayload.content || jobPayload;
  let formattedData = '';

  if (content.isCustomerBill || jobPayload.job_type === 'receipt' || jobPayload.job_type === 'pre_check' || jobPayload.job_type === 'bill') {
    formattedData = formatCustomerBill(content);
  } else if (content.isKitchenTicket || jobPayload.job_type === 'prep_ticket' || content.type === 'kitchen_chit' || content.type === 'test_chit') {
    formattedData = formatPreparationTicket(content);
  } else if (jobPayload.rawText) {
    formattedData = INIT + jobPayload.rawText + FEED + CUT;
  } else {
    formattedData = formatPreparationTicket(content);
  }

  // 4. Physical Dispatch
  console.log(`[PrintServer] Executing job (${source}) to ${isWindowsDriver ? `Spooler "${windowsPrinterName}"` : `TCP ${targetIp}:${targetPort}`}...`);

  let result;
  if (isWindowsDriver) {
    result = await sendToWindowsSpooler(windowsPrinterName, formattedData);
  } else {
    result = await sendToNetworkPrinter(targetIp, targetPort, formattedData);
  }

  // 5. Journal Persistence
  if (idempKey) {
    recordJournalEntry({
      idempotency_key: idempKey,
      job_id: jobPayload.id || null,
      order_id: content.order_id || null,
      printer: isWindowsDriver ? windowsPrinterName : `${targetIp}:${targetPort}`,
      status: result.status,
      success: result.success,
      source
    });
  }

  return result;
}

// Outbound Supabase Queue Consumer (Worker Loop)
let isPolling = false;
let lastCloudSyncAt = null;

async function pollPendingCloudJobs() {
  if (isPolling) return;
  isPolling = true;

  try {
    // Atomic Claim: Fetch pending jobs for this branch
    const { data: jobs, error } = await supabase
      .from('pos_print_jobs')
      .select('*, printer:pos_printers(*)')
      .eq('branch_id', config.branch_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      console.warn('[CloudPoller] Supabase fetch warning:', error.message);
      return;
    }

    lastCloudSyncAt = new Date().toISOString();

    if (jobs && jobs.length > 0) {
      console.log(`[CloudPoller] Claimed ${jobs.length} pending job(s) for branch ${config.branch_name}`);

      for (const job of jobs) {
        // Lock job to processing
        await supabase
          .from('pos_print_jobs')
          .update({
            status: 'processing',
            processed_by: config.machine_id,
            started_at: new Date().toISOString()
          })
          .eq('id', job.id)
          .eq('status', 'pending');

        const jobPayload = {
          id: job.id,
          idempotency_key: job.idempotency_key,
          job_type: job.job_type,
          printer: {
            name: job.printer?.name || 'Printer',
            host: job.printer?.ip_address,
            port: job.printer?.port || 9100,
            connection_type: job.printer?.connection_type,
            windows_printer_name: job.printer?.windows_printer_name
          },
          content: job.payload
        };

        const result = await processPrintJob(jobPayload, 'cloud_queue');

        // Update final status in Supabase
        await supabase
          .from('pos_print_jobs')
          .update({
            status: result.status,
            error_message: result.error || null,
            completed_at: result.success ? new Date().toISOString() : null,
            ack_telemetry: result
          })
          .eq('id', job.id);
      }
    }
  } catch (err) {
    console.warn('[CloudPoller] Exception in worker cycle:', err.message);
  } finally {
    isPolling = false;
  }
}

// Realtime WebSocket Subscription
function initRealtimeSubscription() {
  if (!config.enable_realtime) return;
  try {
    supabase
      .channel('public:pos_print_jobs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pos_print_jobs',
        filter: `branch_id=eq.${config.branch_id}`
      }, (payload) => {
        console.log('[Realtime] Received push notification for job:', payload.new?.id);
        pollPendingCloudJobs();
      })
      .subscribe((status) => {
        console.log('[Realtime] Supabase Realtime channel status:', status);
      });
  } catch (e) {
    console.warn('[Realtime] Could not subscribe:', e.message);
  }
}

// Start Background Worker Timer
setInterval(pollPendingCloudJobs, config.poll_interval_ms);
initRealtimeSubscription();

// Local HTTP Server & Management Dashboard
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-FLOW-Print-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Health / Status Endpoint
  if (req.url === '/status' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      service: 'FLOW Print Server',
      version: '2.1.0',
      branch: config.branch_name,
      branch_id: config.branch_id,
      machine_id: config.machine_id,
      uptime_seconds: Math.round(process.uptime()),
      cloud_sync_at: lastCloudSyncAt,
      journal_entries_count: journalEntries.size
    }));
  }

  // Ping Socket Probe
  if (req.url.startsWith('/ping')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const host = urlObj.searchParams.get('host') || '192.168.18.10';
    const port = Number(urlObj.searchParams.get('port')) || 9100;

    const probe = new net.Socket();
    probe.setTimeout(2500);
    probe.connect(port, host, () => {
      probe.destroy();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, host, port, status: 'ONLINE' }));
    });
    probe.on('error', (err) => {
      probe.destroy();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, host, port, error: err.message, status: 'OFFLINE' }));
    });
    probe.on('timeout', () => {
      probe.destroy();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, host, port, error: 'Socket timed out', status: 'OFFLINE' }));
    });
    return;
  }

  // Direct Print Endpoint (LAN Fallback)
  if (req.url === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let cleanData = body;
      if (body.startsWith('payload=') || body.startsWith('text=')) {
        const parsedForm = querystring.parse(body);
        cleanData = parsedForm.payload || parsedForm.text || body;
      }

      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(cleanData);
      } catch (e) {
        parsedPayload = { rawText: cleanData };
      }

      const result = await processPrintJob(parsedPayload, 'lan_direct');
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // Manager Web UI
  if (req.url === '/manager' || req.url === '/' || req.url.startsWith('/manager/')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const managerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FLOW Print Server Manager</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { --primary: #1e5c4f; --bg: #f8fafc; --card: #ffffff; --border: #e2e8f0; --text: #0f172a; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
    .container { max-width: 900px; margin: 0 auto; space-y: 20px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-b: 1px solid var(--border); padding-bottom: 16px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .badge-online { background: #dcfce7; color: #15803d; }
    .btn { background: var(--primary); color: #fff; border: none; padding: 8px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 12px; }
    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--border); }
    th { font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900;">FLOW Print Server v2.1.0</h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Branch: <strong>${config.branch_name}</strong> &bull; Host: <strong>${config.machine_id}</strong></p>
        </div>
        <div>
          <span class="badge badge-online">🟢 SERVICE RUNNING</span>
        </div>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 16px;">
        <button class="btn" onclick="location.reload()">🔄 Refresh Dashboard</button>
        <button class="btn btn-secondary" onclick="fetch('/ping').then(r=>r.json()).then(d=>alert(JSON.stringify(d)))">📡 Ping Default Socket</button>
      </div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 800; text-transform: uppercase;">Deduplication Journal (Last 10 Processed Jobs)</h3>
      <table>
        <thead>
          <tr>
            <th>Key / Order</th>
            <th>Printer</th>
            <th>Source</th>
            <th>Status</th>
            <th>Recorded At</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from(journalEntries.values()).slice(-10).reverse().map(e => `
            <tr>
              <td><code>${e.idempotency_key}</code></td>
              <td>${e.printer || 'N/A'}</td>
              <td><span style="font-weight:700; text-transform:uppercase;">${e.source || 'cloud'}</span></td>
              <td><span class="badge badge-online">${e.status}</span></td>
              <td>${e.recorded_at ? new Date(e.recorded_at).toLocaleTimeString() : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
    `;
    return res.end(managerHtml);
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(config.http_port, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(` FLOW Print Server v2.1.0 Started Successfully`);
  console.log(` Branch: ${config.branch_name} (${config.branch_id})`);
  console.log(` HTTP Bridge & Manager: http://0.0.0.0:${config.http_port}/manager`);
  console.log(` Cloud Polling Interval: ${config.poll_interval_ms}ms`);
  console.log(` Machine ID: ${config.machine_id}`);
  console.log(`================================================================`);
});
