/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { 
  X, Clock, FileText, Check, Loader2, AlertTriangle, 
  ShieldCheck, Trash2, XCircle, Sparkles 
} from 'lucide-react';
import type { ReconciliationRecord } from '../../utils/attendanceAnalysis';

interface AttendanceAdjustmentModalProps {
  user?: any;
  isOpen: boolean;
  onClose: () => void;
  record: ReconciliationRecord | null;
  onSaved: () => void;
}

const formatToLocalInput = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

export default function AttendanceAdjustmentModal({
  user,
  isOpen,
  onClose,
  record,
  onSaved
}: AttendanceAdjustmentModalProps) {
  const [punchIn, setPunchIn] = useState('');
  const [punchOut, setPunchOut] = useState('');
  const [excuseLate, setExcuseLate] = useState(false);
  const [managerNotes, setManagerNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && record) {
      // Load actual punches without inventing unrecorded punch out
      setPunchIn(formatToLocalInput(record.actual_punch_in));
      setPunchOut(formatToLocalInput(record.actual_punch_out));
      setExcuseLate(record.raw_punch?.is_excused || false);
      setManagerNotes(record.raw_punch?.notes || '');
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSetToScheduled = () => {
    if (record.scheduled_start) {
      setPunchIn(`${record.date}T${record.scheduled_start}`);
    }
    if (record.scheduled_end) {
      setPunchOut(`${record.date}T${record.scheduled_end}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const punchInIso = punchIn ? new Date(punchIn).toISOString() : null;
    const punchOutIso = punchOut ? new Date(punchOut).toISOString() : null;
    const managerName = user?.name || user?.email || 'Store Manager';

    // If both punch in and punch out are cleared and an attendance log exists in DB
    if (!punchInIso && !punchOutIso && record.raw_punch?.id) {
      if (confirm('Both Punch-In and Punch-Out are empty. Would you like to delete and reset this punch log record?')) {
        const delRes = await api.deleteAttendanceLog(record.raw_punch.id);
        setSaving(false);
        if (!delRes.success) {
          alert(`Error deleting attendance record: ${delRes.error}`);
          return;
        }
        onSaved();
        onClose();
        return;
      } else {
        setSaving(false);
        return;
      }
    }

    if (!punchInIso && punchOutIso) {
      alert('Cannot save a Punch-Out timestamp without a Punch-In timestamp. Please provide a Punch-In time or clear both.');
      setSaving(false);
      return;
    }

    const wasPunchedOut = Boolean(record.raw_punch?.punch_out);
    const auditAction = !wasPunchedOut && punchOutIso
      ? `Punch-out manually added by ${managerName}`
      : wasPunchedOut && !punchOutIso
      ? `Accidental punch-out removed/reset by ${managerName}`
      : `Punch timestamps adjusted by ${managerName}`;

    const finalNotes = managerNotes.trim() 
      ? `${managerNotes.trim()}` 
      : auditAction;

    const payload = {
      id: record.raw_punch?.id,
      employee_id: record.employee_id,
      branch: record.branch,
      punch_in: punchInIso,
      punch_out: punchOutIso,
      is_excused: excuseLate,
      notes: finalNotes,
      modified_by: managerName,
      modified_at: new Date().toISOString(),
      modification_reason: managerNotes.trim() ? `${managerNotes.trim()} (${auditAction})` : auditAction
    };

    const res = await api.saveAttendanceLog(payload);
    setSaving(false);

    if (!res.success) {
      alert(`Error saving punch adjustment: ${res.error}`);
      return;
    }

    onSaved();
    onClose();
  };

  const handleDeletePunch = async () => {
    if (!record.raw_punch?.id) {
      setPunchIn('');
      setPunchOut('');
      return;
    }

    if (!confirm(`Are you sure you want to completely reset and remove the attendance punch record for ${record.employee_name} on ${record.date}?`)) {
      return;
    }

    setSaving(true);
    const res = await api.deleteAttendanceLog(record.raw_punch.id);
    setSaving(false);

    if (!res.success) {
      alert(`Error deleting attendance log: ${res.error}`);
      return;
    }

    onSaved();
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'var(--text-main)',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-main)',
    marginBottom: '6px'
  };

  const smallBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '540px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Attendance Punch Override</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Update, clear accidental punches, or reset timestamps</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Employee Header */}
          <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{record.employee_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{record.position} • {record.branch}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>Date: {record.date}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Shift: {record.scheduled_start ? `${record.scheduled_start} - ${record.scheduled_end}` : 'Unscheduled'}
              </div>
            </div>
          </div>

          {/* Flags Banner */}
          {record.flags.length > 0 && (
            <div style={{ padding: '10px 14px', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: '#ea580c', flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#9a3412', fontWeight: 600 }}>
                Discrepancy Flags: {record.flags.join(', ').replace(/_/g, ' ')}
              </div>
            </div>
          )}

          {/* Quick Presets Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f1f5f9', borderRadius: '8px', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Actions:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {record.scheduled_start && (
                <button
                  type="button"
                  onClick={handleSetToScheduled}
                  style={{ ...smallBtnStyle, backgroundColor: '#ffffff', border: '1px solid var(--border)', color: 'var(--primary)' }}
                >
                  <Sparkles size={12} /> Set to Shift Schedule
                </button>
              )}
              {punchOut && (
                <button
                  type="button"
                  onClick={() => setPunchOut('')}
                  style={{ ...smallBtnStyle, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
                  title="Remove accidental punch-out"
                >
                  <XCircle size={12} /> Clear Punch Out
                </button>
              )}
            </div>
          </div>

          {/* Punch In & Punch Out Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            
            {/* Punch In Column */}
            <div>
              <div style={labelStyle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                  <Clock size={14} /> Punch-In
                </span>
                {punchIn && (
                  <button
                    type="button"
                    onClick={() => setPunchIn('')}
                    style={{ ...smallBtnStyle, color: '#dc2626' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={punchIn}
                onChange={(e) => setPunchIn(e.target.value)}
                style={inputStyle}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {punchIn ? 'Recorded punch-in time' : 'No punch-in recorded'}
              </p>
            </div>

            {/* Punch Out Column */}
            <div>
              <div style={labelStyle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}>
                  <Clock size={14} /> Punch-Out
                </span>
                {punchOut && (
                  <button
                    type="button"
                    onClick={() => setPunchOut('')}
                    style={{ ...smallBtnStyle, color: '#dc2626', backgroundColor: '#fee2e2', borderRadius: '4px' }}
                    title="Remove punch-out if user clocked out by mistake"
                  >
                    ✕ Remove Out
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={punchOut}
                onChange={(e) => setPunchOut(e.target.value)}
                style={inputStyle}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {punchOut ? 'Recorded punch-out time' : 'Empty = Shift currently active'}
              </p>
            </div>

          </div>

          {/* Excuse Late Checkbox */}
          <div style={{ padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="excuseLate"
              checked={excuseLate}
              onChange={(e) => setExcuseLate(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="excuseLate" style={{ fontSize: '12px', fontWeight: 600, color: '#1e40af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> Excuse / Approve Discrepancy (Mark as Justified)
            </label>
          </div>

          {/* Manager Notes */}
          <div>
            <div style={labelStyle}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                <FileText size={14} /> Manager Audit Notes
              </span>
            </div>
            <input
              type="text"
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              placeholder="e.g. Accidental punch-out cleared by manager / Traffic excused"
              style={inputStyle}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: '6px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {record.raw_punch?.id ? (
              <button
                type="button"
                onClick={handleDeletePunch}
                disabled={saving}
                style={{ padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Completely delete and reset this attendance record"
              >
                <Trash2 size={14} />
                <span>Reset Punch Record</span>
              </button>
            ) : <div />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', border: 'none', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '8px 18px', backgroundColor: 'var(--primary)', border: 'none', color: '#ffffff', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                <span>Save Adjustment</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
