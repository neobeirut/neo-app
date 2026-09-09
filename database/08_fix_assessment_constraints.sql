-- Migration 08: Fix Assessment Constraints & Audit Logs
-- Adds unique constraints required for Supabase ON CONFLICT upsert calls
-- and ensures section_id is nullable.

-- 1. Assessment Criterion Scores
ALTER TABLE assessment_criterion_scores 
  ALTER COLUMN section_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'assessment_criterion_scores'::regclass 
      AND conname = 'assessment_criterion_scores_assessment_criterion_unique'
  ) THEN
    ALTER TABLE assessment_criterion_scores 
      ADD CONSTRAINT assessment_criterion_scores_assessment_criterion_unique 
      UNIQUE (assessment_id, criterion_id);
  END IF;
END $$;

-- 2. Assessment Question Answers
ALTER TABLE assessment_question_answers 
  ALTER COLUMN section_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'assessment_question_answers'::regclass 
      AND conname = 'assessment_question_answers_assessment_question_unique'
  ) THEN
    ALTER TABLE assessment_question_answers 
      ADD CONSTRAINT assessment_question_answers_assessment_question_unique 
      UNIQUE (assessment_id, question_id);
  END IF;
END $$;

-- 3. Assessment Audit Logs Compatibility Columns
ALTER TABLE assessment_audit_logs ALTER COLUMN entity_type DROP NOT NULL;
ALTER TABLE assessment_audit_logs ALTER COLUMN entity_id DROP NOT NULL;
ALTER TABLE assessment_audit_logs ADD COLUMN IF NOT EXISTS assessment_id uuid;
ALTER TABLE assessment_audit_logs ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE assessment_audit_logs ADD COLUMN IF NOT EXISTS performed_by_name text;
ALTER TABLE assessment_audit_logs ADD COLUMN IF NOT EXISTS performed_by_id uuid;
ALTER TABLE assessment_audit_logs ADD COLUMN IF NOT EXISTS reason text;
