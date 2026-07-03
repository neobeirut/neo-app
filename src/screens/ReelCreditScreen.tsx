import { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Download, Filter, RotateCcw, AlertCircle, TrendingUp, DollarSign, BarChart2, Calendar } from 'lucide-react';
import { api } from '../api/client';

/* ─────────────────────── types / helpers ─────────────────────── */
interface ReelRecord {
  external_id: string;  // ID from the Excel — used for deduplication
  branch_name: string;
  transaction_date: string;
  transaction_time: string;
  status: string;
  amount: number;
  currency: string;
}

const norm = (s: string) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

function findCol(headers: string[], ...keys: string[]): number {
  return headers.findIndex(h => keys.some(k => norm(h).includes(norm(k))));
}

function parseDateTime(raw: any): { date: string; time: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { date: '', time: '' };
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[\sT](\d{2}:\d{2}(?::\d{2})?)$/);
  if (m) return { date: m[1], time: m[2].length === 5 ? m[2] + ':00' : m[2] };
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 40000) {
    const d = XLSX.SSF.parse_date_code(serial);
    return {
      date: `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`,
      time: `${String(d.H).padStart(2,'0')}:${String(d.M).padStart(2,'0')}:${String(d.S).padStart(2,'0')}`,
    };
  }
  return { date: s, time: '' };
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-01`;
}
const currLabel = (c: string) => {
  if (!c) return '';
  if (c.toLowerCase().includes('dollar')) return 'USD';
  if (c.toLowerCase().includes('pound') || c === 'LBP') return 'LBP';
  return c;
};

/* ─────────────────────── main component ─────────────────────── */
export default function ReelCreditScreen({ user }: { user: any }) {
  const [tab, setTab] = useState<'upload' | 'report'>('upload');

  /* upload */
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ReelRecord[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; inserted?: number; duplicates?: number; error?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* report */
  const [records, setRecords] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [filters, setFilters] = useState({ startDate: monthStart(), endDate: today(), branch: 'All', currency: 'All' });
  const [branches, setBranches] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);

  /* ── parse ── */
  const processFile = useCallback((file: File) => {
    setParseError(''); setImportResult(null); setParsed([]); setSkipped(0); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) { setParseError('File appears to be empty.'); return; }

        let headerRow = 0;
        for (let i = 0; i < Math.min(6, rows.length); i++) {
          if (rows[i].filter(Boolean).length >= 4) { headerRow = i; break; }
        }
        const headers = rows[headerRow].map((h: any) => String(h ?? ''));
        const ci = {
          id:       findCol(headers, 'id'),           // Excel ID column — dedup key
          branch:   findCol(headers, 'branch'),
          date:     findCol(headers, 'date'),
          status:   findCol(headers, 'status'),
          amount:   findCol(headers, 'amount'),
          currency: findCol(headers, 'currency'),
        };
        // Only branch, date, status, amount, currency are mandatory
        const required = ['branch', 'date', 'status', 'amount', 'currency'] as const;
        if (required.some(k => ci[k] < 0)) {
          setParseError(`Could not map required columns. Detected headers: ${headers.join(' | ')}`);
          return;
        }
        const good: ReelRecord[] = [];
        let skip = 0;
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.filter(Boolean).length < 3) continue;
          const status = String(row[ci.status] ?? '').trim();
          if (status !== 'Success') { skip++; continue; }
          const { date, time } = parseDateTime(row[ci.date]);
          const amt = parseFloat(String(row[ci.amount] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          const branch = String(row[ci.branch] ?? '').trim();
          const currency = String(row[ci.currency] ?? '').trim();
          // Use the Excel ID as external_id; fall back to a composite key if absent
          const rawId = ci.id >= 0 ? String(row[ci.id] ?? '').trim() : '';
          const external_id = rawId || `${branch}|${date}|${time}|${amt}|${currency}`;
          if (!branch || !date) { skip++; continue; }
          good.push({ external_id, branch_name: branch, transaction_date: date, transaction_time: time, status, amount: amt, currency });
        }
        setParsed(good); setSkipped(skip);
      } catch (err: any) { setParseError(err.message ?? 'Failed to parse file.'); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  /* ── import ── */
  const handleImport = async () => {
    if (!parsed.length) return;
    setImporting(true); setImportResult(null);
    const payload = parsed.map(r => ({ ...r, uploaded_by: user?.name ?? 'Admin' }));
    const res = await api.saveReelCreditRecords(payload);
    setImporting(false);
    if (res.success) {
      setImportResult({ success: true, inserted: res.inserted, duplicates: res.duplicates });
      setParsed([]); setFileName('');
    } else {
      setImportResult({ success: false, error: res.error });
    }
  };

  /* ── report ── */
  const loadReport = useCallback(async () => {
    setReportLoading(true);
    const res = await api.getReelCreditRecords({ ...filters });
    if (res.success && res.data) {
      setRecords(res.data);
      setBranches(Array.from(new Set<string>(res.data.map((r: any) => r.branch_name))).sort());
      setCurrencies(Array.from(new Set<string>(res.data.map((r: any) => r.currency))).sort());
    }
    setReportLoading(false);
  }, [filters]);

  useEffect(() => { if (tab === 'report') loadReport(); }, [tab]);

  /* ── stats ── */
  const totalAmount = records.reduce((s, r) => s + (r.amount || 0), 0);
  const bySummary = records.reduce((acc, r) => { acc[r.branch_name] = (acc[r.branch_name] || 0) + r.amount; return acc; }, {} as Record<string, number>);
  const byCurrency = records.reduce((acc, r) => { acc[r.currency] = (acc[r.currency] || 0) + r.amount; return acc; }, {} as Record<string, number>);

  /* ── export ── */
  const exportCSV = () => {
    if (!records.length) return;
    const header = ['Branch', 'Date', 'Time', 'Amount', 'Currency', 'Imported By'];
    const rows = records.map(r => [r.branch_name, r.transaction_date, r.transaction_time, r.amount, r.currency, r.uploaded_by]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reel_credit_${filters.startDate}_${filters.endDate}.csv`;
    a.click();
  };

  /* ─────── render ─────── */
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '26px' }}>💳</span> Reel Credit Transactions
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '14px' }}>
          Upload Excel settlement files · extract Success transactions · generate reports
        </p>
      </div>

      {/* DB hint */}
      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '10px 16px', marginBottom: '20px', fontSize: '12px', color: '#92400e', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>
          <strong>Supabase table required:</strong>&nbsp;
          <code style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>reel_credit_transactions</code>
          {' '}— columns: <code style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>external_id (text UNIQUE), branch_name, transaction_date (date), transaction_time (text), status, amount (numeric), currency, uploaded_by, imported_at (timestamptz default now())</code>
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '24px', gap: '4px' }}>
        {[{ id: 'upload', label: '📤 Upload & Import' }, { id: 'report', label: '📊 Report' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '9px 22px', fontWeight: 700, fontSize: '14px', border: 'none', background: 'none', cursor: 'pointer', marginBottom: '-2px', borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent', color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ UPLOAD ══ */}
      {tab === 'upload' && (
        <div>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '16px', background: dragOver ? 'rgba(30,92,79,.05)' : '#fafafa', padding: '52px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', marginBottom: '20px' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} style={{ display: 'none' }} />
            <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg,#1e5c4f,#2d9b6e)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 14px rgba(30,92,79,.3)' }}>
              <Upload size={28} color="#fff" />
            </div>
            <p style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text-main)', margin: '0 0 6px' }}>
              {dragOver ? 'Drop it here!' : 'Drag & drop your Reel Credit file'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
              or <span style={{ color: 'var(--primary)', fontWeight: 700 }}>click to browse</span> — .xlsx · .xls · .csv
            </p>
          </div>

          {parseError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', color: '#b91c1c', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', fontSize: '14px' }}>
              <XCircle size={16} /> {parseError}
            </div>
          )}

          {importResult && (
            <div style={{ background: importResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${importResult.success ? '#86efac' : '#fca5a5'}`, borderRadius: '10px', padding: '14px 18px', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '16px' }}>
              {importResult.success ? (
                <>
                  <CheckCircle size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <div style={{ color: '#15803d', fontWeight: 700, fontSize: '14px' }}>
                      {importResult.inserted} new record{importResult.inserted !== 1 ? 's' : ''} imported successfully!
                    </div>
                    {(importResult.duplicates ?? 0) > 0 && (
                      <div style={{ color: '#065f46', fontSize: '12px', marginTop: '3px' }}>
                        ⚠ {importResult.duplicates} duplicate{importResult.duplicates !== 1 ? 's' : ''} already existed and were skipped.
                      </div>
                    )}
                    {(importResult.inserted ?? 0) > 0 && (
                      <div style={{ color: '#065f46', fontSize: '12px', marginTop: '2px' }}>
                        Switch to the <strong>Report</strong> tab to view them.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <><XCircle size={18} color="#b91c1c" style={{ flexShrink: 0 }} /><span style={{ color: '#b91c1c', fontWeight: 700, fontSize: '14px' }}>Import failed: {importResult.error}</span></>
              )}
            </div>
          )}

          {fileName && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
              {/* Bar */}
              <div style={{ background: 'linear-gradient(135deg,#1e5c4f,#2d9b6e)', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileSpreadsheet size={22} color="#fff" />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>{fileName}</div>
                    <div style={{ color: 'rgba(255,255,255,.75)', fontSize: '12px' }}>
                      {parsed.length} success rows ready to import · {skipped} rows skipped
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleImport}
                  disabled={!parsed.length || importing}
                  style={{ background: parsed.length ? '#fff' : 'rgba(255,255,255,.25)', color: parsed.length ? '#1e5c4f' : 'rgba(255,255,255,.5)', border: 'none', borderRadius: '10px', padding: '10px 22px', fontWeight: 800, fontSize: '14px', cursor: parsed.length ? 'pointer' : 'not-allowed', transition: 'all .2s' }}>
                  {importing ? 'Importing…' : `⬆ Import ${parsed.length} Records`}
                </button>
              </div>

              {parsed.length > 0 ? (
                <div style={{ overflowX: 'auto', maxHeight: '440px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        {['#', 'Transaction ID', 'Branch Name', 'Date', 'Time', 'Amount', 'Currency', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f4f8', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>{i + 1}</td>
                          <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#6b7280', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.external_id}>{r.external_id ? r.external_id.slice(0, 18) + '…' : '—'}</td>
                          <td style={{ padding: '9px 14px', fontWeight: 700 }}>{r.branch_name}</td>
                          <td style={{ padding: '9px 14px' }}>{r.transaction_date}</td>
                          <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{r.transaction_time}</td>
                          <td style={{ padding: '9px 14px', fontWeight: 800, color: '#16a34a' }}>{fmt(r.amount)}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{ background: r.currency?.toLowerCase().includes('dollar') ? '#eff6ff' : '#fdf4ff', color: r.currency?.toLowerCase().includes('dollar') ? '#1d4ed8' : '#7c3aed', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                              {currLabel(r.currency)}
                            </span>
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>Success</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <AlertCircle size={36} style={{ marginBottom: '12px', color: '#f59e0b' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>No successful transactions found</p>
                  <p style={{ margin: '6px 0 0', fontSize: '13px' }}>Only rows where <strong>Status = "Success"</strong> are extracted.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ REPORT ══ */}
      {tab === 'report' && (
        <div>
          {/* Filters */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '22px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, width: '100%', marginBottom: '-4px' }}>
              <Filter size={13} /> Filter by
            </div>
            {[{ label: 'From Date', key: 'startDate' }, { label: 'To Date', key: 'endDate' }].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '5px' }}>
                  <Calendar size={11} /> {f.label}
                </label>
                <input type="date" value={filters[f.key as keyof typeof filters]}
                  onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-main)' }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '5px' }}>Branch</label>
              <select value={filters.branch} onChange={e => setFilters(p => ({ ...p, branch: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: '#fff', color: 'var(--text-main)', minWidth: '170px' }}>
                <option value="All">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '5px' }}>Currency</label>
              <select value={filters.currency} onChange={e => setFilters(p => ({ ...p, currency: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: '#fff', color: 'var(--text-main)', minWidth: '150px' }}>
                <option value="All">All Currencies</option>
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={loadReport}
              style={{ padding: '9px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} /> Apply
            </button>
            <button onClick={() => setFilters({ startDate: monthStart(), endDate: today(), branch: 'All', currency: 'All' })}
              style={{ padding: '9px 14px', background: '#f5f5f5', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RotateCcw size={13} /> Reset
            </button>
            <button onClick={exportCSV}
              style={{ padding: '9px 16px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <Download size={13} /> Export CSV
            </button>
          </div>

          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)', fontSize: '15px' }}>Loading records…</div>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '16px', marginBottom: '22px' }}>
                <SummaryCard icon={<TrendingUp size={20} />} color="#1e5c4f" label="Total Transactions" value={records.length.toLocaleString()} />
                <SummaryCard icon={<DollarSign size={20} />} color="#0369a1" label="Grand Total" value={fmt(totalAmount)} sub="All currencies" />
                {Object.entries(byCurrency).map(([c, total]) => (
                  <SummaryCard key={c} icon={<BarChart2 size={20} />} color={c.toLowerCase().includes('dollar') ? '#1d4ed8' : '#7c3aed'} label={`Total ${currLabel(c)}`} value={fmt(total as number)} sub={c} />
                ))}
              </div>

              {/* By-branch breakdown */}
              {Object.keys(bySummary).length > 1 && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 22px', marginBottom: '22px' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🏢 By Branch
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {Object.entries(bySummary).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([branch, total]) => (
                      <div key={branch} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 16px', border: '1px solid var(--border)', minWidth: '170px', flex: '1 1 170px', maxWidth: '260px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{branch}</div>
                        <div style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-main)' }}>{fmt(total as number)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions table */}
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>Transaction Records</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{records.length.toLocaleString()} records</span>
                </div>
                {records.length === 0 ? (
                  <div style={{ padding: '70px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <TrendingUp size={40} style={{ marginBottom: '14px', opacity: .25 }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>No records found</p>
                    <p style={{ margin: '6px 0 0', fontSize: '13px' }}>Try adjusting your filters or import a file.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', maxHeight: '540px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                        <tr>
                          {['Branch Name', 'Date', 'Time', 'Amount', 'Currency', 'Imported At', 'By'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, i) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f0f4f8', background: i % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background .15s' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>{r.branch_name}</td>
                            <td style={{ padding: '10px 14px' }}>{r.transaction_date}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{r.transaction_time}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap' }}>{fmt(r.amount)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ background: r.currency?.toLowerCase().includes('dollar') ? '#eff6ff' : '#fdf4ff', color: r.currency?.toLowerCase().includes('dollar') ? '#1d4ed8' : '#7c3aed', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                                {currLabel(r.currency)}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                              {r.imported_at ? new Date(r.imported_at).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>{r.uploaded_by}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot style={{ position: 'sticky', bottom: 0, background: '#1e5c4f' }}>
                        <tr>
                          <td colSpan={3} style={{ padding: '10px 14px', color: '#fff', fontWeight: 800, fontSize: '13px' }}>TOTAL</td>
                          <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 800, fontSize: '14px' }}>{fmt(totalAmount)}</td>
                          <td colSpan={3} style={{ padding: '10px 14px', color: 'rgba(255,255,255,.6)', fontSize: '12px' }}>
                            {Object.entries(byCurrency).map(([c, t]) => `${currLabel(c)}: ${fmt(t as number)}`).join(' · ')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Summary card ── */
function SummaryCard({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{sub}</div>}
      </div>
    </div>
  );
}

