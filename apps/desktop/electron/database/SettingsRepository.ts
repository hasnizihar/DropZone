import { AppSettings, DEFAULT_SETTINGS, AppSettingsSchema } from '@dropzone/shared';
import { DatabaseManager } from './DatabaseManager';

export class SettingsRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  public getSettings(): AppSettings {
    const rows = this.dbManager.query<{ key: string; value: string }>(
      'SELECT key, value FROM settings;'
    );

    if (!rows || rows.length === 0) {
      return { ...DEFAULT_SETTINGS };
    }

    const rawSettings: Record<string, any> = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      try {
        rawSettings[row.key] = JSON.parse(row.value);
      } catch {
        rawSettings[row.key] = row.value;
      }
    }

    // Validate against schema
    const parseRes = AppSettingsSchema.safeParse(rawSettings);
    if (parseRes.success) {
      return parseRes.data;
    }

    console.warn('[SettingsRepository] Stored settings had validation discrepancies; falling back to valid defaults:', parseRes.error.format());
    return { ...DEFAULT_SETTINGS, ...rawSettings };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...partial };

    const parseRes = AppSettingsSchema.safeParse(updated);
    const validSettings = parseRes.success ? parseRes.data : { ...current, ...partial };

    const now = new Date().toISOString();

    this.dbManager.transaction(() => {
      for (const [key, val] of Object.entries(validSettings)) {
        const serialized = JSON.stringify(val);
        this.dbManager.run(
          `INSERT INTO settings (key, value, updated_at) 
           VALUES (?, ?, ?) 
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
          [key, serialized, now]
        );
      }
    });

    this.dbManager.saveImmediately();
    return validSettings;
  }

  public resetSettings(): AppSettings {
    this.dbManager.transaction(() => {
      this.dbManager.run('DELETE FROM settings;');
      const now = new Date().toISOString();
      for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
        const serialized = JSON.stringify(val);
        this.dbManager.run(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?);',
          [key, serialized, now]
        );
      }
    });

    this.dbManager.saveImmediately();
    return { ...DEFAULT_SETTINGS };
  }
}

