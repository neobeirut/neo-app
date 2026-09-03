import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Search, Plus, Edit, Trash2, Phone, MapPin, X,
  Compass, HelpCircle, Clock, Check, AlertCircle, Wifi
} from 'lucide-react';

/* ─── types ─── */
interface BranchShift {
  id: string;
  branch: string;
  shift_name: string;
  start_time: string; // HH:MM:SS
  end_time: string;
}

/* ─── helpers ─── */
const fmtTime = (t: string) => {
  if (!t) return '—';
  const parts = t.split(':');
  const hr = parseInt(parts[0], 10);
  const min = parts[1] ?? '00';
  const ampm = hr < 12 ? 'AM' : 'PM';
  const hr12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${hr12}:${min} ${ampm}`;
};
const crossesMidnight = (s: string, e: string) => !!s && !!e && e < s;

/* ═══════════════════════════════════════════════════════
   SHIFT FORM  (add / edit one shift)
═══════════════════════════════════════════════════════ */
function ShiftForm({
  branch, existing, onSaved, onCancel,
}: {
  branch: string;
  existing?: BranchShift;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name,  setName]  = useState(existing?.shift_name ?? '');
  const [start, setStart] = useState(existing?.start_time?.slice(0, 5) ?? '07:00');
  const [end,   setEnd]   = useState(existing?.end_time?.slice(0, 5)   ?? '06:59');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const crosses = crossesMidnight(start, end);

  const handleSave = async () => {
    if (!name.trim()) { setErr('Shift name is required.'); return; }
    if (!start || !end) { setErr('Start and end times are required.'); return; }
    setSaving(true); setErr('');
    const res = await api.saveBranchShift({
      id:         existing?.id,
      branch,
      shift_name: name.trim().toUpperCase(),
      start_time: start + ':00',
      end_time:   end   + ':00',
    });
    setSaving(false);
    if (res.success) onSaved();
    else setErr(res.error ?? 'Save failed');
  };

  return (
    <div style={{
      background: '#f0f9ff', border: '1px solid #bae6fd',
      borderRadius: '12px', padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div style={{ fontWeight: 800, fontSize: '14px', color: '#0369a1' }}>
        {existing ? '✏️ Edit Shift' : '➕ New Shift'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Shift Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. AM"
            style={{ width: '100%', fontSize: '14px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bae6fd', boxSizing: 'border-box', fontWeight: 700 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Start Time</label>
          <input
            type="time"
            value={start}
            onChange={e => setStart(e.target.value)}
            style={{ width: '100%', fontSize: '14px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bae6fd', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>
            End Time {crosses && <span style={{ color: '#7c3aed', fontSize: '10px', marginLeft: '4px' }}>+1 day</span>}
          </label>
          <input
            type="time"
            value={end}
            onChange={e => setEnd(e.target.value)}
            style={{ width: '100%', fontSize: '14px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bae6fd', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {crosses && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#6d28d9' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          This shift crosses midnight — it ends at {fmtTime(end + ':00')} the next day.
        </div>
      )}

      {err && <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>⚠ {err}</div>}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} style={{ background: '#0369a1', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
          <Check size={14} />{saving ? 'Saving…' : 'Save Shift'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SHIFTS MODAL
═══════════════════════════════════════════════════════ */
function ShiftsModal({ branch, onClose }: { branch: string; onClose: () => void }) {
  const [shifts, setShifts]   = useState<BranchShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [editing, setEditing] = useState<BranchShift | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await api.getBranchShifts(branch);
    if (res.success && res.data) setShifts(res.data as BranchShift[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this shift?')) return;
    await api.deleteBranchShift(id);
    load();
  };

  return (
    <div className="web-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="web-modal" style={{ maxWidth: '580px', textAlign: 'left' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
              <Clock size={18} style={{ marginRight: '8px', verticalAlign: 'middle', color: '#0369a1' }} />
              Shift Schedules — <span style={{ color: 'var(--primary)' }}>{branch}</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Define shift windows. Start/End time controls reel credit partitioning.
              If End &lt; Start, the shift crosses midnight.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={24} />
          </button>
        </div>

        {/* Shift list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {shifts.length === 0 && !adding && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                No shifts defined yet. Click <strong>Add Shift</strong> below to get started.
              </div>
            )}

            {shifts.map(s =>
              editing?.id === s.id ? (
                <ShiftForm
                  key={s.id}
                  branch={branch}
                  existing={s}
                  onSaved={() => { setEditing(null); load(); }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', background: '#f8fafc',
                  borderRadius: '10px', border: '1px solid #e2e8f0',
                }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Clock size={16} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{s.shift_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {fmtTime(s.start_time)} → {fmtTime(s.end_time)}
                      {crossesMidnight(s.start_time, s.end_time) && (
                        <span style={{ marginLeft: '6px', background: '#ede9fe', color: '#6d28d9', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>crosses midnight</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditing(s); setAdding(false); }}
                    style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: '#334155' }}
                  >
                    <Edit size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    style={{ background: '#fff0f0', border: '1px solid #fecdd3', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: '#be123c' }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )
            )}

            {adding && !editing && (
              <ShiftForm
                branch={branch}
                onSaved={() => { setAdding(false); load(); }}
                onCancel={() => setAdding(false)}
              />
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button
            onClick={() => { setAdding(true); setEditing(null); }}
            disabled={adding || !!editing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: adding ? '#e0f2fe' : 'var(--primary)', color: adding ? '#0369a1' : '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', cursor: adding ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px' }}
          >
            <Plus size={15} /> Add Shift
          </button>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN SCREEN
═══════════════════════════════════════════════════════ */
export default function BranchManagementScreen() {
  const [branches, setBranches]           = useState<any[]>([]);
  const [loading,  setLoading]            = useState(true);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [shiftsByBranch, setShiftsByBranch] = useState<Record<string, BranchShift[]>>({});

  // Branch form state
  const [showModal,   setShowModal]   = useState(false);
  const [isEditMode,  setIsEditMode]  = useState(false);
  const [name,        setName]        = useState('');
  const [totalTables, setTotalTables] = useState('');
  const [totalChairs, setTotalChairs] = useState('');
  const [phone,       setPhone]       = useState('');
  const [latitude,    setLatitude]    = useState('');
  const [longitude,   setLongitude]   = useState('');
  const [radiusMeters,setRadiusMeters]= useState('200');
  const [wifiSsids,   setWifiSsids]   = useState('');
  const [wifiGraceMins, setWifiGraceMins] = useState('15');
  const [autoPunchEnabled, setAutoPunchEnabled] = useState(true);
  const [saving,      setSaving]      = useState(false);

  // Which branch's shift modal is open
  const [shiftsModalBranch, setShiftsModalBranch] = useState<string | null>(null);

  useEffect(() => { loadBranches(); loadAllShifts(); }, []);

  const loadBranches = async () => {
    setLoading(true); setErrorMsg(null);
    const res = await api.getBranches();
    if (res.success && res.data) setBranches(res.data);
    else setErrorMsg(res.error || 'Failed to fetch branches.');
    setLoading(false);
  };

  const loadAllShifts = async () => {
    const res = await api.getBranchShifts();
    if (res.success && res.data) {
      const map: Record<string, BranchShift[]> = {};
      (res.data as BranchShift[]).forEach(s => {
        if (!map[s.branch]) map[s.branch] = [];
        map[s.branch].push(s);
      });
      setShiftsByBranch(map);
    }
  };

  const handleOpenModal = (branch?: any) => {
    setErrorMsg(null);
    if (branch) {
      setIsEditMode(true);
      setName(branch.name || '');
      setTotalTables(branch.total_tables !== null ? String(branch.total_tables) : '');
      setTotalChairs(branch.total_chairs !== null ? String(branch.total_chairs) : '');
      setPhone(branch.phone || '');
      setLatitude(branch.latitude !== null ? String(branch.latitude) : '');
      setLongitude(branch.longitude !== null ? String(branch.longitude) : '');
      setRadiusMeters(branch.radius_meters !== null ? String(branch.radius_meters) : '200');
      setWifiSsids(branch.wifi_ssids || '');
      setWifiGraceMins(branch.wifi_disconnect_grace_mins !== null && branch.wifi_disconnect_grace_mins !== undefined ? String(branch.wifi_disconnect_grace_mins) : '15');
      setAutoPunchEnabled(branch.auto_punch_enabled !== false);
    } else {
      setIsEditMode(false); setName(''); setTotalTables(''); setTotalChairs('');
      setPhone(''); setLatitude(''); setLongitude(''); setRadiusMeters('200');
      setWifiSsids(''); setWifiGraceMins('15'); setAutoPunchEnabled(true);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())              { alert('Branch name is required'); return; }
    if (!totalTables || !totalChairs) { alert('Tables and chairs count are required'); return; }
    setSaving(true);
    const res = await api.saveBranch({
      name: name.trim(),
      total_tables: parseInt(totalTables, 10),
      total_chairs: parseInt(totalChairs, 10),
      phone: phone.trim() || null,
      latitude:  latitude.trim()  ? parseFloat(latitude)  : null,
      longitude: longitude.trim() ? parseFloat(longitude) : null,
      radius_meters: radiusMeters.trim() ? parseInt(radiusMeters, 10) : 200,
      wifi_ssids: wifiSsids.trim() || null,
      wifi_disconnect_grace_mins: wifiGraceMins.trim() ? parseInt(wifiGraceMins, 10) : 15,
      auto_punch_enabled: autoPunchEnabled,
      auto_punch_mode: 'break'
    });
    setSaving(false);
    if (res.success) { setShowModal(false); loadBranches(); }
    else alert(res.error || 'Failed to save branch');
  };

  const handleDelete = async (branchName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete branch "${branchName}"?`)) return;
    const res = (api as any).deleteBranch
      ? await (api as any).deleteBranch(branchName)
      : { success: false, error: 'deleteBranch is not defined in API client' };
    if (res.success) loadBranches();
    else alert(res.error || 'Failed to delete branch');
  };

  const filteredBranches = branches.filter(b =>
    (b.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '8px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>Branch Management</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Configure branch details, seating capacity, GPS coordinates and shift schedules.
          </p>
        </div>
        <button onClick={() => handleOpenModal()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={18} /> Add Branch
        </button>
      </div>

      {/* Search */}
      <div className="filters-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 12px', flex: 1 }}>
          <Search size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
          <input
            type="text"
            placeholder="Search branches by name..."
            style={{ border: 'none', background: 'transparent', height: '36px', padding: '0', flex: 1, boxShadow: 'none', outline: 'none' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Branch cards */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : errorMsg ? (
        <div style={{ color: 'var(--danger)', padding: '20px', background: '#fff0f0', borderRadius: '8px', border: '1px solid #ffcccc', textAlign: 'center' }}>{errorMsg}</div>
      ) : filteredBranches.length === 0 ? (
        <div style={{ background: 'white', padding: '48px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center', color: '#64748b' }}>
          No branches found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredBranches.map(branch => {
            const brShifts = shiftsByBranch[branch.name] ?? [];
            return (
              <div key={branch.name} className="card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Branch info */}
                <div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{branch.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', color: '#475569', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Compass size={14} color="#94a3b8" />
                      <span>Tables: <strong>{branch.total_tables}</strong> · Chairs: <strong>{branch.total_chairs}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={14} color="#94a3b8" />
                      <span>{branch.phone
                        ? <a href={`tel:${branch.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{branch.phone}</a>
                        : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={14} color="#94a3b8" />
                      <span>
                        {branch.latitude && branch.longitude
                          ? <a href={`https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{branch.latitude.toFixed(4)}, {branch.longitude.toFixed(4)}</a>
                          : 'GPS not set'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <HelpCircle size={14} color="#94a3b8" />
                      <span>Geofence: <strong>{branch.radius_meters || 200}m</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Wifi size={14} color="#0284c7" />
                      <span>
                        Wi-Fi: {branch.wifi_ssids ? <strong style={{ color: '#0369a1' }}>{branch.wifi_ssids}</strong> : <span style={{ color: '#94a3b8' }}>Not set</span>}
                        {branch.wifi_disconnect_grace_mins && (
                          <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '6px' }}>({branch.wifi_disconnect_grace_mins}m grace)</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Shift schedule preview ── */}
                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: brShifts.length > 0 ? '10px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Clock size={13} color="#0369a1" />
                      Shift Schedule
                      {brShifts.length > 0 && (
                        <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px' }}>
                          {brShifts.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShiftsModalBranch(branch.name)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0369a1', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                    >
                      <Plus size={12} /> {brShifts.length === 0 ? 'Add Shifts' : 'Manage'}
                    </button>
                  </div>

                  {brShifts.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                      No shifts configured. Click <strong>Add Shifts</strong> to define shift windows.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {brShifts.map(s => (
                        <div key={s.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          background: '#fff', border: '1px solid #dbeafe',
                          borderRadius: '8px', padding: '4px 10px', fontSize: '12px',
                        }}>
                          <span style={{ fontWeight: 800, color: '#0369a1' }}>{s.shift_name}</span>
                          <span style={{ color: '#64748b' }}>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                          {crossesMidnight(s.start_time, s.end_time) && (
                            <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '0px 5px', borderRadius: '8px', fontSize: '10px', fontWeight: 700 }}>+1d</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                  <button onClick={() => handleOpenModal(branch)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    <Edit size={14} /> Edit Branch
                  </button>
                  <button onClick={() => handleDelete(branch.name)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #fecdd3', color: '#be123c', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Shifts modal ── */}
      {shiftsModalBranch && (
        <ShiftsModal
          branch={shiftsModalBranch}
          onClose={() => { setShiftsModalBranch(null); loadAllShifts(); }}
        />
      )}

      {/* ── Branch Add/Edit modal ── */}
      {showModal && (
        <div className="web-modal-overlay">
          <div className="web-modal" style={{ maxWidth: '520px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{isEditMode ? 'Edit' : 'Add'} Branch</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Branch Name *</label>
                <input type="text" placeholder="e.g. Downtown" style={{ width: '100%', backgroundColor: isEditMode ? '#f1f5f9' : '#ffffff' }} value={name} onChange={e => setName(e.target.value)} disabled={isEditMode} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Total Tables *</label>
                  <input type="number" placeholder="e.g. 15" style={{ width: '100%' }} value={totalTables} onChange={e => setTotalTables(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Total Chairs *</label>
                  <input type="number" placeholder="e.g. 60" style={{ width: '100%' }} value={totalChairs} onChange={e => setTotalChairs(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>WhatsApp / Phone Number</label>
                <input type="text" placeholder="e.g. +961 70 123456" style={{ width: '100%' }} value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Latitude</label>
                  <input type="text" placeholder="e.g. 33.8938" style={{ width: '100%' }} value={latitude} onChange={e => setLatitude(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Longitude</label>
                  <input type="text" placeholder="e.g. 35.5018" style={{ width: '100%' }} value={longitude} onChange={e => setLongitude(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Verification Geofence Radius (meters)</label>
                <input type="number" placeholder="e.g. 200" style={{ width: '100%' }} value={radiusMeters} onChange={e => setRadiusMeters(e.target.value)} />
              </div>

              {/* Branch Wi-Fi & Auto-Break Settings */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wifi size={16} /> Branch Wi-Fi & Auto-Break Configuration
                </div>
                <div style={{ fontSize: '11px', color: '#15803d', lineHeight: '16px' }}>
                  Employees connected to authorized branch Wi-Fi can punch immediately. If disconnected &gt; grace period, an auto-break is recorded.
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                    Authorized Wi-Fi SSID(s)
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Flow_Staff, Flow_5G" 
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #86efac', fontSize: '13px', boxSizing: 'border-box' }} 
                    value={wifiSsids} 
                    onChange={e => setWifiSsids(e.target.value)} 
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                      Grace Period (minutes)
                    </label>
                    <input 
                      type="number" 
                      placeholder="15" 
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #86efac', fontSize: '13px', boxSizing: 'border-box' }} 
                      value={wifiGraceMins} 
                      onChange={e => setWifiGraceMins(e.target.value)} 
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                    <input 
                      type="checkbox" 
                      id="autoPunchToggle" 
                      checked={autoPunchEnabled} 
                      onChange={e => setAutoPunchEnabled(e.target.checked)} 
                      style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                    />
                    <label htmlFor="autoPunchToggle" style={{ fontSize: '12px', fontWeight: 700, color: '#166534', cursor: 'pointer' }}>
                      Enable Auto-Break
                    </label>
                  </div>
                </div>
              </div>

              {/* Shift schedule hint inside the form */}
              {isEditMode && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#0369a1' }}>
                      <Clock size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                      Shift Schedule — {(shiftsByBranch[name] ?? []).length} shift(s) defined
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Manage shift windows separately from branch details</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setShiftsModalBranch(name); }}
                    style={{ background: '#0369a1', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                  >
                    <Clock size={12} /> Manage Shifts
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }} disabled={saving}>Cancel</button>
                <button type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
