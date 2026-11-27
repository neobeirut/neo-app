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
const zlib = require('zlib');
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
// Automatically refreshed from database so changes in Admin apply instantly!
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

    // Parallel fetch from Supabase
    const [printersRes, routesRes, appSettingsRes, branchRes, conceptsRes] = await Promise.allSettled([
      supabase.from('pos_printers').select('*').eq('restaurant_id', rId).eq('branch_id', bId).eq('is_active', true).order('name'),
      supabase.from('pos_printer_section_routes').select('*, printer:pos_printers(*)').eq('restaurant_id', rId).eq('branch_id', bId),
      supabase.from('app_settings').select('*'),
      supabase.from('branches').select('*').eq('id', bId).single(),
      supabase.from('business_concepts').select('id, code, name, logo_url, legal_entity_name, mof_tax_number')
    ]);

    // 1. Process Printers
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

    // 2. Process Section Routes
    if (routesRes.status === 'fulfilled' && routesRes.value.data) {
      adminSettings.routes = routesRes.value.data;
    }

    // 3. Process App Settings
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
      if (sMap.receipt_footer_text) adminSettings.receipt_footer = sMap.receipt_footer_text;
      if (sMap.restaurant_name) adminSettings.restaurant_name = sMap.restaurant_name;
      if (sMap.receipt_restaurant_name) adminSettings.restaurant_name = sMap.receipt_restaurant_name;
      if (sMap.company_legal_name || sMap.company_name) adminSettings.company_legal_name = sMap.company_legal_name || sMap.company_name;
      if (sMap.mof_number) adminSettings.mof_number = sMap.mof_number;
      if (sMap.logo_url) adminSettings.logo_url = sMap.logo_url;
    }

    // 4. Branch Name
    if (branchRes.status === 'fulfilled' && branchRes.value.data) {
      config.branch_name = branchRes.value.data.name || config.branch_name;
    }

    // 5. Concept Logos & Metadata
    if (conceptsRes.status === 'fulfilled' && Array.isArray(conceptsRes.value.data)) {
      const nextLogos = {};
      const nextConcepts = {};
      conceptsRes.value.data.forEach(c => {
        if (!c) return;
        if (c.id) nextConcepts[c.id] = c;
        if (c.code) nextConcepts[String(c.code).toUpperCase()] = c;
        if (c.name) nextConcepts[String(c.name).toUpperCase()] = c;
        if (c.logo_url) {
          if (c.id) nextLogos[c.id] = c.logo_url;
          if (c.code) nextLogos[String(c.code).toUpperCase()] = c.logo_url;
          if (c.name) nextLogos[String(c.name).toUpperCase()] = c.logo_url;
        }
      });
      adminSettings.conceptLogos = nextLogos;
      adminSettings.conceptsByKey = nextConcepts;
    }

    adminSettings.lastSyncAt = new Date().toISOString();
    // Silent success log
  } catch (err) {
    console.warn('[AdminSync] Could not refresh admin settings (will retry):', err.message);
  }
}

// Initial Sync and recurring poll
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
const DOUBLE_SIZE    = ESC + '!\x30';
const DOUBLE_WIDTH   = ESC + '!\x20';
const DOUBLE_HEIGHT  = ESC + '!\x10';
const NORMAL         = ESC + '!\x00';
const FONT_A         = ESC + 'M\x00';
const LETTER_SPACE_2 = ESC + ' \x02';
const LETTER_SPACE_0 = ESC + ' \x00';
const LINE_SPACE_LG  = ESC + '3\x48';
const LINE_SPACE_DEF = ESC + '2';
const CUT          = GS  + 'V\x41\x00';
const FEED         = '\n\n\n\n';
const DLE_EOT_1    = '\x10\x04\x01'; // Query printer real-time status

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
const logoRasterCache = new Map();

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function pngBufferToEscPosRaster(buf, maxWidthPx = 280, maxHeightPx = 140) {
  try {
    if (!Buffer.isBuffer(buf) || buf.length < 33) return '';
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return '';

    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    let palette = null;
    let trns = null;
    const idatChunks = [];
    let offset = 8;
    while (offset + 12 <= buf.length) {
      const length = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > buf.length) break;
      if (type === 'IHDR') {
        width = buf.readUInt32BE(dataStart);
        height = buf.readUInt32BE(dataStart + 4);
        bitDepth = buf[dataStart + 8];
        colorType = buf[dataStart + 9];
      } else if (type === 'PLTE') {
        palette = buf.subarray(dataStart, dataEnd);
      } else if (type === 'tRNS') {
        trns = buf.subarray(dataStart, dataEnd);
      } else if (type === 'IDAT') {
        idatChunks.push(buf.subarray(dataStart, dataEnd));
      } else if (type === 'IEND') {
        break;
      }
      offset = dataEnd + 4;
    }

    if (!width || !height || bitDepth !== 8 || idatChunks.length === 0) return '';
    const bppMap = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const bpp = bppMap[colorType];
    if (!bpp) return '';

    const raw = zlib.inflateSync(Buffer.concat(idatChunks));
    const stride = width * bpp;
    const pixels = Buffer.alloc(height * stride);

    for (let y = 0; y < height; y++) {
      const filterType = raw[y * (stride + 1)];
      const rowSrc = y * (stride + 1) + 1;
      const rowDst = y * stride;
      for (let x = 0; x < stride; x++) {
        const val = raw[rowSrc + x];
        const a = x >= bpp ? pixels[rowDst + x - bpp] : 0;
        const b = y > 0 ? pixels[rowDst - stride + x] : 0;
        const c = (x >= bpp && y > 0) ? pixels[rowDst - stride + x - bpp] : 0;
        let recon = val;
        if (filterType === 1) recon = (val + a) & 0xff;
        else if (filterType === 2) recon = (val + b) & 0xff;
        else if (filterType === 3) recon = (val + ((a + b) >> 1)) & 0xff;
        else if (filterType === 4) recon = (val + paethPredictor(a, b, c)) & 0xff;
        pixels[rowDst + x] = recon;
      }
    }

    const scale = Math.min(1, maxWidthPx / width, maxHeightPx / height);
    const outW = Math.max(8, Math.floor(width * scale));
    const outH = Math.max(8, Math.floor(height * scale));
    const widthBytes = Math.ceil(outW / 8);
    const raster = Buffer.alloc(widthBytes * outH);

    for (let y = 0; y < outH; y++) {
      const srcY = Math.min(height - 1, Math.floor(y / scale));
      for (let x = 0; x < outW; x++) {
        const srcX = Math.min(width - 1, Math.floor(x / scale));
        const idx = srcY * stride + srcX * bpp;
        let r = 255, g = 255, b = 255, a = 255;
        if (colorType === 6) {
          r = pixels[idx]; g = pixels[idx + 1]; b = pixels[idx + 2]; a = pixels[idx + 3];
        } else if (colorType === 2) {
          r = pixels[idx]; g = pixels[idx + 1]; b = pixels[idx + 2];
        } else if (colorType === 4) {
          r = g = b = pixels[idx]; a = pixels[idx + 1];
        } else if (colorType === 0) {
          r = g = b = pixels[idx];
        } else if (colorType === 3 && palette) {
          const pIdx = pixels[idx];
          r = palette[pIdx * 3] ?? 255;
          g = palette[pIdx * 3 + 1] ?? 255;
          b = palette[pIdx * 3 + 2] ?? 255;
          if (trns && pIdx < trns.length) a = trns[pIdx];
        }
        const alpha = a / 255;
        const cr = r * alpha + 255 * (1 - alpha);
        const cg = g * alpha + 255 * (1 - alpha);
        const cb = b * alpha + 255 * (1 - alpha);
        const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
        if (lum < 165) {
          raster[y * widthBytes + (x >> 3)] |= (0x80 >> (x & 7));
        }
      }
    }

    const header = Buffer.from([
      0x1d, 0x76, 0x30, 0x00,
      widthBytes & 0xff, (widthBytes >> 8) & 0xff,
      outH & 0xff, (outH >> 8) & 0xff
    ]);
    return ALIGN_CENTER + Buffer.concat([header, raster]).toString('latin1') + '\n';
  } catch (err) {
    console.warn('[PrintServer] Logo PNG raster conversion warning:', err.message);
    return '';
  }
}

async function getEscPosLogo(logoUrl, paperWidth = 80) {
  if (!logoUrl || typeof logoUrl !== 'string') return '';
  const trimmed = logoUrl.trim();
  if (!trimmed) return '';
  const maxW = paperWidth === 58 ? 200 : 280;
  const maxH = paperWidth === 58 ? 100 : 140;
  const cacheKey = `${trimmed}_${maxW}`;
  if (logoRasterCache.has(cacheKey)) return logoRasterCache.get(cacheKey);
  try {
    let buf = null;
    if (trimmed.startsWith('data:image/png;base64,')) {
      buf = Buffer.from(trimmed.slice('data:image/png;base64,'.length), 'base64');
    } else if (/^https?:\/\//i.test(trimmed)) {
      const res = await fetch(trimmed, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        buf = Buffer.from(await res.arrayBuffer());
      }
    } else if (fs.existsSync(trimmed)) {
      buf = fs.readFileSync(trimmed);
    }
    const escpos = buf ? pngBufferToEscPosRaster(buf, maxW, maxH) : '';
    logoRasterCache.set(cacheKey, escpos);
    return escpos;
  } catch (err) {
    console.warn('[PrintServer] Could not load logo for receipt:', err.message);
    return '';
  }
}

/**
 * 1. Customer Bill / Guest Check / Receipt
 */
async function formatCustomerBill(json, paperWidth = 80) {
  const W = getLineWidth(paperWidth);
  let out = INIT;
  const isPreCheck = json.isPreCheck === true || json.title?.includes('PRE-CHECK') || json.title?.includes('GUEST CHECK');

  const conceptsByKey = adminSettings.conceptsByKey || {};
  const conceptMeta =
    (json.concept_id && conceptsByKey[json.concept_id]) ||
    (json.concept_code && conceptsByKey[String(json.concept_code).toUpperCase()]) ||
    (json.concept_name && conceptsByKey[String(json.concept_name).toUpperCase()]) ||
    null;
  const hasExplicitConcept = Boolean(json.concept_id || json.concept_code || json.concept_name);
  const isDefaultNeo =
    !hasExplicitConcept ||
    json.concept_id === '00000000-0000-0000-0000-000000000001' ||
    String(json.concept_code || '').toUpperCase() === 'NEO' ||
    String(json.concept_name || '').toUpperCase().startsWith('NÉO') ||
    String(json.concept_name || '').toUpperCase().startsWith('NEO');
  const conceptLogoMap = adminSettings.conceptLogos || {};
  const dbConceptLogo =
    (conceptMeta && conceptMeta.logo_url) ||
    (json.concept_id && conceptLogoMap[json.concept_id]) ||
    (json.concept_code && conceptLogoMap[String(json.concept_code).toUpperCase()]) ||
    (json.concept_name && conceptLogoMap[String(json.concept_name).toUpperCase()]) ||
    '';
  const payloadLogo =
    json.logo_url && (isDefaultNeo || (json.logo_url !== adminSettings.logo_url && !String(json.logo_url).toLowerCase().includes('neobeirut.com')))
      ? json.logo_url
      : '';
  const conceptLogoUrl =
    dbConceptLogo ||
    payloadLogo ||
    (isDefaultNeo ? (adminSettings.logo_url || '') : '');

  const logoRaster = await getEscPosLogo(conceptLogoUrl, paperWidth);
  if (logoRaster) {
    out += logoRaster;
  }

  out += ALIGN_CENTER + BOLD_ON;
  const headerBrandName = (json.concept_name || (conceptMeta && conceptMeta.name) || json.restaurant_name || adminSettings.restaurant_name || 'NÉO BEIRUT').toUpperCase();
  if (!logoRaster) {
    out += DOUBLE_SIZE + headerBrandName + '\n' + NORMAL;
  } else {
    out += headerBrandName + '\n' + NORMAL;
  }

  out += divider('=', W);
  out += BOLD_ON + DOUBLE_SIZE;
  out += isPreCheck ? 'GUEST CHECK\n' : 'RECEIPT\n';
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

    // Increased prominence/font weight for item line
    out += BOLD_ON + padLine(`${qtyStr} ${nameStr}`, priceStr, W) + BOLD_OFF;

    const rawMods = item.modifiers || item.selectedCustomizations || item.customizations || [];
    const pricedMods = Array.isArray(rawMods)
      ? rawMods.filter(m => m && typeof m === 'object' && Number(m.price ?? m.unit_price ?? m.price_delta ?? m.extra_price ?? 0) > 0)
      : [];
    if (pricedMods.length > 0) {
      for (const mod of pricedMods) {
        const modName = String(mod.name || mod.ingredient || mod.option_name || mod.label || '').trim();
        if (!modName) continue;
        const modQty = Number(mod.quantity || mod.qty || 1);
        const modPrice = Number(mod.price ?? mod.unit_price ?? mod.price_delta ?? mod.extra_price ?? 0) * modQty;
        const qtyTag = modQty > 1 ? ` x${modQty}` : '';
        out += padLine(`     + ${modName}${qtyTag}`, `+$${modPrice.toFixed(2)}`, W);
      }
    } else if (Array.isArray(item.customizations_print_text) && item.customizations_print_text.length > 0) {
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

  // Total in USD displayed on the same line as TOTAL
  out += BOLD_ON + padLine('TOTAL USD:', `$${total.toFixed(2)}`, W) + '\n' + BOLD_OFF;

  // Live currency conversion from Admin exchange rate setting
  const rate = Number(json.exchange_rate || adminSettings.exchange_rate || 90000);
  if (rate > 0) {
    const totalLbp = Math.round(total * rate);
    out += BOLD_ON + padLine('TOTAL LBP:', `${totalLbp.toLocaleString()} L.L.`, W) + '\n' + BOLD_OFF;
  }

  // Company Name, MOF, and Exchange Rate at the bottom
  out += divider('-', W);
  out += ALIGN_CENTER;
  const compLegalName = json.company_legal_name || (conceptMeta && conceptMeta.legal_entity_name) || adminSettings.company_legal_name;
  if (compLegalName) {
    out += BOLD_ON + `${compLegalName}\n` + BOLD_OFF;
  }
  const mof = json.mof_number || (conceptMeta && conceptMeta.mof_tax_number) || adminSettings.mof_number;
  if (mof) {
    out += `MOF: ${mof}\n`;
  }
  if (rate > 0) {
    out += `Rate: 1 USD = ${rate.toLocaleString()} LBP\n`;
  }

  out += divider('-', W);
  out += (json.footer || json.footer_message || adminSettings.receipt_footer) + '\n';
  out += FEED + CUT;
  return out;
}

/**
 * 2. Preparation Ticket (Kitchen, Bar, Bakery, Pastry)
 */
function formatPreparationTicket(json, paperWidth = 80) {
  const W = paperWidth === 58 ? 28 : 38;
  let out = INIT + FONT_A + LINE_SPACE_LG + LETTER_SPACE_2;
  const isCancelled = json.isCancellation === true || json.title?.includes('CANCELLED') || json.ticket_type === 'cancellation';
  const isReprint = json.is_reprint === true || json.title?.includes('REPRINT') || json.ticket_type === 'reprint';

  out += ALIGN_CENTER + BOLD_ON;
  const conceptName = String(json.concept_name || json.conceptName || json.concept_code || json.restaurant_name || adminSettings.restaurant_name || '').trim();
  if (conceptName) {
    out += DOUBLE_SIZE + conceptName.toUpperCase() + '\n' + NORMAL + BOLD_ON;
  }
  const rawTitle = String(json.title || json.station || json.section_key || 'KITCHEN')
    .replace(/\*/g, '')
    .replace(/\bPREPARATION\s+CHIT\b/i, '')
    .replace(/\bPREPARATION\s+TICKET\b/i, '')
    .replace(/\bCHIT\b/i, '')
    .trim();
  const cleanTitle = rawTitle || String(json.station || json.section_key || 'KITCHEN').trim().toUpperCase();
  if (isCancelled) {
    out += DOUBLE_SIZE + '*** ITEM CANCELLED ***\n' + NORMAL + BOLD_ON;
    if (json.reason) out += `REASON: ${json.reason}\n`;
  } else if (isReprint) {
    out += DOUBLE_SIZE + '*** REPRINT ***\n' + NORMAL + BOLD_ON;
    out += cleanTitle.toUpperCase() + '\n';
  } else {
    out += DOUBLE_SIZE + cleanTitle.toUpperCase() + '\n';
  }
  out += NORMAL + divider('=', W);

  if (json.printer_name || json.station) {
    out += ALIGN_CENTER + BOLD_ON + `STATION: ${(json.printer_name || json.station).toUpperCase()}\n` + BOLD_OFF;
  }

  out += ALIGN_LEFT;
  const serviceTypeLower = String(json.service_type || json.order_type || '').toLowerCase();
  const rawTable = json.table_code || json.table_label || json.table || '';
  const hasTableValue = Boolean(rawTable && String(rawTable).trim() !== '' && String(rawTable).trim().toUpperCase() !== 'N/A');
  const isNonTableService = ['takeout', 'pickup', 'delivery', 'sell', 'direct', 'pos', 'counter', 'walkin', 'walk-in'].includes(serviceTypeLower);
  const isTableOrder = Boolean(json.table_code) || (hasTableValue && !isNonTableService);

  if (isTableOrder) {
    const tableStr = String(rawTable).replace(/^table\s+/i, '').trim() || 'N/A';
    out += BOLD_ON + DOUBLE_SIZE + `TABLE: ${tableStr}` + (json.order_id ? ` #${json.order_id}` : '') + '\n' + NORMAL + BOLD_OFF;
  } else {
    const orderNum = json.order_id || json.id || 'N/A';
    const clientName = String(json.customer_name || json.client_name || (hasTableValue ? rawTable : '') || '').trim();
    out += BOLD_ON + DOUBLE_SIZE + `Order: #${orderNum}\n` + NORMAL + BOLD_OFF;
    if (clientName) {
      out += BOLD_ON + `Client: ${clientName}\n` + BOLD_OFF;
    }
  }
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

    let rawMods = item.modifiers || item.selectedCustomizations || item.customizations || [];
    if (typeof rawMods === 'string') {
      try {
        const parsed = JSON.parse(rawMods);
        rawMods = Array.isArray(parsed) ? parsed : rawMods.split(',').map(s => s.trim()).filter(Boolean);
      } catch {
        rawMods = rawMods.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (!Array.isArray(rawMods)) rawMods = [];
    if (rawMods.length === 0) {
      if (Array.isArray(item.addons)) {
        rawMods = rawMods.concat(item.addons.map(a => typeof a === 'string' ? { name: a, customization_type: 'addon' } : { ...a, customization_type: a.customization_type || 'addon' }));
      }
      if (Array.isArray(item.removals)) {
        rawMods = rawMods.concat(item.removals.map(r => typeof r === 'string' ? { name: r, customization_type: 'removal', action: 'remove' } : { ...r, customization_type: 'removal', action: 'remove' }));
      }
    }

    if (rawMods.length > 0) {
      for (const mod of rawMods) {
        let modName = '';
        let isRemoval = false;
        let groupName = '';
        let modQty = 1;
        if (typeof mod === 'string') {
          modName = mod.trim();
          isRemoval = modName.toLowerCase().startsWith('no ') || modName.toLowerCase().startsWith('without ') || modName.toLowerCase().startsWith('remove:') || modName.toLowerCase().startsWith('remove ') || modName.startsWith('- ');
        } else if (typeof mod === 'object' && mod !== null) {
          modName = String(mod.name || mod.ingredient || mod.option_name || mod.label || mod.customization_name || '').trim();
          groupName = String(mod.option_group_name || '').trim();
          modQty = Number(mod.quantity || mod.qty || 1);
          const groupLower = groupName.toLowerCase();
          const typeLower = String(mod.customization_type || mod.type || '').toLowerCase();
          isRemoval = (
            mod.action === 'remove' ||
            mod.action === 'no' ||
            typeLower === 'removal' ||
            typeLower === 'remove' ||
            groupLower.includes('remove') ||
            modName.toLowerCase().startsWith('no ') ||
            modName.toLowerCase().startsWith('without ') ||
            modName.toLowerCase().startsWith('remove:') ||
            modName.toLowerCase().startsWith('remove ') ||
            modName.startsWith('- ')
          );
        }
        if (!modName) continue;
        const cleanName = modName.replace(/^\[?[-+]\s*\]?\s*/i, '').replace(/^(no|without|remove:?)\s+/i, '').replace(/\]$/, '').trim();
        const qtySuffix = modQty > 1 ? ` x${modQty}` : '';
        if (isRemoval) {
          out += BOLD_ON + `       * REMOVE: ${cleanName || modName}\n` + BOLD_OFF;
        } else {
          const groupLower = groupName.toLowerCase();
          const isGenericAddon = !groupName || ['general', 'add on', 'add-on', 'addon', 'add-ons', 'addons', 'add ons', 'add_on', 'add_ons', 'extra', 'extras'].includes(groupLower);
          const label = isGenericAddon ? 'ADD ON' : groupName.toUpperCase();
          out += `       + ${label}: ${cleanName || modName}${qtySuffix}\n`;
        }
      }
    }

    if (item.note || item.comment || item.notes) {
      out += BOLD_ON + `       NOTE: ${item.note || item.comment || item.notes}\n` + BOLD_OFF;
    }
  }

  out += LETTER_SPACE_0 + LINE_SPACE_DEF + NORMAL + FEED + CUT;
  return out;
}

/**
 * 3. Shift Report (X Report / Shift Close Z Report)
 */
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

  // Financials
  const fin = json.financialTotals || {};
  out += BOLD_ON + 'FINANCIAL TOTALS (USD)\n' + BOLD_OFF;
  out += padLine('  Gross Sales:', `$${Number(fin.grossSales || 0).toFixed(2)}`, W);
  out += padLine('  Total Discounts:', `-$${Number(fin.totalDiscounts || 0).toFixed(2)}`, W);
  out += padLine('  Total Refunds:', `-$${Number(fin.totalRefunds || 0).toFixed(2)}`, W);
  out += divider('-', W);
  out += BOLD_ON + padLine('  NET SALES:', `$${Number(fin.netSales || 0).toFixed(2)}`, W) + BOLD_OFF;
  out += padLine('  Total Orders / Covers:', `${fin.totalOrders || 0} / ${fin.totalCovers || 0}`, W);
  out += padLine('  Average Ticket:', `$${Number(fin.avgTicket || 0).toFixed(2)}`, W);

  // Tenders
  const t = json.tenderBreakdown || {};
  out += divider('-', W);
  out += BOLD_ON + 'TENDER BREAKDOWN\n' + BOLD_OFF;
  out += padLine('  Cash USD:', `$${Number(t.cash_usd || 0).toFixed(2)}`, W);
  out += padLine('  Cash LBP:', `${Number(t.cash_lbp || 0).toLocaleString()} L.L.`, W);
  out += padLine('  Card USD:', `$${Number(t.card_usd || 0).toFixed(2)}`, W);
  out += padLine('  Whish USD:', `$${Number(t.whish_usd || 0).toFixed(2)}`, W);
  out += padLine('  Toters USD:', `$${Number(t.toters_usd || 0).toFixed(2)}`, W);
  out += padLine('  NokNok USD:', `$${Number(t.noknok_usd || 0).toFixed(2)}`, W);

  // Cash Reconciliation
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

/**
 * Transport 1: Direct Network Raw TCP Socket (Port 9100)
 */
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

/**
 * Transport 2: Windows Print Spooler (Direct USB / Windows Driver)
 */
async function sendToWindowsSpooler(printerName, payloadString) {
  return new Promise((resolve) => {
    try {
      const spoolId = `spool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const binFile = path.join(DATA_DIR, `${spoolId}.bin`);
      const ps1File = path.join(DATA_DIR, `${spoolId}.ps1`);

      fs.writeFileSync(binFile, payloadString, 'binary');

      const psScript = `
$code = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public class FlowRawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool Print(string printer, byte[] bytes) {
        IntPtr h = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "FLOW Receipt";
        di.pDataType = "RAW";
        if (OpenPrinter(printer, out h, IntPtr.Zero)) {
            if (StartDocPrinter(h, 1, di)) {
                if (StartPagePrinter(h)) {
                    IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, p, bytes.Length);
                    int w = 0;
                    WritePrinter(h, p, bytes.Length, out w);
                    Marshal.FreeCoTaskMem(p);
                    EndPagePrinter(h);
                }
                EndDocPrinter(h);
            }
            ClosePrinter(h);
            return true;
        }
        return false;
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

$printer = "${printerName}";
$binPath = "${binFile.replace(/\\/g, '\\\\')}";
if (Test-Path $binPath) {
    $bytes = [System.IO.File]::ReadAllBytes($binPath);
    if ([FlowRawPrinter]::Print($printer, $bytes)) {
        Write-Host "PRINT_OK";
        exit 0;
    }
}
exit 1;
`;

      fs.writeFileSync(ps1File, psScript, 'utf8');

      exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1File}"`, (err, stdout, stderr) => {
        try { fs.unlinkSync(binFile); } catch (e) {}
        try { fs.unlinkSync(ps1File); } catch (e) {}

        if (!err && (stdout || '').includes('PRINT_OK')) {
          console.log(`[PrintServer] Windows Spooler accepted RAW job for "${printerName}"`);
          resolve({
            success: true,
            status: 'accepted',
            transport: 'windows_driver',
            printerName
          });
        } else {
          console.error(`[PrintServer] Windows Spooler error for "${printerName}":`, err ? err.message : stderr);
          resolve({
            success: false,
            status: 'failed',
            error: err ? err.message : (stderr || `Spooler failed for ${printerName}`),
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
 * Detect local Windows Spooler printers
 */
async function detectLocalWindowsPrinters() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve([]);
    }
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

  // 1. Deduplication
  if (idempKey) {
    if (journalEntries.has(idempKey)) {
      const existing = journalEntries.get(idempKey);
      if (existing.status === 'in_flight' || existing.status === 'confirmed' || existing.status === 'success') {
        console.log(`[PrintServer] Deduplication: Skipped duplicate job "${idempKey}" (Status: ${existing.status})`);
        return {
          success: true,
          duplicate: true,
          status: existing.status || 'confirmed',
          message: 'Job previously processed or in-flight'
        };
      }
    }
    // Mark in-flight immediately to prevent concurrent duplicates from processing
    journalEntries.set(idempKey, {
      idempotency_key: idempKey,
      printer: jobPayload.printer?.name || 'Resolving...',
      source,
      status: 'in_flight',
      recorded_at: new Date().toISOString()
    });
  }

  // 2. Resolve Destination Printer dynamically from Admin settings
  let printerInfo = jobPayload.printer || {};
  const destinationKey = (jobPayload.destination || jobPayload.section_key || '').toLowerCase();

  // If printer not explicitly provided, resolve from Admin synced catalog
  if (!printerInfo.host && !printerInfo.ip_address && !printerInfo.windows_printer_name) {
    if (jobPayload.job_type === 'receipt' || jobPayload.job_type === 'bill' || jobPayload.job_type === 'pre_check' || jobPayload.content?.isCustomerBill) {
      printerInfo = adminSettings.mainReceiptPrinter || {};
    } else if (destinationKey) {
      // Find matching section route
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

  const connType = String(printerInfo.connection_type || '').toLowerCase();
  const isExplicitNetwork = ['network', 'tcp', 'ethernet', 'lan', 'ip'].includes(connType) && Boolean(printerInfo.host || printerInfo.ip_address);
  const isWindowsDriver = !isExplicitNetwork && (connType === 'windows_driver' || connType === 'usb' || Boolean(printerInfo.windows_printer_name));
  const targetIp = printerInfo.host || printerInfo.ip_address || '192.168.10.110';
  const targetPort = Number(printerInfo.port) || 9100;
  let windowsPrinterName = printerInfo.windows_printer_name || printerInfo.name || 'invoice';
  if (!windowsPrinterName || windowsPrinterName === 'Generic / Text Only' || windowsPrinterName === 'POS-80') {
    windowsPrinterName = 'invoice';
  }
  const paperWidth = Number(printerInfo.paper_width_mm) || 80;

  // 3. Format Payload
  const content = jobPayload.content || jobPayload;
  let formattedData = '';

  if (content.reportType || jobPayload.job_type === 'shift_report' || content.isXReport !== undefined) {
    formattedData = formatShiftReport(content, paperWidth);
  } else if (content.isCustomerBill || jobPayload.job_type === 'receipt' || jobPayload.job_type === 'bill' || jobPayload.job_type === 'pre_check') {
    formattedData = await formatCustomerBill(content, paperWidth);
  } else if (content.isKitchenTicket || jobPayload.job_type === 'prep_ticket' || content.type === 'kitchen_chit' || content.type === 'test_chit' || jobPayload.job_type === 'cancellation') {
    formattedData = formatPreparationTicket(content, paperWidth);
  } else if (jobPayload.rawText) {
    formattedData = INIT + jobPayload.rawText + FEED + CUT;
  } else {
    formattedData = formatPreparationTicket(content, paperWidth);
  }

  // 4. Physical Dispatch
  console.log(`[PrintServer] Dispatched (${source}) to ${isWindowsDriver ? `Spooler "${windowsPrinterName}"` : `TCP ${targetIp}:${targetPort}`}`);

  let result;
  if (isWindowsDriver) {
    result = await sendToWindowsSpooler(windowsPrinterName, formattedData);
  } else {
    result = await sendToNetworkPrinter(targetIp, targetPort, formattedData);
  }

  // Fallback to Fallback Printer if primary fails
  const isBillOrReceipt = content.isCustomerBill || jobPayload.job_type === 'receipt' || jobPayload.job_type === 'bill' || jobPayload.job_type === 'pre_check';

  if (!result.success && adminSettings.fallbackPrinter && adminSettings.fallbackPrinter.id !== printerInfo.id) {
    if (isBillOrReceipt) {
      console.warn(`[PrintServer] Main receipt printer failed (${result.error}). Will NOT fallback customer bill to kitchen printer.`);
    } else {
      const fb = adminSettings.fallbackPrinter;
      console.warn(`[PrintServer] Primary printer failed (${result.error}). Failing over to Fallback "${fb.name}" (${fb.ip_address})...`);
      const fbConnType = String(fb.connection_type || '').toLowerCase();
      const fbIsExplicitNetwork = ['network', 'tcp', 'ethernet', 'lan', 'ip'].includes(fbConnType) && Boolean(fb.ip_address);
      if (!fbIsExplicitNetwork && (fbConnType === 'windows_driver' || fbConnType === 'usb' || fb.windows_printer_name)) {
        result = await sendToWindowsSpooler(fb.windows_printer_name || fb.name, formattedData);
      } else {
        result = await sendToNetworkPrinter(fb.ip_address, fb.port || 9100, formattedData);
      }
    }
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

    if (error) {
      return;
    }

    lastCloudSyncAt = new Date().toISOString();

    if (jobs && jobs.length > 0) {
      console.log(`[CloudPoller] Picked up ${jobs.length} pending job(s) from Admin Cloud queue.`);

      for (const job of jobs) {
        const { data: claimed, error: claimErr } = await supabase
          .from('pos_print_jobs')
          .update({
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id)
          .eq('status', 'pending')
          .select('id');

        if (claimErr || !claimed || claimed.length === 0) {
          continue;
        }

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
    // Suppress network jitter errors
  } finally {
    isPolling = false;
  }
}

// Supabase Realtime Listener
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
        console.log('[Realtime] Admin updated pos_printers! Re-syncing...');
        syncAdminSettings();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pos_printer_section_routes'
      }, () => {
        console.log('[Realtime] Admin updated pos_printer_section_routes! Re-syncing...');
        syncAdminSettings();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_settings'
      }, () => {
        console.log('[Realtime] Admin updated app_settings! Re-syncing...');
        syncAdminSettings();
      })
      .subscribe((status) => {
        console.log('[Realtime] Cloud WebSocket status:', status);
      });
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

  // 1. Health & Status (Used by Admin "Test Connection" button)
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

  // 2. Socket Ping Probe
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

  // 3. Direct Print Endpoint (LAN Fast Dispatch)
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

  // 4. API: List Synced Printers & Windows Printers
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

  // 5. API: Force Re-sync
  if (req.url === '/api/sync' && req.method === 'POST') {
    await syncAdminSettings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, synced_at: adminSettings.lastSyncAt, printers: adminSettings.printers }));
  }

  // 6. API: Dispatch Test Print
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

  // 7. Manager Web Dashboard
  if (req.url === '/manager' || req.url === '/' || req.url.startsWith('/manager/')) {
    const localIps = getLocalIpAddresses();
    const winPrinters = await detectLocalWindowsPrinters();

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const managerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FLOW Print Server Manager</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --primary: #1e5c4f;
      --primary-hover: #16463c;
      --bg: #0f172a;
      --card: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #f97316;
      --success: #22c55e;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; }
    .container { max-width: 980px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    .card { background: var(--card); border: 1px solid var(--card-border); border-radius: 14px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--card-border); padding-bottom: 16px; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .title { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; display: flex; align-items: center; gap: 10px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-online { background: rgba(34, 197, 94, 0.15); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.3); }
    .badge-ip { background: rgba(249, 115, 22, 0.15); color: var(--accent); border: 1px solid rgba(249, 115, 22, 0.3); font-family: monospace; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 16px; }
    .stat-box { background: rgba(15, 23, 42, 0.6); border: 1px solid var(--card-border); border-radius: 10px; padding: 14px; }
    .stat-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
    .stat-value { font-size: 16px; font-weight: 800; color: #fff; font-family: monospace; }
    .btn { background: var(--primary); color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { background: var(--primary-hover); transform: translateY(-1px); }
    .btn-secondary { background: #334155; color: #cbd5e1; }
    .btn-secondary:hover { background: #475569; }
    .btn-accent { background: var(--accent); }
    .btn-accent:hover { background: #ea580c; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--card-border); }
    th { font-weight: 700; color: var(--text-muted); text-transform: uppercase; font-size: 11px; }
    code { font-family: 'Consolas', 'Courier New', monospace; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: #38bdf8; }
    .ip-banner { background: linear-gradient(135deg, rgba(30, 92, 79, 0.4), rgba(15, 23, 42, 0.8)); border: 1px solid var(--primary); border-radius: 12px; padding: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div>
          <div class="title">
            🖨️ FLOW Print Server <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">v2.2.0</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Hardware Dispatcher & Cloud Print Bridge for <strong>${config.branch_name}</strong>
          </p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="badge badge-online">🟢 SERVICE ACTIVE</span>
          <button class="btn btn-secondary" onclick="location.reload()">🔄 Refresh</button>
        </div>
      </div>

      <div class="ip-banner">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
            📍 POS Terminal Local IP Address
          </div>
          <div style="font-size: 20px; font-weight: 900; color: #38bdf8; font-family: monospace; margin-top: 2px;">
            ${localIps.map(i => i.address).join(', ') || '127.0.0.1'}
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            💡 Enter this IP into <strong>Admin &gt; Settings &gt; Printer Settings &gt; Print Server IP</strong>
          </div>
        </div>
        <button class="btn btn-accent" onclick="testPrint()">⚡ Print Test Chit</button>
      </div>
    </div>

    <div class="grid">
      <div class="stat-box">
        <div class="stat-label">HTTP Bridge Port</div>
        <div class="stat-value">${config.http_port}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Active Printers (Synced)</div>
        <div class="stat-value">${adminSettings.printers.length} Printers</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Live Exchange Rate</div>
        <div class="stat-value">${adminSettings.exchange_rate.toLocaleString()} LBP</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Deduplication Journal</div>
        <div class="stat-value">${journalEntries.size} Jobs Logged</div>
      </div>
    </div>

    <!-- Synced Printers Table -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; color: var(--text-muted);">
          🌐 Hardware Printers Configured in Admin
        </h3>
        <button class="btn btn-secondary" onclick="forceSync()">🔄 Force Admin Sync</button>
      </div>
      ${adminSettings.printers.length === 0 ? `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No printers found for branch "${config.branch_name}". Add printers in the FLOW Admin portal under <strong>POS &gt; Printer Management</strong>!
        </div>
      ` : `
        <table>
          <thead>
            <tr>
              <th>Printer Name</th>
              <th>Role</th>
              <th>Target Address / Spooler</th>
              <th>Paper</th>
              <th>Type</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${adminSettings.printers.map(p => `
              <tr>
                <td><strong>${p.name}</strong> ${p.is_receipt_printer ? '<span class="badge" style="background:#0284c7; color:#fff;">RECEIPT</span>' : ''} ${p.is_fallback ? '<span class="badge" style="background:#d97706; color:#fff;">FALLBACK</span>' : ''}</td>
                <td><code style="text-transform:uppercase;">${p.printer_role || 'General'}</code></td>
                <td><code>${p.connection_type === 'windows_driver' ? (p.windows_printer_name || p.name) : `${p.ip_address || '192.168.10.110'}:${p.port || 9100}`}</code></td>
                <td>${p.paper_width_mm || 80}mm</td>
                <td>${p.connection_type || 'network_raw'}</td>
                <td>
                  <button class="btn" style="padding: 4px 8px; font-size: 11px;" onclick="testPrinterId('${p.id}')">Test</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- Windows Detected Printers -->
    <div class="card">
      <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">
        🖥️ Local Windows Printers Detected on POS Machine
      </h3>
      <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">
        For USB printers, copy the exact Name into Admin &gt; Printer Management &gt; Connection Type: <strong>Windows Driver Spooler</strong>.
      </p>
      ${winPrinters.length === 0 ? `
        <div style="font-size: 12px; color: var(--text-muted);">No Windows spooler printers detected or running on non-Windows OS.</div>
      ` : `
        <table>
          <thead>
            <tr>
              <th>Windows Printer Name</th>
              <th>Driver</th>
              <th>Port</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${winPrinters.map(wp => `
              <tr>
                <td><strong>${wp.Name}</strong></td>
                <td>${wp.DriverName || 'Generic'}</td>
                <td><code>${wp.PortName || 'USB'}</code></td>
                <td>
                  <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="testWindowsPrinter('${wp.Name}')">Test USB Print</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- Deduplication Journal -->
    <div class="card">
      <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">
        📜 Recent Print Jobs Journal
      </h3>
      <table>
        <thead>
          <tr>
            <th>Idempotency Key</th>
            <th>Printer</th>
            <th>Source</th>
            <th>Status</th>
            <th>Recorded At</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from(journalEntries.values()).slice(-8).reverse().map(e => `
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

  <script>
    async function testPrint() {
      try {
        const res = await fetch('/api/test-print', { method: 'POST', body: '{}' });
        const data = await res.json();
        alert(data.success ? '✅ Test chit dispatched successfully!' : '❌ Print failed: ' + (data.error || 'Check printer connection'));
      } catch (e) {
        alert('❌ Error: ' + e.message);
      }
    }

    async function testPrinterId(id) {
      try {
        const res = await fetch('/api/test-print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printer_id: id })
        });
        const data = await res.json();
        alert(data.success ? '✅ Dispatched to printer!' : '❌ Error: ' + (data.error || 'Failed'));
      } catch (e) {
        alert('❌ Error: ' + e.message);
      }
    }

    async function testWindowsPrinter(name) {
      try {
        const res = await fetch('/api/test-print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ windows_printer_name: name })
        });
        const data = await res.json();
        alert(data.success ? '✅ Windows Spooler accepted job for ' + name : '❌ Error: ' + (data.error || 'Failed'));
      } catch (e) {
        alert('❌ Error: ' + e.message);
      }
    }

    async function forceSync() {
      try {
        const res = await fetch('/api/sync', { method: 'POST' });
        const data = await res.json();
        alert('✅ Synced ' + (data.printers?.length || 0) + ' printers from Admin!');
        location.reload();
      } catch (e) {
        alert('❌ Sync failed: ' + e.message);
      }
    }
  </script>
</body>
</html>
    `;
    return res.end(managerHtml);
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ── 12. Startup & Error Resilience ─────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[PrintServer CRITICAL] Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[PrintServer CRITICAL] Unhandled Rejection:', reason);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[FATAL] Port ${config.http_port} is already in use by another process!`);
    console.error(`To fix this: Run 'stop-server.bat' to kill the background process on port ${config.http_port}, then try again.\n`);
  } else {
    console.error(`[PrintServer HTTP Error]:`, err);
  }
});

server.listen(config.http_port, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log(`================================================================`);
  console.log(`  FLOW Print Server v2.2.0 Started Successfully`);
  console.log(`  Branch: ${config.branch_name} (${config.branch_id})`);
  console.log(`  Local IPs: ${localIps.map(i => i.address).join(', ') || '127.0.0.1'}`);
  console.log(`  HTTP Bridge: http://0.0.0.0:${config.http_port}`);
  console.log(`  Dashboard Manager: http://localhost:${config.http_port}/manager`);
  console.log(`  Machine ID: ${config.machine_id}`);
  console.log(`================================================================`);
});
