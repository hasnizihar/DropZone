import fs from 'fs';
import path from 'path';
import {
  DownloadJob,
  HistoryQueryOptions,
  HistoryListResult,
} from '@dropzone/shared';
import { DatabaseManager } from './DatabaseManager';

export class JobRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  public saveJob(job: DownloadJob): void {
    const postProcessJson = job.postProcess ? JSON.stringify(job.postProcess) : null;
    const errorJson = job.error ? JSON.stringify(job.error) : null;
    const childJobIdsJson = job.childJobIds && job.childJobIds.length > 0 ? JSON.stringify(job.childJobIds) : null;

    const sql = `
      INSERT INTO download_jobs (
        id, parent_job_id, engine, url, title, source, category, status,
        selected_format_id, custom_filename, output_path, source_path,
        target_directory, thumbnail, progress, downloaded_bytes, total_bytes,
        speed_bytes_per_sec, eta_seconds, post_process_json, processing_progress,
        processing_stage, asset_count, completed_assets_count, failed_assets_count,
        cancelled_assets_count, is_partial_failure, mime_type, supports_resume,
        error_json, child_job_ids_json, created_at, started_at, completed_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        parent_job_id = excluded.parent_job_id,
        engine = excluded.engine,
        url = excluded.url,
        title = excluded.title,
        source = excluded.source,
        category = excluded.category,
        status = excluded.status,
        selected_format_id = excluded.selected_format_id,
        custom_filename = excluded.custom_filename,
        output_path = excluded.output_path,
        source_path = excluded.source_path,
        target_directory = excluded.target_directory,
        thumbnail = excluded.thumbnail,
        progress = excluded.progress,
        downloaded_bytes = excluded.downloaded_bytes,
        total_bytes = excluded.total_bytes,
        speed_bytes_per_sec = excluded.speed_bytes_per_sec,
        eta_seconds = excluded.eta_seconds,
        post_process_json = excluded.post_process_json,
        processing_progress = excluded.processing_progress,
        processing_stage = excluded.processing_stage,
        asset_count = excluded.asset_count,
        completed_assets_count = excluded.completed_assets_count,
        failed_assets_count = excluded.failed_assets_count,
        cancelled_assets_count = excluded.cancelled_assets_count,
        is_partial_failure = excluded.is_partial_failure,
        mime_type = excluded.mime_type,
        supports_resume = excluded.supports_resume,
        error_json = excluded.error_json,
        child_job_ids_json = excluded.child_job_ids_json,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at;
    `;

    const params = [
      job.id,
      job.parentJobId || null,
      job.engine,
      job.url,
      job.title,
      job.source,
      job.category,
      job.status,
      job.selectedFormatId || null,
      job.customFilename || null,
      job.outputPath || null,
      job.sourcePath || null,
      job.targetDirectory,
      job.thumbnail || null,
      job.progress || 0,
      job.downloadedBytes || 0,
      job.totalBytes || 0,
      job.speedBytesPerSec || 0,
      job.etaSeconds ?? null,
      postProcessJson,
      job.processingProgress || 0,
      job.processingStage || null,
      job.assetCount ?? null,
      job.completedAssetsCount ?? null,
      job.failedAssetsCount ?? null,
      job.cancelledAssetsCount ?? null,
      job.isPartialFailure ? 1 : 0,
      job.mimeType || null,
      job.supportsResume ? 1 : 0,
      errorJson,
      childJobIdsJson,
      job.createdAt,
      (job as any).startedAt || null,
      job.completedAt || null,
      job.updatedAt || new Date().toISOString(),
    ];

    this.dbManager.run(sql, params);
  }

  public saveJobs(jobs: DownloadJob[]): void {
    if (!jobs || jobs.length === 0) return;
    this.dbManager.transaction(() => {
      for (const job of jobs) {
        this.saveJob(job);
      }
    });
    this.dbManager.saveImmediately();
  }

  public getJob(id: string): DownloadJob | null {
    const row = this.dbManager.queryOne('SELECT * FROM download_jobs WHERE id = ?;', [id]);
    if (!row) return null;
    return this.rowToJob(row);
  }

  public getAllJobs(): DownloadJob[] {
    const rows = this.dbManager.query('SELECT * FROM download_jobs ORDER BY created_at DESC;');
    return rows.map((r) => this.rowToJob(r));
  }

  public listHistory(query?: HistoryQueryOptions): HistoryListResult {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (query?.searchTerm && query.searchTerm.trim()) {
      const term = `%${query.searchTerm.trim()}%`;
      conditions.push('(title LIKE ? OR url LIKE ? OR custom_filename LIKE ?)');
      params.push(term, term, term);
    }

    if (query?.category && query.category !== 'all') {
      conditions.push('category = ?');
      params.push(query.category);
    }

    if (query?.status && query.status !== 'all') {
      conditions.push('status = ?');
      params.push(query.status);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Get total count
    const countRow = this.dbManager.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM download_jobs WHERE ${whereClause};`,
      params
    );
    const totalCount = countRow ? Number(countRow.count) : 0;

    // 2. Sorting
    let sortColumn = 'created_at';
    if (query?.sortBy === 'title') {
      sortColumn = 'title COLLATE NOCASE';
    } else if (query?.sortBy === 'size') {
      sortColumn = 'total_bytes';
    }
    const sortOrder = query?.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // 3. Pagination
    const limit = query?.limit ? Math.min(Math.max(query.limit, 1), 200) : 50;
    const offset = query?.offset ? Math.max(query.offset, 0) : 0;

    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const dataSql = `
      SELECT * FROM download_jobs 
      WHERE ${whereClause} 
      ORDER BY ${sortColumn} ${sortOrder} 
      LIMIT ? OFFSET ?;
    `;
    const queryParams = [...params, limit, offset];
    const rows = this.dbManager.query(dataSql, queryParams);

    return {
      items: rows.map((r) => this.rowToJob(r)),
      totalCount,
      page,
      pageSize: limit,
      totalPages,
    };
  }

  public removeJob(id: string, deleteFile = false): boolean {
    const job = this.getJob(id);
    if (!job) return false;

    // If deleting physical file, do safe removal
    if (deleteFile && job.outputPath && fs.existsSync(job.outputPath)) {
      try {
        fs.unlinkSync(job.outputPath);
      } catch (err) {
        console.error(`[JobRepository] Failed to delete physical file at ${job.outputPath}:`, err);
      }
    }

    // Cascading removal of parent and child records
    this.dbManager.transaction(() => {
      this.dbManager.run('DELETE FROM download_jobs WHERE id = ? OR parent_job_id = ?;', [id, id]);
    });
    this.dbManager.saveImmediately();
    return true;
  }

  public clearHistory(): number {
    let deletedCount = 0;
    this.dbManager.transaction(() => {
      const rows = this.dbManager.query<{ id: string }>(
        "SELECT id FROM download_jobs WHERE status IN ('completed', 'cancelled', 'failed');"
      );
      deletedCount = rows.length;
      this.dbManager.run(
        "DELETE FROM download_jobs WHERE status IN ('completed', 'cancelled', 'failed');"
      );
    });
    this.dbManager.saveImmediately();
    return deletedCount;
  }

  private rowToJob(row: any): DownloadJob {
    let postProcess: any;
    if (row.post_process_json) {
      try {
        postProcess = JSON.parse(row.post_process_json);
      } catch {
        postProcess = undefined;
      }
    }

    let error: any;
    if (row.error_json) {
      try {
        error = JSON.parse(row.error_json);
      } catch {
        error = undefined;
      }
    }

    let childJobIds: string[] | undefined;
    if (row.child_job_ids_json) {
      try {
        childJobIds = JSON.parse(row.child_job_ids_json);
      } catch {
        childJobIds = undefined;
      }
    }

    return {
      id: row.id,
      parentJobId: row.parent_job_id || undefined,
      engine: row.engine,
      url: row.url,
      title: row.title,
      source: row.source,
      category: row.category,
      status: row.status,
      selectedFormatId: row.selected_format_id || undefined,
      customFilename: row.custom_filename || undefined,
      outputPath: row.output_path || undefined,
      sourcePath: row.source_path || undefined,
      targetDirectory: row.target_directory,
      thumbnail: row.thumbnail || undefined,
      progress: Number(row.progress || 0),
      downloadedBytes: Number(row.downloaded_bytes || 0),
      totalBytes: Number(row.total_bytes || 0),
      speedBytesPerSec: Number(row.speed_bytes_per_sec || 0),
      etaSeconds: row.eta_seconds !== null && row.eta_seconds !== undefined ? Number(row.eta_seconds) : null,
      postProcess,
      processingProgress: Number(row.processing_progress || 0),
      processingStage: row.processing_stage || undefined,
      assetCount: row.asset_count !== null && row.asset_count !== undefined ? Number(row.asset_count) : undefined,
      completedAssetsCount: row.completed_assets_count !== null && row.completed_assets_count !== undefined ? Number(row.completed_assets_count) : undefined,
      failedAssetsCount: row.failed_assets_count !== null && row.failed_assets_count !== undefined ? Number(row.failed_assets_count) : undefined,
      cancelledAssetsCount: row.cancelled_assets_count !== null && row.cancelled_assets_count !== undefined ? Number(row.cancelled_assets_count) : undefined,
      isPartialFailure: row.is_partial_failure === 1,
      mimeType: row.mime_type || undefined,
      supportsResume: row.supports_resume === 1,
      error,
      childJobIds,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
      updatedAt: row.updated_at,
    };
  }
}
