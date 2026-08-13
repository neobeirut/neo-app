/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { X, Plus, Trash2, Edit2, Clock, Check, Loader2 } from 'lucide-react';

interface ShiftTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: any[];
  onTemplatesUpdated: () => void;
}

export const PRESET_TEMPLATES = [
  { name: 'Opening', start_time: '07:00', end_time: '15:00', break_duration_mins: 30, color: '#2563eb' },
  { name: 'Morning', start_time: '09:00', end_time: '17:00', break_duration_mins: 45, color: '#10b981' },
  { name: 'Afternoon', start_time: '13:00', end_time: '21:00', break_duration_mins: 45, color: '#f59e0b' },
  { name: 'Evening', start_time: '17:00', end_time: '01:00', break_duration_mins: 30, color: '#8b5cf6' },
  { name: 'Closing', start_time: '18:00', end_time: '02:00', break_duration_mins: 30, color: '#ef4444' }
];

export default function ShiftTemplatesModal({ isOpen, onClose, branches, onTemplatesUpdated }: ShiftTemplatesModalProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakDuration, setBreakDuration] = useState('30');
  const [branch, setBranch] = useState('');
  const [color, setColor] = useState('#2563eb');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    const res = await api.getShiftTemplates();
    if (res.success) {
      setTemplates(res.data || []);
    }
    setLoading(false);
  };

  const handleEdit = (tmpl: any) => {
    setEditingTemplate(tmpl);
    setName(tmpl.name);
    setStartTime(tmpl.start_time);
    setEndTime(tmpl.end_time);
    setBreakDuration(String(tmpl.break_duration_mins || 0));
    setBranch(tmpl.branch || '');
    setColor(tmpl.color || '#2563eb');
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setName('');
    setStartTime('09:00');
    setEndTime('17:00');
    setBreakDuration('30');
    setBranch('');
    setColor('#2563eb');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startTime || !endTime) {
      alert('Please fill in Template Name, Start Time, and End Time.');
      return;
    }

    setSaving(true);
    const payload = {
      id: editingTemplate?.id,
      name: name.trim(),
      start_time: startTime,
      end_time: endTime,
      break_duration_mins: parseInt(breakDuration, 10) || 0,
      branch: branch || null,
      color
    };

    const res = await api.saveShiftTemplate(payload);
    setSaving(false);

    if (!res.success) {
      alert(`Error saving template: ${res.error}`);
      return;
    }

    resetForm();
    await loadTemplates();
    onTemplatesUpdated();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift template?')) return;
    const res = await api.deleteShiftTemplate(id);
    if (!res.success) {
      alert(`Error deleting template: ${res.error}`);
      return;
    }
    await loadTemplates();
    onTemplatesUpdated();
  };

  const handleSeedPresets = async () => {
    setSaving(true);
    for (const preset of PRESET_TEMPLATES) {
      await api.saveShiftTemplate(preset);
    }
    setSaving(false);
    await loadTemplates();
    onTemplatesUpdated();
  };

  if (!isOpen) return null;

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
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-main)',
    marginBottom: '4px'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Shift Templates</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Create & manage reusable shift presets (Opening, Morning, Afternoon, Evening, Closing)</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

          {/* Form Column */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{editingTemplate ? 'Edit Template' : 'Add New Template'}</strong>
              {editingTemplate && (
                <button type="button" onClick={resetForm} style={{ fontSize: '12px', color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer' }}>
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Template Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Morning Shift"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Start Time *</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Time *</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Break (mins)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={breakDuration}
                    onChange={(e) => setBreakDuration(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Badge Color</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ ...inputStyle, padding: '2px', height: '37px', cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Branch Filter (Optional)</label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">All Branches</option>
                  {branches.map((b: any, idx: number) => {
                    const nameStr = typeof b === 'string' ? b : b.name;
                    return <option key={idx} value={nameStr}>{nameStr}</option>;
                  })}
                </select>
              </div>

              <div style={{ marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '9px',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {saving ? <Loader2 size={16} className="spin" /> : editingTemplate ? <Check size={16} /> : <Plus size={16} />}
                  <span>{editingTemplate ? 'Update Template' : 'Add Template'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* List Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>Existing Templates ({templates.length})</strong>
              {templates.length === 0 && (
                <button
                  onClick={handleSeedPresets}
                  disabled={saving}
                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--primary)', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Load Standard Presets
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <Loader2 size={18} className="spin" /> Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div style={{ padding: '30px', border: '1px dashed var(--border)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={28} style={{ marginBottom: '8px', color: 'var(--secondary)' }} />
                <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>No Shift Templates</p>
                <p style={{ fontSize: '11px', marginTop: '4px' }}>Click "Load Standard Presets" to auto-generate Opening, Morning, Afternoon, Evening, and Closing templates.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '360px' }}>
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: tmpl.color || '#2563eb', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {tmpl.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '6px' }}>
                          <span>{tmpl.start_time} - {tmpl.end_time}</span>
                          <span>•</span>
                          <span>Break: {tmpl.break_duration_mins || 0}m</span>
                          {tmpl.branch && (
                            <>
                              <span>•</span>
                              <span style={{ color: 'var(--primary)' }}>{tmpl.branch}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={() => handleEdit(tmpl)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(tmpl.id)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
