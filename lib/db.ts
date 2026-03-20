/**
 * Local SQLite store for offline drafts and user-saved drafts.
 *
 * source = 'offline' — saved because device was offline when submitting; auto-synced
 * source = 'draft'   — user explicitly tapped "Save Draft"; shown in Drafts tab
 */
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('ghgi_offline.db');

  // Base table
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_drafts (
      id          TEXT PRIMARY KEY,
      form_type   TEXT NOT NULL,
      form_data   TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      synced      INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: add source column if it doesn't exist yet
  try {
    await _db.execAsync(`ALTER TABLE offline_drafts ADD COLUMN source TEXT NOT NULL DEFAULT 'offline';`);
  } catch {
    // Column already exists — safe to ignore
  }

  return _db;
}

export type DraftSource = 'offline' | 'draft';

export interface OfflineDraft {
  id: string;
  form_type: string;
  form_data: Record<string, unknown>;
  created_at: string;
  synced: boolean;
  source: DraftSource;
}

/** Save a record. source defaults to 'offline' for backward compat. */
export async function saveDraft(
  draft: Omit<OfflineDraft, 'synced'>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_drafts (id, form_type, form_data, created_at, synced, source)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [draft.id, draft.form_type, JSON.stringify(draft.form_data), draft.created_at, draft.source ?? 'offline'],
  );
}

/** Pending offline records only (source='offline', not yet synced). Used by auto-sync. */
export async function getPendingDrafts(): Promise<OfflineDraft[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; form_type: string; form_data: string; created_at: string; synced: number; source: string;
  }>(
    `SELECT * FROM offline_drafts WHERE synced = 0 AND source = 'offline' ORDER BY created_at ASC`,
  );
  return rows.map((r) => ({
    ...r,
    form_data: JSON.parse(r.form_data),
    synced: r.synced === 1,
    source: r.source as DraftSource,
  }));
}

/** User-saved drafts (source='draft'). Shown in Drafts tab. */
export async function getUserDrafts(): Promise<OfflineDraft[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; form_type: string; form_data: string; created_at: string; synced: number; source: string;
  }>(
    `SELECT * FROM offline_drafts WHERE source = 'draft' ORDER BY created_at DESC`,
  );
  return rows.map((r) => ({
    ...r,
    form_data: JSON.parse(r.form_data),
    synced: r.synced === 1,
    source: r.source as DraftSource,
  }));
}

/** All records regardless of source. Used by Sync tab overview. */
export async function getAllDrafts(): Promise<OfflineDraft[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; form_type: string; form_data: string; created_at: string; synced: number; source: string;
  }>(
    `SELECT * FROM offline_drafts ORDER BY created_at DESC`,
  );
  return rows.map((r) => ({
    ...r,
    form_data: JSON.parse(r.form_data),
    synced: r.synced === 1,
    source: r.source as DraftSource,
  }));
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE offline_drafts SET synced = 1 WHERE id = ?', [id]);
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM offline_drafts WHERE id = ?', [id]);
}
