import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  calculateOverallAssessment,
  getScoreRatingInfo,
  type CriterionScoreState,
  type QuestionAnswerState,
} from '../utils/assessmentScoring';
import AssessmentDetailWebModal from './AssessmentDetailWebModal';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  User,
  Building,
  Calendar,
  Layers,
} from 'lucide-react';

export default function AssessmentConductWebScreen({ user }: { user?: any }) {
  const { id: assessmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [assessment, setAssessment] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [scoresMap, setScoresMap] = useState<Record<string, CriterionScoreState>>({});
  const [answersMap, setAnswersMap] = useState<Record<string, QuestionAnswerState>>({});
  const [expandedGuidance, setExpandedGuidance] = useState<Record<string, boolean>>({});

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (assessmentId) {
      loadAssessment();
    }
  }, [assessmentId]);

  const loadAssessment = async () => {
    setLoading(true);
    const res = await api.getEmployeeAssessmentById(assessmentId!);
    if (res.success && res.data) {
      const a = res.data;
      setAssessment(a);

      const snap = a.template_snapshot || {};
      setTemplate(snap);

      const secList = (snap.sections || []).sort((x: any, y: any) => (x.display_order || 0) - (y.display_order || 0));
      setSections(secList);

      const sMap: Record<string, CriterionScoreState> = {};
      (a.scores || []).forEach((sc: any) => {
        sMap[sc.criterion_id] = {
          score: sc.score,
          is_not_observed: sc.is_not_observed,
          comment: sc.comment,
          evidence_url: sc.evidence_url,
          needs_follow_up: sc.needs_follow_up,
        };
      });
      setScoresMap(sMap);

      const aMap: Record<string, QuestionAnswerState> = {};
      (a.answers || []).forEach((ans: any) => {
        aMap[ans.question_id] = {
          score: ans.score,
          recorded_answer: ans.recorded_answer,
          selected_option: ans.selected_option,
          comment: ans.comment,
          attachment_url: ans.attachment_url,
          is_critical_failed: ans.is_critical_failed,
        };
      });
      setAnswersMap(aMap);
    } else {
      alert('Error loading assessment: ' + res.error);
    }
    setLoading(false);
  };

  const allCriteria = sections.flatMap((s) => s.criteria || s.assessment_template_criteria || []);
  const allQuestions = sections.flatMap((s) => s.questions || s.assessment_template_questions || []);

  const overallCalc = template
    ? calculateOverallAssessment({
        template: {
          practical_weight: template.practical_weight ?? 70,
          questions_weight: template.questions_weight ?? 30,
          passing_score: template.passing_score ?? 80,
          confirmation_threshold: template.confirmation_threshold ?? 80,
          probation_extension_min: template.probation_extension_min ?? 65,
          probation_extension_max: template.probation_extension_max ?? 79.99,
          dismissal_threshold: template.dismissal_threshold ?? 65,
        },
        sections,
        criteria: allCriteria,
        questions: allQuestions,
        scoresMap,
        answersMap,
      })
    : {
        practicalScore: 0,
        questionsScore: 0,
        finalScore: 0,
        provisionalScore: 0,
        hasCriticalFailure: false,
        criticalFailureDetails: [],
        missingRequiredCount: 0,
        missingCommentsCount: 0,
        systemRecommendation: 'Dismiss' as const,
        isReadyForSubmission: false,
        sectionsBreakdown: [],
        totalApplicableWeight: 0,
      };

  const handleScoreChange = (criterionId: string, score: number | null, isNotObserved = false) => {
    setScoresMap((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        score: isNotObserved ? null : score,
        is_not_observed: isNotObserved,
      },
    }));
  };

  const handleCriterionCommentChange = (criterionId: string, comment: string) => {
    setScoresMap((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        comment,
      },
    }));
  };

  const handleQuestionScoreChange = (questionId: string, score: number) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        score,
      },
    }));
  };

  const handleQuestionRecordedAnswerChange = (questionId: string, recorded_answer: string) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        recorded_answer,
      },
    }));
  };

  const handleQuestionCommentChange = (questionId: string, comment: string) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        comment,
      },
    }));
  };

  const handleSaveDraft = async (silent = false) => {
    if (!assessmentId) return;
    setSavingDraft(true);
    const res = await api.saveAssessmentScoresAndAnswers({
      assessmentId,
      scoresMap,
      answersMap,
      provisionalScore: overallCalc.provisionalScore,
      practicalScore: overallCalc.practicalScore,
      questionsScore: overallCalc.questionsScore,
      hasCriticalFailure: overallCalc.hasCriticalFailure,
      criticalFailureDetails: overallCalc.criticalFailureDetails,
      systemRecommendation: overallCalc.systemRecommendation,
      status: 'In Progress',
      userName: user?.name,
      userId: user?.id,
    });
    setSavingDraft(false);

    if (res.success) {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(nowStr);
      if (!silent) {
        alert(`Draft saved successfully at ${nowStr}`);
      }
    } else if (!silent) {
      alert('Save failed: ' + res.error);
    }
  };

  const handleProceedToFinalDecision = async () => {
    if (overallCalc.missingRequiredCount > 0) {
      alert(`There are ${overallCalc.missingRequiredCount} required items remaining. Please evaluate all required criteria.`);
      return;
    }

    if (overallCalc.missingCommentsCount > 0) {
      alert(`There are ${overallCalc.missingCommentsCount} mandatory comments required for scores below 3 or required questions.`);
      return;
    }

    await handleSaveDraft(true);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
        Loading shift evaluation...
      </div>
    );
  }

  const activeSection = sections[activeSectionIndex] || null;
  const isQuestionsSec = activeSection?.category_group === 'questions' || activeSection?.section_type?.includes('question') || activeSection?.section_type?.includes('scenario');
  const activeCriteria = (activeSection?.criteria || activeSection?.assessment_template_criteria || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
  const activeQuestions = (activeSection?.questions || activeSection?.assessment_template_questions || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

  const empName = `${assessment?.employees?.first_name || ''} ${assessment?.employees?.last_name || ''}`.trim() || 'Employee';
  const scoreRating = getScoreRatingInfo(overallCalc.provisionalScore / 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8fafc' }}>
      {/* Top Sticky Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => navigate('/assessments')}
            style={{
              background: 'none',
              border: 'none',
              color: '#1e5c4f',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {empName} &bull; <span style={{ color: '#64748b', fontWeight: 600 }}>{assessment?.position}</span>
            </h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              {assessment?.branch} &bull; Day {assessment?.days_worked ?? 10} &bull; {lastSavedTime ? `Saved at ${lastSavedTime}` : 'Draft'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              backgroundColor: scoreRating.bgColor,
              color: scoreRating.color,
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 900,
              fontSize: '16px',
              border: `1px solid ${scoreRating.color}33`,
            }}
          >
            {overallCalc.provisionalScore}% ({scoreRating.label})
          </div>

          <button
            type="button"
            onClick={() => handleSaveDraft(false)}
            disabled={savingDraft}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Save size={15} />
            {savingDraft ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            type="button"
            onClick={handleProceedToFinalDecision}
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
            <CheckCircle size={15} /> Review & Finalize
          </button>
        </div>
      </div>

      {/* Critical Standard Failure Alert */}
      {overallCalc.hasCriticalFailure && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            borderBottom: '1px solid #fca5a5',
            padding: '10px 24px',
            color: '#b91c1c',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>
            ⚠️ Critical Standard Failed ({overallCalc.criticalFailureDetails.length}): Automatic Dismissal Recommended upon management review.
          </span>
        </div>
      )}

      {/* Section Tabs Carousel */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          gap: '8px',
        }}
      >
        {sections.map((sec, idx) => {
          const isSelected = activeSectionIndex === idx;
          const secBreakdown = overallCalc.sectionsBreakdown.find((b) => b.sectionId === sec.id);
          const isCompleted = secBreakdown?.isFullyCompleted;

          return (
            <button
              key={sec.id}
              onClick={() => setActiveSectionIndex(idx)}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                borderBottom: isSelected ? '3px solid #1e5c4f' : '3px solid transparent',
                color: isSelected ? '#1e5c4f' : '#64748b',
                fontWeight: isSelected ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{idx + 1}. {sec.title}</span>
              {isCompleted && <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span>}
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>
                ({sec.weight}%)
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Scoring Workspace */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {activeSection && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '18px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {activeSectionIndex + 1}. {activeSection.title}
                </h2>
                <span
                  style={{
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  Section Weight: {activeSection.weight}%
                </span>
              </div>
              {activeSection.description && (
                <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                  {activeSection.description}
                </p>
              )}
            </div>
          )}

          {/* PRACTICAL CRITERIA LIST */}
          {!isQuestionsSec ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {activeCriteria.map((crit: any, cIdx: number) => {
                const scoreState = scoresMap[crit.id] || {};
                const currentScore = scoreState.score;
                const isNO = !!scoreState.is_not_observed;
                const requiresComment = typeof currentScore === 'number' && currentScore < (crit.comment_required_below_score ?? 3);
                const missingComment = requiresComment && !(scoreState.comment || '').trim();

                return (
                  <div
                    key={crit.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      padding: '18px 20px',
                      border: '1px solid',
                      borderColor: missingComment ? '#fca5a5' : '#e2e8f0',
                      borderLeft: crit.is_critical ? '4px solid #dc2626' : undefined,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                        {cIdx + 1}. {crit.name}
                      </div>
                      {crit.is_critical && (
                        <span
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 800,
                          }}
                        >
                          CRITICAL
                        </span>
                      )}
                    </div>

                    {crit.expected_standard && (
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          borderLeft: '3px solid #94a3b8',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#334155',
                          marginBottom: '10px',
                        }}
                      >
                        <strong>Standard:</strong> {crit.expected_standard}
                      </div>
                    )}

                    {crit.instructions && (
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 10px 0' }}>
                        {crit.instructions}
                      </p>
                    )}

                    {/* Touch / Click Score Buttons (1 to 5 + N/O) */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSel = !isNO && currentScore === val;
                        const rating = getScoreRatingInfo(val);
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleScoreChange(crit.id, val, false)}
                            style={{
                              flex: 1,
                              padding: '10px 6px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isSel ? rating.color : '#cbd5e1',
                              backgroundColor: isSel ? rating.color : '#f8fafc',
                              color: isSel ? '#ffffff' : '#1e293b',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: '16px', fontWeight: 800 }}>{val}</div>
                            <div style={{ fontSize: '9px', fontWeight: 600, opacity: isSel ? 0.95 : 0.7 }}>
                              {rating.label}
                            </div>
                          </button>
                        );
                      })}

                      {crit.allow_not_observed && (
                        <button
                          type="button"
                          onClick={() => handleScoreChange(crit.id, null, !isNO)}
                          style={{
                            flex: 1,
                            padding: '10px 6px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isNO ? '#64748b' : '#cbd5e1',
                            backgroundColor: isNO ? '#64748b' : '#f1f5f9',
                            color: isNO ? '#ffffff' : '#64748b',
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '15px', fontWeight: 800 }}>N/O</div>
                          <div style={{ fontSize: '9px', fontWeight: 600 }}>Not Obs.</div>
                        </button>
                      )}
                    </div>

                    {/* Evaluator Comment Input */}
                    <input
                      type="text"
                      placeholder={
                        requiresComment
                          ? '⚠️ Score is below standard - Mandatory comment required'
                          : 'Evaluator comment / observation note (optional)...'
                      }
                      value={scoreState.comment || ''}
                      onChange={(e) => handleCriterionCommentChange(crit.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: missingComment ? '#ef4444' : '#e2e8f0',
                        backgroundColor: missingComment ? '#fef2f2' : '#f8fafc',
                        fontSize: '12px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            /* SCENARIO QUESTIONS LIST */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {activeQuestions.map((q: any, qIdx: number) => {
                const ansState = answersMap[q.id] || {};
                const currentScore = ansState.score;
                const isGuidanceOpen = !!expandedGuidance[q.id];
                const missingComment = q.mandatory_comment && !(ansState.comment || '').trim();

                return (
                  <div
                    key={q.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      padding: '18px 20px',
                      border: '1px solid',
                      borderColor: missingComment ? '#fca5a5' : '#e2e8f0',
                      borderLeft: q.is_critical ? '4px solid #dc2626' : undefined,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                        Q{qIdx + 1}. {q.question_text}
                      </div>
                      {q.is_critical && (
                        <span
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 800,
                          }}
                        >
                          CRITICAL
                        </span>
                      )}
                    </div>

                    {/* Expandable Model Answer for Evaluator */}
                    {q.expected_answer && (
                      <div
                        style={{
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          marginBottom: '10px',
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedGuidance((p) => ({ ...p, [q.id]: !p[q.id] }))}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#15803d',
                          }}
                        >
                          <span>💡 Evaluator Model Answer & Guidance</span>
                          {isGuidanceOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {isGuidanceOpen && (
                          <div style={{ padding: '0 12px 10px 12px', fontSize: '11px', color: '#166534', lineHeight: 1.5 }}>
                            {q.expected_answer}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Candidate Answer Textarea */}
                    <textarea
                      rows={2}
                      placeholder="Record candidate's verbal or practical answer..."
                      value={ansState.recorded_answer || ''}
                      onChange={(e) => handleQuestionRecordedAnswerChange(q.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        marginBottom: '10px',
                        boxSizing: 'border-box',
                      }}
                    />

                    {/* 1-5 Score Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSel = currentScore === val;
                        const rating = getScoreRatingInfo(val);
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleQuestionScoreChange(q.id, val)}
                            style={{
                              flex: 1,
                              padding: '10px 6px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isSel ? rating.color : '#cbd5e1',
                              backgroundColor: isSel ? rating.color : '#f8fafc',
                              color: isSel ? '#ffffff' : '#1e293b',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: '16px', fontWeight: 800 }}>{val}</div>
                            <div style={{ fontSize: '9px', fontWeight: 600, opacity: isSel ? 0.95 : 0.7 }}>
                              {rating.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Notes / Mandatory Comment */}
                    <input
                      type="text"
                      placeholder={
                        q.mandatory_comment
                          ? '⚠️ Mandatory evaluator explanation required'
                          : 'Evaluator notes on response (optional)...'
                      }
                      value={ansState.comment || ''}
                      onChange={(e) => handleQuestionCommentChange(q.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: missingComment ? '#ef4444' : '#e2e8f0',
                        backgroundColor: missingComment ? '#fef2f2' : '#f8fafc',
                        fontSize: '12px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Section Navigation Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', gap: '12px' }}>
            <button
              type="button"
              disabled={activeSectionIndex === 0}
              onClick={() => setActiveSectionIndex((prev) => Math.max(0, prev - 1))}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: activeSectionIndex === 0 ? '#94a3b8' : '#334155',
                fontSize: '13px',
                fontWeight: 700,
                cursor: activeSectionIndex === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ‹ Previous Section
            </button>

            {activeSectionIndex < sections.length - 1 ? (
              <button
                type="button"
                onClick={() => setActiveSectionIndex((prev) => Math.min(sections.length - 1, prev + 1))}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#1e5c4f',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Next Section ›
              </button>
            ) : (
              <button
                type="button"
                onClick={handleProceedToFinalDecision}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#15803d',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Review & Finalize Assessment ›
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Final Review & Management Decision Modal */}
      {showDetailModal && (
        <AssessmentDetailWebModal
          assessmentId={assessmentId!}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          onAssessmentUpdated={() => {
            loadAssessment();
          }}
          user={user}
        />
      )}
    </div>
  );
}
