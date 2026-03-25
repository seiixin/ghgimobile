/**
 * Local data helpers — barangays, inventory years, and emission factors.
 * All three are fetched from the API and cached in SQLite for offline use.
 * The local JSON files are kept as a last-resort fallback for label/unit display only.
 */
import { getDb } from './db';

// ─── Barangays ────────────────────────────────────────────────────────────────

export interface LocalBarangay {
  id: number;
  name: string;
}

const INIT_BARANGAYS_SQL = `
  CREATE TABLE IF NOT EXISTS cached_barangays (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
`;

export async function cacheBarangays(barangays: LocalBarangay[]): Promise<void> {
  const db = await getDb();
  await db.execAsync(INIT_BARANGAYS_SQL);
  for (const b of barangays) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_barangays (id, name) VALUES (?, ?)`,
      [b.id, b.name]
    );
  }
}

export async function getCachedBarangays(): Promise<LocalBarangay[]> {
  const db = await getDb();
  await db.execAsync(INIT_BARANGAYS_SQL);
  return db.getAllAsync<{ id: number; name: string }>(
    `SELECT id, name FROM cached_barangays ORDER BY name ASC`
  );
}

// ─── Inventory Years ──────────────────────────────────────────────────────────

export interface CachedYear {
  id: number;
  year: number;
}

const INIT_YEARS_SQL = `
  CREATE TABLE IF NOT EXISTS cached_years (
    id   INTEGER PRIMARY KEY,
    year INTEGER NOT NULL
  );
`;

export async function cacheYears(years: CachedYear[]): Promise<void> {
  const db = await getDb();
  await db.execAsync(INIT_YEARS_SQL);
  // Clear old entries so stale years (e.g. 2023) don't persist
  await db.runAsync(`DELETE FROM cached_years`);
  for (const y of years) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_years (id, year) VALUES (?, ?)`,
      [y.id, y.year]
    );
  }
}

export async function getCachedYears(): Promise<CachedYear[]> {
  const db = await getDb();
  await db.execAsync(INIT_YEARS_SQL);
  return db.getAllAsync<{ id: number; year: number }>(
    `SELECT id, year FROM cached_years ORDER BY year DESC`
  );
}

// ─── Emission Factors (API-cached, real DB ids) ───────────────────────────────

export interface LocalEF {
  id: number;   // real DB id — must match emission_factors.id on the server
  label: string;
  value: number;
  unit: string;
}

const INIT_EFS_SQL = `
  CREATE TABLE IF NOT EXISTS cached_efs (
    id               INTEGER PRIMARY KEY,
    form_type        TEXT NOT NULL,
    subcategory      TEXT,
    fuel_type        TEXT,
    application_type TEXT,
    gas_type         TEXT,
    value            REAL NOT NULL,
    unit             TEXT,
    label            TEXT NOT NULL
  );
`;

/**
 * Map a server-side form_type to the subcategory(ies) used in emission_factors table.
 * Matches the subcategory values set by EmissionFactorSeeder.inferSubcategory().
 */
const FORM_TYPE_TO_SUBCATEGORY: Record<string, string[]> = {
  mobile_combustion:       ['Mobile Fuel Consumption', 'Mobile Fuel Use by Distance'],
  stationary_combustion:   ['Stationary Fuel Use'],
  electricity_consumption: ['Philippines Electricity'],
  livestock:               ['Agriculture Livestock'],
  crops:                   ['Agriculture Crops'],
  solid_waste:             ['Solid Waste Disposal'],
  wastewater:              ['Solid Waste Disposal'],   // no dedicated wastewater EF file; fallback
  biological_treatment:    ['Biological Treatment of Solid Waste'],
  industrial_processes:    ['Industrial Processes'],
  forestry:                ['Forestry'],
  forestry_removal:        ['Forestry'],
  air_travel:              ['Commercial Air Travel'],
  business_travel:         ['Other Employee Business Travel'],
};

export async function cacheEFs(efs: any[]): Promise<void> {
  const db = await getDb();
  await db.execAsync(INIT_EFS_SQL);

  for (const ef of efs) {
    // Build a human-readable label from available fields
    const parts = [ef.fuel_type, ef.application_type].filter(Boolean);
    const label = parts.length > 0
      ? parts.join(' — ')
      : (ef.subcategory ?? 'Unknown');

    // Determine which form_types this EF belongs to
    const formTypes = Object.entries(FORM_TYPE_TO_SUBCATEGORY)
      .filter(([, subs]) => subs.includes(ef.subcategory))
      .map(([ft]) => ft);

    for (const ft of formTypes) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_efs
           (id, form_type, subcategory, fuel_type, application_type, gas_type, value, unit, label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ef.id, ft, ef.subcategory ?? '', ef.fuel_type ?? '', ef.application_type ?? '',
         ef.gas_type ?? 'CO2', ef.value, ef.unit ?? '', label]
      );
    }
  }
}

export async function getCachedEFs(formType: string): Promise<LocalEF[]> {
  const db = await getDb();
  await db.execAsync(INIT_EFS_SQL);
  const rows = await db.getAllAsync<{
    id: number; label: string; value: number; unit: string;
  }>(
    `SELECT id, label, value, unit
       FROM cached_efs
      WHERE form_type = ? AND value > 0
      ORDER BY label ASC`,
    [formType]
  );
  return rows;
}

/**
 * In-memory cache so getLocalEFs() (sync, used in render) works after
 * the async getCachedEFs() has been called once per session.
 */
const _memCache: Record<string, LocalEF[]> = {};

export function setMemEFs(formType: string, efs: LocalEF[]): void {
  _memCache[formType] = efs;
}

export function getLocalEFs(formType: string): LocalEF[] {
  return _memCache[formType] ?? [];
}
