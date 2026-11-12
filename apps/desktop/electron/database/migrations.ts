export interface Migration {
  version: number;
  name: string;
  up: (db: any) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    up: (db: any) => {
      // 1. Settings Table (key-value store for preferences)
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 2. Download Jobs Table (durable store for downloads and parent-child hierarchy)
      db.run(`
        CREATE TABLE IF NOT EXISTS download_jobs (
          id TEXT PRIMARY KEY,
          parent_job_id TEXT,
          engine TEXT NOT NULL,
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          source TEXT NOT NULL,
          category TEXT NOT NULL,
          status TEXT NOT NULL,
          selected_format_id TEXT,
          custom_filename TEXT,
          output_path TEXT,
          source_path TEXT,
          target_directory TEXT NOT NULL,
          thumbnail TEXT,
          progress REAL NOT NULL DEFAULT 0,
          downloaded_bytes INTEGER NOT NULL DEFAULT 0,
          total_bytes INTEGER NOT NULL DEFAULT 0,
          speed_bytes_per_sec REAL NOT NULL DEFAULT 0,
          eta_seconds REAL,
          post_process_json TEXT,
          processing_progress REAL DEFAULT 0,
          processing_stage TEXT,
          asset_count INTEGER,
          completed_assets_count INTEGER,
          failed_assets_count INTEGER,
          cancelled_assets_count INTEGER,
          is_partial_failure INTEGER DEFAULT 0,
          mime_type TEXT,
          supports_resume INTEGER DEFAULT 0,
          error_json TEXT,
          child_job_ids_json TEXT,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (parent_job_id) REFERENCES download_jobs(id) ON DELETE CASCADE
        );
      `);

      // 3. Performance Indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_download_jobs_status ON download_jobs(status);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_download_jobs_category ON download_jobs(category);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_download_jobs_created_at ON download_jobs(created_at DESC);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_download_jobs_parent_id ON download_jobs(parent_job_id);`);
    },
  },
];

