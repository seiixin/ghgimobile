/**
 * Local data helpers — barangays (API-cached) and emission factors from bundled JSON files.
 * Both barangays and years are fetched from API and cached in SQLite for offline use.
 */
import { getDb } from './db';

// ─── Barangays (SQLite cache — real DB ids from API) ──────────────────────────

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

// ─── Emission Factors ─────────────────────────────────────────────────────────

export interface LocalEF {
  id: string;
  label: string;
  value: number;
  unit: string;
}

/**
 * Generic row parser. Tries every candidate label/value field in order
 * and picks the first one that yields a non-empty string / valid number.
 */
function parseRows(
  rows: any[],
  labelCandidates: string[],
  valueCandidates: string[],
  unitCandidates: string[],
): LocalEF[] {
  const results: LocalEF[] = [];

  rows.forEach((row, idx) => {
    // Find label
    let label = '';
    for (const f of labelCandidates) {
      const v = String(row[f] ?? '').trim();
      if (v) { label = v; break; }
    }

    // Find numeric value
    let value = NaN;
    let rawValStr = '';
    for (const f of valueCandidates) {
      const v = String(row[f] ?? '').trim().replace(/,/g, '').replace(/\s/g, '');
      const n = parseFloat(v);
      if (!isNaN(n)) { value = n; rawValStr = v; break; }
    }

    // Find unit
    let unit = '';
    for (const f of unitCandidates) {
      const v = String(row[f] ?? '').trim();
      if (v) { unit = v; break; }
    }

    // Skip header rows (label equals a field name) and rows with no valid value
    if (!label || isNaN(value)) return;

    results.push({
      id:    String(idx),
      label: unit ? `${label} (${unit})` : label,
      value,
      unit,
    });
  });

  return results;
}

// ─── Per-file parsers ─────────────────────────────────────────────────────────

function parseStationary(): LocalEF[] {
  const rows = require('../Emission_Factors/EmissionsfromStationaryFuelUse.json');
  return parseRows(rows,
    ['Fuel Type'],
    [' Emission Factors'],
    ['Units'],
  );
}

function parseLivestock(): LocalEF[] {
  const rows = require('../Emission_Factors/Agriculture (Livestock) Emissions Factors/Agriculture(Livestock)EmissionsFactors.json');
  return parseRows(rows,
    ['Application (Livestock Type)', 'Type of Factor'],
    [' Emission Factors'],
    ['Units'],
  );
}

function parseCrops(): LocalEF[] {
  const rows = require('../Emission_Factors/Agriculture (Crop-Type) Emissions Factors/EmissionsfromAgriculture(Crops).json');
  return parseRows(rows,
    ['Application (Crop Type and Irrigation)*', 'Type of Factor'],
    [' Emission Factors'],
    ['Units'],
  );
}

function parseBiological(): LocalEF[] {
  const rows = require('../Emission_Factors/Biological Treatment of Solid Waste Emission Factors/BiologicalTreatmentofSolidWasteEmission.json');
  return parseRows(rows,
    ['Type of Waste', 'Type of Factor'],
    [' Emission/Intensity Factor'],
    ['Units'],
  );
}

function parseElectricity(): LocalEF[] {
  const rows = require('../Emission_Factors/Electricity Emission Factors for the Philippines/EmissionsfromElectricityGeneration.json');
  return parseRows(rows,
    ['Country/Region/Grid*', 'Application'],
    [' Emission Factors'],
    ['Units'],
  );
}

function parseForestry(): LocalEF[] {
  const rows = require('../Emission_Factors/ForestryEmissionsFactors/ForestryEmissionsFactors.json');
  return parseRows(rows,
    ['Sources of Emission', 'Sources of Removal'],
    ['Emission/Removal Factor'],
    ['Units'],
  );
}

function parseIndustrial(): LocalEF[] {
  const rows = require('../Emission_Factors/Industrial Processes Emission Factors/IndustrialProcessesEmissionFactors.json');
  return parseRows(rows,
    ['Operation', 'Industry Type'],
    ['Emission Factor'],
    // No dedicated Units column — embed in label via Operation field
    ['Units', ''],
  );
}

function parseSolidWaste(): LocalEF[] {
  const rows = require('../Emission_Factors/Waste Emission Factors (IPCC-derived)/SolidWasteDisposalEmissionFactors.json');
  return parseRows(rows,
    ['Type of Waste', 'Type of Factor'],
    [' Emission/Intensity Factor'],
    ['Units'],
  );
}

function parseAirTravel(): LocalEF[] {
  const rows = require('../Emission_Factors/Emissions Factors for Emissions from Mobile Sources/EmissionsfromCommercialAirTravel.json');
  return parseRows(rows,
    ['Flight Distance', 'Flight Type'],
    [' Emission Factors*'],
    ['Units'],
  );
}

function parseBusinessTravel(): LocalEF[] {
  const rows = require('../Emission_Factors/Emissions Factors for Emissions from Mobile Sources/EmissionsfromOtherEmployeeBusinessTravel(AllExceptAirTravel).json');
  return parseRows(rows,
    ['Distance/Application', 'Rail Type'],
    [' Emission Factors*'],
    ['Units'],
  );
}

function parseMobileCombustion(): LocalEF[] {
  const byConsumption = require('../Emission_Factors/Emissions Factors for Emissions from Mobile Sources/InternationalEmissionFactorsforMobileFuelConsumption.json');
  const byDistance    = require('../Emission_Factors/Emissions Factors for Emissions from Mobile Sources/InternationalEmissionFactorsfromMobileFuelUsebyDistance.json');
  const combined      = [...byConsumption, ...byDistance];
  return parseRows(combined,
    ['Fuel Type', 'Application'],
    [' Emission Factors'],
    ['Units'],
  );
}

// ─── Cache + public API ───────────────────────────────────────────────────────

const _efCache: Record<string, LocalEF[]> = {};

export function getLocalEFs(formType: string): LocalEF[] {
  if (_efCache[formType]) return _efCache[formType];

  let results: LocalEF[] = [];

  switch (formType) {
    case 'stationary_combustion':   results = parseStationary();      break;
    case 'livestock':               results = parseLivestock();        break;
    case 'crops':                   results = parseCrops();            break;
    case 'biological_treatment':    results = parseBiological();       break;
    case 'electricity_consumption': results = parseElectricity();      break;
    case 'forestry':
    case 'forestry_removal':        results = parseForestry();         break;
    case 'industrial_processes':    results = parseIndustrial();       break;
    case 'solid_waste':
    case 'wastewater':              results = parseSolidWaste();       break;
    case 'air_travel':              results = parseAirTravel();        break;
    case 'business_travel':         results = parseBusinessTravel();   break;
    case 'mobile_combustion':       results = parseMobileCombustion(); break;
    default:                        results = [];
  }

  _efCache[formType] = results;
  return results;
}

// ─── Inventory Years (SQLite cache) ──────────────────────────────────────────

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
