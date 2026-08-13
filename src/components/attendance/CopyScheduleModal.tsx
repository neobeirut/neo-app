/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { X, Copy, Calendar, Building, Check, Loader2 } from 'lucide-react';

interface CopyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: any[];
  currentStartDate: string;
  onCopied: () => void;
}

export default function CopyScheduleModal({
  isOpen,
  onClose,
  branches,
  currentStartDate,
  onCopied
}: CopyScheduleModalProps) {
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [sourceWeekStart, setSourceWeekStart] = useState('');
  const [targetWeekStart, setTargetWeekStart] = useState('');

  const [sourceMonth, setSourceMonth] = useState('');
  const [targetMonth, setTargetMonth] = useState('');

  const [branch, setBranch] = useState('All');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Calculate previous week start date
      const targetDate = new Date(currentStartDate || new Date());
      const prevWeekDate = new Date(targetDate);
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);

      setSourceWeekStart(prevWeekDate.toISOString().split('T')[0]);
      setTargetWeekStart(targetDate.toISOString().split('T')[0]);

      // Calculate previous month string YYYY-MM
      const currYear = targetDate.getFullYear();
      const currMonth = targetDate.getMonth();

      const targetMonthStr = `${currYear}-${String(currMonth + 1).padStart(2, '0')}`;

      const prevMonthDate = new Date(currYear, currMonth - 1, 1);
      const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

      setSourceMonth(prevMonthStr);
      setTargetMonth(targetMonthStr);

      setBranch('All');
    }
  }, [isOpen, currentStartDate]);

  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    setCopying(true);

    let res: any;
    if (mode === 'week') {
      if (!sourceWeekStart || !targetWeekStart) {
        alert('Please specify source and target start dates.');
        setCopying(false);
        return;
      }
      res = await api.copyPreviousWeekSchedule(sourceWeekStart, targetWeekStart, branch);
    } else {
      if (!sourceMonth || !targetMonth) {
        alert('Please specify source and target months.');
        setCopying(false);
        return;
      }
      res = await api.copyPreviousMonthSchedule(sourceMonth, targetMonth, branch);
    }

    setCopying(false);

    if (!res.success) {
      alert(`Error copying schedule: ${res.error}`);
      return;
    }

    alert(`Successfully copied ${res.count} schedule assignments!`);
    onCopied();
    onClose();
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
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
              <Copy size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Copy Schedule Roster</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Duplicate previous week or month schedules</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleCopy} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Switch */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setMode('week')}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: mode === 'week' ? '#8b5cf6' : 'transparent',
                color: mode === 'week' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              Copy Weekly Schedule
            </button>
            <button
              type="button"
              onClick={() => setMode('month')}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: mode === 'month' ? '#8b5cf6' : 'transparent',
                color: mode === 'month' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              Copy Monthly Schedule
            </button>
          </div>

          {/* Branch */}
          <div>
            <label style={labelStyle}>
              <Building size={14} style={{ color: 'var(--text-muted)' }} /> Branch Filter
            </label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              style={inputStyle}
            >
              <option value="All">All Branches</option>
              {branches.map((b: any, idx: number) => {
                const bName = typeof b === 'string' ? b : b.name;
                return <option key={idx} value={bName}>{bName}</option>;
              })}
            </select>
          </div>

          {/* Controls */}
          {mode === 'week' ? (
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>
                  <Calendar size={14} /> Source Week Start (Monday)
                </label>
                <input
                  type="date"
                  value={sourceWeekStart}
                  onChange={(e) => setSourceWeekStart(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>
                  <Calendar size={14} /> Target Week Start (Monday)
                </label>
                <input
                  type="date"
                  value={targetWeekStart}
                  onChange={(e) => setTargetWeekStart(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Source Month (YYYY-MM)</label>
                <input
                  type="month"
                  value={sourceMonth}
                  onChange={(e) => setSourceMonth(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Target Month (YYYY-MM)</label>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
            </div>
          )}

          <div style={{ padding: '12px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', fontSize: '12px', color: '#6b21a8' }}>
            Copied schedules will be added as <strong>Draft</strong> schedules in the target period so you can review before publishing.
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
              disabled={copying}
              style={{ padding: '8px 18px', backgroundColor: '#8b5cf6', border: 'none', color: '#ffffff', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {copying ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              <span>Copy Schedule</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
