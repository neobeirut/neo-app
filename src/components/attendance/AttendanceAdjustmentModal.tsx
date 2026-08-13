import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { X, Clock, FileText, Check, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ReconciliationRecord } from '../../utils/attendanceAnalysis';

interface AttendanceAdjustmentModalProps {
  user?: any;
  isOpen: boolean;
  onClose: () => void;
  record: ReconciliationRecord | null;
  onSaved: () => void;
}

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
      // Format ISO timestamp into local datetime-local input string
      if (record.actual_punch_in) {
        const d = new Date(record.actual_punch_in);
        setPunchIn(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      } else {
        setPunchIn(`${record.date}T${record.scheduled_start || '09:00'}`);
      }

      if (record.actual_punch_out) {
        const d = new Date(record.actual_punch_out);
        setPunchOut(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      } else {
        setPunchOut(`${record.date}T${record.scheduled_end || '17:00'}`);
      }

      setExcuseLate(record.raw_punch?.is_excused || false);
      setManagerNotes(record.raw_punch?.notes || '');
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const punchInIso = punchIn ? new Date(punchIn).toISOString() : null;
    const punchOutIso = punchOut ? new Date(punchOut).toISOString() : null;
    const managerName = user?.name || user?.email || 'Store Manager';

    const payload = {
      id: record.raw_punch?.id,
      employee_id: record.employee_id,
      branch: record.branch,
      punch_in: punchInIso,
      punch_out: punchOutIso,
      is_excused: excuseLate,
      notes: managerNotes.trim() || null,
      modified_by: managerName,
      modified_at: new Date().toISOString(),
      modification_reason: managerNotes.trim() || `Punch exception adjusted by ${managerName}`
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'var(--text-main)',
    outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-main)',
    marginBottom: '4px'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Attendance Exception Override</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Adjust punch timestamps and excuse attendance flags</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Details Card */}
        <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Employee Header */}
          <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{record.employee_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{record.position} • {record.branch}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>Date: {record.date}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Scheduled: {record.scheduled_start ? `${record.scheduled_start} - ${record.scheduled_end}` : 'No Shift'}
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

          {/* Punch In & Punch Out Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>
                <Clock size={14} style={{ color: '#059669' }} /> Punch-In Timestamp
              </label>
              <input
                type="datetime-local"
                value={punchIn}
                onChange={(e) => setPunchIn(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                <Clock size={14} style={{ color: '#dc2626' }} /> Punch-Out Timestamp
              </label>
              <input
                type="datetime-local"
                value={punchOut}
                onChange={(e) => setPunchOut(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Excuse Late Checkbox */}
          <div style={{ padding: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="excuseLate"
              checked={excuseLate}
              onChange={(e) => setExcuseLate(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="excuseLate" style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> Excuse / Approve Discrepancy (Mark as Justified)
            </label>
          </div>

          {/* Manager Notes */}
          <div>
            <label style={labelStyle}>
              <FileText size={14} style={{ color: 'var(--text-muted)' }} /> Manager Audit Notes
            </label>
            <input
              type="text"
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              placeholder="e.g. Traffic delay approved by Store Manager"
              style={inputStyle}
            />
          </div>

          {/* Buttons */}
          <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
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

        </form>

      </div>
    </div>
  );
}
