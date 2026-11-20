/**
 * FLOW Print Server – Standalone Hardware Print Server & Dispatcher
 * Version: 2.2.0
 * Architecture:
 *   - Auto-syncs all printer hardware, section routes, and financial settings from Admin (Supabase).
 *   - Supports ESC/POS Network (TCP 9100) & USB Windows Driver (RAW Spooler) printers.
 *   - Dual dispatch mode: Fast LAN direct bridge (port 9191) + Outbound Cloud Queue consumer.
 *   - Built-in Manager Web UI (http://localhost:9191/manager) with auto-detected local IP and diagnostics.
 *   - Full ticket rendering: Receipts (dual USD/LBP), Kitchen/Bar chits, Void/Cancellations, and Shift Reports.
 */

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');
const querystring = require('querystring');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// ── 1. Configuration & Persistence ──────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, 'config.json');
let config = {
  restaurant_id: '79256f11-a9f8-4fec-901d-69baf929762d',
  branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94',
  branch_name: 'Badaro',
  supabase_url: 'https://ilrlychrraagugntqdfr.supabase.co',
  supabase_anon_key: 'sb_publishable_kOFvZiJuLPN9uliL649IHg_Z-CESFMg',
  http_port: 9191,
  poll_interval_ms: 3000,
  sync_interval_ms: 15000,
  journal_path: './data/print_jobs_journal.json',
  enable_realtime: true,
  allow_lan_direct: true,
  machine_id: `FLOW-POS-${os.hostname().toUpperCase()}`
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...loaded };
  } catch (e) {
    console.warn('[PrintServer] Warning parsing config.json:', e.message);
  }
}

// Ensure data folder exists
const DATA_DIR = path.dirname(path.resolve(__dirname, config.journal_path));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── 2. Local IP Detection ───────────────────────────────────────────────────
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const netIf of interfaces[name]) {
      if (netIf.family === 'IPv4' && !netIf.internal) {
        addresses.push({ interface: name, address: netIf.address });
      }
    }
  }
  return addresses;
}

// ── 3. Supabase Client ──────────────────────────────────────────────────────
const supabase = createClient(config.supabase_url, config.supabase_anon_key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ── 4. Dynamic Admin Settings Cache ─────────────────────────────────────────
let adminSettings = {
  exchange_rate: 90000,
  vat_rate: 11,
  restaurant_name: 'NÉO BEIRUT',
  company_legal_name: 'NEO RESTAURANTS S.A.L.',
  mof_number: '3651294',
  receipt_footer: 'Thank you for dining with us! Come back soon.',
  printers: [],
  routes: [],
  mainReceiptPrinter: null,
  fallbackPrinter: null,
  lastSyncAt: null
};

async function syncAdminSettings() {
  try {
    const rId = config.restaurant_id;
    const bId = config.branch_id;

    const [printersRes, routesRes, appSettingsRes, branchRes] = await Promise.allSettled([
      supabase.from('pos_printers').select('*').eq('restaurant_id', rId).eq('branch_id', bId).eq('is_active', true).order('name'),
      supabase.from('pos_printer_section_routes').select('*, printer:pos_printers(*)').eq('restaurant_id', rId).eq('branch_id', bId),
      supabase.from('app_settings').select('*'),
      supabase.from('branches').select('*').eq('id', bId).single()
    ]);

    if (printersRes.status === 'fulfilled' && printersRes.value.data) {
      adminSettings.printers = printersRes.value.data;
      adminSettings.mainReceiptPrinter =
        adminSettings.printers.find(p => p.is_receipt_printer) ||
        adminSettings.printers.find(p => (p.name || '').toLowerCase() === 'main') ||
        adminSettings.printers[0] || null;

      adminSettings.fallbackPrinter =
        adminSettings.printers.find(p => p.is_fallback) ||
        adminSettings.printers.find(p => (p.name || '').toLowerCase().includes('kitchen')) ||
        adminSettings.printers[0] || null;
    }

    if (routesRes.status === 'fulfilled' && routesRes.value.data) {
      adminSettings.routes = routesRes.value.data;
    }

    if (appSettingsRes.status === 'fulfilled' && appSettingsRes.value.data) {
      const sMap = {};
      appSettingsRes.value.data.forEach(r => { sMap[r.setting_key] = r.setting_value; });

      if (sMap.exchange_rate) {
        const rate = Number(sMap.exchange_rate);
        if (!isNaN(rate) && rate > 0) adminSettings.exchange_rate = rate;
      }
      if (sMap.vat_rate) {
        const vat = Number(sMap.vat_rate);
        if (!isNaN(vat)) adminSettings.vat_rate = vat;
      }
      if (sMap.receipt_footer) adminSettings.receipt_footer = sMap.receipt_footer;
      if (sMap.restaurant_name) adminSettings.restaurant_name = sMap.restaurant_name;
    }

    if (branchRes.status === 'fulfilled' && branchRes.value.data) {
      config.branch_name = branchRes.value.data.name || config.branch_name;
    }

    adminSettings.lastSyncAt = new Date().toISOString();
  } catch (err) {
    console.warn('[AdminSync] Could not refresh admin settings (will retry):', err.message);
  }
}

syncAdminSettings();
setInterval(syncAdminSettings, config.sync_interval_ms);

// ── 5. ESC/POS Command Constants ────────────────────────────────────────────
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
const DLE_EOT_1    = '\x10\x04\x01';

function getLineWidth(paperWidthMm = 80) {
  return paperWidthMm === 58 ? 32 : 42;
}

function divider(c = '-', len = 42) {
  return c.repeat(len) + '\n';
}

function padLine(left, right, width = 42) {
  const l = String(left || '');
  const r = String(right || '');
  const spaces = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(spaces) + r + '\n';
}

// ── 6. Persistent Deduplication Journal ──────────────────────────────────────
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
  } catch (e) {
    console.warn('[Journal] Warning reading journal:', e.message);
  }
}

function recordJournalEntry(entry) {
  if (!entry || !entry.idempotency_key) return;
  journalEntries.set(entry.idempotency_key, {
    ...entry,
    recorded_at: new Date().toISOString()
  });

  try {
    const list = Array.from(journalEntries.values()).slice(-2000);
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Journal] Warning writing journal:', e.message);
  }
}

loadJournal();

// ── 7. Render Formatters ────────────────────────────────────────────────────
function formatCustomerBill(json, paperWidth = 80) {
  const W = getLineWidth(paperWidth);
  let out = INIT;
  const isPreCheck = json.isPreCheck === true || json.title?.includes('PRE-CHECK') || json.title?.includes('GUEST CHECK');

  out += ALIGN_CENTER + BOLD_ON;
  out += (json.restaurant_name || adminSettings.restaurant_name || 'NÉO BEIRUT').toUpperCase() + '\n';
  out += NORMAL;
  if (json.company_legal_name || adminSettings.company_legal_name) {
    out += `${json.company_legal_name || adminSettings.company_legal_name}\n`;
  }
  if (json.mof_number || adminSettings.mof_number) {
    out += `MOF: ${json.mof_number || adminSettings.mof_number}\n`;
  }

  out += divider('=', W);
  out += BOLD_ON + DOUBLE_SIZE;
  out += isPreCheck ? 'GUEST CHECK\n' : 'TAX INVOICE\n';
  out += NORMAL + BOLD_ON;
  if (isPreCheck) out += '(NOT A TAX RECEIPT - PAY AT CASHIER)\n';
  out += NORMAL + divider('=', W);

  out += ALIGN_LEFT;
  out += padLine(`Order: #${json.order_id || json.id || 'N/A'}`, json.table_label ? `Table: ${json.table_label}` : 'Direct', W);
  out += padLine(`Server: ${json.waiter_name || json.server_name || 'Staff'}`, `Guests: ${json.guest_count || 1}`, W);
  out += padLine(`Date: ${new Date().toLocaleDateString()}`, `Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, W);

  out += divider('-', W);
  out += BOLD_ON + padLine('QTY  DESCRIPTION', 'TOTAL (USD)', W) + BOLD_OFF;
  out += divider('-', W);

  let subtotal = 0;
  for (const item of (json.items || [])) {
    const qty = Number(item.qty || item.quantity || 1);
    const unitPrice = Number(item.unit_price || item.price || 0);
    const lineTotal = Number(item.total_price !== undefined ? item.total_price : (unitPrice * qty));
    subtotal += lineTotal;

    const qtyStr = String(qty).padEnd(4);
    const nameStr = item.name || item.product_name || 'Item';
    const priceStr = `$${lineTotal.toFixed(2)}`;

    out += padLine(`${qtyStr} ${nameStr}`, priceStr, W);

    if (Array.isArray(item.customizations_print_text) && item.customizations_print_text.length > 0) {
      for (const line of item.customizations_print_text) {
        out += `       ${line}\n`;
      }
    }
  }

  out += divider('-', W);
  out += padLine('Subtotal:', `$${(Number(json.subtotal || json.subtotal_amount || subtotal)).toFixed(2)}`, W);

  const discount = Number(json.discount_amount || json.discount || 0);
  if (discount > 0) {
    out += padLine('Discount:', `-$${discount.toFixed(2)}`, W);
  }

  const deliveryFee = Number(json.delivery_fee || 0);
  if (deliveryFee > 0) {
    out += padLine('Delivery Fee:', `$${deliveryFee.toFixed(2)}`, W);
  }

  const vat = Number(json.vat_amount || 0);
  if (vat > 0) {
    out += padLine(`VAT (${adminSettings.vat_rate}%):`, `$${vat.toFixed(2)}`, W);
  }

  const total = Number(json.total || json.total_amount || (subtotal - discount + deliveryFee + vat));
  out += divider('=', W);
  out += BOLD_ON + DOUBLE_SIZE + padLine('TOTAL:', `$${total.toFixed(2)}`, W) + NORMAL;

  const rate = Number(json.exchange_rate || adminSettings.exchange_rate || 90000);
  const totalLbp = Math.round(total * rate);
  out += BOLD_ON + padLine('Total LBP:', `${totalLbp.toLocaleString()} L.L.`, W) + BOLD_OFF;
  out += padLine('Exchange Rate:', `1 USD = ${rate.toLocaleString()} LBP`, W);

  out += divider('-', W);
  out += ALIGN_CENTER;
  out += (json.footer || json.footer_message || adminSettings.receipt_footer) + '\n';
  out += FEED + CUT;
  return out;
}

function formatPreparationTicket(json, paperWidth = 80) {
  const W = getLineWidth(paperWidth);
  let out = INIT;
  const isCancelled = json.isCancellation === true || json.title?.includes('CANCELLED') || json.ticket_type === 'cancellation';
  const isReprint = json.is_reprint === true || json.title?.includes('REPRINT') || json.ticket_type === 'reprint';

  out += ALIGN_CENTER + BOLD_ON;
  if (isCancelled) {
    out += DOUBLE_SIZE + '*** ITEM CANCELLED ***\n' + NORMAL + BOLD_ON;
    if (json.reason) out += `REASON: ${json.reason}\n`;
  } else if (isReprint) {
    out += DOUBLE_SIZE + '*** REPRINT ***\n' + NORMAL + BOLD_ON;
    out += (json.title || 'PREPARATION TICKET') + '\n';
  } else {
    out += DOUBLE_SIZE + (json.title || 'PREPARATION TICKET') + '\n';
  }
  out += NORMAL + divider('=', W);

  if (json.printer_name || json.station) {
    out += ALIGN_CENTER + BOLD_ON + `STATION: ${(json.printer_name || json.station).toUpperCase()}\n` + BOLD_OFF;
  }

  out += ALIGN_LEFT;
  const tableStr = json.table_label || json.table_code || json.table || 'N/A';
  out += BOLD_ON + DOUBLE_WIDTH + padLine(`TABLE: ${tableStr}`, json.order_id ? `#${json.order_id}` : '', W) + NORMAL;
  out += padLine(`Server: ${json.waiter_name || json.waiter || 'Staff'}`, `Guests: ${json.guest_count || 1}`, W);
  out += padLine(`Time: ${json.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, `Round: #${json.fire_round || 1}`, W);

  out += divider('-', W);
  out += BOLD_ON + padLine('QTY  ITEM', 'STATION', W) + BOLD_OFF;
  out += divider('-', W);

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

  out += divider('=', W);
  out += ALIGN_CENTER + `FLOW POS Intelligent Routing • #${json.order_id || 'Chit'}\n`;
  out += FEED + CUT;
  return out;
}

function formatShiftReport(json, paperWidth = 80) {
  const W = getLineWidth(paperWidth);
  let out = INIT;
  const isX = json.isXReport === true || json.reportType?.includes('X REPORT');

  out += ALIGN_CENTER + BOLD_ON + DOUBLE_SIZE;
  out += (isX ? 'X REPORT\n' : 'SHIFT CLOSE REPORT\n') + NORMAL;
  out += BOLD_ON + (adminSettings.restaurant_name || 'NÉO BEIRUT').toUpperCase() + '\n' + BOLD_OFF;
  out += divider('=', W);

  out += ALIGN_LEFT;
  out += padLine(`Branch: ${json.branch || config.branch_name}`, `Terminal: ${json.terminal || 'TERM-1'}`, W);
  out += padLine(`Cashier: ${json.cashier || 'Staff'}`, `Shift: #${String(json.shiftId || '').slice(-6)}`, W);
  out += padLine(`Opened: ${json.openedAt ? new Date(json.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}`, `Generated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, W);
  out += divider('-', W);

  const fin = json.financialTotals || {};
  out += BOLD_ON + 'FINANCIAL TOTALS (USD)\n' + BOLD_OFF;
  out += padLine('  Gross Sales:', `$${Number(fin.grossSales || 0).toFixed(2)}`, W);
  out += padLine('  Total Discounts:', `-$${Number(fin.totalDiscounts || 0).toFixed(2)}`, W);
  out += padLine('  Total Refunds:', `-$${Number(fin.totalRefunds || 0).toFixed(2)}`, W);
  out += divider('-', W);
  out += BOLD_ON + padLine('  NET SALES:', `$${Number(fin.netSales || 0).toFixed(2)}`, W) + BOLD_OFF;
  out += padLine('  Total Orders / Covers:', `${fin.totalOrders || 0} / ${fin.totalCovers || 0}`, W);
  out += padLine('  Average Ticket:', `$${Number(fin.avgTicket || 0).toFixed(2)}`, W);

  const t = json.tenderBreakdown || {};
  out += divider('-', W);
  out += BOLD_ON + 'TENDER BREAKDOWN\n' + BOLD_OFF;
  out += padLine('  Cash USD:', `$${Number(t.cash_usd || 0).toFixed(2)}`, W);
  out += padLine('  Cash LBP:', `${Number(t.cash_lbp || 0).toLocaleString()} L.L.`, W);
  out += padLine('  Card USD:', `$${Number(t.card_usd || 0).toFixed(2)}`, W);
  out += padLine('  Whish USD:', `$${Number(t.whish_usd || 0).toFixed(2)}`, W);
  out += padLine('  Toters USD:', `$${Number(t.toters_usd || 0).toFixed(2)}`, W);
  out += padLine('  NokNok USD:', `$${Number(t.noknok_usd || 0).toFixed(2)}`, W);

  const rec = json.reconciliation || {};
  out += divider('=', W);
  out += BOLD_ON + 'CASH RECONCILIATION\n' + BOLD_OFF;
  out += padLine('  Expected Cash USD:', `$${Number(rec.expectedCashUsd || 0).toFixed(2)}`, W);
  out += padLine('  Actual Cash USD:', `$${Number(rec.actualCashUsd || 0).toFixed(2)}`, W);
  const diffUsd = Number(rec.varianceUsd || 0);
  out += BOLD_ON + padLine('  Variance USD:', `${diffUsd >= 0 ? '+' : ''}$${diffUsd.toFixed(2)}`, W) + BOLD_OFF;
  out += padLine('  Expected Cash LBP:', `${Number(rec.expectedCashLbp || 0).toLocaleString()} L.L.`, W);
  out += padLine('  Actual Cash LBP:', `${Number(rec.actualCashLbp || 0).toLocaleString()} L.L.`, W);

  out += divider('-', W);
  out += padLine('Manager Approval:', rec.managerApproval || 'Verified', W);
  if (rec.closingNotes) {
    out += `Notes: ${rec.closingNotes}\n`;
  }

  out += '\n\n' + padLine('Cashier Signature', 'Manager Signature', W) + '\n';
  out += FEED + CUT;
  return out;
}

// ── 8. Hardware Transports ──────────────────────────────────────────────────
async function sendToNetworkPrinter(host, port, payloadString) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(4000);

    let confirmedCut = false;

    socket.connect(port, host, () => {
      socket.write(payloadString, 'binary', () => {
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
        }, 350);
      });
    });

    socket.on('data', (data) => {
      if (data && data.length > 0) confirmedCut = true;
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
        status: 'failed',
        error: 'Socket transmission timed out (4s)',
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
      const tempFile = path.join(DATA_DIR, `spool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.bin`);
      fs.writeFileSync(tempFile, payloadString, 'binary');

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
            status: 'accepted',
            transport: 'windows_driver',
            printerName
          });
        } else {
          resolve({
            success: false,
            status: 'failed',
            error: err.message || `Windows Spooler failed to reach printer "${printerName}"`,
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

async function detectLocalWindowsPrinters() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    const psCmd = `Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json -Compress`;
    exec(`powershell -ExecutionPolicy Bypass -Command "${psCmd}"`, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

// ── 9. Intelligent Job Processor ────────────────────────────────────────────
async function processPrintJob(jobPayload, source = 'cloud') {
  const idempKey = jobPayload.idempotency_key || jobPayload.content?.idempotency_key;

  if (idempKey && journalEntries.has(idempKey)) {
    const existing = journalEntries.get(idempKey);
    console.log(`[PrintServer] Deduplication: Skipped duplicate job "${idempKey}" (Status: ${existing.status})`);
    return {
      success: true,
      duplicate: true,
      status: existing.status || 'confirmed',
      message: 'Job previously processed'
    };
  }

  let printerInfo = jobPayload.printer || {};
  const destinationKey = (jobPayload.destination || jobPayload.section_key || '').toLowerCase();

  if (!printerInfo.host && !printerInfo.ip_address && !printerInfo.windows_printer_name) {
    if (jobPayload.job_type === 'receipt' || jobPayload.job_type === 'bill' || jobPayload.job_type === 'pre_check' || jobPayload.content?.isCustomerBill) {
      printerInfo = adminSettings.mainReceiptPrinter || {};
    } else if (destinationKey) {
      const route = adminSettings.routes.find(r => r.section_key.toLowerCase() === destinationKey);
      if (route && route.printer) {
        printerInfo = route.printer;
      } else {
        const matchByName = adminSettings.printers.find(p => p.name.toLowerCase().includes(destinationKey));
        printerInfo = matchByName || adminSettings.fallbackPrinter || {};
      }
    } else {
      printerInfo = adminSettings.fallbackPrinter || adminSettings.mainReceiptPrinter || {};
    }
  }

  const isWindowsDriver = printerInfo.connection_type === 'windows_driver' || Boolean(printerInfo.windows_printer_name);
  const targetIp = printerInfo.host || printerInfo.ip_address || '192.168.10.110';
  const targetPort = Number(printerInfo.port) || 9100;
  const windowsPrinterName = printerInfo.windows_printer_name || printerInfo.name || 'POS-80';
  const paperWidth = Number(printerInfo.paper_width_mm) || 80;

  const content = jobPayload.content || jobPayload;
  let formattedData = '';

  if (content.reportType || jobPayload.job_type === 'shift_report' || content.isXReport !== undefined) {
    formattedData = formatShiftReport(content, paperWidth);
  } else if (content.isCustomerBill || jobPayload.job_type === 'receipt' || jobPayload.job_type === 'bill' || jobPayload.job_type === 'pre_check') {
    formattedData = formatCustomerBill(content, paperWidth);
  } else if (content.isKitchenTicket || jobPayload.job_type === 'prep_ticket' || content.type === 'kitchen_chit' || content.type === 'test_chit' || jobPayload.job_type === 'cancellation') {
    formattedData = formatPreparationTicket(content, paperWidth);
  } else if (jobPayload.rawText) {
    formattedData = INIT + jobPayload.rawText + FEED + CUT;
  } else {
    formattedData = formatPreparationTicket(content, paperWidth);
  }

  console.log(`[PrintServer] Dispatched (${source}) to ${isWindowsDriver ? `Spooler "${windowsPrinterName}"` : `TCP ${targetIp}:${targetPort}`}`);

  let result;
  if (isWindowsDriver) {
    result = await sendToWindowsSpooler(windowsPrinterName, formattedData);
  } else {
    result = await sendToNetworkPrinter(targetIp, targetPort, formattedData);
  }

  if (!result.success && adminSettings.fallbackPrinter && adminSettings.fallbackPrinter.id !== printerInfo.id) {
    const fb = adminSettings.fallbackPrinter;
    console.warn(`[PrintServer] Primary printer failed. Failing over to Fallback "${fb.name}" (${fb.ip_address})...`);
    if (fb.connection_type === 'windows_driver' || fb.windows_printer_name) {
      result = await sendToWindowsSpooler(fb.windows_printer_name || fb.name, formattedData);
    } else {
      result = await sendToNetworkPrinter(fb.ip_address, fb.port || 9100, formattedData);
    }
  }

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

// ── 10. Outbound Cloud Queue Worker ─────────────────────────────────────────
let isPolling = false;
let lastCloudSyncAt = null;

async function pollPendingCloudJobs() {
  if (isPolling) return;
  isPolling = true;

  try {
    const { data: jobs, error } = await supabase
      .from('pos_print_jobs')
      .select('*, printer:pos_printers(*)')
      .eq('branch_id', config.branch_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(6);

    if (error) return;

    lastCloudSyncAt = new Date().toISOString();

    if (jobs && jobs.length > 0) {
      console.log(`[CloudPoller] Picked up ${jobs.length} pending job(s) from Admin Cloud queue.`);

      for (const job of jobs) {
        await supabase
          .from('pos_print_jobs')
          .update({
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id)
          .eq('status', 'pending');

        const jobPayload = {
          id: job.id,
          idempotency_key: job.idempotency_key,
          job_type: job.job_type,
          destination: job.section_key,
          printer: job.printer ? {
            name: job.printer.name,
            host: job.printer.ip_address,
            port: job.printer.port || 9100,
            connection_type: job.printer.connection_type,
            windows_printer_name: job.printer.windows_printer_name,
            paper_width_mm: job.printer.paper_width_mm
          } : null,
          content: job.payload
        };

        const result = await processPrintJob(jobPayload, 'cloud_queue');

        await supabase
          .from('pos_print_jobs')
          .update({
            status: result.status,
            error_message: result.error || null,
            completed_at: result.success ? new Date().toISOString() : null
          })
          .eq('id', job.id);
      }
    }
  } catch (err) {
  } finally {
    isPolling = false;
  }
}

function initRealtime() {
  if (!config.enable_realtime) return;
  try {
    supabase
      .channel('flow:print_server')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pos_print_jobs',
        filter: `branch_id=eq.${config.branch_id}`
      }, () => {
        pollPendingCloudJobs();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pos_printers'
      }, () => {
        syncAdminSettings();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pos_printer_section_routes'
      }, () => {
        syncAdminSettings();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_settings'
      }, () => {
        syncAdminSettings();
      })
      .subscribe();
  } catch (e) {
    console.warn('[Realtime] Warning connecting realtime:', e.message);
  }
}

setInterval(pollPendingCloudJobs, config.poll_interval_ms);
initRealtime();

// ── 11. Local HTTP Server & Web Dashboard ───────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-FLOW-Print-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/status' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const localIps = getLocalIpAddresses();
    return res.end(JSON.stringify({
      ok: true,
      service: 'FLOW Print Server',
      version: '2.2.0',
      printer: adminSettings.mainReceiptPrinter ? `${adminSettings.mainReceiptPrinter.name} (${adminSettings.printers.length} online)` : 'Online',
      branch: config.branch_name,
      branch_id: config.branch_id,
      machine_id: config.machine_id,
      uptime_seconds: Math.round(process.uptime()),
      cloud_sync_at: adminSettings.lastSyncAt || lastCloudSyncAt,
      ip_addresses: localIps.map(i => i.address),
      printers_count: adminSettings.printers.length,
      exchange_rate: adminSettings.exchange_rate,
      vat_rate: adminSettings.vat_rate
    }));
  }

  if (req.url.startsWith('/ping')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const host = urlObj.searchParams.get('host') || '192.168.10.110';
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

  if (req.url === '/api/printers') {
    const winPrinters = await detectLocalWindowsPrinters();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      synced_from_admin: adminSettings.printers,
      windows_spooler_printers: winPrinters,
      routes: adminSettings.routes,
      exchange_rate: adminSettings.exchange_rate,
      last_sync: adminSettings.lastSyncAt
    }));
  }

  if (req.url === '/api/sync' && req.method === 'POST') {
    await syncAdminSettings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, synced_at: adminSettings.lastSyncAt, printers: adminSettings.printers }));
  }

  if (req.url === '/api/test-print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let targetPrinter = null;
      try {
        const p = JSON.parse(body);
        if (p.printer_id) {
          targetPrinter = adminSettings.printers.find(x => x.id === p.printer_id);
        } else if (p.ip) {
          targetPrinter = { ip_address: p.ip, port: p.port || 9100, name: 'Manual Test' };
        } else if (p.windows_printer_name) {
          targetPrinter = { connection_type: 'windows_driver', windows_printer_name: p.windows_printer_name, name: p.windows_printer_name };
        }
      } catch (e) {}

      if (!targetPrinter) targetPrinter = adminSettings.mainReceiptPrinter || adminSettings.fallbackPrinter;

      const testPayload = {
        printer: targetPrinter,
        job_type: 'test_chit',
        idempotency_key: `test_manual_${Date.now()}`,
        content: {
          isKitchenTicket: true,
          title: '*** HARDWARE TEST CHIT ***',
          printer_name: targetPrinter?.name || 'Default Printer',
          timestamp: new Date().toLocaleString(),
          items: [
            { name: 'POS Print Server v2.2.0 Active', qty: 1, note: `Machine: ${config.machine_id}` },
            { name: 'Hardware Dispatch Status: OK', qty: 1, note: targetPrinter?.ip_address ? `TCP ${targetPrinter.ip_address}:${targetPrinter.port || 9100}` : `Spooler: ${targetPrinter?.windows_printer_name}` }
          ]
        }
      };

      const result = await processPrintJob(testPayload, 'manager_ui');
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (req.url === '/manager' || req.url === '/' || req.url.startsWith('/manager/')) {
    const localIps = getLocalIpAddresses();
    const winPrinters = await detectLocalWindowsPrinters();

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const managerHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FLOW Print Server Manager</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{background:#0f172a;color:#f8fafc;font-family:-apple-system,sans-serif;padding:24px}.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:20px}.btn{background:#1e5c4f;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-weight:700;cursor:pointer}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:8px;border-bottom:1px solid #334155}</style></head><body><div class="card"><h1>🖨️ FLOW Print Server v2.2.0</h1><p>Branch: <strong>${config.branch_name}</strong> | Local IP: <strong style="color:#38bdf8">${localIps.map(i=>i.address).join(', ')}</strong></p><p>Printers synced from Admin: <strong>${adminSettings.printers.length}</strong> | Exchange Rate: <strong>${adminSettings.exchange_rate} LBP</strong></p><button class="btn" onclick="fetch('/api/test-print',{method:'POST'}).then(r=>r.json()).then(d=>alert(JSON.stringify(d)))">Print Test Chit</button></div></body></html>`;
    return res.end(managerHtml);
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(config.http_port, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log(`================================================================`);
  console.log(`  FLOW Print Server v2.2.0 Started Successfully`);
  console.log(`  Branch: ${config.branch_name} (${config.branch_id})`);
  console.log(`  Local IPs: ${localIps.map(i => i.address).join(', ') || '127.0.0.1'}`);
  console.log(`  HTTP Bridge: http://0.0.0.0:${config.http_port}`);
  console.log(`  Dashboard Manager: http://localhost:${config.http_port}/manager`);
  console.log(`================================================================`);
});
