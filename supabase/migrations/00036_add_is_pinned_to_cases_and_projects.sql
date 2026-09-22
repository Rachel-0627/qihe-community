ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cases_is_pinned ON cases(is_pinned DESC, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_is_pinned ON projects(is_pinned DESC, sort_order ASC, created_at DESC);
