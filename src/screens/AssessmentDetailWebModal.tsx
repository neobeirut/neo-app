import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { printAssessmentReportWeb } from '../utils/printAssessmentWeb';
import { getScoreRatingInfo } from '../utils/assessmentScoring';
import {
  X,
  Printer,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  Building,
  Calendar,
  FileText,
  Lock,
  Plus,
  Trash2,
  Send,
  RotateCcw,
} from 'lucide-react';

interface AssessmentDetailWebModalProps {
  assessmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onAssessmentUpdated?: () => void;
  user: any;
  onStartReassessment?: (assessment: any) => void;
}

export default function AssessmentDetailWebModal({
  assessmentId,
  isOpen,
  onClose,
  onAssessmentUpdated,
  user,
  onStartReassessment,
}: AssessmentDetailWebModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assessment, setAssessment] = useState<any>(null);

  // Decision & Review fields
  const [managerDecision, setManagerDecision] = useState<'Confirm Employment' | 'Extend Probation' | 'Dismiss'>('Confirm Employment');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionOverrideExplanation, setDecisionOverrideExplanation] = useState('');
  const [generalComments, setGeneralComments] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');

  // Extended Probation Objectives
  const [newProbationEndDate, setNewProbationEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [reassessmentDate, setReassessmentDate] = useState(
    new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [objectives, setObjectives] = useState<
    Array<{
      objective_number: number;
      objective_text: string;
      expected_standard: string;
      responsible_manager?: string;
      training_required?: string;
      target_completion_date?: string;
    }>
  >([
    {
      objective_number: 1,
      objective_text: '',
      expected_standard: '',
      responsible_manager: user?.name || 'Manager',
      training_required: '',
    },
  ]);

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Active sub-tab in modal
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'practical' | 'questions' | 'objectives'>('summary');

  const roleLower = (user?.role || '').toString().toLowerCase().trim();
  const isAdmin = roleLower === 'admin' || roleLower === 'superadmin' || roleLower.includes('admin') || roleLower === 'owner';
  const isManager = isAdmin || roleLower === 'manager';

  useEffect(() => {
    if (isOpen && assessmentId) {
      loadAssessment();
    }
  }, [isOpen, assessmentId]);

  const loadAssessment = async () => {
    setLoading(true);
    const res = await api.getEmployeeAssessmentById(assessmentId);
    if (res.success && res.data) {
      const a = res.data;
      setAssessment(a);

      const sysRec = a.system_recommendation || 'Confirm Employment';
      setManagerDecision(a.manager_decision || sysRec);
      setDecisionReason(a.decision_reason || '');
      setDecisionOverrideExplanation(a.decision_override_explanation || '');
      setGeneralComments(a.general_comments || '');
      setStrengths(a.strengths || '');
      setWeaknesses(a.weaknesses || '');

      if (a.objectives && a.objectives.length > 0) {
        setObjectives(a.objectives);
      }
    }
    setLoading(false);
  };

  const handleAddObjective = () => {
    if (objectives.length >= 5) {
      alert('You can add up to 5 improvement objectives.');
      return;
    }
    setObjectives((prev) => [
      ...prev,
      {
        objective_number: prev.length + 1,
        objective_text: '',
        expected_standard: '',
        responsible_manager: user?.name || 'Manager',
        training_required: '',
        target_completion_date: reassessmentDate,
      },
    ]);
  };

  const handleRemoveObjective = (index: number) => {
    setObjectives((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinalSubmit = async () => {
    const sysRec = assessment?.system_recommendation || 'Confirm Employment';
    const isOverriding = managerDecision !== sysRec;

    if (isOverriding && !decisionOverrideExplanation.trim()) {
      alert(
        `The chosen decision (${managerDecision}) differs from the system recommendation (${sysRec}). Please provide a written explanation for the override.`
      );
      return;
    }

    if (managerDecision === 'Extend Probation') {
      const validObjs = objectives.filter((o) => o.objective_text.trim());
      if (validObjs.length === 0) {
        alert('Please specify at least 1 improvement objective for extended probation.');
        return;
      }
    }

    if (!confirm(`Are you sure you want to record the final decision as "${managerDecision}"?`)) {
      return;
    }

    setSubmitting(true);
    const res = await api.submitFinalAssessment({
      assessmentId,
      managerDecision,
      decisionReason,
      decisionOverrideExplanation,
      generalComments,
      strengths,
      weaknesses,
      finalScore: Number(assessment?.final_score || assessment?.provisional_score || 0),
      practicalScore: Number(assessment?.practical_score || 0),
      questionsScore: Number(assessment?.questions_score || 0),
      hasCriticalFailure: !!assessment?.has_critical_failure,
      criticalFailureDetails: assessment?.critical_failure_details || [],
      systemRecommendation: assessment?.system_recommendation,
      userName: user?.name || 'Manager',
      userId: user?.id,
      objectives: managerDecision === 'Extend Probation' ? objectives : [],
    });
    setSubmitting(false);

    if (res.success) {
      alert('Final management decision recorded successfully.');
      loadAssessment();
      if (onAssessmentUpdated) onAssessmentUpdated();
    } else {
      alert('Error submitting decision: ' + (res.error || 'Unknown error'));
    }
  };

  const handlePrint = () => {
    if (!assessment) return;
    printAssessmentReportWeb({
      assessment,
      employee: assessment.employees,
      sections: assessment.template_snapshot?.sections || [],
      scores: assessment.scores || [],
      answers: assessment.answers || [],
      objectives: assessment.objectives || [],
      restaurantName: user?.restaurants?.name || 'FLOW Restaurant Management',
      restaurantLogo: user?.restaurants?.logo_url,
    });
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      alert('Please provide a justification reason for reopening.');
      return;
    }
    setSubmitting(true);
    const res = await api.reopenAssessment({
      assessmentId,
      reason: reopenReason.trim(),
      userName: user?.name || 'Admin',
      userId: user?.id,
    });
    setSubmitting(false);

    if (res.success) {
      setShowReopenModal(false);
      alert('Assessment reopened successfully. The evaluator may now adjust scores.');
      loadAssessment();
      if (onAssessmentUpdated) onAssessmentUpdated();
    } else {
      alert('Error reopening: ' + res.error);
    }
  };

  if (!isOpen) return null;

  const isCompleted = assessment?.status === 'Completed' || assessment?.status === 'Probation Extended' || assessment?.status === 'Dismissed';
  const finalScore = Number(assessment?.final_score ?? assessment?.provisional_score ?? 0);
  const practicalScore = Number(assessment?.practical_score ?? 0);
  const questionsScore = Number(assessment?.questions_score ?? 0);
  const scoreRating = getScoreRatingInfo(finalScore / 20);
  const empName = `${assessment?.employees?.first_name || ''} ${assessment?.employees?.last_name || ''}`.trim() || 'Employee';
  const sysRec = assessment?.system_recommendation || 'Confirm Employment';
  const template = assessment?.template_snapshot || {};
  const sectionsList = template?.sections || [];

  const scoresMap: Record<string, any> = {};
  (assessment?.scores || []).forEach((s: any) => {
    scoresMap[s.criterion_id] = s;
  });

  const answersMap: Record<string, any> = {};
  (assessment?.answers || []).forEach((a: any) => {
    answersMap[a.question_id] = a;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
              Employee Assessment Report
            </h2>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>
              {empName} &bull; {assessment?.position} &bull; {assessment?.branch}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Printer size={15} /> Print / Export PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
            Loading assessment details...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Score Hero Banner */}
            <div
              style={{
                padding: '18px 24px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    backgroundColor: scoreRating.bgColor,
                    color: scoreRating.color,
                    padding: '10px 18px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: `1px solid ${scoreRating.color}33`,
                  }}
                >
                  <div style={{ fontSize: '26px', fontWeight: 900 }}>{finalScore}%</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    {scoreRating.label}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{empName}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {assessment?.position} &bull; {assessment?.branch} &bull; {assessment?.assessment_date}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                    Evaluator: {assessment?.evaluator_name} {assessment?.second_evaluator_name ? `& ${assessment.second_evaluator_name}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e5c4f' }}>{practicalScore}%</div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Practical ({template?.practical_weight ?? 70}%)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e5c4f' }}>{questionsScore}%</div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Questions ({template?.questions_weight ?? 30}%)
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      backgroundColor:
                        assessment?.manager_decision === 'Confirm Employment'
                          ? '#dcfce7'
                          : assessment?.manager_decision === 'Extend Probation'
                          ? '#ffedd5'
                          : assessment?.manager_decision === 'Dismiss'
                          ? '#fee2e2'
                          : '#f1f5f9',
                      color:
                        assessment?.manager_decision === 'Confirm Employment'
                          ? '#15803d'
                          : assessment?.manager_decision === 'Extend Probation'
                          ? '#c2410c'
                          : assessment?.manager_decision === 'Dismiss'
                          ? '#b91c1c'
                          : '#475569',
                      fontWeight: 800,
                      fontSize: '12px',
                    }}
                  >
                    {assessment?.manager_decision || assessment?.status}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>
                    Decision
                  </div>
                </div>
              </div>
            </div>

            {/* Critical Failure Alert */}
            {assessment?.has_critical_failure && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  borderBottom: '1px solid #fecaca',
                  padding: '10px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#991b1b',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <AlertTriangle size={16} />
                <span>
                  <strong>CRITICAL FAILURE RECORDED:</strong> One or more mandatory standard violations occurred during evaluation. Management review is required.
                </span>
              </div>
            )}

            {/* Sub-Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #e5e7eb',
                padding: '0 24px',
                backgroundColor: '#ffffff',
              }}
            >
              {[
                { id: 'summary', label: 'Decision & Review' },
                { id: 'practical', label: `1. Practical Observations (${sectionsList.filter((s: any) => s.category_group === 'practical' || s.section_type?.includes('practical')).length} Sections)` },
                { id: 'questions', label: `2. Scenario Questions (${sectionsList.filter((s: any) => s.category_group === 'questions' || s.section_type?.includes('question')).length} Sections)` },
                { id: 'objectives', label: `Improvement Objectives (${objectives.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  style={{
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: activeSubTab === tab.id ? 700 : 500,
                    color: activeSubTab === tab.id ? '#1e5c4f' : '#64748b',
                    border: 'none',
                    background: 'none',
                    borderBottom: activeSubTab === tab.id ? '2px solid #1e5c4f' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {activeSubTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* System Recommendation vs Manager Decision */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '18px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                      Management Decision & Recommendation
                    </h3>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        marginBottom: '16px',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        System Calculated Recommendation:
                      </span>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '12px',
                          backgroundColor:
                            sysRec === 'Confirm Employment'
                              ? '#dcfce7'
                              : sysRec === 'Extend Probation'
                              ? '#ffedd5'
                              : '#fee2e2',
                          color:
                            sysRec === 'Confirm Employment'
                              ? '#15803d'
                              : sysRec === 'Extend Probation'
                              ? '#c2410c'
                              : '#b91c1c',
                        }}
                      >
                        {sysRec}
                      </span>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                        Manager Final Decision *
                      </label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {(['Confirm Employment', 'Extend Probation', 'Dismiss'] as const).map((dec) => {
                          const isSel = managerDecision === dec;
                          return (
                            <button
                              key={dec}
                              type="button"
                              onClick={() => setManagerDecision(dec)}
                              disabled={isCompleted && !isManager}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: isSel
                                  ? dec === 'Confirm Employment'
                                    ? '#15803d'
                                    : dec === 'Extend Probation'
                                    ? '#ea580c'
                                    : '#dc2626'
                                  : '#cbd5e1',
                                backgroundColor: isSel
                                  ? dec === 'Confirm Employment'
                                    ? '#15803d'
                                    : dec === 'Extend Probation'
                                    ? '#ea580c'
                                    : '#dc2626'
                                  : '#f8fafc',
                                color: isSel ? '#ffffff' : '#334155',
                                fontWeight: isSel ? 800 : 600,
                                fontSize: '13px',
                                cursor: 'pointer',
                              }}
                            >
                              {dec}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {managerDecision !== sysRec && (
                      <div
                        style={{
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde047',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '14px',
                        }}
                      >
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a16207', marginBottom: '4px' }}>
                          ⚠️ Mandatory Explanation for Decision Override
                        </label>
                        <textarea
                          rows={2}
                          value={decisionOverrideExplanation}
                          onChange={(e) => setDecisionOverrideExplanation(e.target.value)}
                          placeholder="Provide the rationale explaining why manager decision differs from system score..."
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '12px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                        General Assessment Notes / Evaluator Feedback
                      </label>
                      <textarea
                        rows={2}
                        value={generalComments}
                        onChange={(e) => setGeneralComments(e.target.value)}
                        placeholder="Overall feedback, attitude and shift context..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Strengths and Weaknesses */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div
                      style={{
                        border: '1px solid #bbf7d0',
                        borderRadius: '12px',
                        padding: '16px',
                        backgroundColor: '#f0fdf4',
                      }}
                    >
                      <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#15803d', margin: '0 0 8px 0' }}>
                        🌟 Key Strengths
                      </h4>
                      <textarea
                        rows={3}
                        value={strengths}
                        onChange={(e) => setStrengths(e.target.value)}
                        placeholder="What did the employee excel at? (e.g. Speed, greeting warmth, upselling dessert)..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #86efac',
                          fontSize: '12px',
                          backgroundColor: '#ffffff',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        border: '1px solid #fecaca',
                        borderRadius: '12px',
                        padding: '16px',
                        backgroundColor: '#fef2f2',
                      }}
                    >
                      <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#b91c1c', margin: '0 0 8px 0' }}>
                        🎯 Areas for Improvement
                      </h4>
                      <textarea
                        rows={3}
                        value={weaknesses}
                        onChange={(e) => setWeaknesses(e.target.value)}
                        placeholder="What needs coaching, speed or menu knowledge improvement?..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #fca5a5',
                          fontSize: '12px',
                          backgroundColor: '#ffffff',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Employee Acknowledgement Box */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                      Employee Acknowledgement
                    </h4>
                    {assessment?.employee_acknowledged_at ? (
                      <div style={{ backgroundColor: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                          ✅ Confirmed on {assessment.employee_acknowledged_at.split('T')[0]}
                        </div>
                        <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px', fontStyle: 'italic' }}>
                          "{assessment.employee_acknowledgement || 'Acknowledged receipt of report.'}"
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Pending employee digital acknowledgement.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSubTab === 'practical' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {sectionsList
                    .filter((s: any) => s.category_group === 'practical' || s.section_type?.includes('practical') || s.section_type?.includes('observation'))
                    .map((sec: any, sIdx: number) => {
                      const criteriaList = sec.criteria || sec.assessment_template_criteria || [];
                      return (
                        <div
                          key={sec.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <div
                            style={{
                              backgroundColor: '#f8fafc',
                              padding: '10px 16px',
                              borderBottom: '1px solid #e2e8f0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                              {sIdx + 1}. {sec.title}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                              Weight: {sec.weight}%
                            </span>
                          </div>

                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                                <th style={{ padding: '8px 12px', width: '35%' }}>Criterion</th>
                                <th style={{ padding: '8px 12px', width: '30%' }}>Expected Standard</th>
                                <th style={{ padding: '8px 12px', width: '12%' }}>Score</th>
                                <th style={{ padding: '8px 12px', width: '23%' }}>Evaluator Comment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {criteriaList.map((crit: any) => {
                                const sc = scoresMap[crit.id] || {};
                                const isNO = !!sc.is_not_observed;
                                const rating = isNO ? { label: 'Not Observed', color: '#6c757d', bgColor: '#e9ecef' } : getScoreRatingInfo(sc.score);

                                return (
                                  <tr key={crit.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 12px' }}>
                                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{crit.name}</div>
                                      {crit.is_critical && (
                                        <span style={{ color: '#dc2626', fontSize: '10px', fontWeight: 800 }}>[CRITICAL]</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                                      {crit.expected_standard || 'Standard protocol'}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '6px',
                                          fontWeight: 800,
                                          fontSize: '11px',
                                          backgroundColor: rating.bgColor,
                                          color: rating.color,
                                        }}
                                      >
                                        {isNO ? 'N/O' : `${sc.score ?? '-'}/${crit.max_score || 5}`}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                      {sc.comment || <span style={{ color: '#cbd5e1' }}>None</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                </div>
              )}

              {activeSubTab === 'questions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {sectionsList
                    .filter((s: any) => s.category_group === 'questions' || s.section_type?.includes('question') || s.section_type?.includes('scenario'))
                    .map((sec: any) => {
                      const questionsList = sec.questions || sec.assessment_template_questions || [];
                      return (
                        <div
                          key={sec.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                                <th style={{ padding: '8px 12px', width: '38%' }}>Scenario Question</th>
                                <th style={{ padding: '8px 12px', width: '32%' }}>Candidate Response</th>
                                <th style={{ padding: '8px 12px', width: '12%' }}>Score</th>
                                <th style={{ padding: '8px 12px', width: '18%' }}>Evaluator Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {questionsList.map((q: any, qIdx: number) => {
                                const ans = answersMap[q.id] || {};
                                const rating = getScoreRatingInfo(ans.score);

                                return (
                                  <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 12px' }}>
                                      <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                        Q{qIdx + 1}: {q.question_text}
                                      </div>
                                      {q.expected_answer && (
                                        <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                                          <strong>Guidance:</strong> {q.expected_answer}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#334155' }}>
                                      {ans.recorded_answer || <span style={{ color: '#cbd5e1' }}>No answer recorded</span>}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '6px',
                                          fontWeight: 800,
                                          fontSize: '11px',
                                          backgroundColor: rating.bgColor,
                                          color: rating.color,
                                        }}
                                      >
                                        {ans.score ?? '-'}/{q.max_score || 5}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                      {ans.comment || <span style={{ color: '#cbd5e1' }}>None</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                </div>
              )}

              {activeSubTab === 'objectives' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      border: '1px solid #fde047',
                      borderRadius: '12px',
                      padding: '16px',
                      backgroundColor: '#fffbeb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#b45309', margin: 0 }}>
                        🔁 Extended Probation Improvement Objectives
                      </h4>
                      {objectives.length < 5 && (
                        <button
                          type="button"
                          onClick={handleAddObjective}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #f59e0b',
                            backgroundColor: '#ffffff',
                            color: '#b45309',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Add Objective
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78350f', marginBottom: '4px' }}>
                          New Probation End Date
                        </label>
                        <input
                          type="date"
                          value={newProbationEndDate}
                          onChange={(e) => setNewProbationEndDate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '12px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78350f', marginBottom: '4px' }}>
                          Target Reassessment Date
                        </label>
                        <input
                          type="date"
                          value={reassessmentDate}
                          onChange={(e) => setReassessmentDate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '12px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {objectives.map((obj, idx) => (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
                              Objective #{idx + 1}
                            </span>
                            {objectives.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveObjective(idx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <input
                            type="text"
                            placeholder="Improvement objective (e.g. Master menu allergy questions)"
                            value={obj.objective_text}
                            onChange={(e) => {
                              const next = [...objectives];
                              next[idx].objective_text = e.target.value;
                              setObjectives(next);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '12px',
                              marginBottom: '6px',
                              boxSizing: 'border-box',
                            }}
                          />

                          <input
                            type="text"
                            placeholder="Expected standard (e.g. 100% compliance during shift checks)"
                            value={obj.expected_standard}
                            onChange={(e) => {
                              const next = [...objectives];
                              next[idx].expected_standard = e.target.value;
                              setObjectives(next);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '12px',
                              marginBottom: '6px',
                              boxSizing: 'border-box',
                            }}
                          />

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="Responsible manager"
                              value={obj.responsible_manager || ''}
                              onChange={(e) => {
                                const next = [...objectives];
                                next[idx].responsible_manager = e.target.value;
                                setObjectives(next);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '11px',
                                boxSizing: 'border-box',
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Training / coaching required"
                              value={obj.training_required || ''}
                              onChange={(e) => {
                                const next = [...objectives];
                                next[idx].training_required = e.target.value;
                                setObjectives(next);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '11px',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {isCompleted && onStartReassessment && (
                      <button
                        type="button"
                        onClick={() => onStartReassessment(assessment)}
                        style={{
                          marginTop: '14px',
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          backgroundColor: '#ea580c',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '13px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        🎯 Launch Follow-up Reassessment Now ›
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                {isCompleted && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowReopenModal(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #fca5a5',
                      backgroundColor: '#fef2f2',
                      color: '#b91c1c',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={14} /> Reopen Assessment (Admin)
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>

                {(!isCompleted || isManager) && (
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#1e5c4f',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <CheckCircle size={15} />
                    {submitting ? 'Saving...' : 'Submit & Record Manager Decision'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* REOPEN REASON MODAL */}
      {showReopenModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '450px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: '0 0 8px 0' }}>
              Reopen Assessment
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.4 }}>
              Reopening will allow the evaluator to modify scores and criteria. This action will be permanently recorded in the audit trail.
            </p>

            <textarea
              rows={3}
              placeholder="Reason for reopening (e.g. Correcting score on Allergy protocol)..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '12px',
                marginBottom: '14px',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopen}
                disabled={submitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#b91c1c',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
