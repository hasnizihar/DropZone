import fs from 'fs';
import path from 'path';
import { MIGRATIONS } from './migrations';

// Import inline WASM version of sql.js so esbuild bundles it cleanly without external .wasm file requirements
// eslint-disable-next-line @typescript-eslint/no-var-requires
const initSqlJs = require('sql.js/dist/sql-wasm-inline.js');

export interface DatabaseManagerOptions {
  dbPath?: string;
  inMemoryOnly?: boolean;
}

export class DatabaseManager {
  private db: any = null;
  private dbPath: string | null = null;
  private inMemoryOnly = false;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving = false;
  private isShuttingDown = false;

  constructor(options?: DatabaseManagerOptions) {
    if (options?.inMemoryOnly) {
      this.inMemoryOnly = true;
      this.dbPath = null;
    } else if (options?.dbPath) {
      this.dbPath = options.dbPath;
    }
  }

  public async initialize(): Promise<void> {
    const SQL = await initSqlJs();

    if (this.inMemoryOnly) {
      this.db = new SQL.Database();
    } else if (this.dbPath) {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.dbPath)) {
        try {
          const fileBuffer = fs.readFileSync(this.dbPath);
          this.db = new SQL.Database(fileBuffer);
          // Run integrity check
          const res = this.db.exec('PRAGMA integrity_check;');
          if (res.length > 0 && res[0].values?.[0]?.[0] !== 'ok') {
            console.error('[DatabaseManager] Database integrity check failed. Backing up corrupted db.');
            this.handleCorruptedDatabase(SQL);
          }
        } catch (err) {
          console.error('[DatabaseManager] Failed to read database file. Backing up and starting fresh.', err);
          this.handleCorruptedDatabase(SQL);
        }
      } else {
        this.db = new SQL.Database();
        this.saveImmediately();
      }
    } else {
      this.db = new SQL.Database();
    }

    // Enable foreign keys
    this.run('PRAGMA foreign_keys = ON;');

    // Run schema migrations
    this.applyMigrations();
  }

  private handleCorruptedDatabase(SQL: any): void {
    if (this.dbPath && fs.existsSync(this.dbPath)) {
      try {
        const backupPath = `${this.dbPath}.corrupted.${Date.now()}`;
        fs.copyFileSync(this.dbPath, backupPath);
        console.warn(`[DatabaseManager] Corrupted database backed up to: ${backupPath}`);
      } catch (backupErr) {
        console.error('[DatabaseManager] Failed to back up corrupted database:', backupErr);
      }
    }
    this.db = new SQL.Database();
    this.saveImmediately();
  }

  private applyMigrations(): void {
    // Create schema_migrations table if not exists
    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    // Fetch already applied migration versions
    const appliedRows = this.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC;');
    const appliedVersions = new Set(appliedRows.map((r) => r.version));

    for (const migration of MIGRATIONS) {
      if (!appliedVersions.has(migration.version)) {
        console.log(`[DatabaseManager] Applying migration v${migration.version}: ${migration.name}`);
        this.transaction(() => {
          migration.up(this.db);
          this.run(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
            [migration.version, migration.name, new Date().toISOString()]
          );
        });
      }
    }

    if (this.dbPath && !this.inMemoryOnly) {
      this.saveImmediately();
    }
  }

  public run(sql: string, params: any[] = []): void {
    this.assertOpen();
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      try {
        stmt.run(params);
      } finally {
        stmt.free();
      }
    } else {
      this.db.run(sql);
    }
    this.scheduleSave();
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    this.assertOpen();
    const results: T[] = [];
    const stmt = this.db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
    } finally {
      stmt.free();
    }
    return results;
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const list = this.query<T>(sql, params);
    return list.length > 0 ? list[0] : null;
  }

  public transaction<T>(fn: () => T): T {
    this.assertOpen();
    this.db.run('BEGIN TRANSACTION;');
    try {
      const result = fn();
      this.db.run('COMMIT;');
      this.scheduleSave();
      return result;
    } catch (err) {
      try {
        this.db.run('ROLLBACK;');
      } catch {
        // Ignore rollback failure if already aborted
      }
      throw err;
    }
  }

  public scheduleSave(delayMs = 300): void {
    if (this.inMemoryOnly || !this.dbPath || this.isShuttingDown) {
      return;
    }
    if (this.saveTimeout) {
      return;
    }
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveImmediately();
    }, delayMs);
  }

  public saveImmediately(): void {
    if (this.inMemoryOnly || !this.dbPath || !this.db || this.isSaving) {
      return;
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    this.isSaving = true;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const tmpPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, this.dbPath);
    } catch (err) {
      console.error('[DatabaseManager] Failed to persist database to disk:', err);
    } finally {
      this.isSaving = false;
    }
  }

  public close(): void {
    this.isShuttingDown = true;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.db) {
      try {
        this.saveImmediately();
        this.db.close();
      } catch (err) {
        console.error('[DatabaseManager] Error during database close:', err);
      }
      this.db = null;
    }
  }

  public getDbPath(): string | null {
    return this.dbPath;
  }

  public isClosed(): boolean {
    return this.db === null;
  }

  private assertOpen(): void {
    if (!this.db) {
      throw new Error('[DatabaseManager] Database is closed or not initialized.');
    }
  }
}
