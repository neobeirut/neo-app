import { getScoreRatingInfo } from './assessmentScoring';

export interface PrintAssessmentData {
  assessment: any;
  employee: any;
  sections: any[];
  scores: any[];
  answers: any[];
  objectives: any[];
  restaurantName?: string;
  restaurantLogo?: string;
}

export const printAssessmentReportWeb = (data: PrintAssessmentData) => {
  const { assessment, employee, sections, scores, answers, objectives, restaurantName, restaurantLogo } = data;
  const empName = `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || 'Employee';
  const template = assessment?.template_snapshot || {};
  const scoresMap: Record<string, any> = {};
  (scores || []).forEach((s) => {
    scoresMap[s.criterion_id] = s;
  });
  const answersMap: Record<string, any> = {};
  (answers || []).forEach((a) => {
    answersMap[a.question_id] = a;
  });

  const finalScore = Number(assessment?.final_score ?? 0);
  const practicalScore = Number(assessment?.practical_score ?? 0);
  const questionsScore = Number(assessment?.questions_score ?? 0);
  const decision = assessment?.manager_decision || assessment?.system_recommendation || 'Pending';
  const hasCritical = !!assessment?.has_critical_failure;

  let decisionBadgeColor = '#28a745';
  if (decision === 'Dismiss' || hasCritical) decisionBadgeColor = '#dc3545';
  else if (decision === 'Extend Probation') decisionBadgeColor = '#fd7e14';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Employee Assessment - ${empName}</title>
        <style>
          @page { margin: 12mm; size: A4; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1a202c;
            line-height: 1.4;
            margin: 0;
            padding: 20px;
            font-size: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1e5c4f;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }
          .logo {
            max-height: 50px;
            max-width: 140px;
            object-fit: contain;
          }
          .title-area h1 {
            margin: 0;
            font-size: 20px;
            color: #1e5c4f;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .title-area p {
            margin: 2px 0 0 0;
            font-size: 11px;
            color: #718096;
          }
          .grid-2 {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
          }
          .card {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 12px;
          }
          .card-title {
            font-size: 11px;
            font-weight: 700;
            color: #4a5568;
            text-transform: uppercase;
            margin-bottom: 6px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 11px;
          }
          .info-label {
            color: #718096;
            font-weight: 500;
          }
          .info-value {
            font-weight: 600;
            color: #2d3748;
          }
          .score-banner {
            display: flex;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 15px;
            justify-content: space-around;
            text-align: center;
          }
          .score-item .val {
            font-size: 22px;
            font-weight: 800;
            color: #1e5c4f;
          }
          .score-item .lbl {
            font-size: 10px;
            font-weight: 600;
            color: #4a5568;
            text-transform: uppercase;
          }
          .decision-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            color: #fff;
            font-weight: 700;
            font-size: 12px;
            background: ${decisionBadgeColor};
          }
          .critical-alert {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 11px;
            font-weight: 600;
          }
          .section-block {
            margin-bottom: 15px;
            page-break-inside: avoid;
          }
          .section-header {
            background: #edf2f7;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 700;
            color: #2d3748;
            border-left: 4px solid #1e5c4f;
            display: flex;
            justify-content: space-between;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: 11px;
          }
          th, td {
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f8fafc;
            font-weight: 600;
            color: #4a5568;
          }
          .score-pill {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 10px;
          }
          .text-muted { color: #718096; font-size: 10px; }
          .sig-container {
            display: flex;
            justify-content: space-between;
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px dashed #cbd5e1;
            page-break-inside: avoid;
          }
          .sig-box {
            width: 30%;
            text-align: center;
          }
          .sig-line {
            border-bottom: 1px solid #718096;
            height: 35px;
            margin-bottom: 4px;
          }
          .sig-label {
            font-size: 10px;
            color: #718096;
            font-weight: 600;
            text-transform: uppercase;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="title-area">
            <h1>Employee Assessment Report</h1>
            <p>${restaurantName || 'FLOW Restaurant Management'} &bull; ${template?.name || 'Standard Evaluation'}</p>
          </div>
          ${restaurantLogo ? `<img src="${restaurantLogo}" class="logo" alt="Logo" />` : ''}
        </div>

        <!-- Info Grid -->
        <div class="grid-2">
          <div class="card">
            <div class="card-title">Employee Details</div>
            <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${empName}</span></div>
            <div class="info-row"><span class="info-label">Position:</span><span class="info-value">${assessment?.position || employee?.position || 'Staff'}</span></div>
            <div class="info-row"><span class="info-label">Branch:</span><span class="info-value">${assessment?.branch || employee?.branch || 'Main'}</span></div>
            <div class="info-row"><span class="info-label">Employment Start:</span><span class="info-value">${employee?.date_started || assessment?.employment_start_date || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Days Worked:</span><span class="info-value">${assessment?.days_worked ?? 10} days</span></div>
          </div>
          <div class="card">
            <div class="card-title">Assessment Metadata</div>
            <div class="info-row"><span class="info-label">Assessment Date:</span><span class="info-value">${assessment?.assessment_date || new Date().toISOString().split('T')[0]}</span></div>
            <div class="info-row"><span class="info-label">Reason:</span><span class="info-value">${assessment?.reason || 'Initial probation'}</span></div>
            <div class="info-row"><span class="info-label">Evaluator:</span><span class="info-value">${assessment?.evaluator_name || 'Manager'}</span></div>
            ${assessment?.second_evaluator_name ? `<div class="info-row"><span class="info-label">2nd Evaluator:</span><span class="info-value">${assessment.second_evaluator_name}</span></div>` : ''}
            <div class="info-row"><span class="info-label">Status:</span><span class="info-value">${assessment?.status || 'Completed'}</span></div>
          </div>
        </div>

        <!-- Scores & Decision Banner -->
        <div class="score-banner">
          <div class="score-item">
            <div class="val">${practicalScore}%</div>
            <div class="lbl">Practical Test (${template?.practical_weight ?? 70}%)</div>
          </div>
          <div class="score-item">
            <div class="val">${questionsScore}%</div>
            <div class="lbl">Questions & Scenarios (${template?.questions_weight ?? 30}%)</div>
          </div>
          <div class="score-item">
            <div class="val">${finalScore}%</div>
            <div class="lbl">Final Score</div>
          </div>
          <div class="score-item">
            <div style="margin-top: 4px;">
              <span class="decision-badge">${decision}</span>
            </div>
            <div class="lbl" style="margin-top: 6px;">Manager Decision</div>
          </div>
        </div>

        ${hasCritical ? `
          <div class="critical-alert">
            ⚠️ <strong>CRITICAL FAILURE DETECTED:</strong> One or more mandatory standard violations occurred during this assessment. Management review is required.
          </div>
        ` : ''}

        ${assessment?.decision_override_explanation ? `
          <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 8px 12px; border-radius: 6px; margin-bottom: 15px; font-size: 11px;">
            <strong>Decision Override Rationale:</strong> ${assessment.decision_override_explanation}
          </div>
        ` : ''}

        <!-- Practical Sections Breakdown -->
        <h3 style="font-size: 13px; color: #1e5c4f; margin: 15px 0 8px 0; border-bottom: 1px solid #1e5c4f; padding-bottom: 3px;">
          1. Practical Shift Observations
        </h3>

        ${(sections || []).filter(s => s.category_group === 'practical' || s.section_type?.includes('practical') || s.section_type?.includes('observation')).map((sec: any) => {
          const secCriteria = (sec.criteria || sec.assessment_template_criteria || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
          return `
            <div class="section-block">
              <div class="section-header">
                <span>${sec.title}</span>
                <span>Weight: ${sec.weight}%</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 35%;">Evaluation Criteria</th>
                    <th style="width: 30%;">Expected Standard</th>
                    <th style="width: 12%;">Score</th>
                    <th style="width: 23%;">Evaluator Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${secCriteria.map((crit: any) => {
                    const sc = scoresMap[crit.id] || {};
                    const isNO = !!sc.is_not_observed;
                    const rating = isNO ? { label: 'Not Observed', color: '#6c757d', bgColor: '#e9ecef' } : getScoreRatingInfo(sc.score);
                    return `
                      <tr>
                        <td>
                          <strong>${crit.name}</strong>
                          ${crit.is_critical ? '<span style="color: #dc3545; font-weight: bold;"> [CRITICAL]</span>' : ''}
                          ${crit.instructions ? `<div class="text-muted">${crit.instructions}</div>` : ''}
                        </td>
                        <td>${crit.expected_standard || 'Standard hospitality protocol'}</td>
                        <td>
                          <span class="score-pill" style="background: ${rating.bgColor}; color: ${rating.color};">
                            ${isNO ? 'N/O' : `${sc.score ?? '-'}/${crit.max_score || 5}`}
                          </span>
                        </td>
                        <td>${sc.comment || '<span class="text-muted">None</span>'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}

        <!-- Questions & Scenarios -->
        <h3 style="font-size: 13px; color: #1e5c4f; margin: 20px 0 8px 0; border-bottom: 1px solid #1e5c4f; padding-bottom: 3px; page-break-before: auto;">
          2. Questions and Simulated Scenarios
        </h3>

        ${(sections || []).filter(s => s.category_group === 'questions' || s.section_type?.includes('question') || s.section_type?.includes('scenario')).map((sec: any) => {
          const secQuestions = (sec.questions || sec.assessment_template_questions || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
          return `
            <div class="section-block">
              <table>
                <thead>
                  <tr>
                    <th style="width: 40%;">Question / Simulated Scenario</th>
                    <th style="width: 35%;">Recorded Response & Guidance</th>
                    <th style="width: 10%;">Score</th>
                    <th style="width: 15%;">Evaluator Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${secQuestions.map((q: any, idx: number) => {
                    const ans = answersMap[q.id] || {};
                    const rating = getScoreRatingInfo(ans.score);
                    return `
                      <tr>
                        <td>
                          <strong>Q${idx + 1}: ${q.question_text}</strong>
                          ${q.is_critical ? '<span style="color: #dc3545; font-weight: bold;"> [CRITICAL]</span>' : ''}
                          ${q.expected_answer ? `<div class="text-muted" style="margin-top: 3px;"><strong>Guidance:</strong> ${q.expected_answer}</div>` : ''}
                        </td>
                        <td>${ans.recorded_answer || '<span class="text-muted">No verbal answer recorded</span>'}</td>
                        <td>
                          <span class="score-pill" style="background: ${rating.bgColor}; color: ${rating.color};">
                            ${ans.score ?? '-'}/${q.max_score || 5}
                          </span>
                        </td>
                        <td>${ans.comment || '<span class="text-muted">None</span>'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}

        <!-- Strengths, Weaknesses, General Notes -->
        ${(assessment?.strengths || assessment?.weaknesses || assessment?.general_comments) ? `
          <div class="grid-2" style="margin-top: 15px; page-break-inside: avoid;">
            <div class="card">
              <div class="card-title" style="color: #2e7d32;">Key Strengths</div>
              <p style="font-size: 11px; margin: 0;">${assessment.strengths || 'None recorded'}</p>
            </div>
            <div class="card">
              <div class="card-title" style="color: #c62828;">Areas for Improvement</div>
              <p style="font-size: 11px; margin: 0;">${assessment.weaknesses || 'None recorded'}</p>
            </div>
          </div>
        ` : ''}

        <!-- Extended Probation Improvement Plan (if applicable) -->
        ${objectives && objectives.length > 0 ? `
          <div class="section-block" style="margin-top: 15px; page-break-inside: avoid;">
            <div class="section-header" style="background: #fff3cd; border-left-color: #f59e0b;">
              <span>Extended Probation Improvement Objectives</span>
              <span>${objectives.length} Objectives</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 35%;">Improvement Objective</th>
                  <th style="width: 30%;">Expected Standard</th>
                  <th style="width: 15%;">Responsible Manager</th>
                  <th style="width: 15%;">Target Date</th>
                </tr>
              </thead>
              <tbody>
                ${objectives.map((obj: any, idx: number) => `
                  <tr>
                    <td><strong>${idx + 1}</strong></td>
                    <td>${obj.objective_text}</td>
                    <td>${obj.expected_standard}</td>
                    <td>${obj.responsible_manager || 'Manager'}</td>
                    <td>${obj.target_completion_date || 'Reassessment Date'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- Signatures & Acknowledgement -->
        <div class="sig-container">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Evaluator Signature</div>
            <div style="font-size: 10px; color: #4a5568;">${assessment?.evaluator_name || 'Evaluator'}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Branch / General Manager</div>
            <div style="font-size: 10px; color: #4a5568;">Authorized Signature</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Employee Acknowledgement</div>
            <div style="font-size: 9px; color: #718096; margin-top: 2px;">
              ${assessment?.employee_acknowledged_at ? `Acknowledged on ${assessment.employee_acknowledged_at.split('T')[0]}` : 'I confirm receipt of this evaluation'}
            </div>
          </div>
        </div>

        <div style="text-align: center; font-size: 9px; color: #a0aec0; margin-top: 20px;">
          Generated by FLOW System &bull; Confidential &bull; Document Version ${template?.version || 1}
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
};
