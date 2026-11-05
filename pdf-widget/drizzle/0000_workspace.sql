CREATE TABLE annotations (id TEXT PRIMARY KEY, environment TEXT NOT NULL, project_id TEXT NOT NULL, document_id TEXT NOT NULL, page_index INTEGER NOT NULL, body TEXT NOT NULL, version INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_operation TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX annotations_document ON annotations(environment, project_id, document_id);
--> statement-breakpoint
CREATE TABLE operations (id TEXT PRIMARY KEY, environment TEXT NOT NULL, project_id TEXT NOT NULL, document_id TEXT NOT NULL, actor TEXT NOT NULL, request_hash TEXT NOT NULL, response TEXT NOT NULL);
