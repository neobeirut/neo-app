/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import { X, Calendar, User, Building, FileText, Check, Trash2, Loader2, Clock, Sparkles, CheckSquare, Square } from 'lucide-react';
import { getEmployeeFullName } from './ShiftManagementView';
import ConflictModal from './ConflictModal';

interface ScheduleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: any[];
  branches: any[];
  templates: any[];
  initialData?: any;
  onSaved: () => void;
}

export default function ScheduleAssignmentModal({
  isOpen,
  onClose,
  employees,
  branches,
  templates,
  initialData,
  onSaved
}: ScheduleAssignmentModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [branch, setBranch] = useState('');
  const [date, setDate] = useState('');
  const [assignmentType, setAssignmentType] = useState<'shift' | 'day_off' | 'vacation' | 'sick_leave' | 'unpaid_leave'>('shift');
  
  // Conflict Error Modal state
  const [conflictError, setConflictError] = useState<string | null>(null);
  
  // Shift Mode: 'template' (Predefined Shift) vs 'custom' (Unique Shift)
  const [shiftMode, setShiftMode] = useState<'template' | 'custom'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [shiftName, setShiftName] = useState('Work Shift');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakDuration, setBreakDuration] = useState('30');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Multi-day selection state
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Compute 7 days of the week containing `date`
  const weekDays = useMemo(() => {
    if (!date) return [];
    const baseDate = new Date(date);
    const day = baseDate.getDay(); // 0 is Sun
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(baseDate.setDate(diff));

    const list: { dateStr: string; dayName: string; dayNum: number; isWeekend: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      const dName = d.toLocaleDateString('default', { weekday: 'short' });
      const dNum = d.getDate();
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      list.push({ dateStr: dStr, dayName: dName, dayNum: dNum, isWeekend });
    }
    return list;
  }, [date]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const empId = initialData.employee_id || employees[0]?.employee_id || employees[0]?.id || '';
        const empObj = employees.find((e) => (e.employee_id || e.id) === empId);
        const targetDate = initialData.date || new Date().toISOString().split('T')[0];

        setEmployeeId(empId);
        setBranch(initialData.branch || empObj?.branch || (typeof branches[0] === 'string' ? branches[0] : branches[0]?.name || 'Main'));
        setDate(targetDate);
        setSelectedDates([targetDate]);
        setAssignmentType(initialData.assignment_type || 'shift');
        
        if (initialData.shift_template_id) {
          setShiftMode('template');
          setSelectedTemplateId(initialData.shift_template_id);
        } else {
          setShiftMode(templates.length > 0 ? 'template' : 'custom');
          setSelectedTemplateId('');
        }

        setShiftName(initialData.shift_name || 'Work Shift');
        setStartTime(initialData.start_time || '09:00');
        setEndTime(initialData.end_time || '17:00');
        setBreakDuration(String(initialData.break_duration_mins ?? 30));
        setPosition(initialData.position || empObj?.position || '');
        setNotes(initialData.notes || '');
      } else {
        const firstEmp = employees[0];
        const empId = firstEmp?.employee_id || firstEmp?.id || '';
        const todayStr = new Date().toISOString().split('T')[0];

        setEmployeeId(empId);
        setBranch(firstEmp?.branch || (typeof branches[0] === 'string' ? branches[0] : (branches[0]?.name || 'Main Branch')));
        setDate(todayStr);
        setSelectedDates([todayStr]);
        setAssignmentType('shift');
        
        setShiftMode(templates.length > 0 ? 'template' : 'custom');
        setSelectedTemplateId(templates[0]?.id || '');
        if (templates[0]) {
          setShiftName(templates[0].name);
          setStartTime(templates[0].start_time);
          setEndTime(templates[0].end_time);
          setBreakDuration(String(templates[0].break_duration_mins || 30));
          setPosition(firstEmp?.position || '');
        } else {
          setShiftName('Work Shift');
          setStartTime('09:00');
          setEndTime('17:00');
          setBreakDuration('30');
          setPosition(firstEmp?.position || '');
        }

        setNotes('');
      }
    }
  }, [isOpen, initialData, employees, branches, templates]);

  const handleEmployeeChange = (selectedId: string) => {
    setEmployeeId(selectedId);
    const empObj = employees.find((e) => (e.employee_id || e.id) === selectedId);
    if (empObj) {
      if (empObj.position) setPosition(empObj.position);
      if (empObj.branch) setBranch(empObj.branch);
    }
  };

  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    if (!tmplId) return;
    const tmpl = templates.find((t) => t.id === tmplId);
    if (tmpl) {
      setShiftName(tmpl.name);
      setStartTime(tmpl.start_time);
      setEndTime(tmpl.end_time);
      setBreakDuration(String(tmpl.break_duration_mins || 0));
    }
  };

  const handleSwitchMode = (mode: 'template' | 'custom') => {
    setShiftMode(mode);
    if (mode === 'template' && templates.length > 0) {
      const firstTmpl = templates[0];
      setSelectedTemplateId(firstTmpl.id);
      setShiftName(firstTmpl.name);
      setStartTime(firstTmpl.start_time);
      setEndTime(firstTmpl.end_time);
      setBreakDuration(String(firstTmpl.break_duration_mins || 30));
    } else if (mode === 'custom') {
      setSelectedTemplateId('');
      setShiftName('Unique Shift');
    }
  };

  const toggleDateSelection = (dStr: string) => {
    setSelectedDates((prev) =>
      prev.includes(dStr) ? prev.filter((d) => d !== dStr) : [...prev, dStr]
    );
  };

  const selectWorkdaysOnly = () => {
    const workdays = weekDays.filter((w) => !w.isWeekend).map((w) => w.dateStr);
    setSelectedDates(workdays);
  };

  const selectAllWeekdays = () => {
    const all = weekDays.map((w) => w.dateStr);
    setSelectedDates(all);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !branch) {
      alert('Please fill in Employee and Branch.');
      return;
    }

    const finalDates = selectedDates.length > 0 ? selectedDates : [date];
    if (finalDates.length === 0) {
      alert('Please select at least one day for the assignment.');
      return;
    }

    if (assignmentType === 'shift' && (!startTime || !endTime)) {
      alert('Please specify Start Time and End Time for shift.');
      return;
    }

    setSaving(true);

    const empObj = employees.find((e) => (e.employee_id || e.id) === employeeId);
    const defaultPos = position || empObj?.position;

    // Create payload batch for all checked dates
    const batchPayloads = finalDates.map((targetDateStr) => {
      const item: any = {
        employee_id: employeeId,
        branch,
        date: targetDateStr,
        assignment_type: assignmentType,
        shift_template_id: (assignmentType === 'shift' && shiftMode === 'template') ? (selectedTemplateId || null) : null,
        shift_name: assignmentType === 'shift' ? shiftName : assignmentType.toUpperCase().replace('_', ' '),
        start_time: assignmentType === 'shift' ? startTime : null,
        end_time: assignmentType === 'shift' ? endTime : null,
        break_duration_mins: assignmentType === 'shift' ? (parseInt(breakDuration, 10) || 0) : 0,
        position: defaultPos || null,
        status: initialData?.status || 'draft',
        notes: notes.trim() || null
      };
      if (initialData?.id && finalDates.length === 1 && targetDateStr === initialData.date) {
        item.id = initialData.id;
      }
      return item;
    });

    let res: any;
    if (batchPayloads.length === 1) {
      res = await api.saveEmployeeSchedule(batchPayloads[0]);
    } else {
      res = await api.saveEmployeeSchedulesBatch(batchPayloads);
    }
    setSaving(false);

    if (!res.success) {
      setConflictError(res.error || 'Failed to save schedule assignment.');
      return;
    }

    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!confirm('Are you sure you want to remove this assignment?')) return;
    setDeleting(true);
    const res = await api.deleteEmployeeSchedule(initialData.id);
    setDeleting(false);

    if (!res.success) {
      alert(`Error deleting assignment: ${res.error}`);
      return;
    }

    onSaved();
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
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Calendar size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {initialData?.id ? 'Edit Shift Assignment' : 'Assign Employee Schedule'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Assign shift for a single date or select multiple days in the week</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Employee & Branch */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>
                <User size={14} style={{ color: 'var(--primary)' }} /> Employee *
              </label>
              <select
                value={employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                style={{ ...inputStyle, fontWeight: 600 }}
                required
              >
                <option value="">Select Employee</option>
                {employees.filter((e: any) => e.status !== 'Inactive' && e.is_active !== false).map((e: any) => {
                  const empId = e.employee_id || e.id;
                  const fullName = getEmployeeFullName(e);
                  return (
                    <option key={empId} value={empId}>
                      {fullName} ({e.position || 'Staff'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                <Building size={14} style={{ color: 'var(--text-muted)' }} /> Branch *
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                style={inputStyle}
                required
              >
                {branches.map((b: any, idx: number) => {
                  const bName = typeof b === 'string' ? b : b.name;
                  return (
                    <option key={idx} value={bName}>
                      {bName}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Multi-Day Week Selector */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ ...labelStyle, margin: 0 }}>
                <Calendar size={14} style={{ color: 'var(--primary)' }} /> Repeat for Days of Week ({selectedDates.length} selected)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={selectWorkdaysOnly}
                  style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Mon-Fri
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>|</span>
                <button
                  type="button"
                  onClick={selectAllWeekdays}
                  style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  Select All
                </button>
              </div>
            </div>

            {/* 7 Days Checkbox Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {weekDays.map((w) => {
                const isSelected = selectedDates.includes(w.dateStr);
                return (
                  <button
                    key={w.dateStr}
                    type="button"
                    onClick={() => toggleDateSelection(w.dateStr)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <span>{w.dayName}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{w.dayNum}</span>
                    {isSelected ? <CheckSquare size={12} style={{ color: 'var(--primary)' }} /> : <Square size={12} style={{ color: 'var(--text-muted)' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignment Type */}
          <div>
            <label style={labelStyle}>Assignment Type</label>
            <select
              value={assignmentType}
              onChange={(e) => setAssignmentType(e.target.value as any)}
              style={inputStyle}
            >
              <option value="shift">Work Shift</option>
              <option value="day_off">Day Off</option>
              <option value="vacation">Vacation Leave</option>
              <option value="sick_leave">Sick Leave</option>
              <option value="unpaid_leave">Unpaid Leave</option>
            </select>
          </div>

          {/* Shift Mode: Predefined Shift vs Custom Shift */}
          {assignmentType === 'shift' && (
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Segmented Switcher */}
              <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('template')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: shiftMode === 'template' ? 'var(--primary)' : 'transparent',
                    color: shiftMode === 'template' ? '#ffffff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Sparkles size={14} /> Select Predefined Shift
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMode('custom')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: shiftMode === 'custom' ? 'var(--primary)' : 'transparent',
                    color: shiftMode === 'custom' ? '#ffffff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Clock size={14} /> Enter Unique / Custom Shift
                </button>
              </div>

              {shiftMode === 'template' ? (
                <div>
                  <label style={labelStyle}>Select Predefined Shift Template *</label>
                  {templates.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px' }}>
                      No predefined shift templates found. Switch to "Enter Unique Shift" or create templates in the Shift Templates tab.
                    </div>
                  ) : (
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleSelectTemplate(e.target.value)}
                      style={{ ...inputStyle, backgroundColor: '#ffffff', color: 'var(--primary)', fontWeight: 700 }}
                      required
                    >
                      <option value="">-- Choose Shift Template --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.start_time} - {t.end_time})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Define unique shift times for this employee assignment without linking to a predefined template.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Shift Name</label>
                  <input
                    type="text"
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. Morning Shift"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Employee Position</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. Barista"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Start Time *</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>End Time *</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Break (Mins)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={breakDuration}
                    onChange={(e) => setBreakDuration(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={labelStyle}>
              <FileText size={14} style={{ color: 'var(--text-muted)' }} /> Manager Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Covering for John"
              style={inputStyle}
            />
          </div>

          {/* Buttons */}
          <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {initialData?.id ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: '8px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: 'var(--danger)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                <span>Remove</span>
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
                <span>Save Assignment ({selectedDates.length || 1} Days)</span>
              </button>
            </div>
          </div>

        </form>

      </div>

      <ConflictModal
        isOpen={!!conflictError}
        message={conflictError || ''}
        onClose={() => setConflictError(null)}
      />
    </div>
  );
}
