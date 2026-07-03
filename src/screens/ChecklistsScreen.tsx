import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Eye, 
  RefreshCw, 
  Info, 
  X,
  Image as ImageIcon,
  Hash
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

export default function ChecklistsScreen({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'submissions' | 'templates'>('submissions');
  const [loading, setLoading] = useState(true);

  // Data lists
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  // Submissions Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterDept, setFilterDept] = useState('All');

  // Modals state
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateBranch, setTemplateBranch] = useState('');
  const [templateDept, setTemplateDept] = useState('');
  const [templateTasks, setTemplateTasks] = useState<{ id: string; text: string; type: 'checkbox' | 'number' | 'photo' }[]>([]);
  
  // Task builder state
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskType, setNewTaskType] = useState<'checkbox' | 'number' | 'photo'>('checkbox');

  const [submittingAction, setSubmittingAction] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState({
    totalSubmissions: 0,
    submissionsToday: 0,
    activeTemplatesCount: 0
  });

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (activeTab === 'submissions') {
      loadSubmissions();
    } else {
      loadTemplates();
    }
  }, [activeTab, startDate, endDate, filterBranch, filterDept]);

  const loadLookups = async () => {
    try {
      const [branchRes, deptRes] = await Promise.all([
        api.getBranchesList(),
        api.getDepartmentsList()
      ]);
      if (branchRes.success && branchRes.data) {
        setBranches(branchRes.data.map((b: any) => typeof b === 'string' ? b : b.name));
      }
      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data.map((d: any) => typeof d === 'string' ? d : d.name));
      }
    } catch (e) {
      console.error('Error loading checklists lookups:', e);
    }
  };

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const res = await api.getChecklistSubmissions(
        filterBranch === 'All' ? undefined : filterBranch,
        filterDept === 'All' ? undefined : filterDept
      );
      if (res.success && res.data) {
        let data = res.data;
        
        // Filter by date range locally if selected
        if (startDate) {
          data = data.filter((s: any) => s.date_submitted >= `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
          data = data.filter((s: any) => s.date_submitted <= `${endDate}T23:59:59.999Z`);
        }

        setSubmissions(data);

        // Calculate KPIs
        const totalSubmissions = data.length;
        const todayStr = new Date().toISOString().split('T')[0];
        const submissionsToday = data.filter((s: any) => s.date_submitted && s.date_submitted.startsWith(todayStr)).length;
        
        // Fetch templates count
        const tempRes = await api.getChecklists();
        const activeTemplatesCount = tempRes.success && tempRes.data ? tempRes.data.length : 0;
        
        setKpis({ totalSubmissions, submissionsToday, activeTemplatesCount });
      } else {
        setSubmissions([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.getChecklists();
      if (res.success && res.data) {
        let data = res.data;
        if (filterBranch !== 'All') {
          data = data.filter((t: any) => t.branch === filterBranch);
        }
        if (filterDept !== 'All') {
          data = data.filter((t: any) => t.department === filterDept);
        }
        setTemplates(data);
      } else {
        setTemplates([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Open Submission Detail
  const handleOpenSubmission = (sub: any) => {
    setSelectedSubmission(sub);
    setShowSubModal(true);
  };

  // Open Template Modal
  const handleOpenTemplateModal = (templateObj: any | null) => {
    setEditingTemplate(templateObj);
    setNewTaskText('');
    setNewTaskType('checkbox');
    
    if (templateObj) {
      setTemplateName(templateObj.name || '');
      setTemplateBranch(templateObj.branch || '');
      setTemplateDept(templateObj.department || '');
      setTemplateTasks(templateObj.tasks || []);
    } else {
      setTemplateName('');
      setTemplateBranch(branches[0] || 'Downtown');
      setTemplateDept(departments[0] || 'Kitchen');
      setTemplateTasks([]);
    }
    setShowTemplateModal(true);
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this checklist template? This will not affect submitted checklist history.')) return;
    try {
      const res = await api.deleteChecklist(id);
      if (res.success) {
        loadTemplates();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error deleting template: ' + e.message);
    }
  };

  // Add Task to List
  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    setTemplateTasks(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
        text: newTaskText.trim(),
        type: newTaskType
      }
    ]);
    setNewTaskText('');
  };

  // Remove Task from List
  const handleRemoveTask = (idx: number) => {
    setTemplateTasks(templateTasks.filter((_, i) => i !== idx));
  };

  // Save Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      alert('Please enter a checklist template name.');
      return;
    }
    if (!templateBranch) {
      alert('Please select a branch.');
      return;
    }
    if (!templateDept) {
      alert('Please select a department.');
      return;
    }
    if (templateTasks.length === 0) {
      alert('Please add at least one task/question to the checklist.');
      return;
    }

    setSubmittingAction(true);
    try {
      const payload = {
        ...(editingTemplate?.id ? { id: editingTemplate.id } : {}),
        name: templateName.trim(),
        branch: templateBranch,
        department: templateDept,
        tasks: templateTasks,
        created_by: editingTemplate ? editingTemplate.created_by : user.name,
        is_active: true
      };

      const res = await api.saveChecklist(payload);
      if (res.success) {
        alert('Checklist template saved successfully.');
        setShowTemplateModal(false);
        loadTemplates();
      } else {
        alert('Error saving template: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmittingAction(false);
  };

  // Calculate Submission compliance score
  const getSubmissionScore = (submission: any) => {
    const responses = submission.responses || {};
    const total = Object.keys(responses).length;
    if (total === 0) return '0 / 0 (0%)';
    const completed = Object.values(responses).filter(v => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return v.trim().length > 0;
      return !!v;
    }).length;
    const percentage = Math.round((completed / total) * 100);
    return `${completed} / ${total} (${percentage}%)`;
  };

  return (
    <div className="dashboard-container">
      {/* Title Header */}
      <div className="dashboard-title-row">
        <div>
          <h1>Daily Checklists</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Review staff FOH/BOH daily checklist logs, audit compliance metrics, and manage checklist templates.
          </p>
        </div>

        {/* Toggle Tabs & Add Template */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button 
              className="auth-btn" 
              style={{ 
                width: 'auto', 
                borderRadius: 0,
                backgroundColor: activeTab === 'submissions' ? 'var(--primary)' : '#ffffff',
                color: activeTab === 'submissions' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '14px'
              }}
              onClick={() => setActiveTab('submissions')}
            >
              Completed Logs
            </button>
            <button 
              className="auth-btn" 
              style={{ 
                width: 'auto', 
                borderRadius: 0,
                backgroundColor: activeTab === 'templates' ? 'var(--primary)' : '#ffffff',
                color: activeTab === 'templates' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '14px'
              }}
              onClick={() => setActiveTab('templates')}
            >
              Checklist Templates
            </button>
          </div>

          {activeTab === 'templates' && (
            <button 
              onClick={() => handleOpenTemplateModal(null)}
              className="auth-btn"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} /> Create Template
            </button>
          )}
        </div>
      </div>

      {activeTab === 'submissions' && (
        <>
          {/* Summary KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Completed Logs Today</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.submissionsToday}</span>
                <span className="kpi-card-label">Checklists submitted today</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Total Submissions Logs</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#e2e8f0', color: 'var(--text-muted)' }}>
                  <ClipboardList size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.totalSubmissions}</span>
                <span className="kpi-card-label">Checklist logs in history</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Checklist Templates</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <Info size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.activeTemplatesCount}</span>
                <span className="kpi-card-label">Active templates configured</span>
              </div>
            </div>
          </div>

          {/* Submissions Filter Card */}
          <div className="filters-card" style={{ marginTop: '16px' }}>
            <div className="filters-row">
              <div className="filter-group" style={{ maxWidth: '160px' }}>
                <label>Start Date</label>
                <input 
                  type="date" 
                  className="filter-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="filter-group" style={{ maxWidth: '160px' }}>
                <label>End Date</label>
                <input 
                  type="date" 
                  className="filter-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label>Branch</label>
                <select 
                  className="filter-select"
                  value={filterBranch} 
                  onChange={(e) => setFilterBranch(e.target.value)}
                >
                  <option value="All">All Branches</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Department</label>
                <select 
                  className="filter-select"
                  value={filterDept} 
                  onChange={(e) => setFilterDept(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button 
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setFilterBranch('All');
                    setFilterDept('All');
                  }}
                  className="auth-btn"
                  style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Submissions Logs Table Grid */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            {loading ? (
              <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading checklist logs...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
                <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Submissions Found</span>
                <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try loosening your date or branch filters.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>Checklist Name</th>
                      <th style={tableHeaderStyle}>Branch</th>
                      <th style={tableHeaderStyle}>Department</th>
                      <th style={tableHeaderStyle}>Filled By</th>
                      <th style={tableHeaderStyle}>Date Submitted</th>
                      <th style={tableHeaderStyle}>Compliance Score</th>
                      <th style={tableHeaderStyle}>Comments</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                        <td style={{ ...tableCellStyle, fontWeight: 700 }}>{sub.checklist_name}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{sub.branch}</td>
                        <td style={tableCellStyle}>{sub.department}</td>
                        <td style={tableCellStyle}>{sub.user_name || '—'}</td>
                        <td style={tableCellStyle}>{sub.date_submitted ? new Date(sub.date_submitted).toLocaleString() : '—'}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 700, color: 'var(--primary)' }}>
                          {getSubmissionScore(sub)}
                        </td>
                        <td style={{ ...tableCellStyle, maxWidth: '200px', whiteSpace: 'normal', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {sub.comments || '—'}
                        </td>
                        <td style={tableCellStyle}>
                          <button 
                            onClick={() => handleOpenSubmission(sub)} 
                            className="auth-btn" 
                            style={{ 
                              width: 'auto', 
                              padding: '6px 12px', 
                              fontSize: '12px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              backgroundColor: 'var(--primary)'
                            }}
                          >
                            <Eye size={14} /> Review Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <>
          {/* Templates Filters */}
          <div className="filters-card">
            <div className="filters-row">
              <div className="filter-group">
                <label>Branch</label>
                <select 
                  className="filter-select"
                  value={filterBranch} 
                  onChange={(e) => setFilterBranch(e.target.value)}
                >
                  <option value="All">All Branches</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Department</label>
                <select 
                  className="filter-select"
                  value={filterDept} 
                  onChange={(e) => setFilterDept(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button 
                  onClick={() => {
                    setFilterBranch('All');
                    setFilterDept('All');
                  }}
                  className="auth-btn"
                  style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Templates Grid List */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            {loading ? (
              <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
                <ClipboardList size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Templates Found</span>
                <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Click "Create Template" to add a checklist template.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>Checklist Template Name</th>
                      <th style={tableHeaderStyle}>Branch</th>
                      <th style={tableHeaderStyle}>Department</th>
                      <th style={tableHeaderStyle}>Tasks Count</th>
                      <th style={tableHeaderStyle}>Created By</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((temp) => (
                      <tr key={temp.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                        <td style={{ ...tableCellStyle, fontWeight: 700 }}>{temp.name}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{temp.branch}</td>
                        <td style={tableCellStyle}>{temp.department}</td>
                        <td style={tableCellStyle}>{(temp.tasks || []).length} Task(s)</td>
                        <td style={tableCellStyle}>{temp.created_by || '—'}</td>
                        <td style={tableCellStyle}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => handleOpenTemplateModal(temp)} 
                              className="auth-btn"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
                            >
                              Edit Template
                            </button>
                            <button 
                              onClick={() => handleDeleteTemplate(temp.id)} 
                              className="auth-btn"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* SUBMISSION DETAIL MODAL */}
      {showSubModal && selectedSubmission && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Checklist Audit Logs</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Template: <strong>{selectedSubmission.checklist_name}</strong>
                </p>
              </div>
              <button 
                onClick={() => setShowSubModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Submission details summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Filled By</span>
                  <strong style={{ fontSize: '14px' }}>{selectedSubmission.user_name}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date & Time</span>
                  <strong style={{ fontSize: '14px' }}>{new Date(selectedSubmission.date_submitted).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Branch / Department</span>
                  <strong style={{ fontSize: '14px' }}>{selectedSubmission.branch} ({selectedSubmission.department})</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Compliance Score</span>
                  <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>{getSubmissionScore(selectedSubmission)}</strong>
                </div>
              </div>

              {/* Responses List */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Task Results</h3>
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '10px 14px', fontSize: '12px' }}>Task Description</th>
                        <th style={{ padding: '10px 14px', fontSize: '12px', width: '150px', textAlign: 'right' }}>Response / Photo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedSubmission.responses || {}).map(([task, answer]: [string, any], idx) => {
                        const isPhoto = typeof answer === 'string' && answer.startsWith('http');
                        const isNumber = typeof answer === 'string' && !isPhoto && answer !== '';
                        const isBoolean = typeof answer === 'boolean';
                        const isChecked = isBoolean ? answer : !!answer;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{task}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              {isPhoto ? (
                                <a href={answer} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '12px' }}>
                                  <ImageIcon size={14} /> Open Photo
                                </a>
                              ) : isNumber ? (
                                <span style={{ padding: '4px 8px', backgroundColor: '#e2e8f0', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '12px' }}>
                                  <Hash size={12} /> {answer}
                                </span>
                              ) : (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  color: isChecked ? 'var(--success)' : 'var(--danger)',
                                  display: 'inline-block'
                                }}>
                                  {isChecked ? 'Done' : 'Missed'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Extra Comments */}
              {selectedSubmission.comments && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Additional Comments</h3>
                  <div style={{ backgroundColor: '#f1f5f9', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', fontSize: '13px', fontStyle: 'italic' }}>
                    "{selectedSubmission.comments}"
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: '#f8fafc'
            }}>
              <button
                onClick={() => setShowSubModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE FORM MODAL */}
      {showTemplateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800 }}>
                {editingTemplate ? 'Edit Checklist Template' : 'Create Checklist Template'}
              </h2>
              <button 
                onClick={() => setShowTemplateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              {/* Modal Body */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Checklist Name</label>
                  <input 
                    type="text" 
                    className="filter-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Opening BOH Kitchen Checklist, Bar Closing Checklist..."
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Branch</label>
                    <select 
                      className="filter-select"
                      value={templateBranch}
                      onChange={(e) => setTemplateBranch(e.target.value)}
                    >
                      {branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Department</label>
                    <select 
                      className="filter-select"
                      value={templateDept}
                      onChange={(e) => setTemplateDept(e.target.value)}
                    >
                      {departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tasks List Editor */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Tasks / Questions</h3>
                  
                  {/* Render Tasks List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '180px', overflowY: 'auto' }}>
                    {templateTasks.length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks added yet. Add tasks using the builder below.</span>
                    ) : (
                      templateTasks.map((task, idx) => {
                        let typeIcon = '☑️';
                        if (task.type === 'number') typeIcon = '🔢';
                        if (task.type === 'photo') typeIcon = '📷';
                        
                        return (
                          <div key={task.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}>
                              <span>{typeIcon}</span>
                              <span>{task.text}</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveTask(idx)}
                              style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Task Box */}
                  <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="filter-input"
                      style={{ flex: 1, height: '36px' }}
                      placeholder="Add task/question..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                    />
                    <select
                      className="filter-select"
                      style={{ width: '110px', height: '36px', padding: '0 8px' }}
                      value={newTaskType}
                      onChange={(e: any) => setNewTaskType(e.target.value)}
                    >
                      <option value="checkbox">☑️ Check</option>
                      <option value="number">🔢 Number</option>
                      <option value="photo">📷 Photo</option>
                    </select>
                    <button 
                      type="button"
                      onClick={handleAddTask}
                      className="auth-btn"
                      style={{ width: 'auto', height: '36px', padding: '0 14px' }}
                    >
                      Add
                    </button>
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '20px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: '#f8fafc'
              }}>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}
                  disabled={submittingAction}
                >
                  {submittingAction ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--text-muted)',
  fontWeight: 700,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '2px solid var(--border)',
  backgroundColor: '#f8fafc',
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
  fontSize: '13.5px',
  color: 'var(--text-main)',
  fontWeight: 500,
};
