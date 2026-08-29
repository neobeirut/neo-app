/**
 * Pure calculation logic for Employee Assessments (Web Admin).
 * Handles dynamic weighting, exclusion and redistribution of "Not Observed" (N/O) criteria,
 * critical failure overrides, and configurable recommendation thresholds.
 */

export interface CriterionScoreState {
  score: number | null;
  is_not_observed?: boolean;
  comment?: string;
  evidence_url?: string;
  needs_follow_up?: boolean;
}

export interface QuestionAnswerState {
  score: number | null;
  recorded_answer?: string;
  selected_option?: string;
  comment?: string;
  attachment_url?: string;
  is_critical_failed?: boolean;
}

export interface SectionScoreResult {
  sectionId: string;
  sectionTitle: string;
  sectionWeight: number;
  isApplicable: boolean;
  rawPointsEarned: number;
  rawMaxPoints: number;
  sectionPercentage: number;
  weightedContribution: number;
  totalCriteriaCount: number;
  observedCriteriaCount: number;
  notObservedCriteriaCount: number;
  isFullyCompleted: boolean;
  hasCriticalFailure: boolean;
}

export interface QuestionsScoreResult {
  rawPointsEarned: number;
  rawMaxPoints: number;
  questionsPercentage: number;
  totalQuestionsCount: number;
  answeredQuestionsCount: number;
  isFullyCompleted: boolean;
  hasCriticalFailure: boolean;
  criticalQuestionsFailed: string[];
}

export interface OverallAssessmentCalculation {
  practicalScore: number;
  questionsScore: number;
  finalScore: number;
  provisionalScore: number;
  hasCriticalFailure: boolean;
  criticalFailureDetails: string[];
  missingRequiredCount: number;
  missingCommentsCount: number;
  systemRecommendation: 'Confirm Employment' | 'Extend Probation' | 'Dismiss';
  isReadyForSubmission: boolean;
  sectionsBreakdown: SectionScoreResult[];
  totalApplicableWeight: number;
}

export interface TemplateRules {
  practical_weight?: number;
  questions_weight?: number;
  passing_score?: number;
  confirmation_threshold?: number;
  probation_extension_min?: number;
  probation_extension_max?: number;
  dismissal_threshold?: number;
  auto_dismiss_on_critical?: boolean;
}

export function calculatePracticalSectionScore(
  section: any,
  criteriaList: any[],
  scoresMap: Record<string, CriterionScoreState>
): SectionScoreResult {
  const sectionId = section.id;
  const sectionTitle = section.title || 'Section';
  const sectionWeight = Number(section.weight ?? 0);

  let rawPointsEarned = 0;
  let rawMaxPoints = 0;
  let observedCount = 0;
  let notObservedCount = 0;
  let scoredCount = 0;
  let hasCriticalFailure = false;

  const totalCriteriaCount = criteriaList.length;

  for (const crit of criteriaList) {
    const scoreState = scoresMap[crit.id] || { score: null, is_not_observed: false };
    const maxPts = Number(crit.max_score || 5);

    if (scoreState.is_not_observed) {
      notObservedCount++;
      continue;
    }

    if (typeof scoreState.score === 'number' && scoreState.score >= 0) {
      scoredCount++;
      observedCount++;
      rawPointsEarned += scoreState.score;
      rawMaxPoints += maxPts;

      if (crit.is_critical && scoreState.score < (crit.comment_required_below_score ?? 3)) {
        hasCriticalFailure = true;
      }
    } else {
      observedCount++;
      rawMaxPoints += maxPts;
    }
  }

  const isApplicable = rawMaxPoints > 0;
  const sectionPercentage = isApplicable && rawMaxPoints > 0
    ? (rawPointsEarned / rawMaxPoints) * 100
    : 0;

  const isFullyCompleted = totalCriteriaCount === (scoredCount + notObservedCount);

  return {
    sectionId,
    sectionTitle,
    sectionWeight,
    isApplicable,
    rawPointsEarned: Math.round(rawPointsEarned * 100) / 100,
    rawMaxPoints,
    sectionPercentage: Math.round(sectionPercentage * 100) / 100,
    weightedContribution: 0,
    totalCriteriaCount,
    observedCriteriaCount: observedCount,
    notObservedCriteriaCount: notObservedCount,
    isFullyCompleted,
    hasCriticalFailure,
  };
}

export function calculateQuestionsSectionScore(
  questionsList: any[],
  answersMap: Record<string, QuestionAnswerState>
): QuestionsScoreResult {
  let rawPointsEarned = 0;
  let rawMaxPoints = 0;
  let answeredCount = 0;
  let hasCriticalFailure = false;
  const criticalQuestionsFailed: string[] = [];

  const totalQuestionsCount = questionsList.length;

  for (const q of questionsList) {
    const ansState = answersMap[q.id] || { score: null };
    const maxPts = Number(q.max_score || 5);

    rawMaxPoints += maxPts;

    if (typeof ansState.score === 'number' && ansState.score >= 0) {
      answeredCount++;
      rawPointsEarned += ansState.score;

      if (q.is_critical && ansState.score < 3) {
        hasCriticalFailure = true;
        criticalQuestionsFailed.push(q.question_text || `Question ${q.id}`);
      }
    }
  }

  const questionsPercentage = rawMaxPoints > 0
    ? (rawPointsEarned / rawMaxPoints) * 100
    : 0;

  const isFullyCompleted = totalQuestionsCount === answeredCount && totalQuestionsCount > 0;

  return {
    rawPointsEarned: Math.round(rawPointsEarned * 100) / 100,
    rawMaxPoints,
    questionsPercentage: Math.round(questionsPercentage * 100) / 100,
    totalQuestionsCount,
    answeredQuestionsCount: answeredCount,
    isFullyCompleted,
    hasCriticalFailure,
    criticalQuestionsFailed,
  };
}

export function calculateOverallAssessment(params: {
  template: TemplateRules;
  sections: any[];
  criteria: any[];
  questions: any[];
  scoresMap: Record<string, CriterionScoreState>;
  answersMap: Record<string, QuestionAnswerState>;
}): OverallAssessmentCalculation {
  const { template, sections, criteria, questions, scoresMap, answersMap } = params;

  const practicalWeightConfig = template.practical_weight ?? 70;
  const questionsWeightConfig = template.questions_weight ?? 30;

  const practicalSections = sections.filter(
    (s) => s.category_group === 'practical' || s.section_type.includes('practical') || s.section_type.includes('observation')
  );

  let totalApplicableWeight = 0;
  const sectionsBreakdown: SectionScoreResult[] = [];
  let hasCriticalFailure = false;
  const criticalFailureDetails: string[] = [];
  let missingRequiredCount = 0;
  let missingCommentsCount = 0;

  for (const sec of practicalSections) {
    const secCriteria = criteria.filter((c) => c.section_id === sec.id);
    const result = calculatePracticalSectionScore(sec, secCriteria, scoresMap);

    if (result.isApplicable) {
      totalApplicableWeight += result.sectionWeight;
    }

    if (result.hasCriticalFailure) {
      hasCriticalFailure = true;
      criticalFailureDetails.push(`Critical failure in section: ${sec.title}`);
    }

    for (const c of secCriteria) {
      const sc = scoresMap[c.id];
      if (c.is_required && (!sc || (sc.score === null && !sc.is_not_observed))) {
        missingRequiredCount++;
      }
      if (sc && typeof sc.score === 'number' && sc.score < (c.comment_required_below_score ?? 3)) {
        if (!sc.comment || !sc.comment.trim()) {
          missingCommentsCount++;
        }
      }
    }

    sectionsBreakdown.push(result);
  }

  let practicalScore = 0;
  if (totalApplicableWeight > 0) {
    let accumulatedWeightedScore = 0;
    for (const sb of sectionsBreakdown) {
      if (sb.isApplicable) {
        const normalizedSectionWeight = sb.sectionWeight / totalApplicableWeight;
        sb.weightedContribution = Math.round(sb.sectionPercentage * normalizedSectionWeight * 100) / 100;
        accumulatedWeightedScore += sb.sectionPercentage * normalizedSectionWeight;
      }
    }
    practicalScore = Math.round(accumulatedWeightedScore * 100) / 100;
  }

  const questionsResult = calculateQuestionsSectionScore(questions, answersMap);
  if (questionsResult.hasCriticalFailure) {
    hasCriticalFailure = true;
    criticalFailureDetails.push(...questionsResult.criticalQuestionsFailed.map((q) => `Critical question failed: ${q}`));
  }

  for (const q of questions) {
    const ans = answersMap[q.id];
    if (q.is_required && (!ans || typeof ans.score !== 'number')) {
      missingRequiredCount++;
    }
    if (q.mandatory_comment && (!ans?.comment || !ans.comment.trim())) {
      missingCommentsCount++;
    }
  }

  const questionsScore = questionsResult.questionsPercentage;

  const totalConfigWeight = practicalWeightConfig + questionsWeightConfig || 100;
  const finalScore = Math.round(
    ((practicalScore * practicalWeightConfig + questionsScore * questionsWeightConfig) / totalConfigWeight) * 100
  ) / 100;

  const provisionalScore = finalScore;

  const systemRecommendation = determineSystemRecommendation(
    finalScore,
    hasCriticalFailure,
    template
  );

  const isReadyForSubmission =
    missingRequiredCount === 0 &&
    missingCommentsCount === 0 &&
    sectionsBreakdown.every((s) => s.isFullyCompleted) &&
    questionsResult.isFullyCompleted;

  return {
    practicalScore,
    questionsScore,
    finalScore,
    provisionalScore,
    hasCriticalFailure,
    criticalFailureDetails,
    missingRequiredCount,
    missingCommentsCount,
    systemRecommendation,
    isReadyForSubmission,
    sectionsBreakdown,
    totalApplicableWeight,
  };
}

export function determineSystemRecommendation(
  score: number,
  hasCriticalFailure: boolean,
  template: TemplateRules
): 'Confirm Employment' | 'Extend Probation' | 'Dismiss' {
  if (hasCriticalFailure) {
    return 'Dismiss';
  }

  const confirmThreshold = template.confirmation_threshold ?? 80;
  const probationMin = template.probation_extension_min ?? 65;
  const probationMax = template.probation_extension_max ?? 79.99;

  if (score >= confirmThreshold) {
    return 'Confirm Employment';
  } else if (score >= probationMin && score <= probationMax) {
    return 'Extend Probation';
  } else {
    return 'Dismiss';
  }
}

export function validateSectionWeights(sections: any[]): {
  isValid: boolean;
  totalPracticalWeight: number;
  totalQuestionsWeight: number;
} {
  let totalPractical = 0;
  let totalQuestions = 0;

  for (const s of sections) {
    if (!s.is_active && s.is_active !== undefined) continue;
    const w = Number(s.weight || 0);
    if (s.category_group === 'questions' || s.section_type.includes('question') || s.section_type.includes('scenario')) {
      totalQuestions += w;
    } else {
      totalPractical += w;
    }
  }

  const isValid = Math.abs(totalPractical - 100) < 0.01 || totalPractical === 0;

  return {
    isValid,
    totalPracticalWeight: Math.round(totalPractical * 100) / 100,
    totalQuestionsWeight: Math.round(totalQuestions * 100) / 100,
  };
}

export function getScoreRatingInfo(score: number | null): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (score === null || score === undefined) {
    return { label: 'Unrated', color: '#64748b', bgColor: '#f1f5f9' };
  }

  if (score >= 4.5) return { label: 'Excellent', color: '#15803d', bgColor: '#dcfce7' };
  if (score >= 3.5) return { label: 'Good', color: '#059669', bgColor: '#d1fae5' };
  if (score >= 2.5) return { label: 'Acceptable', color: '#d97706', bgColor: '#fef3c7' };
  if (score >= 1.5) return { label: 'Below Expectations', color: '#ea580c', bgColor: '#ffedd5' };
  return { label: 'Unacceptable', color: '#dc2626', bgColor: '#fee2e2' };
}
