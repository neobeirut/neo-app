import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { 
  Clock, CheckCircle2, Search, Plus, 
  Trash2, Edit3, X, Eye, RefreshCw, ClipboardList, ShieldAlert,
  User, Users, Building, Loader2
} from 'lucide-react';

interface TasksScreenProps {
  user: any;
}

export default function TasksScreen({ user }: TasksScreenProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCompleteFormOpen, setIsCompleteFormOpen] = useState(false);

  // Form Field States (for Create/Edit)
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formAssignType, setFormAssignType] = useState('Employee');
  const [formAssignValue, setFormAssignValue] = useState('');
  const [formPriority, setFormPriority] = useState('Normal');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPhotoRequired, setFormPhotoRequired] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Complete Form States
  const [completionNote, setCompletionNote] = useState('');
  const [completionPhoto, setCompletionPhoto] = useState<File | null>(null);
  const [completionSubmitting, setCompletionSubmitting] = useState(false);

  // Photo Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [tasksRes, branchesRes, deptsRes, usersRes] = await Promise.all([
        api.getTasks(),
        api.getBranchesList(),
        api.getDepartmentsList(),
        api.getAllUsers()
      ]);

      if (tasksRes.success && tasksRes.data) {
        setTasks(tasksRes.data);
      }
      if (branchesRes.success && branchesRes.data) {
        // Handle format mismatch if getBranchesList returns string[] or object[]
        setBranches(branchesRes.data.map((b: any) => typeof b === 'string' ? b : b.name));
      }
      if (deptsRes.success && deptsRes.data) {
        setDepartments(deptsRes.data.map((d: any) => d.name));
      }
      if (usersRes.success && usersRes.data) {
        setEmployees(usersRes.data.map((u: any) => u.name));
      }
    } catch (e) {
      console.error('Error loading tasks dashboard data:', e);
    }
    setLoading(false);
  };

  const reloadTasks = async () => {
    try {
      const res = await api.getTasks();
      if (res.success && res.data) {
        setTasks(res.data);
      }
    } catch (e) {
      console.error('Error reloading tasks:', e);
    }
  };

  // Helper: Format DateTime for <input type="datetime-local">
  const formatForDateTimeLocal = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const tzoffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
  };

  // KPI calculations
  const stats = useMemo(() => {
    const total = tasks.length;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    const now = new Date();

    tasks.forEach(t => {
      const isTaskOverdue = t.due_date && new Date(t.due_date) < now && t.status !== 'Completed' && t.status !== 'Cancelled';
      if (isTaskOverdue) overdue++;
      
      if (t.status === 'Pending') pending++;
      else if (t.status === 'In Progress') inProgress++;
      else if (t.status === 'Completed') completed++;
    });

    return { total, pending, inProgress, completed, overdue };
  }, [tasks]);

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = 
        t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assigned_to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.task_id?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter;
      const matchesBranch = branchFilter === 'All' || t.branch === branchFilter;
      const matchesDept = deptFilter === 'All' || t.department === deptFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesBranch && matchesDept;
    });
  }, [tasks, searchTerm, statusFilter, priorityFilter, branchFilter, deptFilter]);

  // Assign To options helper
  const getAssignValueOptions = () => {
    switch (formAssignType) {
      case 'Branch':
        return ['All Branches', ...branches];
      case 'Department':
        return ['All Departments', ...departments];
      case 'Employee':
        return employees;
      default:
        return [];
    }
  };

  // Open modal for Create Task
  const openCreateModal = () => {
    setIsEditMode(false);
    setSelectedTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormBranch(branches[0] || '');
    setFormDept(departments[0] || '');
    setFormAssignType('Employee');
    setFormAssignValue('');
    setFormPriority('Normal');
    // Default due date: tomorrow at current time
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setFormDueDate(formatForDateTimeLocal(tomorrow.toISOString()));
    setFormPhotoRequired(false);
    setIsCreateModalOpen(true);
  };

  // Open modal for Edit Task
  const openEditModal = (task: any) => {
    setIsEditMode(true);
    setSelectedTask(task);
    setFormTitle(task.title || '');
    setFormDescription(task.description || '');
    setFormBranch(task.branch || '');
    setFormDept(task.department || '');
    setFormAssignType(task.assigned_to_type || 'Employee');
    setFormAssignValue(task.assigned_to || '');
    setFormPriority(task.priority || 'Normal');
    setFormDueDate(task.due_date ? formatForDateTimeLocal(task.due_date) : '');
    setFormPhotoRequired(task.photo_required || false);
    setIsCreateModalOpen(true);
  };

  // Open details modal
  const openDetailsModal = (task: any) => {
    setSelectedTask(task);
    setIsCompleteFormOpen(false);
    setCompletionNote('');
    setCompletionPhoto(null);
    setIsDetailsModalOpen(true);
  };

  // Save / Update Task Action
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return alert('Task title is required.');
    if (!formBranch) return alert('Branch is required.');
    if (!formDept) return alert('Department is required.');
    if (!formAssignValue) return alert('Assignee is required.');
    if (!formDueDate) return alert('Due date is required.');

    setFormSubmitting(true);
    try {
      const payload: any = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        branch: formBranch,
        department: formDept,
        assigned_to_type: formAssignType,
        assigned_to: formAssignValue,
        due_date: new Date(formDueDate).toISOString(),
        priority: formPriority,
        photo_required: formPhotoRequired,
      };

      if (isEditMode && selectedTask) {
        payload.task_id = selectedTask.task_id;
        payload.status = selectedTask.status; // Keep current status
      } else {
        payload.created_by = user.name || 'Manager';
        payload.status = 'Pending';
      }

      const res = await api.saveTask(payload);
      if (res.success) {
        setIsCreateModalOpen(false);
        reloadTasks();
      } else {
        alert('Failed to save task: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setFormSubmitting(false);
  };

  // Complete / Resolve Task Action (from Web-Admin)
  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (selectedTask.photo_required && !completionPhoto) {
      return alert('A photo proof is required to complete this task.');
    }

    setCompletionSubmitting(true);
    try {
      let photoUrl = selectedTask.photo_url || null;

      if (completionPhoto) {
        const uploadRes = await api.uploadTaskPhoto(completionPhoto);
        if (uploadRes.success && uploadRes.url) {
          photoUrl = uploadRes.url;
        } else {
          setCompletionSubmitting(false);
          return alert('Failed to upload photo proof: ' + uploadRes.error);
        }
      }

      const payload = {
        ...selectedTask,
        status: 'Completed',
        completion_note: completionNote.trim() || null,
        photo_url: photoUrl,
        completed_by: user.name || 'Manager',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const res = await api.saveTask(payload);
      if (res.success) {
        setIsDetailsModalOpen(false);
        reloadTasks();
      } else {
        alert('Failed to complete task: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setCompletionSubmitting(false);
  };

  // Cancel Task Action
  const handleCancelTask = async (task: any) => {
    if (!window.confirm(`Are you sure you want to cancel the task: "${task.title}"?`)) return;

    try {
      const payload = {
        ...task,
        status: 'Cancelled',
        updated_at: new Date().toISOString()
      };
      const res = await api.saveTask(payload);
      if (res.success) {
        if (isDetailsModalOpen) {
          setIsDetailsModalOpen(false);
        }
        reloadTasks();
      } else {
        alert('Failed to cancel task: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Reopen Task Action
  const handleReopenTask = async (task: any) => {
    try {
      const payload = {
        ...task,
        status: 'Pending',
        completion_note: null,
        photo_url: null,
        completed_by: null,
        completed_at: null,
        updated_at: new Date().toISOString()
      };
      const res = await api.saveTask(payload);
      if (res.success) {
        if (isDetailsModalOpen) {
          setIsDetailsModalOpen(false);
        }
        reloadTasks();
      } else {
        alert('Failed to reopen task: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Delete Task Action
  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the task: "${taskTitle}"?`)) return;

    try {
      const res = await api.deleteTask(taskId);
      if (res.success) {
        reloadTasks();
      } else {
        alert('Failed to delete task: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case 'Low': return 'bg-gray-badge';
      case 'Normal': return 'bg-blue-badge';
      case 'High': return 'bg-orange-badge';
      case 'Urgent': return 'bg-red-badge';
      default: return 'bg-gray-badge';
    }
  };

  const getStatusBadgeColor = (s: string, isOverdue: boolean) => {
    if (isOverdue) return 'bg-red-badge';
    switch (s) {
      case 'Pending': return 'bg-orange-badge';
      case 'In Progress': return 'bg-blue-badge';
      case 'Completed': return 'bg-green-badge';
      case 'Cancelled': return 'bg-gray-badge';
      default: return 'bg-gray-badge';
    }
  };

  return (
    <div className="dashboard-container">
      <style>{`
        .bg-gray-badge { background-color: #f1f3f5; color: #495057; border: 1px solid #dee2e6; }
        .bg-blue-badge { background-color: #e7f5ff; color: #1c7ed6; border: 1px solid #a5d8ff; }
        .bg-orange-badge { background-color: #fff4e6; color: #f76707; border: 1px solid #ffd8a8; }
        .bg-red-badge { background-color: #fff5f5; color: #fa5252; border: 1px solid #ffc9c9; }
        .bg-green-badge { background-color: #ebfbee; color: #37b24d; border: 1px solid #b2f2bb; }
        
        .task-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .task-filter-select {
          width: auto !important;
          min-width: 125px !important;
          height: 36px !important;
          padding: 6px 10px !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius) !important;
          background-color: #ffffff !important;
          font-size: 13px !important;
          outline: none !important;
          color: var(--text-main) !important;
          transition: border-color 0.2s !important;
          display: inline-block !important;
        }
        
        .task-filter-select:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px rgba(30, 92, 79, 0.15) !important;
        }

        .task-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease-out;
        }

        .task-modal {
          background-color: #ffffff;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          animation: slideUp 0.25s ease-out;
        }

        .task-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: #f8f9fa;
        }

        .task-modal-title {
          font-size: 16px;
          font-weight: 800;
          color: var(--text-main);
          margin: 0;
        }

        .task-modal-close {
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--text-muted);
          transition: color 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 50%;
        }

        .task-modal-close:hover {
          color: var(--danger);
          background-color: #f1f3f5;
        }

        .task-modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .task-modal-footer {
          padding: 12px 20px;
          border-top: 1px solid var(--border);
          background-color: #f8f9fa;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-label {
          font-size: 12px;
          font-weight: 700;
          color: #495057;
        }

        .form-input, .form-textarea, .form-select {
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          font-size: 14px;
          outline: none;
          background-color: #ffffff;
          color: var(--text-main);
          transition: border-color 0.2s;
        }

        .form-input:focus, .form-textarea:focus, .form-select:focus {
          border-color: var(--primary);
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          background-color: #f8f9fa;
          border-radius: var(--radius);
          padding: 16px;
          margin-bottom: 20px;
          border: 1px solid var(--border);
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 700;
          text-transform: uppercase;
        }

        .detail-value {
          font-size: 13px;
          color: var(--text-main);
          font-weight: 600;
        }

        .completion-proof-box {
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          background-color: #ffffff;
          padding: 12px;
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .completion-photo-preview {
          width: 100px;
          height: 100px;
          border-radius: var(--radius);
          object-fit: cover;
          border: 1px solid var(--border);
          cursor: zoom-in;
          transition: transform 0.2s;
        }

        .completion-photo-preview:hover {
          transform: scale(1.05);
        }

        .action-icon-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--text-muted);
          padding: 6px;
          border-radius: var(--radius);
          transition: all 0.15s;
        }

        .action-icon-btn:hover {
          background-color: #f1f3f5;
        }

        .action-icon-btn.view:hover { color: var(--primary); }
        .action-icon-btn.edit:hover { color: #2f9e44; }
        .action-icon-btn.cancel:hover { color: #f76707; }
        .action-icon-btn.delete:hover { color: var(--danger); }

        .lightbox-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0,0,0,0.85);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: zoom-out;
          animation: fadeIn 0.2s ease-out;
        }

        .lightbox-img {
          max-width: 90%;
          max-height: 90vh;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          cursor: default;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Title Row */}
      <div className="dashboard-title-row">
        <div>
          <h1>Operational Task Manager</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Assign, track, and manage operational standard task checklists for your branches and departments
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={loadInitialData} 
            className="auth-btn" 
            style={{ width: 'auto', padding: '10px 14px', background: '#f1f3f5', color: 'var(--text-main)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={openCreateModal} 
            className="auth-btn" 
            style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
          >
            <Plus size={16} /> Create Task
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Total Tasks</span>
            <div className="kpi-card-icon-wrapper">
              <ClipboardList size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{stats.total}</span>
            <span className="kpi-card-label">Active assigned tasks</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Pending / Active</span>
            <div className="kpi-card-icon-wrapper">
              <Clock size={20} color="#f76707" />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ color: '#f76707' }}>{stats.pending + stats.inProgress}</span>
            <span className="kpi-card-label">Requires action ({stats.pending} pending, {stats.inProgress} ongoing)</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-danger" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Overdue Tasks</span>
            <div className="kpi-card-icon-wrapper">
              <ShieldAlert size={20} color="var(--danger)" />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ color: 'var(--danger)' }}>{stats.overdue}</span>
            <span className="kpi-card-label">Deadlines expired</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Completed Tasks</span>
            <div className="kpi-card-icon-wrapper">
              <CheckCircle2 size={20} color="var(--success)" />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ color: 'var(--success)' }}>{stats.completed}</span>
            <span className="kpi-card-label">Resolved successfully</span>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px', maxWidth: '280px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search tasks..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px', height: '36px', fontSize: '13px' }}
          />
        </div>

        <select 
          className="task-filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <select 
          className="task-filter-select"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="All">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Normal">Normal</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>

        <select 
          className="task-filter-select"
          value={branchFilter}
          onChange={e => setBranchFilter(e.target.value)}
        >
          <option value="All">All Branches</option>
          {branches.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select 
          className="task-filter-select"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="All">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {(searchTerm || statusFilter !== 'All' || priorityFilter !== 'All' || branchFilter !== 'All' || deptFilter !== 'All') && (
          <button 
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('All');
              setPriorityFilter('All');
              setBranchFilter('All');
              setDeptFilter('All');
            }}
            style={{ padding: '8px 12px', border: 'none', background: 'none', color: 'var(--danger)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Table Panel */}
      <div className="table-container">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <Loader2 size={36} className="spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Task ID</th>
                <th>Task Details</th>
                <th>Assigned Scope</th>
                <th>Assigned To</th>
                <th style={{ width: '100px' }}>Priority</th>
                <th style={{ width: '110px' }}>Status</th>
                <th>Due Date</th>
                <th>Proof</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const now = new Date();
                const isOverdue = t.due_date && new Date(t.due_date) < now && t.status !== 'Completed' && t.status !== 'Cancelled';
                
                return (
                  <tr key={t.task_id} style={{ cursor: 'pointer' }} onClick={() => openDetailsModal(t)}>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t.task_id}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{t.title}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                          {t.description || 'No instructions provided.'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600 }}><Building size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} /> {t.branch}</span>
                        <span style={{ color: 'var(--text-muted)' }}><Users size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} /> {t.department}</span>
                      </div>
                    </td>
                    <td>
                      <span className="task-badge bg-gray-badge" style={{ textTransform: 'none', fontWeight: 600 }}>
                        {t.assigned_to_type === 'Employee' ? <User size={10} style={{ marginRight: '3px' }} /> : <Users size={10} style={{ marginRight: '3px' }} />}
                        {t.assigned_to}
                      </span>
                    </td>
                    <td>
                      <span className={`task-badge ${getPriorityBadgeColor(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`task-badge ${getStatusBadgeColor(t.status, isOverdue)}`}>
                        {isOverdue ? 'Overdue' : t.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', fontWeight: 600 }}>
                      <span style={{ color: isOverdue ? 'var(--danger)' : 'inherit' }}>
                        {new Date(t.due_date).toLocaleDateString()} {new Date(t.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', fontWeight: 500 }}>
                      {t.photo_required ? (
                        t.photo_url ? (
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>Uploaded</span>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Required</span>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None</span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button onClick={() => openDetailsModal(t)} className="action-icon-btn view" title="View Details">
                          <Eye size={16} />
                        </button>
                        {(t.status === 'Pending' || t.status === 'In Progress') && (
                          <>
                            <button onClick={() => openEditModal(t)} className="action-icon-btn edit" title="Edit Task">
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => handleCancelTask(t)} className="action-icon-btn cancel" title="Cancel Task">
                              <X size={16} />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteTask(t.task_id, t.title)} className="action-icon-btn delete" title="Delete Task">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <ClipboardList size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No tasks match current filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isCreateModalOpen && (
        <div className="task-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="task-modal-header">
              <h3 className="task-modal-title">{isEditMode ? 'Edit Task Settings' : 'Create Operational Task'}</h3>
              <button className="task-modal-close" onClick={() => setIsCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="task-modal-body">
                {/* Title */}
                <div className="form-group">
                  <label className="form-label">Task Title *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Deep clean espresso machine" 
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Detailed Instructions / Description</label>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Provide step-by-step guidance..." 
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                  />
                </div>

                {/* Branch and Department scope */}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Target Branch *</label>
                    <select 
                      className="form-select" 
                      value={formBranch} 
                      onChange={e => {
                        setFormBranch(e.target.value);
                        if (formAssignType === 'Branch') setFormAssignValue(e.target.value);
                      }}
                    >
                      {branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Department *</label>
                    <select 
                      className="form-select" 
                      value={formDept} 
                      onChange={e => {
                        setFormDept(e.target.value);
                        if (formAssignType === 'Department') setFormAssignValue(e.target.value);
                      }}
                    >
                      {departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Assign to scope */}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Assignee Type *</label>
                    <select 
                      className="form-select" 
                      value={formAssignType} 
                      onChange={e => {
                        setFormAssignType(e.target.value);
                        setFormAssignValue(''); // Reset
                      }}
                    >
                      <option value="Branch">Entire Branch</option>
                      <option value="Department">Entire Department</option>
                      <option value="Employee">Specific Employee</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assigned Value *</label>
                    <select 
                      className="form-select" 
                      value={formAssignValue} 
                      onChange={e => setFormAssignValue(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select assignee...</option>
                      {getAssignValueOptions().map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Due Date and Priority */}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Due Date & Time *</label>
                    <input 
                      type="datetime-local" 
                      className="form-input" 
                      value={formDueDate} 
                      onChange={e => setFormDueDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select 
                      className="form-select" 
                      value={formPriority} 
                      onChange={e => setFormPriority(e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Photo proof required toggle */}
                <div className="form-checkbox-row" style={{ marginTop: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="photoRequired" 
                    checked={formPhotoRequired}
                    onChange={e => setFormPhotoRequired(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="photoRequired" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                    Require photo proof completion
                  </label>
                </div>
              </div>
              <div className="task-modal-footer">
                <button 
                  type="button" 
                  className="auth-btn" 
                  style={{ width: 'auto', padding: '8px 16px', background: '#f1f3f5', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="auth-btn" 
                  style={{ width: 'auto', padding: '8px 20px' }}
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Saving...' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {isDetailsModalOpen && selectedTask && (
        <div className="task-modal-backdrop" onClick={() => setIsDetailsModalOpen(false)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="task-modal-header">
              <h3 className="task-modal-title">Task Details: {selectedTask.task_id}</h3>
              <button className="task-modal-close" onClick={() => setIsDetailsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="task-modal-body">
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 10px 0', color: '#111827' }}>{selectedTask.title}</h2>
              <p style={{ fontSize: '14px', color: '#374151', whiteSpace: 'pre-line', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                {selectedTask.description || 'No detailed instructions provided.'}
              </p>

              {/* Scope details grid */}
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <div>
                    <span className={`task-badge ${getStatusBadgeColor(selectedTask.status, selectedTask.due_date && new Date(selectedTask.due_date) < new Date() && selectedTask.status !== 'Completed' && selectedTask.status !== 'Cancelled')}`}>
                      {selectedTask.status}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Priority</span>
                  <div>
                    <span className={`task-badge ${getPriorityBadgeColor(selectedTask.priority)}`}>
                      {selectedTask.priority}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Scope (Branch/Dept)</span>
                  <span className="detail-value">{selectedTask.branch} - {selectedTask.department}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Assigned To</span>
                  <span className="detail-value">{selectedTask.assigned_to} ({selectedTask.assigned_to_type})</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Created By</span>
                  <span className="detail-value">{selectedTask.created_by}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Due Date</span>
                  <span className="detail-value" style={{ color: selectedTask.due_date && new Date(selectedTask.due_date) < new Date() && selectedTask.status !== 'Completed' && selectedTask.status !== 'Cancelled' ? 'var(--danger)' : 'inherit' }}>
                    {new Date(selectedTask.due_date).toLocaleDateString()} {new Date(selectedTask.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Completion data (if completed) */}
              {selectedTask.status === 'Completed' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--success)' }}>
                    Completion Proof
                  </h4>
                  <div className="details-grid" style={{ backgroundColor: '#ebfbee', borderColor: '#b2f2bb' }}>
                    <div className="detail-item">
                      <span className="detail-label">Completed By</span>
                      <span className="detail-value">{selectedTask.completed_by || 'Unknown'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Completed At</span>
                      <span className="detail-value">
                        {selectedTask.completed_at ? new Date(selectedTask.completed_at).toLocaleDateString() + ' ' + new Date(selectedTask.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </span>
                    </div>
                    <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="detail-label">Completion Notes</span>
                      <span className="detail-value" style={{ fontWeight: 500, color: '#2b2b2b' }}>{selectedTask.completion_note || 'No notes left.'}</span>
                    </div>
                  </div>

                  {selectedTask.photo_url && (
                    <div className="completion-proof-box">
                      <span className="detail-label">Photo Proof Attachment:</span>
                      <img 
                        src={selectedTask.photo_url} 
                        className="completion-photo-preview" 
                        alt="Task photo proof" 
                        onClick={() => setLightboxImage(selectedTask.photo_url)}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click image to zoom</span>
                    </div>
                  )}
                </div>
              )}

              {/* Completion form (if manager is completing task from admin panel) */}
              {isCompleteFormOpen && (
                <form onSubmit={handleCompleteTask} style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 12px 0', textTransform: 'uppercase', color: 'var(--primary)' }}>
                    Resolve Operational Task
                  </h4>
                  <div className="form-group">
                    <label className="form-label">Completion Notes *</label>
                    <textarea 
                      className="form-textarea" 
                      placeholder="Specify details about task completion..." 
                      value={completionNote}
                      onChange={e => setCompletionNote(e.target.value)}
                      required
                    />
                  </div>
                  
                  {selectedTask.photo_required && (
                    <div className="form-group">
                      <label className="form-label">Photo Proof Attachment *</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => {
                          if (e.target.files && e.target.files.length > 0) {
                            setCompletionPhoto(e.target.files[0]);
                          }
                        }}
                        required
                      />
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button 
                      type="button" 
                      className="auth-btn" 
                      style={{ width: 'auto', padding: '8px 16px', background: '#f1f3f5', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                      onClick={() => setIsCompleteFormOpen(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="auth-btn" 
                      style={{ width: 'auto', padding: '8px 20px' }}
                      disabled={completionSubmitting}
                    >
                      {completionSubmitting ? 'Uploading & Completing...' : 'Submit Resolution'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="task-modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {(selectedTask.status === 'Completed' || selectedTask.status === 'Cancelled') && (
                  <button 
                    onClick={() => handleReopenTask(selectedTask)}
                    className="auth-btn" 
                    style={{ width: 'auto', padding: '8px 16px', background: '#f1f3f5', color: 'var(--primary)', border: '1px solid var(--border)' }}
                  >
                    Reopen Task
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="auth-btn" 
                  style={{ width: 'auto', padding: '8px 16px', background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  Close
                </button>
                
                {(selectedTask.status === 'Pending' || selectedTask.status === 'In Progress') && !isCompleteFormOpen && (
                  <>
                    <button 
                      className="auth-btn" 
                      style={{ width: 'auto', padding: '8px 16px', background: '#f76707' }}
                      onClick={() => handleCancelTask(selectedTask)}
                    >
                      Cancel Task
                    </button>
                    <button 
                      className="auth-btn" 
                      style={{ width: 'auto', padding: '8px 16px' }}
                      onClick={() => setIsCompleteFormOpen(true)}
                    >
                      Resolve Task
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Overlay */}
      {lightboxImage && (
        <div className="lightbox-backdrop" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} className="lightbox-img" alt="Enlarged task proof" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
