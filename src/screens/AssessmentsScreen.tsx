import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  getScoreRatingInfo,
  validateSectionWeights,
} from '../utils/assessmentScoring';
import { printAssessmentReportWeb } from '../utils/printAssessmentWeb';
import AssessmentDetailWebModal from './AssessmentDetailWebModal';
import {
  Target,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Edit,
  Trash2,
  Copy,
  Archive,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  Building,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Play,
  X,
} from 'lucide-react';

export default function AssessmentsScreen({ user }: { user?: any }) {
  const navigate = useNavigate();

  // Tabs: 'dashboard' | 'in_progress' | 'reassessments' | 'templates'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'in_progress' | 'reassessments' | 'templates'>('dashboard');

  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | 'month'>('all');

  // Modals & Drawers
  const [selectedAssessmentIdForDetail, setSelectedAssessmentIdForDetail] = useState<string | null>(null);

  // New Assessment Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newTemplateId, setNewTemplateId] = useState('');
  const [newPosition, setNewPosition] = useState('Waiter');
  const [newBranch, setNewBranch] = useState('');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAssessmentDate, setNewAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDaysWorked, setNewDaysWorked] = useState('10');
  const [newReason, setNewReason] = useState('Initial probation');
  const [newEvaluatorName, setNewEvaluatorName] = useState(user?.name || 'Manager');
  const [newSecondEvaluatorName, setNewSecondEvaluatorName] = useState('');
  const [parentAssessmentIdForReassessment, setParentAssessmentIdForReassessment] = useState<string | undefined>(undefined);
  const [isReassessmentFlag, setIsReassessmentFlag] = useState(false);

  // Template Builder States
  const [templateTab, setTemplateTab] = useState<'active' | 'archived'>('active');
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [showTemplateEditorModal, setShowTemplateEditorModal] = useState(false);
  const [templateBuilderTab, setTemplateBuilderTab] = useState<'general' | 'sections'>('general');

  // Section / Criteria / Question Modals
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [showCriterionModal, setShowCriterionModal] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<any>(null);
  const [targetSectionIdForCriterion, setTargetSectionIdForCriterion] = useState<string>('');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [targetSectionIdForQuestion, setTargetSectionIdForQuestion] = useState<string>('');

  const roleLower = (user?.role || '').toString().toLowerCase().trim();
  const isAdmin = roleLower === 'admin' || roleLower === 'superadmin' || roleLower.includes('admin') || roleLower === 'owner';
  const isManager = isAdmin || roleLower === 'manager';

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedBranch, selectedPosition, selectedStatus, dateFilter, activeTab, templateTab]);

  const loadLookups = async () => {
    const [empRes, tmplRes, branchRes] = await Promise.all([
      api.getEmployees(),
      api.getAssessmentTemplates({ includeArchived: true }),
      api.getBranches(),
    ]);

    if (empRes.success && empRes.data) setEmployees(empRes.data);
    if (tmplRes.success && tmplRes.data) setTemplates(tmplRes.data);
    if (branchRes.success && branchRes.data) setBranches(branchRes.data);
  };

  const loadData = async () => {
    setLoading(true);

    let dateFrom: string | undefined = undefined;
    const now = new Date();
    if (dateFilter === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      dateFrom = d.toISOString().split('T')[0];
    } else if (dateFilter === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      dateFrom = d.toISOString().split('T')[0];
    } else if (dateFilter === 'month') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }

    const [assRes, metRes, tmplRes] = await Promise.all([
      api.getEmployeeAssessments({
        branch: selectedBranch || undefined,
        position: selectedPosition || undefined,
        status: selectedStatus || undefined,
        dateFrom,
      }),
      api.getAssessmentDashboardMetrics({
        branch: selectedBranch || undefined,
        position: selectedPosition || undefined,
        dateFrom,
      }),
      api.getAssessmentTemplates({ includeArchived: templateTab === 'archived' }),
    ]);

    if (assRes.success && assRes.data) setAssessments(assRes.data);
    if (metRes.success && metRes.data) setMetrics(metRes.data);
    if (tmplRes.success && tmplRes.data) {
      const filtered = templateTab === 'active'
        ? tmplRes.data.filter((t: any) => !t.is_archived)
        : tmplRes.data.filter((t: any) => t.is_archived);
      setTemplates(filtered);
    }

    setLoading(false);
  };

  // Launch New Assessment Workflow
  const handleOpenNewModal = (prefillEmployee?: any, parentAssessment?: any) => {
    if (prefillEmployee) {
      setNewEmployeeId(prefillEmployee.employee_id);
      setNewPosition(prefillEmployee.position || 'Waiter');
      setNewBranch(prefillEmployee.branch || (branches[0]?.name || 'Main'));
      if (prefillEmployee.date_started) setNewStartDate(prefillEmployee.date_started);

      const matchingTmpl = templates.find((t) => (t.position || '').toLowerCase() === (prefillEmployee.position || '').toLowerCase());
      if (matchingTmpl) setNewTemplateId(matchingTmpl.id);
      else if (templates.length > 0) setNewTemplateId(templates[0].id);
    } else if (templates.length > 0 && !newTemplateId) {
      setNewTemplateId(templates[0].id);
    }

    if (parentAssessment) {
      setParentAssessmentIdForReassessment(parentAssessment.id);
      setIsReassessmentFlag(true);
      setNewReason('Extended probation');
    } else {
      setParentAssessmentIdForReassessment(undefined);
      setIsReassessmentFlag(false);
      setNewReason('Initial probation');
    }

    setShowNewModal(true);
  };

  const handleCreateAssessment = async () => {
    if (!newEmployeeId) return alert('Please select an employee.');
    if (!newTemplateId) return alert('Please select an assessment template.');

    const res = await api.createEmployeeAssessment({
      templateId: newTemplateId,
      employeeId: newEmployeeId,
      position: newPosition,
      branch: newBranch || 'Main',
      employmentStartDate: newStartDate,
      assessmentDate: newAssessmentDate,
      daysWorked: parseInt(newDaysWorked) || 10,
      reason: newReason,
      evaluatorName: newEvaluatorName,
      secondEvaluatorName: newSecondEvaluatorName || undefined,
      parentAssessmentId: parentAssessmentIdForReassessment,
      isReassessment: isReassessmentFlag,
      createdBy: user?.name,
    });

    if (res.success && res.data) {
      setShowNewModal(false);
      loadData();
      navigate(`/assessments/conduct/${res.data.id}`);
    } else {
      alert('Error creating assessment: ' + res.error);
    }
  };

  // Template CRUD
  const handleOpenTemplateEditor = async (templateId?: string) => {
    if (templateId) {
      const res = await api.getAssessmentTemplateById(templateId);
      if (res.success && res.data) {
        setEditingTemplate(res.data);
      }
    } else {
      setEditingTemplate({
        name: '',
        position: 'Waiter',
        description: '',
        recommended_days_timing: 10,
        default_evaluator_role: 'Manager',
        practical_weight: 70,
        questions_weight: 30,
        confirmation_threshold: 80,
        probation_extension_min: 65,
        probation_extension_max: 79.99,
        dismissal_threshold: 65,
        additional_rules: { auto_dismiss_on_critical: true },
        sections: [],
      });
    }
    setTemplateBuilderTab('general');
    setShowTemplateEditorModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate.name.trim()) return alert('Please enter a template name.');
    if (!editingTemplate.position.trim()) return alert('Please specify a position.');

    const pWeight = parseFloat(editingTemplate.practical_weight) || 0;
    const qWeight = parseFloat(editingTemplate.questions_weight) || 0;
    if (Math.abs(pWeight + qWeight - 100) > 0.01) {
      return alert(`Practical weight (${pWeight}%) + Questions weight (${qWeight}%) must sum to 100%.`);
    }

    const weightVal = validateSectionWeights(editingTemplate.sections || []);
    if (editingTemplate.sections && editingTemplate.sections.length > 0 && !weightVal.isValid) {
      return alert(`Active practical sections weight is ${weightVal.totalPracticalWeight}%. Must equal 100%.`);
    }

    const res = await api.saveAssessmentTemplate({
      ...editingTemplate,
      created_by: user?.name || 'Admin',
    });

    if (res.success) {
      alert('Template saved successfully.');
      setShowTemplateEditorModal(false);
      loadData();
    } else {
      alert('Error saving template: ' + res.error);
    }
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to clone this assessment template?')) return;
    const res = await api.duplicateAssessmentTemplate(templateId, user?.name);
    if (res.success) {
      alert('Template duplicated successfully.');
      loadData();
    } else {
      alert('Error duplicating: ' + res.error);
    }
  };

  const handleToggleArchiveTemplate = async (template: any) => {
    const nextArchived = !template.is_archived;
    if (!confirm(`Are you sure you want to ${nextArchived ? 'archive' : 'restore'} "${template.name}"?`)) return;
    const res = await api.archiveAssessmentTemplate(template.id, nextArchived);
    if (res.success) {
      loadData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleDeleteTemplate = async (template: any) => {
    if (!confirm(`Permanently delete "${template.name}" and all its sections? This cannot be undone.`)) return;
    const res = await api.deleteAssessmentTemplate(template.id);
    if (res.success) {
      alert('Template deleted.');
      loadData();
    } else {
      alert('Error deleting template: ' + res.error);
    }
  };

  // Section Builder Inside Editor
  const handleSaveSectionModal = async () => {
    if (!editingSection.title.trim()) return alert('Please enter section title.');
    if (!editingTemplate.id) return alert('Please save template general details first.');

    const catGroup = editingSection.section_type?.includes('question') || editingSection.section_type?.includes('scenario')
      ? 'questions'
      : 'practical';

    const res = await api.saveAssessmentSection({
      ...editingSection,
      template_id: editingTemplate.id,
      category_group: catGroup,
      weight: parseFloat(editingSection.weight) || 0,
      display_order: parseInt(editingSection.display_order) || 1,
    });

    if (res.success) {
      setShowSectionModal(false);
      const refreshRes = await api.getAssessmentTemplateById(editingTemplate.id);
      if (refreshRes.success) setEditingTemplate(refreshRes.data);
    } else {
      alert('Error saving section: ' + res.error);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Delete section and all its criteria/questions?')) return;
    await api.deleteAssessmentSection(sectionId);
    const refreshRes = await api.getAssessmentTemplateById(editingTemplate.id);
    if (refreshRes.success) setEditingTemplate(refreshRes.data);
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const list = [...(editingTemplate.sections || [])];
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    for (let i = 0; i < list.length; i++) {
      await api.saveAssessmentSection({ id: list[i].id, display_order: i + 1 });
    }
    const refreshRes = await api.getAssessmentTemplateById(editingTemplate.id);
    if (refreshRes.success) setEditingTemplate(refreshRes.data);
  };

  // Criterion Modal Save
  const handleSaveCriterionModal = async () => {
    if (!editingCriterion.name.trim()) return alert('Please enter criterion name.');
    const res = await api.saveAssessmentCriterion({
      ...editingCriterion,
      section_id: targetSectionIdForCriterion,
      template_id: editingTemplate.id,
      max_score: parseFloat(editingCriterion.max_score) || 5,
      weight_in_section: parseFloat(editingCriterion.weight_in_section) || 1,
      comment_required_below_score: parseFloat(editingCriterion.comment_required_below_score) || 3,
    });

    if (res.success) {
      setShowCriterionModal(false);
      const refreshRes = await api.getAssessmentTemplateById(editingTemplate.id);
      if (refreshRes.success) setEditingTemplate(refreshRes.data);
    } else {
      alert('Error saving criterion: ' + res.error);
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    if (!confirm('Remove criterion?')) return;
    await api.deleteAssessmentCriterion(criterionId);
    const refreshRes = await api.getAssessmentTemplateById(editingTemplate.id);
    if (refreshRes.success) setEditingTemplate(refreshRes.data);
  };

  // Question Modal Save
  const handleSaveQuestionModal = async () => {
    if (!editingQuestion.question_text.trim()) return alert('Please enter question text.');
    const res = await api.saveAssessmentQuestion({
      ...editingQuestion,
      section_id: targetSectionIdForQuestion,
      template_id: editingTemplate.id,
      max_score: parseFloat(editingQuestion.max_score) || 5,
    });

    if (res.success) {
      setShowQuestionModal(false);
      const refreshRes = await api.getAssessmentTemplateById(editingTemplate.id);
      if (refreshRes.success) setEditingTemplate(refreshRes.data);
    } else {
      alert('Error saving question: ' + res.error);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Remove question?')) return;
    await api.deleteAssessmentQuestion(questionId);
    const refreshRes = await api.getAssessmentTemplateById(editingTemplate.id);
    if (refreshRes.success) setEditingTemplate(refreshRes.data);
  };

  const filteredAssessments = assessments.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = `${a.employees?.first_name || ''} ${a.employees?.last_name || ''}`.toLowerCase();
    const pos = (a.position || '').toLowerCase();
    const br = (a.branch || '').toLowerCase();
    const ev = (a.evaluator_name || '').toLowerCase();
    return name.includes(q) || pos.includes(q) || br.includes(q) || ev.includes(q);
  });

  const inProgressAssessments = filteredAssessments.filter(
    (a) => a.status === 'In Progress' || a.status === 'Draft' || a.status === 'Assigned'
  );

  const reassessmentsDue = filteredAssessments.filter(
    (a) => a.status === 'Probation Extended'
  );

  const templateWeightValidation = editingTemplate?.sections ? validateSectionWeights(editingTemplate.sections) : { isValid: true, totalPracticalWeight: 100 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', boxSizing: 'border-box' }}>
      {/* Top Main Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={28} style={{ color: 'var(--primary)' }} /> Employee Assessments
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0 0' }}>
            On-shift practical observations, scenario roleplay, dynamic scoring, and probation decisions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => loadData()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          {isManager && (
            <button
              onClick={() => handleOpenNewModal()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <Plus size={16} /> New Assessment
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '20px', gap: '8px' }}>
        {[
          { id: 'dashboard', label: '📊 Dashboard & Overview' },
          { id: 'in_progress', label: `⏳ In Progress (${metrics?.inProgress ?? 0})` },
          { id: 'reassessments', label: `🔁 Reassessments Due (${metrics?.reassessmentsDue ?? 0})` },
          { id: 'templates', label: '📋 Assessment Templates Matrix' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? 800 : 600,
              color: activeTab === tab.id ? 'var(--primary)' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: DASHBOARD & OVERVIEW */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', borderLeft: '4px solid #3b82f6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b' }}>{metrics?.inProgress ?? 0}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>In Progress Drafts</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', borderLeft: '4px solid #22c55e', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#15803d' }}>{metrics?.confirmed ?? 0}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>Confirmed Employments</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', borderLeft: '4px solid #f97316', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#c2410c' }}>{metrics?.reassessmentsDue ?? 0}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>Reassessments Scheduled</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', borderLeft: '4px solid #ef4444', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#b91c1c' }}>{metrics?.dismissalCount ?? 0}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>Dismissals Recommended</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', borderLeft: '4px solid var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>{metrics?.averageScore ?? 0}%</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>Overall Average Score</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search by employee, position, branch, evaluator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: '#ffffff' }}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id || b.name} value={b.name}>{b.name}</option>
              ))}
            </select>

            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: '#ffffff' }}
            >
              <option value="">All Positions</option>
              <option value="Waiter">Waiter</option>
              <option value="Barista">Barista</option>
              <option value="Cashier">Cashier</option>
              <option value="Chef">Chef</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Manager">Manager</option>
              <option value="Host">Host</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: '#ffffff' }}
            >
              <option value="">All Statuses</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Probation Extended">Probation Extended</option>
              <option value="Dismissed">Dismissed</option>
            </select>

            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
              {[
                { id: 'all', label: 'All' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'month', label: 'This Month' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDateFilter(d.id as any)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: dateFilter === d.id ? '#ffffff' : 'transparent',
                    color: dateFilter === d.id ? '#0f172a' : '#64748b',
                    fontWeight: dateFilter === d.id ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Average Scores by Position */}
          {metrics?.avgByPosition && metrics.avgByPosition.length > 0 && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                📈 Position Performance Averages
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {metrics.avgByPosition.map((item: any) => {
                  const rating = getScoreRatingInfo(item.average / 20);
                  return (
                    <div key={item.position} style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{item.position}</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: rating.color }}>{item.average}% ({item.count} evaluated)</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, item.average)}%`, height: '100%', backgroundColor: rating.color, borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assessments Data Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Employee</th>
                  <th style={{ padding: '12px 16px' }}>Position & Branch</th>
                  <th style={{ padding: '12px 16px' }}>Assessment Date</th>
                  <th style={{ padding: '12px 16px' }}>Evaluator</th>
                  <th style={{ padding: '12px 16px' }}>Score</th>
                  <th style={{ padding: '12px 16px' }}>Status / Decision</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                      Loading assessments...
                    </td>
                  </tr>
                ) : filteredAssessments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                      No assessments found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredAssessments.map((a) => {
                    const empName = `${a.employees?.first_name || ''} ${a.employees?.last_name || ''}`.trim() || 'Employee';
                    const score = Number(a.final_score ?? a.provisional_score ?? 0);
                    const rating = getScoreRatingInfo(score / 20);

                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{empName}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{a.reason}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ color: '#1e293b', fontWeight: 600 }}>{a.position}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{a.branch}</div>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>
                          {a.assessment_date}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>
                          {a.evaluator_name}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontWeight: 800,
                              fontSize: '12px',
                              backgroundColor: rating.bgColor,
                              color: rating.color,
                            }}
                          >
                            {score > 0 ? `${score}%` : 'Draft'}
                          </span>
                          {a.has_critical_failure && (
                            <span style={{ color: '#dc2626', fontSize: '10px', fontWeight: 800, marginLeft: '6px' }}>
                              ⚠️ Critical
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '11px',
                              backgroundColor:
                                a.status === 'Completed'
                                  ? '#dcfce7'
                                  : a.status === 'Probation Extended'
                                  ? '#ffedd5'
                                  : a.status === 'In Progress'
                                  ? '#fef3c7'
                                  : a.status === 'Dismissed'
                                  ? '#fee2e2'
                                  : '#f1f5f9',
                              color:
                                a.status === 'Completed'
                                  ? '#15803d'
                                  : a.status === 'Probation Extended'
                                  ? '#c2410c'
                                  : a.status === 'In Progress'
                                  ? '#b45309'
                                  : a.status === 'Dismissed'
                                  ? '#b91c1c'
                                  : '#475569',
                            }}
                          >
                            {a.manager_decision || a.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            {a.status === 'In Progress' || a.status === 'Draft' ? (
                              <button
                                onClick={() => navigate(`/assessments/conduct/${a.id}`)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  backgroundColor: 'var(--primary)',
                                  color: '#ffffff',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                🎯 Conduct
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedAssessmentIdForDetail(a.id)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #d1d5db',
                                  backgroundColor: '#ffffff',
                                  color: '#374151',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                👁️ View & Decision
                              </button>
                            )}

                            <button
                              onClick={() => {
                                printAssessmentReportWeb({
                                  assessment: a,
                                  employee: a.employees,
                                  sections: a.template_snapshot?.sections || [],
                                  scores: a.scores || [],
                                  answers: a.answers || [],
                                  objectives: a.objectives || [],
                                  restaurantName: user?.restaurants?.name,
                                  restaurantLogo: user?.restaurants?.logo_url,
                                });
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                backgroundColor: '#f8fafc',
                                color: '#475569',
                                cursor: 'pointer',
                              }}
                              title="Print Report"
                            >
                              <Printer size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: IN PROGRESS SHIFT EVALUATIONS */}
      {activeTab === 'in_progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#fef3c7', borderLeft: '4px solid #f59e0b', borderRadius: '10px', padding: '14px', color: '#92400e', fontSize: '13px' }}>
            <strong>Shift Observations in Progress:</strong> These evaluations have been started but not yet submitted for final management sign-off.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {inProgressAssessments.map((a) => {
              const empName = `${a.employees?.first_name || ''} ${a.employees?.last_name || ''}`.trim() || 'Employee';
              const score = Number(a.provisional_score ?? 0);
              const rating = getScoreRatingInfo(score / 20);

              return (
                <div key={a.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{empName}</h3>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{a.position} &bull; {a.branch}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '12px', backgroundColor: rating.bgColor, color: rating.color }}>
                      {score}% Provisional
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', margin: '8px 0 14px 0' }}>
                    Started by: <strong>{a.evaluator_name}</strong> on {a.assessment_date} (Day {a.days_worked ?? 10})
                  </div>

                  <button
                    onClick={() => navigate(`/assessments/conduct/${a.id}`)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Play size={14} /> Resume Shift Assessment
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EXTENDED PROBATION REASSESSMENTS */}
      {activeTab === 'reassessments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#fff7ed', borderLeft: '4px solid #ea580c', borderRadius: '10px', padding: '14px', color: '#c2410c', fontSize: '13px' }}>
            <strong>Extended Probation Tracking:</strong> Employees scheduled for improvement follow-ups. Click "Conduct Reassessment" to evaluate progress against target objectives.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {reassessmentsDue.map((a) => {
              const empName = `${a.employees?.first_name || ''} ${a.employees?.last_name || ''}`.trim() || 'Employee';
              return (
                <div key={a.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{empName}</h3>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{a.position} &bull; {a.branch}</div>
                    </div>
                    <span style={{ backgroundColor: '#ffedd5', color: '#c2410c', padding: '4px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '11px' }}>
                      Prev: {a.final_score}%
                    </span>
                  </div>

                  {a.weaknesses && (
                    <div style={{ backgroundColor: '#fef2f2', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '11px', color: '#991b1b', marginBottom: '12px' }}>
                      <strong>Weaknesses:</strong> {a.weaknesses}
                    </div>
                  )}

                  <button
                    onClick={() => handleOpenNewModal(a.employees, a)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    🎯 Launch Follow-up Reassessment
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: TEMPLATES & SECTION BUILDER */}
      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setTemplateTab('active')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: templateTab === 'active' ? 'var(--primary)' : '#f1f5f9',
                  color: templateTab === 'active' ? '#ffffff' : '#64748b',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Active Templates
              </button>
              <button
                onClick={() => setTemplateTab('archived')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: templateTab === 'archived' ? 'var(--primary)' : '#f1f5f9',
                  color: templateTab === 'archived' ? '#ffffff' : '#64748b',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Archived Templates
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenTemplateEditor()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} /> Create Assessment Template
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {templates.map((tmpl) => (
              <div key={tmpl.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{tmpl.name}</h3>
                    <span style={{ display: 'inline-block', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>
                      👤 {tmpl.position} &bull; v{tmpl.version || 1}
                    </span>
                  </div>
                </div>

                {tmpl.description && (
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 12px 0', lineHeight: 1.4 }}>
                    {tmpl.description}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#475569', marginBottom: '14px' }}>
                  <div>
                    <div style={{ color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Timing</div>
                    <div style={{ fontWeight: 800, color: '#1e293b' }}>Day {tmpl.recommended_days_timing || 10}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Weights</div>
                    <div style={{ fontWeight: 800, color: '#1e293b' }}>{tmpl.practical_weight ?? 70}% / {tmpl.questions_weight ?? 30}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Pass Score</div>
                    <div style={{ fontWeight: 800, color: '#1e293b' }}>{tmpl.passing_score ?? 80}%</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <button
                    onClick={() => handleOpenTemplateEditor(tmpl.id)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ Edit Builder
                  </button>
                  <button
                    onClick={() => handleDuplicateTemplate(tmpl.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                    title="Duplicate Template"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleArchiveTemplate(tmpl)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                    title={tmpl.is_archived ? 'Restore' : 'Archive'}
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tmpl)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fca5a5',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      cursor: 'pointer',
                    }}
                    title="Delete Template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW ASSESSMENT MODAL */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '550px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
                {isReassessmentFlag ? '🔁 Launch Follow-up Reassessment' : '🎯 Start New Shift Assessment'}
              </h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Select Employee *
                </label>
                <select
                  value={newEmployeeId}
                  onChange={(e) => {
                    setNewEmployeeId(e.target.value);
                    const match = employees.find((emp) => emp.employee_id === e.target.value);
                    if (match) {
                      setNewPosition(match.position || 'Waiter');
                      setNewBranch(match.branch || 'Main');
                      if (match.date_started) setNewStartDate(match.date_started);
                    }
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((e) => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.first_name} {e.last_name} ({e.position || 'Staff'}) - {e.branch || 'Main'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Select Assessment Template *
                </label>
                <select
                  value={newTemplateId}
                  onChange={(e) => setNewTemplateId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}
                >
                  <option value="">-- Choose Template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.position})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Position
                  </label>
                  <input
                    type="text"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Branch
                  </label>
                  <input
                    type="text"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Assessment Date
                  </label>
                  <input
                    type="date"
                    value={newAssessmentDate}
                    onChange={(e) => setNewAssessmentDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Days Worked
                  </label>
                  <input
                    type="number"
                    value={newDaysWorked}
                    onChange={(e) => setNewDaysWorked(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Primary Evaluator *
                  </label>
                  <input
                    type="text"
                    value={newEvaluatorName}
                    onChange={(e) => setNewEvaluatorName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    2nd Evaluator (Optional)
                  </label>
                  <input
                    type="text"
                    value={newSecondEvaluatorName}
                    onChange={(e) => setNewSecondEvaluatorName(e.target.value)}
                    placeholder="Supervisor name"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setShowNewModal(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAssessment}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
              >
                Launch Assessment ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE EDITOR & SECTION BUILDER MODAL */}
      {showTemplateEditorModal && editingTemplate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Editor Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
                {editingTemplate.id ? `Edit Template: ${editingTemplate.name}` : 'Create Assessment Template'}
              </h2>
              <button onClick={() => setShowTemplateEditorModal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Editor Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 24px', backgroundColor: '#ffffff' }}>
              <button
                onClick={() => setTemplateBuilderTab('general')}
                style={{
                  padding: '12px 18px',
                  fontSize: '13px',
                  fontWeight: templateBuilderTab === 'general' ? 700 : 500,
                  color: templateBuilderTab === 'general' ? 'var(--primary)' : '#64748b',
                  border: 'none',
                  background: 'none',
                  borderBottom: templateBuilderTab === 'general' ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                ⚙️ General & Thresholds
              </button>
              <button
                onClick={() => setTemplateBuilderTab('sections')}
                style={{
                  padding: '12px 18px',
                  fontSize: '13px',
                  fontWeight: templateBuilderTab === 'sections' ? 700 : 500,
                  color: templateBuilderTab === 'sections' ? 'var(--primary)' : '#64748b',
                  border: 'none',
                  background: 'none',
                  borderBottom: templateBuilderTab === 'sections' ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                📑 Sections & Criteria ({(editingTemplate.sections || []).length})
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {templateBuilderTab === 'general' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                        Template Name *
                      </label>
                      <input
                        type="text"
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                        placeholder="e.g. Waiter – 10-Day Assessment"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                        Target Position *
                      </label>
                      <input
                        type="text"
                        value={editingTemplate.position}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, position: e.target.value })}
                        placeholder="e.g. Waiter, Barista"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                      Description & Guidelines
                    </label>
                    <textarea
                      rows={2}
                      value={editingTemplate.description || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                      placeholder="Timing and instructions for evaluators..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>Category Weights (%)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Practical Shift Test</label>
                          <input
                            type="number"
                            value={editingTemplate.practical_weight ?? 70}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, practical_weight: e.target.value })}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Scenario Questions</label>
                          <input
                            type="number"
                            value={editingTemplate.questions_weight ?? 30}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, questions_weight: e.target.value })}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>Score Recommendation Thresholds</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>Confirm (&ge; %)</label>
                          <input
                            type="number"
                            value={editingTemplate.confirmation_threshold ?? 80}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, confirmation_threshold: e.target.value })}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#c2410c', marginBottom: '4px' }}>Extend Min (%)</label>
                          <input
                            type="number"
                            value={editingTemplate.probation_extension_min ?? 65}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, probation_extension_min: e.target.value })}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>Dismiss (&lt; %)</label>
                          <input
                            type="number"
                            value={editingTemplate.dismissal_threshold ?? 65}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, dismissal_threshold: e.target.value })}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* SECTIONS & CRITERIA BUILDER */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Weight Warning Banner */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: templateWeightValidation.isValid ? '#86efac' : '#fde047',
                      backgroundColor: templateWeightValidation.isValid ? '#f0fdf4' : '#fffbeb',
                      color: templateWeightValidation.isValid ? '#15803d' : '#a16207',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      {templateWeightValidation.isValid ? '✅' : '⚠️'} Practical Sections Total Weight: {templateWeightValidation.totalPracticalWeight}% (Must equal 100%)
                    </span>
                    <button
                      onClick={() => {
                        setEditingSection({
                          title: '',
                          description: '',
                          section_type: 'practical_observation',
                          category_group: 'practical',
                          weight: 15,
                          display_order: (editingTemplate.sections || []).length + 1,
                        });
                        setShowSectionModal(true);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      + Add Section
                    </button>
                  </div>

                  {/* List of Sections */}
                  {(editingTemplate.sections || []).map((sec: any, secIdx: number) => {
                    const isQuestionsSec = sec.category_group === 'questions' || sec.section_type?.includes('question') || sec.section_type?.includes('scenario');
                    const criteriaList = sec.criteria || [];
                    const questionsList = sec.questions || [];

                    return (
                      <div key={sec.id} style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 800, fontSize: '11px', width: '22px', height: '22px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {secIdx + 1}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{sec.title}</span>
                            <span style={{ backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                              {sec.weight}% {isQuestionsSec ? 'Questions' : 'Practical'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handleMoveSection(secIdx, 'up')} disabled={secIdx === 0} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', opacity: secIdx === 0 ? 0.3 : 1 }}>
                              <ArrowUp size={14} />
                            </button>
                            <button onClick={() => handleMoveSection(secIdx, 'down')} disabled={secIdx === (editingTemplate.sections || []).length - 1} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', opacity: secIdx === (editingTemplate.sections || []).length - 1 ? 0.3 : 1 }}>
                              <ArrowDown size={14} />
                            </button>
                            <button onClick={() => { setEditingSection(sec); setShowSectionModal(true); }} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}>
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDeleteSection(sec.id)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Items under this section */}
                        {!isQuestionsSec ? (
                          <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Criteria ({criteriaList.length})
                              </span>
                              <button
                                onClick={() => {
                                  setTargetSectionIdForCriterion(sec.id);
                                  setEditingCriterion({
                                    name: '',
                                    instructions: '',
                                    expected_standard: '',
                                    max_score: 5,
                                    is_critical: false,
                                    allow_not_observed: true,
                                    comment_required_below_score: 3,
                                  });
                                  setShowCriterionModal(true);
                                }}
                                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                + Add Criterion
                              </button>
                            </div>

                            {criteriaList.map((crit: any, cIdx: number) => (
                              <div key={crit.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: '12px', color: '#1e293b' }}>
                                  <strong>{cIdx + 1}. {crit.name}</strong>
                                  {crit.is_critical && <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '10px', marginLeft: '6px' }}>[CRITICAL]</span>}
                                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>Std: {crit.expected_standard || 'Standard'}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button onClick={() => { setTargetSectionIdForCriterion(sec.id); setEditingCriterion(crit); setShowCriterionModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <Edit size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteCriterion(crit.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Scenario Questions ({questionsList.length})
                              </span>
                              <button
                                onClick={() => {
                                  setTargetSectionIdForQuestion(sec.id);
                                  setEditingQuestion({
                                    question_text: '',
                                    expected_answer: '',
                                    max_score: 5,
                                    question_type: 'scenario_roleplay',
                                    is_critical: false,
                                    mandatory_comment: false,
                                  });
                                  setShowQuestionModal(true);
                                }}
                                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                + Add Question
                              </button>
                            </div>

                            {questionsList.map((q: any, qIdx: number) => (
                              <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: '12px', color: '#1e293b' }}>
                                  <strong>Q{qIdx + 1}. {q.question_text}</strong>
                                  {q.is_critical && <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '10px', marginLeft: '6px' }}>[CRITICAL]</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button onClick={() => { setTargetSectionIdForQuestion(sec.id); setEditingQuestion(q); setShowQuestionModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <Edit size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Editor Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowTemplateEditorModal(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION MODAL */}
      {showSectionModal && editingSection && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '450px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: '0 0 12px 0' }}>
              {editingSection.id ? 'Edit Section' : 'Add Section'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Section Title *</label>
                <input
                  type="text"
                  value={editingSection.title}
                  onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                  placeholder="e.g. Guest Service"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Type</label>
                <select
                  value={editingSection.section_type || 'practical_observation'}
                  onChange={(e) => setEditingSection({ ...editingSection, section_type: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
                >
                  <option value="practical_observation">Practical Observation (Shift)</option>
                  <option value="scenario_roleplay">Scenario & Roleplay Questions</option>
                  <option value="verbal_questions">Verbal Questions</option>
                  <option value="written_questions">Written Questions</option>
                  <option value="controlled_test">Controlled Test</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Weight (%) *</label>
                <input
                  type="number"
                  value={editingSection.weight ?? 15}
                  onChange={(e) => setEditingSection({ ...editingSection, weight: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Description / Guidelines</label>
                <textarea
                  rows={2}
                  value={editingSection.description || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowSectionModal(false)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveSectionModal} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
                Save Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRITERION MODAL */}
      {showCriterionModal && editingCriterion && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '450px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: '0 0 12px 0' }}>
              {editingCriterion.id ? 'Edit Criterion' : 'Add Evaluation Criterion'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Criterion Name *</label>
                <input
                  type="text"
                  value={editingCriterion.name}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, name: e.target.value })}
                  placeholder="e.g. Greets guest within 60 seconds"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Expected Standard</label>
                <input
                  type="text"
                  value={editingCriterion.expected_standard || ''}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, expected_standard: e.target.value })}
                  placeholder="e.g. 100% adherence to greeting protocol"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Instructions for Evaluator</label>
                <textarea
                  rows={2}
                  value={editingCriterion.instructions || ''}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, instructions: e.target.value })}
                  placeholder="What to check for during observation..."
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!editingCriterion.is_critical}
                    onChange={(e) => setEditingCriterion({ ...editingCriterion, is_critical: e.target.checked })}
                  />
                  Critical Standard (Failure triggers review)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowCriterionModal(false)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveCriterionModal} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
                Save Criterion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION MODAL */}
      {showQuestionModal && editingQuestion && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '450px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: '0 0 12px 0' }}>
              {editingQuestion.id ? 'Edit Question' : 'Add Scenario Question'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Scenario / Question Prompt *</label>
                <textarea
                  rows={2}
                  value={editingQuestion.question_text}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                  placeholder="e.g. A guest tells you they have a severe peanut allergy. What steps do you take?"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Expected Model Answer (Evaluator Guidance)</label>
                <textarea
                  rows={3}
                  value={editingQuestion.expected_answer || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, expected_answer: e.target.value })}
                  placeholder="Key points candidate must mention..."
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!editingQuestion.is_critical}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, is_critical: e.target.checked })}
                  />
                  Critical Question
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowQuestionModal(false)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveQuestionModal} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
                Save Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL & DECISION MODAL */}
      {selectedAssessmentIdForDetail && (
        <AssessmentDetailWebModal
          assessmentId={selectedAssessmentIdForDetail}
          isOpen={!!selectedAssessmentIdForDetail}
          onClose={() => setSelectedAssessmentIdForDetail(null)}
          onAssessmentUpdated={() => loadData()}
          user={user}
          onStartReassessment={(prevAss) => {
            setSelectedAssessmentIdForDetail(null);
            handleOpenNewModal(prevAss.employees, prevAss);
          }}
        />
      )}
    </div>
  );
}
