CREATE TABLE IF NOT EXISTS rb_annotations (id TEXT PRIMARY KEY, environment TEXT NOT NULL, project_id TEXT NOT NULL, document_id TEXT NOT NULL, page_index INTEGER NOT NULL, body TEXT NOT NULL, version INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_operation TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS rb_annotations_document ON rb_annotations(environment,project_id,document_id);
CREATE TABLE IF NOT EXISTS rb_operations (id TEXT PRIMARY KEY, environment TEXT NOT NULL, project_id TEXT NOT NULL, document_id TEXT NOT NULL, actor TEXT NOT NULL, request_hash TEXT NOT NULL, response TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rb_sessions (token_hash TEXT PRIMARY KEY, actor TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS rb_sessions_expiry ON rb_sessions(expires_at);
