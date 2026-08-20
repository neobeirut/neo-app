/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import {
  Clock, Plus, Copy, Send, Settings, ChevronLeft, ChevronRight,
  Building, Search, CheckCircle2, Loader2, Sparkles, CalendarDays, RefreshCw, User, Briefcase, Trash2
} from 'lucide-react';
import ShiftTemplatesModal from './ShiftTemplatesModal';
import ScheduleAssignmentModal from './ScheduleAssignmentModal';
import CopyScheduleModal from './CopyScheduleModal';
import ConflictModal from './ConflictModal';

interface ShiftManagementViewProps {
  user?: any;
  permissions?: any;
  employees: any[];
  branches: any[];
}

export const getEmployeeFullName = (emp: any): string => {
  if (!emp) return 'Unknown';
  if (emp.first_name || emp.last_name) {
    return `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
  }
  return emp.full_name || emp.name || emp.employee_id || emp.id || 'Staff';
};

export const isEmployeeActive = (emp: any): boolean => {
  if (!emp) return false;
  const status = (emp.status || '').toString().trim().toLowerCase();
  if (status === 'inactive' || status === 'disabled' || status === 'archived' || status === 'terminated') return false;
  if (emp.is_active === false || emp.is_active === 0 || emp.is_active === 'false') return false;
  if (emp.active === false || emp.active === 0 || emp.active === 'false') return false;
  return true;
};

export default function ShiftManagementView({
  user: _user,
  permissions: _permissions,
  employees,
  branches
}: ShiftManagementViewProps) {
  // Navigation & View Mode
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'daily'>('weekly');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Conflict Error Popup state
  const [conflictError, setConflictError] = useState<string | null>(null);
  
  // Filters
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterEmployee, setFilterEmployee] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick-Assign Palette State (null = open modal form, or template/type object = instant 1-click assign)
  const [selectedQuickShift, setSelectedQuickShift] = useState<any | null>(null);

  // Data state
  const [schedules, setSchedules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Modals state
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);

  // Load data on date range or filter change
  useEffect(() => {
    loadData();
  }, [currentDate, viewMode, filterBranch, filterEmployee]);

  // Compute Date Range depending on viewMode
  const dateRange = useMemo(() => {
    const curr = new Date(currentDate);
    if (viewMode === 'weekly') {
      // Find Monday of current week
      const day = curr.getDay(); // 0 is Sun
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(curr.setDate(diff));

      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        days.push(d);
      }
      const startStr = days[0].toISOString().split('T')[0];
      const endStr = days[6].toISOString().split('T')[0];
      return { days, startStr, endStr };
    } else if (viewMode === 'monthly') {
      const year = curr.getFullYear();
      const month = curr.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const days: Date[] = [];
      for (let d = 1; d <= lastDay.getDate(); d++) {
        days.push(new Date(year, month, d));
      }
      return {
        days,
        startStr: firstDay.toISOString().split('T')[0],
        endStr: lastDay.toISOString().split('T')[0]
      };
    } else {
      // Daily
      const dayStr = curr.toISOString().split('T')[0];
      return { days: [curr], startStr: dayStr, endStr: dayStr };
    }
  }, [currentDate, viewMode]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    const [schedRes, tmplRes] = await Promise.all([
      api.getEmployeeSchedules({
        startDate: dateRange.startStr,
        endDate: dateRange.endStr,
        branch: filterBranch,
        employee_id: filterEmployee
      }),
      api.getShiftTemplates(filterBranch)
    ]);

    if (schedRes.success) {
      setSchedules(schedRes.data || []);
    }
    if (tmplRes.success) {
      setTemplates(tmplRes.data || []);
    }
    if (!silent) setLoading(false);
  };

  // Date Navigation
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'weekly') d.setDate(d.getDate() - 7);
    else if (viewMode === 'monthly') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'weekly') d.setDate(d.getDate() + 7);
    else if (viewMode === 'monthly') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Draft vs Published Stats
  const draftCount = useMemo(() => {
    return schedules.filter((s) => s.status === 'draft').length;
  }, [schedules]);

  const publishedCount = useMemo(() => {
    return schedules.filter((s) => s.status === 'published').length;
  }, [schedules]);

  // Handle Publish Schedule
  const handlePublish = async () => {
    if (draftCount === 0) {
      alert('No draft schedules in this view range to publish.');
      return;
    }
    if (!confirm(`Are you sure you want to publish ${draftCount} draft shift schedules? Affected employees will receive schedule update notifications.`)) {
      return;
    }

    setPublishing(true);
    const res = await api.publishSchedules(dateRange.startStr, dateRange.endStr, filterBranch);
    setPublishing(false);

    if (!res.success) {
      alert(`Error publishing schedule: ${res.error}`);
      return;
    }

    alert(`Successfully published ${res.count} shift schedules!`);
    await loadData();
  };

  // Filter employees list by search & branch & employee selection (excluding inactive)
  const filteredEmployeesList = useMemo(() => {
    return employees.filter((emp) => {
      if (!isEmployeeActive(emp)) return false;
      const name = getEmployeeFullName(emp).toLowerCase();
      const pos = (emp.position || '').toLowerCase();
      const empId = (emp.employee_id || emp.id || '').toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch = !query || name.includes(query) || pos.includes(query) || empId.includes(query);
      const matchesBranch = filterBranch === 'All' || emp.branch === filterBranch;
      const matchesEmpSelect = filterEmployee === 'All' || (emp.employee_id || emp.id) === filterEmployee;

      return matchesSearch && matchesBranch && matchesEmpSelect;
    });
  }, [employees, searchQuery, filterBranch, filterEmployee]);

  // Group employees by Position
  const groupedEmployeesByPosition = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredEmployeesList.forEach((emp) => {
      const pos = emp.position || 'General Staff';
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(emp);
    });
    return groups;
  }, [filteredEmployeesList]);

  // Handle 1-click Quick Delete of shift without opening modal
  const handleQuickDeleteAssignment = async (e: React.MouseEvent, scheduleId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this shift assignment?')) return;

    // Optimistic deletion
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));

    const res = await api.deleteEmployeeSchedule(scheduleId);
    if (!res.success) {
      alert(`Error deleting assignment: ${res.error}`);
      await loadData(true);
      return;
    }
    await loadData(true);
  };

  // Handle clicking on + in cell (either 1-click assign if Quick Shift palette pill selected, or open Modal)
  const handleCellClick = async (empId: string, dateStr: string) => {
    const empObj = employees.find((e) => (e.employee_id || e.id) === empId);

    if (selectedQuickShift) {
      let payload: any;
      if (selectedQuickShift.id) {
        // Shift Template selected
        payload = {
          employee_id: empId,
          date: dateStr,
          branch: empObj?.branch || (filterBranch !== 'All' ? filterBranch : (typeof branches[0] === 'string' ? branches[0] : (branches[0]?.name || 'Main'))),
          position: empObj?.position || null,
          assignment_type: 'shift',
          shift_template_id: selectedQuickShift.id,
          shift_name: selectedQuickShift.name,
          start_time: selectedQuickShift.start_time,
          end_time: selectedQuickShift.end_time,
          break_duration_mins: selectedQuickShift.break_duration_mins || 0,
          status: 'draft'
        };
      } else if (selectedQuickShift.type) {
        // Off/Leave pill selected (day_off, vacation, sick_leave)
        payload = {
          employee_id: empId,
          date: dateStr,
          branch: empObj?.branch || (filterBranch !== 'All' ? filterBranch : (typeof branches[0] === 'string' ? branches[0] : (branches[0]?.name || 'Main'))),
          position: empObj?.position || null,
          assignment_type: selectedQuickShift.type,
          shift_name: selectedQuickShift.type.replace('_', ' ').toUpperCase(),
          status: 'draft'
        };
      }

      // Optimistic UI Update: Instantly add temporary schedule to state
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const tempSchedule = {
        id: tempId,
        ...payload,
        employees: empObj || null
      };

      setSchedules((prev) => [...prev, tempSchedule]);

      // Call API in background
      const res = await api.saveEmployeeSchedule(payload);

      if (!res.success) {
        // Rollback optimistic schedule if failed or conflict
        setSchedules((prev) => prev.filter((s) => s.id !== tempId));
        setConflictError(res.error || 'Failed to quick assign shift.');
        return;
      }

      // Silent background refresh to retrieve server-assigned ID & data
      await loadData(true);
    } else {
      // Manual Modal Form
      setSelectedAssignment({
        employee_id: empId,
        date: dateStr,
        branch: empObj?.branch || (filterBranch !== 'All' ? filterBranch : (typeof branches[0] === 'string' ? branches[0] : (branches[0]?.name || 'Main'))),
        position: empObj?.position || ''
      });
      setShowAssignmentModal(true);
    }
  };

  const handleOpenAddAssignment = (empId?: string, dateStr?: string) => {
    const empObj = employees.find((e) => (e.employee_id || e.id) === empId);

    setSelectedAssignment({
      employee_id: empId || '',
      date: dateStr || dateRange.startStr,
      branch: empObj?.branch || (filterBranch !== 'All' ? filterBranch : (typeof branches[0] === 'string' ? branches[0] : (branches[0]?.name || 'Main'))),
      position: empObj?.position || ''
    });
    setShowAssignmentModal(true);
  };

  const handleEditAssignment = (scheduleObj: any) => {
    setSelectedAssignment(scheduleObj);
    setShowAssignmentModal(true);
  };

  const btnSecondaryStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-main)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
    transition: 'all 0.15s ease'
  };

  const btnPrimaryStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
    transition: 'all 0.15s ease'
  };

  const inputStyle: React.CSSProperties = {
    padding: '7px 12px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'var(--text-main)',
    outline: 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Top Header & Actions Bar */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <CalendarDays size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Shift Management</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Plan weekly & monthly employee rosters, manage templates, and publish shifts
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* View Mode Switcher */}
            <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setViewMode('weekly')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'weekly' ? 'var(--surface)' : 'transparent',
                  color: viewMode === 'weekly' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'weekly' ? 'var(--shadow)' : 'none'
                }}
              >
                Weekly View
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'monthly' ? 'var(--surface)' : 'transparent',
                  color: viewMode === 'monthly' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'monthly' ? 'var(--shadow)' : 'none'
                }}
              >
                Monthly View
              </button>
              <button
                onClick={() => setViewMode('daily')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'daily' ? 'var(--surface)' : 'transparent',
                  color: viewMode === 'daily' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'daily' ? 'var(--shadow)' : 'none'
                }}
              >
                Daily View
              </button>
            </div>

            <button onClick={() => setShowTemplatesModal(true)} style={btnSecondaryStyle}>
              <Settings size={15} style={{ color: 'var(--primary)' }} />
              <span>Shift Templates</span>
            </button>

            <button onClick={() => setShowCopyModal(true)} style={btnSecondaryStyle}>
              <Copy size={15} style={{ color: '#8b5cf6' }} />
              <span>Copy Schedule</span>
            </button>

            <button onClick={() => handleOpenAddAssignment()} style={btnPrimaryStyle}>
              <Plus size={16} />
              <span>Assign Shift</span>
            </button>

          </div>

        </div>

        {/* Toolbar: Navigation & Branch/Employee Filters */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          
          {/* Date Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
              <button onClick={handlePrev} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <ChevronLeft size={18} />
              </button>
              <button onClick={handleToday} style={{ padding: '4px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                Today
              </button>
              <button onClick={handleNext} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <ChevronRight size={18} />
              </button>
            </div>

            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
              {viewMode === 'weekly' && `Week of ${dateRange.startStr} to ${dateRange.endStr}`}
              {viewMode === 'monthly' && `${currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`}
              {viewMode === 'daily' && `${dateRange.startStr}`}
            </span>
          </div>

          {/* Branch & Employee Filters & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search staff or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '32px', width: '180px' }}
              />
            </div>

            {/* Branch Dropdown */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px' }}>
              <Building size={14} style={{ color: 'var(--primary)' }} />
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                style={{ ...inputStyle, border: 'none', padding: '7px 0', cursor: 'pointer', fontWeight: 600 }}
              >
                <option value="All">All Branches</option>
                {branches.map((b: any, idx: number) => {
                  const bName = typeof b === 'string' ? b : b.name;
                  return <option key={idx} value={bName}>{bName}</option>;
                })}
              </select>
            </div>

            {/* Employee Dropdown */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px' }}>
              <User size={14} style={{ color: 'var(--primary)' }} />
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                style={{ ...inputStyle, border: 'none', padding: '7px 0', cursor: 'pointer', fontWeight: 600 }}
              >
                <option value="All">All Employees</option>
                {employees.filter(isEmployeeActive).map((e: any) => {
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

            <button onClick={() => loadData(false)} style={{ ...btnSecondaryStyle, padding: '7px 10px' }} title="Refresh Schedule">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>

          </div>

        </div>
      </div>

      {/* HORIZONTAL QUICK-ASSIGN SHIFT PALETTE */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 18px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '2px', flex: 1 }}>
          
          {/* Default Option: Manual Form */}
          <button
            onClick={() => setSelectedQuickShift(null)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: `1px solid ${selectedQuickShift === null ? 'var(--primary)' : 'var(--border)'}`,
              backgroundColor: selectedQuickShift === null ? '#eff6ff' : '#ffffff',
              color: selectedQuickShift === null ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: selectedQuickShift === null ? '0 1px 3px rgba(37,99,235,0.15)' : 'none'
            }}
          >
            ✋ Manual Form (Modal)
          </button>

          {/* Shift Templates Pills */}
          {templates.map((tmpl) => {
            const isSelected = selectedQuickShift?.id === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedQuickShift(tmpl)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: `1px solid ${isSelected ? tmpl.color || 'var(--primary)' : 'var(--border)'}`,
                  backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                  color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.2)' : 'none'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tmpl.color || '#2563eb' }} />
                <span>{tmpl.name}</span>
              </button>
            );
          })}

          {/* Leave & Off Pills */}
          {[
            { type: 'day_off', label: '🌴 Day Off' },
            { type: 'vacation', label: '🏖️ Vacation' },
            { type: 'sick_leave', label: '🤒 Sick Leave' },
            { type: 'unpaid_leave', label: '⏳ Unpaid Leave' }
          ].map((item) => {
            const isSelected = selectedQuickShift?.type === item.type;
            return (
              <button
                key={item.type}
                onClick={() => setSelectedQuickShift({ type: item.type })}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: `1px solid ${isSelected ? '#f59e0b' : 'var(--border)'}`,
                  backgroundColor: isSelected ? '#fffbeb' : '#ffffff',
                  color: isSelected ? '#b45309' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.label}
              </button>
            );
          })}

        </div>
      </div>

      {/* Publish Overview Banner */}
      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 'var(--radius)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '14px', color: '#92400e' }}>Schedule Status Overview</strong>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fde68a', color: '#78350f' }}>
                {draftCount} Draft Shifts
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', backgroundColor: '#d1fae5', color: '#065f46' }}>
                {publishedCount} Published
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#b45309', margin: '2px 0 0 0' }}>
              Draft shifts are visible to managers only. Click "Publish Schedule" to notify employees in the mobile app.
            </p>
          </div>
        </div>

        <button
          onClick={handlePublish}
          disabled={publishing || draftCount === 0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            backgroundColor: draftCount > 0 ? '#059669' : '#cbd5e1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: draftCount > 0 ? 'pointer' : 'not-allowed',
            boxShadow: draftCount > 0 ? '0 2px 4px rgba(5, 150, 105, 0.2)' : 'none'
          }}
        >
          {publishing ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          <span>Publish Schedule ({draftCount})</span>
        </button>
      </div>

      {/* Main Schedule Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--primary)', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Loading schedule matrix...</p>
        </div>
      ) : viewMode === 'weekly' ? (

        /* ================= WEEKLY MATRIX VIEW (GROUPED BY POSITION) ================= */
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              
              {/* Header */}
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 14px', width: '200px', fontWeight: 600, color: 'var(--text-main)', borderRight: '1px solid var(--border)' }}>
                    Employee / Position
                  </th>
                  {dateRange.days.map((dayDate, idx) => {
                    const dateStr = dayDate.toISOString().split('T')[0];
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    const dayName = dayDate.toLocaleDateString('default', { weekday: 'short' });
                    const dayNum = dayDate.getDate();

                    return (
                      <th
                        key={idx}
                        style={{
                          padding: '10px 4px',
                          width: 'calc((100% - 200px) / 7)',
                          textAlign: 'center',
                          borderRight: '1px solid var(--border)',
                          backgroundColor: isToday ? '#eff6ff' : 'transparent'
                        }}
                      >
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: isToday ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700 }}>
                          {dayName}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text-main)', marginTop: '2px' }}>
                          {dayNum}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Rows Grouped by Position */}
              <tbody>
                {Object.keys(groupedEmployeesByPosition).length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No employees match the current search or filters.
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedEmployeesByPosition).map(([posName, empList]) => (
                    <React.Fragment key={posName}>
                      
                      {/* Position Group Header Row */}
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                        <td
                          colSpan={8}
                          style={{
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#334155',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Briefcase size={14} style={{ color: 'var(--primary)' }} />
                            <span>{posName}</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e2e8f0', color: '#475569' }}>
                              {empList.length} staff
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Employees in Position */}
                      {empList.map((emp) => {
                        const empId = emp.employee_id || emp.id;
                        const fullName = getEmployeeFullName(emp);
                        const initials = fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

                        return (
                          <tr key={empId} style={{ borderBottom: '1px solid var(--border)' }}>
                            
                            {/* Employee Name */}
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border)', backgroundColor: '#ffffff' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                                  {initials || 'E'}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                    {fullName}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', marginTop: '2px' }}>
                                    <span>{emp.position || 'Staff'}</span>
                                    <span>•</span>
                                    <span>{emp.branch || 'Main'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Days Cells */}
                            {dateRange.days.map((dayDate, dIdx) => {
                              const dateStr = dayDate.toISOString().split('T')[0];
                              const empDaySchedules = schedules.filter(
                                (s) => s.employee_id === empId && s.date === dateStr
                              );

                              return (
                                <td
                                  key={dIdx}
                                  onClick={() => {
                                    handleCellClick(empId, dateStr);
                                  }}
                                  style={{
                                    padding: '8px',
                                    borderRight: '1px solid var(--border)',
                                    verticalAlign: 'top',
                                    cursor: 'pointer',
                                    height: '70px',
                                    backgroundColor: '#ffffff'
                                  }}
                                >
                                  {empDaySchedules.length === 0 ? (
                                    <div
                                      style={{
                                        height: '100%',
                                        minHeight: '50px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '6px',
                                        border: '1px dashed transparent',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: selectedQuickShift ? '#dbeafe' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                        <Plus size={16} />
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {empDaySchedules.map((sched) => {
                                        const isOff = sched.assignment_type !== 'shift';
                                        const isDraft = sched.status === 'draft';

                                        let badgeBg = '#eff6ff';
                                        let badgeBorder = '#bfdbfe';
                                        let badgeText = '#1e40af';

                                        if (sched.assignment_type === 'day_off') {
                                          badgeBg = '#f1f5f9';
                                          badgeBorder = '#cbd5e1';
                                          badgeText = '#475569';
                                        } else if (sched.assignment_type === 'vacation') {
                                          badgeBg = '#fffbeb';
                                          badgeBorder = '#fde68a';
                                          badgeText = '#92400e';
                                        } else if (sched.assignment_type === 'sick_leave') {
                                          badgeBg = '#fef2f2';
                                          badgeBorder = '#fecaca';
                                          badgeText = '#991b1b';
                                        } else if (sched.assignment_type === 'unpaid_leave') {
                                          badgeBg = '#f3f4f6';
                                          badgeBorder = '#d1d5db';
                                          badgeText = '#374151';
                                        }

                                        return (
                                          <div
                                            key={sched.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditAssignment(sched);
                                            }}
                                            style={{
                                              padding: '6px 8px',
                                              borderRadius: '6px',
                                              backgroundColor: badgeBg,
                                              border: `1px ${isDraft ? 'dashed' : 'solid'} ${badgeBorder}`,
                                              fontSize: '11px',
                                              color: badgeText,
                                              fontWeight: 600,
                                              position: 'relative'
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {sched.shift_name || sched.assignment_type.replace('_', ' ').toUpperCase()}
                                              </span>
                                              
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                {isDraft ? (
                                                  <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '4px', backgroundColor: '#fde68a', color: '#78350f' }}>Draft</span>
                                                ) : (
                                                  <CheckCircle2 size={11} style={{ color: '#059669', flexShrink: 0 }} />
                                                )}

                                                <button
                                                  type="button"
                                                  onClick={(e) => handleQuickDeleteAssignment(e, sched.id)}
                                                  title="Delete Shift"
                                                  style={{
                                                    padding: '2px',
                                                    border: 'none',
                                                    background: 'none',
                                                    cursor: 'pointer',
                                                    color: '#ef4444',
                                                    borderRadius: '3px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: 0.85
                                                  }}
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              </div>
                                            </div>

                                            {!isOff && (
                                              <div style={{ fontSize: '10px', color: badgeText, opacity: 0.9, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={10} />
                                                <span>{sched.start_time} - {sched.end_time}</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              );
                            })}

                          </tr>
                        );
                      })}

                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      ) : viewMode === 'monthly' ? (

        /* ================= MONTHLY GRID ================= */
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dName, idx) => (
              <div key={idx} style={{ padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {dName}
              </div>
            ))}

            {dateRange.days.map((dayDate, idx) => {
              const dateStr = dayDate.toISOString().split('T')[0];
              const dayNum = dayDate.getDate();
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              const daySchedules = schedules.filter((s) => s.date === dateStr);

              return (
                <div
                  key={idx}
                  onClick={() => handleOpenAddAssignment(undefined, dateStr)}
                  style={{
                    minHeight: '100px',
                    padding: '8px',
                    backgroundColor: isToday ? '#eff6ff' : 'var(--surface)',
                    border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text-main)' }}>
                      {dayNum}
                    </span>
                    {daySchedules.length > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', backgroundColor: '#dbeafe', color: '#1e40af' }}>
                        {daySchedules.length}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    {daySchedules.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditAssignment(s);
                        }}
                        style={{ fontSize: '10px', padding: '4px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getEmployeeFullName(s.employees)} ({s.start_time})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleQuickDeleteAssignment(e, s.id)}
                          style={{ padding: '1px', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                    {daySchedules.length > 2 && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        +{daySchedules.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      ) : (

        /* ================= DAILY VIEW ================= */
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Daily Roster Timeline — {dateRange.startStr}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Detailed scheduled shifts and coverage for the selected day</p>
            </div>
            <button onClick={() => handleOpenAddAssignment(undefined, dateRange.startStr)} style={btnPrimaryStyle}>
              <Plus size={16} /> Add Shift
            </button>
          </div>

          {schedules.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No shifts scheduled for {dateRange.startStr}. Click "Add Shift" to assign employees.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {schedules.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleEditAssignment(s)}
                  style={{
                    padding: '14px 18px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                      {getEmployeeFullName(s.employees).substring(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{getEmployeeFullName(s.employees)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span>{s.position || 'Staff'}</span>
                        <span>•</span>
                        <span>{s.branch}</span>
                        <span>•</span>
                        <strong style={{ color: 'var(--primary)' }}>{s.shift_name}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {s.assignment_type === 'shift' ? (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} style={{ color: 'var(--primary)' }} />
                          <span>{s.start_time} - {s.end_time}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Break: {s.break_duration_mins || 0}m
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '6px', fontWeight: 600 }}>
                        {s.assignment_type.replace('_', ' ').toUpperCase()}
                      </span>
                    )}

                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: s.status === 'draft' ? '#fef3c7' : '#d1fae5', color: s.status === 'draft' ? '#78350f' : '#065f46' }}>
                      {s.status.toUpperCase()}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleQuickDeleteAssignment(e, s.id)}
                      title="Delete Shift"
                      style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', borderRadius: '6px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      )}

      {/* Modals */}
      <ShiftTemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        branches={branches}
        onTemplatesUpdated={loadData}
      />

      <ScheduleAssignmentModal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        employees={employees}
        branches={branches}
        templates={templates}
        initialData={selectedAssignment}
        onSaved={() => loadData(true)}
      />

      <CopyScheduleModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        branches={branches}
        currentStartDate={dateRange.startStr}
        onCopied={loadData}
      />

      <ConflictModal
        isOpen={!!conflictError}
        message={conflictError || ''}
        onClose={() => setConflictError(null)}
      />

    </div>
  );
}
