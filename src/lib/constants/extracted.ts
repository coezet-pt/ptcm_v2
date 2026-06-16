/**
 * Power Train Choice Model — extracted constants from
 * Power_Train_Choice_Model_Final_v4_15042026.xlsx
 *
 * Drop this entire file at: src/lib/constants/extracted.ts
 *
 * All values are taken directly from the source Excel. Do NOT modify by hand —
 * regenerate from the workbook if the model changes upstream.
 */

// ===========================================================================
// POWERTRAIN ENUM
// ===========================================================================
export type Powertrain = 'Diesel' | 'CNG' | 'LNG' | 'BET' | 'H2-ICE' | 'H2-FCET';

export const POWERTRAINS: Powertrain[] = [
  'Diesel', 'CNG', 'LNG', 'BET', 'H2-ICE', 'H2-FCET'
];

export const POWERTRAIN_COLORS: Record<Powertrain, string> = {
  'Diesel':  '#4a4a4a',
  'CNG':     '#b0b0b0',
  'LNG':     '#1a1a1a',
  'BET':     '#166534',
  'H2-ICE':  '#7c3aed',
  'H2-FCET': '#4ade80',
};

// ===========================================================================
// VEHICLE-SIZE BASE PRICES (2025 INR) — source: 'Changing with year' rows 19-27, 30-38, 74-82
// engine_trans = engine + transmission cost (used for ZET = base_glider component)
// epowertrain  = E-powertrain cost (motor + electronics for BET/FCET)
// diesel_total = total diesel vehicle on-road price 2025
// ===========================================================================
export type VehicleSize =
  | '15T Rigid' | '19T Rigid' | '28T Rigid' | '35T Rigid' | '48T Rigid'
  | '28T Tipper' | '35T Tipper' | '40T Tractor' | '55T Tractor';

export const VEHICLE_BASE_PRICES_2025: Record<VehicleSize, {
  engine_trans: number;
  e_powertrain: number;
  diesel_total: number;
}> = {
  '15T Rigid':   { engine_trans: 525000,  e_powertrain: 1400000, diesel_total: 2000000 },
  '19T Rigid':   { engine_trans: 625000,  e_powertrain: 1400000, diesel_total: 2750000 },
  '28T Rigid':   { engine_trans: 650000,  e_powertrain: 1400000, diesel_total: 3600000 },
  '35T Rigid':   { engine_trans: 650000,  e_powertrain: 1700000, diesel_total: 4000000 },
  '48T Rigid':   { engine_trans: 750000,  e_powertrain: 1700000, diesel_total: 4700000 },
  '28T Tipper':  { engine_trans: 650000,  e_powertrain: 1700000, diesel_total: 4200000 },
  '35T Tipper':  { engine_trans: 750000,  e_powertrain: 1700000, diesel_total: 4800000 },
  '40T Tractor': { engine_trans: 650000,  e_powertrain: 1400000, diesel_total: 4300000 },
  '55T Tractor': { engine_trans: 750000,  e_powertrain: 1700000, diesel_total: 5000000 },
};

// BS-VII regulatory bump applied to all diesel prices in 2030 (one-time +₹4 lakh)
export const BS_VII_PRICE_BUMP_2030 = 400000;

// ===========================================================================
// 14 BUCKETS — source: 'No change with year' rows 5-18, 'Buckets' sheet col I
// ===========================================================================
export interface Bucket {
  id: string;             // 'B1' .. 'B14'
  useCase: string;
  size: VehicleSize;
  tivShare2045: number;   // share of total TIV in 2045 (sums to ~0.92, residual ~8% is "Other")

  // Operational params (constants, not user-editable in Quick mode)
  annualKm: number;
  workingDays: number;
  kmPerDay: number;
  ulw: number;            // unladen weight kg (diesel)
  gvw: number;            // gross vehicle weight kg

  // Powertrain efficiencies
  dieselKMPL: number;
  cngKmPerKg: number;
  lngKmPerKg: number;
  h2iceKmPerKg: number;
  betKwhPerKm: number;
  fcetKmPerKg: number;

  // Powertrain-specific spec (depends on size)
  betBatteryKWh: number;
  fcetBatteryKWh: number;
  fcetFuelCellKW: number;
  h2TankKg: number;       // H2 ICE tank capacity in kg

  // Tyre counts
  tyreRib: number;
  tyreLug: number;

  // Maintenance per km (₹/km, 7-year average)
  maintDieselPerKm: number;
  maintCngLngH2icePerKm: number;
}

export const BUCKETS: Bucket[] = [
  { id: 'B1',  useCase: 'Market Load',                 size: '19T Rigid',   tivShare2045: 0.0657, annualKm: 108000, workingDays: 300, kmPerDay: 360, ulw: 8000,  gvw: 18500, dieselKMPL: 5.2, cngKmPerKg: 5.4, lngKmPerKg: 5.3,  h2iceKmPerKg: 15.6, betKwhPerKm: 0.95, fcetKmPerKg: 20.8, betBatteryKWh: 200, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 4,  maintDieselPerKm: 2.8,  maintCngLngH2icePerKm: 3.3 },
  { id: 'B2',  useCase: 'Market Load',                 size: '28T Rigid',   tivShare2045: 0.0621, annualKm: 99000,  workingDays: 275, kmPerDay: 360, ulw: 9000,  gvw: 28000, dieselKMPL: 4.5, cngKmPerKg: 4.8, lngKmPerKg: 4.65, h2iceKmPerKg: 13.5, betKwhPerKm: 1.20, fcetKmPerKg: 18.0, betBatteryKWh: 250, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 8,  maintDieselPerKm: 4.2,  maintCngLngH2icePerKm: 4.7 },
  { id: 'B3',  useCase: 'Market Load',                 size: '48T Rigid',   tivShare2045: 0.0533, annualKm: 108000, workingDays: 300, kmPerDay: 360, ulw: 12500, gvw: 47500, dieselKMPL: 2.9, cngKmPerKg: 3.1, lngKmPerKg: 3.0,  h2iceKmPerKg: 8.7,  betKwhPerKm: 1.35, fcetKmPerKg: 11.6, betBatteryKWh: 350, fcetBatteryKWh: 80, fcetFuelCellKW: 120, h2TankKg: 28.2, tyreRib: 4, tyreLug: 12, maintDieselPerKm: 7.7,  maintCngLngH2icePerKm: 8.2 },
  { id: 'B4',  useCase: 'Parcel Load and FMCG',        size: '19T Rigid',   tivShare2045: 0.0504, annualKm: 108000, workingDays: 300, kmPerDay: 360, ulw: 8000,  gvw: 18500, dieselKMPL: 5.0, cngKmPerKg: 5.4, lngKmPerKg: 5.2,  h2iceKmPerKg: 15.0, betKwhPerKm: 0.90, fcetKmPerKg: 20.0, betBatteryKWh: 200, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 4,  maintDieselPerKm: 2.8,  maintCngLngH2icePerKm: 3.3 },
  { id: 'B5',  useCase: 'Parcel Load and FMCG',        size: '28T Rigid',   tivShare2045: 0.1149, annualKm: 108000, workingDays: 300, kmPerDay: 360, ulw: 9500,  gvw: 28000, dieselKMPL: 4.5, cngKmPerKg: 4.8, lngKmPerKg: 4.65, h2iceKmPerKg: 13.5, betKwhPerKm: 1.15, fcetKmPerKg: 18.0, betBatteryKWh: 250, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 8,  maintDieselPerKm: 4.2,  maintCngLngH2icePerKm: 4.7 },
  { id: 'B6',  useCase: 'Perishables',                 size: '15T Rigid',   tivShare2045: 0.0699, annualKm: 120000, workingDays: 300, kmPerDay: 400, ulw: 6500,  gvw: 16000, dieselKMPL: 6.0, cngKmPerKg: 6.3, lngKmPerKg: 6.15, h2iceKmPerKg: 18.0, betKwhPerKm: 0.85, fcetKmPerKg: 24.0, betBatteryKWh: 200, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 4,  maintDieselPerKm: 3.1,  maintCngLngH2icePerKm: 3.6 },
  { id: 'B7',  useCase: 'Construction & Mining',       size: '28T Tipper',  tivShare2045: 0.1213, annualKm: 67200,  workingDays: 280, kmPerDay: 240, ulw: 13500, gvw: 28000, dieselKMPL: 3.8, cngKmPerKg: 4.0, lngKmPerKg: 3.9,  h2iceKmPerKg: 11.4, betKwhPerKm: 1.30, fcetKmPerKg: 15.2, betBatteryKWh: 250, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 8,  maintDieselPerKm: 8.6,  maintCngLngH2icePerKm: 9.1 },
  { id: 'B8',  useCase: 'Construction & Mining',       size: '35T Tipper',  tivShare2045: 0.1758, annualKm: 67200,  workingDays: 280, kmPerDay: 240, ulw: 15000, gvw: 35000, dieselKMPL: 3.0, cngKmPerKg: 3.2, lngKmPerKg: 3.1,  h2iceKmPerKg: 9.0,  betKwhPerKm: 1.40, fcetKmPerKg: 12.0, betBatteryKWh: 300, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 4, tyreLug: 8,  maintDieselPerKm: 10.9, maintCngLngH2icePerKm: 11.4 },
  { id: 'B9',  useCase: 'Cement (Bulkers & Bagged)',   size: '48T Rigid',   tivShare2045: 0.0627, annualKm: 115200, workingDays: 320, kmPerDay: 360, ulw: 12500, gvw: 47500, dieselKMPL: 2.9, cngKmPerKg: 3.1, lngKmPerKg: 3.0,  h2iceKmPerKg: 8.7,  betKwhPerKm: 1.40, fcetKmPerKg: 11.6, betBatteryKWh: 350, fcetBatteryKWh: 80, fcetFuelCellKW: 120, h2TankKg: 28.2, tyreRib: 4, tyreLug: 12, maintDieselPerKm: 7.7,  maintCngLngH2icePerKm: 8.2 },
  { id: 'B10', useCase: 'Cement (Bulkers & Bagged)',   size: '55T Tractor', tivShare2045: 0.0470, annualKm: 108000, workingDays: 300, kmPerDay: 360, ulw: 15500, gvw: 55000, dieselKMPL: 2.6, cngKmPerKg: 2.8, lngKmPerKg: 2.7,  h2iceKmPerKg: 7.8,  betKwhPerKm: 1.45, fcetKmPerKg: 10.4, betBatteryKWh: 300, fcetBatteryKWh: 80, fcetFuelCellKW: 120, h2TankKg: 28.2, tyreRib: 2, tyreLug: 16, maintDieselPerKm: 6.5,  maintCngLngH2icePerKm: 7.0 },
  { id: 'B11', useCase: 'Steel & metal products',      size: '55T Tractor', tivShare2045: 0.0971, annualKm: 96000,  workingDays: 320, kmPerDay: 300, ulw: 15000, gvw: 55000, dieselKMPL: 2.6, cngKmPerKg: 2.7, lngKmPerKg: 2.65, h2iceKmPerKg: 7.8,  betKwhPerKm: 1.40, fcetKmPerKg: 10.4, betBatteryKWh: 300, fcetBatteryKWh: 80, fcetFuelCellKW: 120, h2TankKg: 28.2, tyreRib: 2, tyreLug: 16, maintDieselPerKm: 8.3,  maintCngLngH2icePerKm: 8.8 },
  { id: 'B12', useCase: 'Tankers - POL & CNG cascades', size: '28T Rigid',  tivShare2045: 0.0304, annualKm: 75000,  workingDays: 300, kmPerDay: 250, ulw: 9500,  gvw: 28000, dieselKMPL: 4.7, cngKmPerKg: 4.9, lngKmPerKg: 4.8,  h2iceKmPerKg: 14.1, betKwhPerKm: 1.05, fcetKmPerKg: 18.8, betBatteryKWh: 250, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 8,  maintDieselPerKm: 3.5,  maintCngLngH2icePerKm: 4.0 },
  { id: 'B13', useCase: 'Tankers - Non POL',           size: '28T Rigid',   tivShare2045: 0.0364, annualKm: 90000,  workingDays: 300, kmPerDay: 300, ulw: 9500,  gvw: 28000, dieselKMPL: 4.7, cngKmPerKg: 4.9, lngKmPerKg: 4.8,  h2iceKmPerKg: 14.1, betKwhPerKm: 1.05, fcetKmPerKg: 18.8, betBatteryKWh: 250, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 8,  maintDieselPerKm: 3.5,  maintCngLngH2icePerKm: 4.0 },
  { id: 'B14', useCase: 'LPG bullet tankers',          size: '40T Tractor', tivShare2045: 0.0129, annualKm: 60000,  workingDays: 240, kmPerDay: 250, ulw: 19000, gvw: 39500, dieselKMPL: 3.6, cngKmPerKg: 3.8, lngKmPerKg: 3.7,  h2iceKmPerKg: 10.8, betKwhPerKm: 1.25, fcetKmPerKg: 14.4, betBatteryKWh: 300, fcetBatteryKWh: 70, fcetFuelCellKW: 80,  h2TankKg: 28.2, tyreRib: 2, tyreLug: 12, maintDieselPerKm: 4.3,  maintCngLngH2icePerKm: 4.8 },
];

// Sum of all bucket shares = ~0.9099. Residual ~9% is modelled as Diesel-only "Other".
export const BUCKET_TIV_SHARE_TOTAL = BUCKETS.reduce((s, b) => s + b.tivShare2045, 0);
export const OTHER_DIESEL_TIV_SHARE = 1 - BUCKET_TIV_SHARE_TOTAL;

// ===========================================================================
// RESALE VALUE TIERS (% of purchase price after 7 years)
// Tier1 = until 2035 sales | Tier2 = 2036-2045 | Tier3 = after 2045
// Two profile groups in Excel — "high duty" (cement, mining, tipper) and "general"
// ===========================================================================
export type ResaleProfile = 'general' | 'high_duty' | 'tipper';

export const RESALE_VALUES: Record<ResaleProfile, Record<Powertrain, [number, number, number]>> = {
  general:   { // applies to B1, B2, B4, B5, B6, B12, B13, B14
    'Diesel':  [0.55, 0.45, 0.35],
    'CNG':     [0.50, 0.40, 0.30],
    'LNG':     [0.50, 0.40, 0.30],
    'BET':     [0.20, 0.30, 0.40],
    'H2-ICE':  [0.25, 0.35, 0.40],
    'H2-FCET': [0.10, 0.20, 0.30],
  },
  high_duty: { // applies to B3, B9, B10, B11
    'Diesel':  [0.50, 0.40, 0.30],
    'CNG':     [0.45, 0.35, 0.25],
    'LNG':     [0.45, 0.35, 0.25],
    'BET':     [0.15, 0.25, 0.35],
    'H2-ICE':  [0.20, 0.30, 0.35],
    'H2-FCET': [0.05, 0.15, 0.25],
  },
  tipper: { // applies to B7, B8 (Excel B7/B8 TCO sheets, resale ÷ vehicle cost)
    'Diesel':  [0.30, 0.25, 0.20],
    'CNG':     [0.25, 0.20, 0.15],
    'LNG':     [0.25, 0.20, 0.15],
    'BET':     [0.10, 0.20, 0.25],
    'H2-ICE':  [0.15, 0.20, 0.25],
    'H2-FCET': [0.05, 0.15, 0.20],
  },
};

// Maps each bucket to its resale profile
export const BUCKET_RESALE_PROFILE: Record<string, ResaleProfile> = {
  'B1': 'general',  'B2': 'general',  'B3': 'high_duty', 'B4': 'general',
  'B5': 'general',  'B6': 'general',  'B7': 'tipper',    'B8': 'tipper',
  'B9': 'high_duty','B10': 'high_duty','B11': 'high_duty','B12': 'general',
  'B13': 'general', 'B14': 'general',
};

// ===========================================================================
// CHOICE MODEL — per-bucket effective elasticities (impact rating × weight ×
// 1.5 global multiplier already folded in). Back-solved exactly from the
// Excel Estimation SS2045 factor rows against the Input Sheet value blocks;
// identical within each use-case group.
// ===========================================================================
export interface ChoiceElasticities {
  tco: number; price: number; payload: number; tat: number; range: number;
}
const CE_ML:      ChoiceElasticities = { tco: 13.5,     price: 13.25, payload: 10.75, tat: 8.25, range: 11.25 };    // B1-B3 Market Load
const CE_PARCEL:  ChoiceElasticities = { tco: 13.03125, price: 8.625, payload: 7.5,   tat: 8.25, range: 12.84375 }; // B4-B6 Parcel/FMCG/Perishables
const CE_TIPPER:  ChoiceElasticities = { tco: 13.5,     price: 13.5,  payload: 8.5,   tat: 10.5, range: 12 };       // B7-B8 Construction & Mining
const CE_CEMENT:  ChoiceElasticities = { tco: 13.5,     price: 13.2,  payload: 10.8,  tat: 8.1,  range: 12 };       // B9-B10 Cement
const CE_STEEL:   ChoiceElasticities = { tco: 12.9,     price: 11.7,  payload: 8.7,   tat: 5.7,  range: 8.7 };      // B11 Steel & metal
const CE_TANKER:  ChoiceElasticities = { tco: 13,       price: 12.5,  payload: 13,    tat: 3.5,  range: 7 };        // B12-B14 Tankers
export const BUCKET_CHOICE_ELASTICITIES: Record<string, ChoiceElasticities> = {
  B1: CE_ML, B2: CE_ML, B3: CE_ML,
  B4: CE_PARCEL, B5: CE_PARCEL, B6: CE_PARCEL,
  B7: CE_TIPPER, B8: CE_TIPPER,
  B9: CE_CEMENT, B10: CE_CEMENT,
  B11: CE_STEEL,
  B12: CE_TANKER, B13: CE_TANKER, B14: CE_TANKER,
};

// Rated payloads per bucket (Excel B-sheet rows 17-19). Diesel/CNG/LNG/H2-ICE
// share the diesel payload; only BET and FCET carry a payload penalty.
export const BUCKET_PAYLOADS: Record<string, { diesel: number; bet: number; fcet: number }> = {
  B1:  { diesel: 10500, bet: 8900,  fcet: 9600 },
  B2:  { diesel: 19000, bet: 17000, fcet: 18100 },
  B3:  { diesel: 35000, bet: 32200, fcet: 33900 },
  B4:  { diesel: 10500, bet: 8900,  fcet: 9600 },
  B5:  { diesel: 18500, bet: 16500, fcet: 17600 },
  B6:  { diesel: 9500,  bet: 7900,  fcet: 8600 },
  B7:  { diesel: 14500, bet: 12500, fcet: 13600 },
  B8:  { diesel: 20000, bet: 17600, fcet: 19100 },
  B9:  { diesel: 35000, bet: 32200, fcet: 33900 },
  B10: { diesel: 39500, bet: 37100, fcet: 38400 },
  B11: { diesel: 40000, bet: 37600, fcet: 38900 },
  B12: { diesel: 18500, bet: 16500, fcet: 17600 },
  B13: { diesel: 18500, bet: 16500, fcet: 17600 },
  B14: { diesel: 20500, bet: 18100, fcet: 19600 },
};

// ===========================================================================
// CHOICE MODEL SHARE ADJUSTMENTS (Excel Estimation sheets, per bucket)
// Combined multiplier applied to the raw normalized PT shares, then the
// shares are renormalized — exactly as the Estimation sheets do:
//   2045: "Adjustment for delay in PT Start of Supply" × "Adjustment for Potential TIV"
//   2050: Start-of-Supply × "Adjustment for delay in PT Maturity" × Potential TIV
//   2055: "Adjustment for delay in Powertrain Maturity Year" (ZET-only sheet)
// Extracted as ratio (final-adjusted row ÷ raw PT-share row) per bucket.
// ===========================================================================
export const CHOICE_SHARE_ADJUSTMENT: Record<number, Record<string, Partial<Record<Powertrain, number>>>> = {
  2045: {
    B1:  { Diesel: 1, CNG: 0.9,      LNG: 0,        BET: 0.9,  'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B2:  { Diesel: 1, CNG: 0.9,      LNG: 0,        BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B3:  { Diesel: 1, CNG: 0.588669, LNG: 0.230586, BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B4:  { Diesel: 1, CNG: 0.9,      LNG: 0,        BET: 0.9,  'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B5:  { Diesel: 1, CNG: 0.591916, LNG: 0.256737, BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B6:  { Diesel: 1, CNG: 0.878329, LNG: 0.018059, BET: 0.9,  'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B7:  { Diesel: 1, CNG: 0.9,      LNG: 0,        BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B8:  { Diesel: 1, CNG: 0.631347, LNG: 0,        BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B9:  { Diesel: 1, CNG: 0.85,     LNG: 0,        BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B10: { Diesel: 1, CNG: 0,        LNG: 0.85,     BET: 0.9,  'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B11: { Diesel: 1, CNG: 0.043948, LNG: 0.806052, BET: 0.9,  'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B12: { Diesel: 1, CNG: 0.9,      LNG: 0,        BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B13: { Diesel: 1, CNG: 0.9,      LNG: 0,        BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
    B14: { Diesel: 1, CNG: 0.559505, LNG: 0.290495, BET: 0.85, 'H2-ICE': 0.55, 'H2-FCET': 0.35 },
  },
  2050: {
    B1:  { Diesel: 1, CNG: 0.736,    LNG: 0,        BET: 0.552, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B2:  { Diesel: 1, CNG: 0.736,    LNG: 0,        BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B3:  { Diesel: 1, CNG: 0.487372, LNG: 0.167394, BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B4:  { Diesel: 1, CNG: 0.736,    LNG: 0,        BET: 0.552, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B5:  { Diesel: 1, CNG: 0.484041, LNG: 0.186231, BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B6:  { Diesel: 1, CNG: 0.718333, LNG: 0.013058, BET: 0.552, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B7:  { Diesel: 1, CNG: 0.736,    LNG: 0,        BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B8:  { Diesel: 1, CNG: 0.522884, LNG: 0.139953, BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B9:  { Diesel: 1, CNG: 0.704,    LNG: 0,        BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B10: { Diesel: 1, CNG: 0,        LNG: 0.5984,   BET: 0.552, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B11: { Diesel: 1, CNG: 0.036333, LNG: 0.567517, BET: 0.552, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B12: { Diesel: 1, CNG: 0.736,    LNG: 0,        BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B13: { Diesel: 1, CNG: 0.736,    LNG: 0,        BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
    B14: { Diesel: 1, CNG: 0.462884, LNG: 0.204949, BET: 0.528, 'H2-ICE': 0.2048, 'H2-FCET': 0.096 },
  },
  // 2055 ('Estimation 100% ZET 2055'): same maturity multiplier for all buckets
  2055: Object.fromEntries(
    ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12','B13','B14'].map(b => [
      b, { BET: 1, 'H2-ICE': 0.65, 'H2-FCET': 0.5 },
    ]),
  ),
};

// ===========================================================================
// CHOICE MODEL — elasticities & weightings (Excel 'Input Sheet' rows 8-12, col D & E)
// Final exponent multiplier in factor formula = elasticity × weighting / E2
// where E2 = 1.5 (the global weighting denominator)
// ===========================================================================
export const CHOICE_FACTORS = {
  TCO:                { elasticity: 9.0,  weighting: 10 },
  vehiclePrice:       { elasticity: 8.83, weighting: 9  },
  ratedPayload:       { elasticity: 7.17, weighting: 6  },
  tatGradeability:    { elasticity: 5.5,  weighting: 3  },
  rangeFillingTime:   { elasticity: 7.5,  weighting: 8  },
};
export const CHOICE_WEIGHT_DENOMINATOR = 1.5; // Excel cell E2/F2

// Relative powertrain ratings for the non-TCO non-Price factors (Excel 'No change with year' D52, D53)
// Applied as the "value" in the EXP(elasticity * weighting * (base/value - 1)) formula
export const POWERTRAIN_RATINGS = {
  // Ratings used as DENOMINATORS in the factor formula (Diesel = 1.0 baseline)
  tatGradeability: { 'Diesel': 1.0, 'CNG': 0.95, 'LNG': 0.95, 'BET': 1.15, 'H2-ICE': 0.95, 'H2-FCET': 1.15 },
  rangeFillingTime:{ 'Diesel': 1.0, 'CNG': 1.05, 'LNG': 1.10, 'BET': 1.20, 'H2-ICE': 1.0,  'H2-FCET': 1.0  },
} as const;

// ===========================================================================
// LOAN, INSURANCE, USEFUL LIFE
// ===========================================================================
export const FINANCE = {
  diesel_cng_lng_h2ice_interest_pa_default: 0.12,
  zet_interest_pa_default: 0.12,        // BEST scenario can lower to 0.10
  loan_tenure_years: 7,
  insurance_rate_per_year: 0.02,        // 2% of vehicle price/year
  useful_life_years: 7,
};

// Battery & fuel-cell life
export const TECH_SPECS = {
  battery_life_cycles: 3000,
  fuel_cell_life_hours: 25000,
  battery_energy_density_kg_per_kwh: 8,
  fuel_cell_power_density_kg_per_kw: 4,
  adblue_consumption_l_per_l_diesel: 0.05,
};

// CNG/LNG/H2 tank physical sizes (used to compute tank cost contribution)
export const TANK_SIZES = {
  cng_small_ltrs: 480,  cng_large_ltrs: 960,  cng_density_kg_per_l: 0.20,
  lng_small_ltrs: 450,  lng_large_ltrs: 990,  lng_density_kg_per_l: 0.35,
  h2_small_ltrs:  1200, h2_large_ltrs:  2400, h2_density_kg_per_m3_at_350bar: 23.5,
};

// ===========================================================================
// OEM MARGIN SCHEDULE for BET (multiplier applied to e-powertrain + battery cost)
// Higher = OEM keeps more margin, less cost-passed-through to buyer in early years
// Source: 'No change with year' row 34
// ===========================================================================
// ===========================================================================
// PER-BUCKET OPEX CALIBRATION (Excel B1-B14 TCO sheets, label-matched rows)
// maintBET/maintFCET are 4-point knots at [2025, 2045, 2050, 2055]
// (₹/km incl. tyres + battery replacement); Excel's post-2045 growth is
// steeper than the 2025-45 CAGR, hence the extra knots. The rest are
// [value@2025, value@2045] pairs whose implied CAGR also extends past 2045:
//   tollPerYear : ₹/vehicle/year (same for all powertrains)
//   manpowerIce : ₹/vehicle/year, Diesel/CNG/LNG/H2-ICE crews
//   manpowerZet : ₹/vehicle/year, BET/H2-FCET crews
// ===========================================================================
export const BUCKET_OPEX_CALIBRATION: Record<string, {
  maintBET: [number, number, number, number];
  maintFCET: [number, number, number, number];
  tollPerYear: [number, number];
  manpowerIce: [number, number];
  manpowerZet: [number, number];
  /** Excel quirk: B7's CNG block escalates manpower on B8's rate (row 87). */
  manpowerCng?: [number, number];
}> = {
  B1:  { maintBET: [5.122, 6.640, 7.526, 8.828],    maintFCET: [5.765, 7.080, 7.944, 9.268],    tollPerYear: [572400, 698436.78],   manpowerIce: [400000, 971000],  manpowerZet: [460000, 1113000] },
  B2:  { maintBET: [7.178, 9.916, 11.362, 13.408],  maintFCET: [7.220, 9.945, 11.390, 13.437],  tollPerYear: [693000, 845591.70],   manpowerIce: [450000, 1083000], manpowerZet: [510000, 1231000] },
  B3:  { maintBET: [11.471, 17.887, 20.887, 24.893],maintFCET: [11.878, 18.166, 21.152, 25.172],tollPerYear: [972000, 1186024.72],  manpowerIce: [600000, 1447000], manpowerZet: [660000, 1590000] },
  B4:  { maintBET: [5.322, 6.777, 7.656, 8.965],    maintFCET: [5.997, 7.239, 8.095, 9.426],    tollPerYear: [572400, 698436.78],   manpowerIce: [400000, 971000],  manpowerZet: [460000, 1113000] },
  B5:  { maintBET: [6.923, 9.741, 11.196, 13.234],  maintFCET: [7.037, 9.819, 11.270, 13.311],  tollPerYear: [756000, 922463.67],   manpowerIce: [450000, 1083000], manpowerZet: [510000, 1231000] },
  B6:  { maintBET: [5.198, 7.144, 8.180, 9.648],    maintFCET: [5.805, 7.560, 8.575, 10.063],   tollPerYear: [636000, 776040.87],   manpowerIce: [400000, 971000],  manpowerZet: [460000, 1113000] },
  B7:  { maintBET: [10.168, 15.579, 18.145, 21.596],maintFCET: [11.121, 16.231, 18.765, 22.248],tollPerYear: [666400, 813134.64],   manpowerIce: [450000, 1083000], manpowerZet: [510000, 1231000], manpowerCng: [450000, 1211000] },
  B8:  { maintBET: [12.773, 20.586, 24.152, 28.855],maintFCET: [13.338, 20.973, 24.520, 29.242],tollPerYear: [571200, 696972.55],   manpowerIce: [500000, 1211000], manpowerZet: [560000, 1350000] },
  B9:  { maintBET: [11.339, 17.796, 20.801, 24.803],maintFCET: [11.842, 18.141, 21.128, 25.147],tollPerYear: [1036800, 1265093.03], manpowerIce: [600000, 1447000], manpowerZet: [660000, 1590000] },
  B10: { maintBET: [10.064, 15.477, 18.036, 21.473],maintFCET: [10.948, 16.082, 18.612, 22.078],tollPerYear: [972000, 1186024.72],  manpowerIce: [600000, 1447000], manpowerZet: [660000, 1590000] },
  B11: { maintBET: [12.284, 19.709, 23.109, 27.599],maintFCET: [12.979, 20.184, 23.561, 28.074],tollPerYear: [864000, 1054244.20],  manpowerIce: [600000, 1447000], manpowerZet: [660000, 1590000] },
  B12: { maintBET: [6.435, 8.473, 9.630, 11.313],   maintFCET: [7.270, 9.045, 10.173, 11.885],  tollPerYear: [525000, 640599.77],   manpowerIce: [450000, 1083000], manpowerZet: [510000, 1231000] },
  B13: { maintBET: [6.455, 8.487, 9.643, 11.327],   maintFCET: [6.870, 8.771, 9.913, 11.611],   tollPerYear: [630000, 768719.73],   manpowerIce: [450000, 1083000], manpowerZet: [510000, 1231000] },
  B14: { maintBET: [8.037, 10.896, 12.446, 14.661], maintFCET: [9.042, 11.584, 13.100, 15.349], tollPerYear: [540000, 658902.62],   manpowerIce: [600000, 1447000], manpowerZet: [660000, 1590000] },
};

export const BET_OEM_MARGIN_BY_YEAR: Record<number, number> = (() => {
  const m: Record<number, number> = {};
  for (let y = 2025; y <= 2027; y++) m[y] = 0.50;
  m[2028] = 0.45;
  m[2029] = 0.40;
  m[2030] = 0.35;
  for (let y = 2031; y <= 2040; y++) m[y] = 0.30;
  for (let y = 2041; y <= 2055; y++) m[y] = 0.25;
  return m;
})();

// H2-FCET OEM margin — 'Changing with year' row 141:
// 0.40 → 2040, 0.35 2041-45, 0.30 2046-50, 0.25 2051+
export const FCET_OEM_MARGIN_BY_YEAR: Record<number, number> = (() => {
  const m: Record<number, number> = {};
  for (let y = 2025; y <= 2040; y++) m[y] = 0.40;
  for (let y = 2041; y <= 2045; y++) m[y] = 0.35;
  for (let y = 2046; y <= 2050; y++) m[y] = 0.30;
  for (let y = 2051; y <= 2055; y++) m[y] = 0.25;
  return m;
})();

// ===========================================================================
// TIV (Total Industry Volume) per year — all heavy trucks combined
// Source: 'AnnualSalesSummary Revised' row 75. Pre-2025 values are
// historical, used for stock evolution. From 2025+ used to compute
// annual sales by powertrain.
// ===========================================================================
export const HISTORICAL_SALES: Record<number, number> = {
  2001: 33256,  2002: 38380,  2003: 43757,  2004: 49997,  2005: 56999,
  2006: 61186,  2007: 64659,  2008: 70360,  2009: 78121,  2010: 85868,
  2011: 93708,  2012: 102292, 2013: 111304, 2014: 120475, 2015: 158398,
  2016: 214258, 2017: 211032, 2018: 247608, 2019: 274768, 2020: 143237,
  2021: 125404, 2022: 193951, 2023: 274193, 2024: 267078,
};

export const TIV_PROJECTION: Record<number, number> = {
  2025: 267370, 2026: 301120, 2027: 306590, 2028: 311550, 2029: 340650,
  2030: 349950, 2031: 357130, 2032: 393810, 2033: 419910, 2034: 435110,
  2035: 459480, 2036: 480610, 2037: 500010, 2038: 520490, 2039: 544970,
  2040: 570540, 2041: 599070, 2042: 627500, 2043: 654020, 2044: 679990,
  2045: 707250, 2046: 734040, 2047: 762490, 2048: 775820, 2049: 799700,
  2050: 853510, 2051: 887890, 2052: 922960, 2053: 958330, 2054: 993980,
  2055: 1029830,
};

// Pre-2025 stock baseline — used as starting diesel stock at end of 2024
export const DIESEL_STOCK_END_2024 = 5193503;

// 20-year scrappage policy — vehicles 20+ years old retire each year
export const SCRAPPAGE_AGE_YEARS = 20;

// Pre-2001 backlog — flat 125,000/year diesel scrappage until backlog clears
export const PRE_2001_DIESEL_SCRAPPAGE_PER_YEAR = 125000;
export const PRE_2001_SCRAPPAGE_END_YEAR = 2040; // approximate — backlog cleared by ~2040

// ===========================================================================
// GOMPERTZ / WEIBULL PARAMETERS
// Start year per powertrain × vehicle size — when supply begins
// Source: 'No change with year' rows 65-73, cols J-O
// ===========================================================================
export const START_OF_SUPPLY: Record<VehicleSize, Record<Powertrain, number>> = {
  '15T Rigid':   { Diesel: 2025, CNG: 2027, LNG: 2030, BET: 2027, 'H2-ICE': 2036, 'H2-FCET': 2040 },
  '19T Rigid':   { Diesel: 2025, CNG: 2027, LNG: 2030, BET: 2027, 'H2-ICE': 2036, 'H2-FCET': 2040 },
  '28T Rigid':   { Diesel: 2025, CNG: 2027, LNG: 2030, BET: 2028, 'H2-ICE': 2036, 'H2-FCET': 2040 },
  '35T Rigid':   { Diesel: 2025, CNG: 2028, LNG: 2030, BET: 2028, 'H2-ICE': 2036, 'H2-FCET': 2040 },
  '48T Rigid':   { Diesel: 2025, CNG: 2028, LNG: 2030, BET: 2028, 'H2-ICE': 2036, 'H2-FCET': 2040 },
  '28T Tipper':  { Diesel: 2025, CNG: 2027, LNG: 2030, BET: 2028, 'H2-ICE': 2036, 'H2-FCET': 2040 },
  '35T Tipper':  { Diesel: 2025, CNG: 2028, LNG: 2030, BET: 2028, 'H2-ICE': 2036, 'H2-FCET': 2040 },
  '40T Tractor': { Diesel: 2025, CNG: 2028, LNG: 2028, BET: 2028, 'H2-ICE': 2036, 'H2-FCET': 2040 },
  '55T Tractor': { Diesel: 2025, CNG: 2028, LNG: 2028, BET: 2027, 'H2-ICE': 2036, 'H2-FCET': 2040 },
};

// Gompertz initial pilot share W (very small — represents 2025 sales as fraction of total)
export const PTTM_PILOT_SHARE = {
  BET: 0.0009052,    // ~0.09% of TIV in 2025
  'H2-ICE': 0.0001,
  'H2-FCET': 0.0001,
};

// Weibull shape parameter for CNG/LNG (already past inflection)
export const WEIBULL_SHAPE_ALPHA = 5;
export const WEIBULL_PEAK_YEAR = 2045;

// 2025 known volumes (calibration anchors for Weibull) — Turn 3b: exact from
// Output Summary row 29 (2025), cols J and L of CoEZET_PTCM_v3.xlsx.
export const CNG_UNITS_2025 = 11875;
export const LNG_UNITS_2025 = 368;

// Gompertz pilot/start year per powertrain (v3 PTTM col S, rows 2-4).
// Kept for backwards reference — Gompertz loop now reads from GOMPERTZ_PARAMS_BY_PT.
export const PTTM_PILOT_START_YEAR = {
  BET: 2025,
  'H2-ICE': 2028,
  'H2-FCET': 2030,
} as const;

// v3 PTTM rows 2-4, cols T (saturation a), V (initial pilot share W),
// W (displacement b), X (growth rate c). GLOBAL — not per-bucket (PTTM sheet
// has exactly one parameter row per Gompertz powertrain).
export const GOMPERTZ_PARAMS_BY_PT = {
  BET:       { a: 1.0382, b: 7.5299, c: 0.12560, W: 0.0005572, startYear: 2025 },
  'H2-ICE':  { a: 0.0659, b: 6.4914, c: 0.09171, W: 0.0001,    startYear: 2028 },
  'H2-FCET': { a: 0.0616, b: 6.4228, c: 0.10427, W: 0.0001,    startYear: 2030 },
} as const;

// ===========================================================================
// SCENARIO PRESET INFLECTION YEARS (10% share year per powertrain)
// Source: 'Scenarios' sheet rows 20-21 + 'No change with year' V65/W65/X65
// ===========================================================================
export type ScenarioName = 'BAU' | 'BWS-1' | 'BWS-2' | 'BEST';

export const SCENARIO_INFLECTION_YEARS: Record<ScenarioName, {
  BET: number; 'H2-ICE': number; 'H2-FCET': number;
}> = {
  'BAU':   { BET: 2031, 'H2-ICE': 2051, 'H2-FCET': 2051 },
  'BWS-1': { BET: 2036, 'H2-ICE': 2049, 'H2-FCET': 2049 },
  'BWS-2': { BET: 2036, 'H2-ICE': 2049, 'H2-FCET': 2049 },
  'BEST':  { BET: 2032, 'H2-ICE': 2049, 'H2-FCET': 2049 },
};

export const SCENARIO_MATURITY_YEARS: Record<ScenarioName, {
  BET: number; 'H2-ICE': number; 'H2-FCET': number;
}> = {
  'BAU':   { BET: 2035, 'H2-ICE': 2042, 'H2-FCET': 2045 },
  'BWS-1': { BET: 2035, 'H2-ICE': 2042, 'H2-FCET': 2045 },
  'BWS-2': { BET: 2035, 'H2-ICE': 2042, 'H2-FCET': 2045 },
  'BEST':  { BET: 2033, 'H2-ICE': 2040, 'H2-FCET': 2045 },
};

// ===========================================================================
// BAU DEFAULT SCENARIO CONFIG — drop-in for ScenarioConfig.parameters
// All deltas are decimal (0.025 = 2.5% per year)
// ===========================================================================
// BAU defaults — natively encoded in the v4 6-range CAGR shape.
// Category A: CAGRs computed directly from CoEZET_PTCM_v4.xlsx 'Changing with year'
//   at each range endpoint: cagr = (V_end / V_start)^(1/years) - 1.
// Category B (// FLAG): v3 fallback values spread across the 6 ranges
//   (v3 d2630 → d2530, v3 d3140 → d3135 & d3640, v3 d4150 → d4145 & d4650, v3 d5155 → d5155).
//   These params aren't user-editable in the v4 Dashboard spec; re-extract from v4 later.
export const BAU_PARAMETERS = {
  // Category A — native v4 6-range
  diesel_price_per_l:            { baseValue: 88.9263, d2530:  0.0380, d3135:  0.0200, d3640:  0.0200, d4145:  0.0200, d4650:  0.0200, d5155:  0.0200 },
  cng_price_per_kg:              { baseValue: 87,      d2530:  0.0343, d3135:  0.0300, d3640:  0.0300, d4145:  0.0300, d4650:  0.0300, d5155:  0.0300 },
  lng_price_per_kg:              { baseValue: 83,      d2530:  0.0312, d3135:  0.0300, d3640:  0.0300, d4145:  0.0300, d4650:  0.0300, d5155:  0.0300 },
  electricity_incl_caas_per_kwh: { baseValue: 11.9298, d2530:  0.0031, d3135: -0.0546, d3640: -0.0097, d4145:  0.0026, d4650:  0.0057, d5155:  0.0313 },
  green_h2_production_per_kg:    { baseValue: 546.50,  d2530:  0.0020, d3135: -0.0409, d3640: -0.0344, d4145: -0.0403, d4650: -0.0264, d5155:  0.0021 },
  h2_compression_storage_per_kg: { baseValue: 175,     d2530: -0.0400, d3135: -0.0300, d3640: -0.0300, d4145: -0.0300, d4650: -0.0300, d5155: -0.0200 },
  battery_cost_per_kwh:          { baseValue: 9900,    d2530: -0.0150, d3135: -0.0250, d3640: -0.0250, d4145: -0.0100, d4650: -0.0100, d5155:  0.0100 },
  fuel_cell_cost_per_kw:         { baseValue: 36000,   d2530: -0.0300, d3135: -0.0300, d3640: -0.0300, d4145: -0.0200, d4650: -0.0200, d5155:  0.0100 },
  adblue_per_l:                  { baseValue: 55,      d2530:  0.0250, d3135:  0.0250, d3640:  0.0250, d4145:  0.0250, d4650:  0.0250, d5155:  0.0250 },
  grey_h2_production_per_kg:     { baseValue: 250,     d2530:  0.0200, d3135:  0.0200, d3640:  0.0200, d4145:  0.0200, d4650:  0.0200, d5155:  0.0200 },
  discom_electricity_per_kwh:    { baseValue: 7.50,    d2530:  0.0200, d3135: -0.0200, d3640: -0.0200, d4145: -0.0100, d4650: -0.0100, d5155:  0.0250 },
  fixed_demand_charges_per_kwh:  { baseValue: 2.3964,  d2530: -0.0882, d3135: -0.1005, d3640:  0.0000, d4145:  0.0032, d4650:  0.0000, d5155: -0.0032 },
  charging_infra_per_kwh:        { baseValue: 2.0334,  d2530:  0.0273, d3135: -0.1971, d3640:  0.0645, d4145:  0.0709, d4650:  0.0669, d5155:  0.0620 },
  green_h2_electricity_per_kg:   { baseValue: 291.50,  d2530:  0.0269, d3135: -0.0380, d3640: -0.0277, d4145: -0.0349, d4650: -0.0146, d5155:  0.0221 },
  green_h2_capex_per_kg:         { baseValue: 115,     d2530: -0.0300, d3135: -0.0400, d3640: -0.0400, d4145: -0.0500, d4650: -0.0500, d5155: -0.0500 },
  green_h2_opex_margin_per_kg:   { baseValue: 140,     d2530: -0.0300, d3135: -0.0500, d3640: -0.0500, d4145: -0.0500, d4650: -0.0500, d5155: -0.0500 },
  grey_h2_blend_fraction:        { baseValue: 0,       d2530:  0,      d3135:  0,      d3640:  0,      d4145:  0,      d4650:  0,      d5155:  0      },

  // Category B — FLAG: v3 fallback; re-extract from v4 'Changing with year' in a later round.
  electricity_per_kwh:           { baseValue: 18,      d2530:  0,      d3135:  0,      d3640: -0.02,   d4145: -0.02,   d4650: -0.02,   d5155: -0.01   }, // FLAG: v3 fallback (superseded by electricity_incl_caas_per_kwh in v4)
  lng_tank_cost_per_kg:          { baseValue: 3050,    d2530:  0.0100, d3135:  0.0100, d3640:  0.0100, d4145:  0.0100, d4650:  0.0100, d5155:  0.0100 }, // FLAG: v3 fallback — re-extract from v4 LNG tank row
  lng_valves_piping_per_vehicle: { baseValue: 100000,  d2530:  0.0100, d3135:  0.0100, d3640:  0.0100, d4145:  0.0100, d4650:  0.0100, d5155:  0.0100 }, // FLAG: v3 fallback
  h2_tank_cost_per_kg:           { baseValue: 56000,   d2530: -0.0500, d3135: -0.0400, d3640: -0.0400, d4145:  0.0100, d4650:  0.0100, d5155:  0.0100 }, // FLAG: v3 fallback — re-extract from v4 H2 tank row
  diesel_vehicle_growth:         { baseValue: 0,       d2530:  0.0300, d3135:  0.0300, d3640:  0.0300, d4145:  0.0300, d4650:  0.0300, d5155:  0.0300 }, // FLAG: v3 fallback
  engine_trans_growth:           { baseValue: 0,       d2530:  0.0200, d3135:  0.0200, d3640:  0.0200, d4145:  0.0200, d4650:  0.0200, d5155:  0.0200 }, // FLAG: v3 fallback
  e_powertrain_growth:           { baseValue: 0,       d2530: -0.0400, d3135: -0.0100, d3640: -0.0100, d4145:  0.0100, d4650:  0.0100, d5155:  0.0100 }, // FLAG: v3 fallback
} satisfies Record<string, import('@/lib/types').ParameterConfig>;

// BAU fixed (non-trajectory) parameters
export const BAU_FIXED = {
  interest_rate_ice: 0.12,
  loan_tenure_years_nonzet: 7,
  insurance_rate_per_year: 0.02,
  adblue_consumption_l_per_l_diesel: 0.05,
  battery_energy_density_kg_per_kwh: 8,
  fuel_cell_power_density_kg_per_kw: 4,
  tat_gradeability: {
    'Diesel': 1.0, 'CNG': 0.95, 'LNG': 0.95, 'BET': 1.15, 'H2-ICE': 0.95, 'H2-FCET': 1.15,
  },
  range_filling_time: {
    'Diesel': 1.0, 'CNG': 1.05, 'LNG': 1.10, 'BET': 1.20, 'H2-ICE': 1.0, 'H2-FCET': 1.0,
  },
};

// BAU per-segment vehicle base prices (mirrors VEHICLE_BASE_PRICES_2025, editable)
export const BAU_SEGMENT_BASE_PRICES = { ...VEHICLE_BASE_PRICES_2025 };

// BAU policy levers
export const BAU_POLICY = {
  bet_demand_incentive_per_kwh: 0,
  fcet_demand_incentive_per_kwh: 0,
  interest_rate_zet: 0.12,
  loan_tenure_years: 7,
  electricity_subsidy_per_kwh: 0,
  toll_waiver_pct_first_5y: 0,
  toll_waiver_pct_next_5y: 0,
  bet_inflection_year: 2031,
  h2ice_inflection_year: 2051,
  fcet_inflection_year: 2051,
  h2_source_mix: 'green_only' as const,
  // 0 = no override; tier-2 resale comes from RESALE_VALUES per profile
  // (Excel BAU: 0.40 general / 0.35 high-duty / 0.25 tipper)
  bet_resale_2046_plus: 0,
  diesel_price_5pct_yoy_after_2045: false,
  // New fields
  bet_incentive_phase1_end_year: 2030,
  bet_demand_incentive_phase2_per_kwh: 0,
  bet_incentive_phase2_end_year: 2035,
  fcet_incentive_phase1_end_year: 2030,
  fcet_demand_incentive_phase2_per_kwh: 0,
  fcet_incentive_phase2_end_year: 2035,
  electricity_subsidy_end_year: 2035,
  toll_waiver_first_period_years: 5,
  toll_waiver_second_period_years: 5,
  bet_maturity_year: 2035,
  h2ice_maturity_year: 2042,
  fcet_maturity_year: 2045,
  range_filling_concern_after_2035: true,
  gvw_payload_compensation_t: 0,
};

// BEST scenario overrides (apply on top of BAU)
export const BEST_OVERRIDES = {
  parameters: {
    green_h2_production_per_kg:   { baseValue: 600,   d2530: -0.04,   d3135: -0.035, d3640: -0.035, d4145: -0.03,  d4650: -0.03,  d5155: -0.03 },
    h2_compression_storage_per_kg:{ baseValue: 175,   d2530: -0.04,   d3135: -0.03,  d3640: -0.03,  d4145: -0.03,  d4650: -0.03,  d5155: -0.02 },
    diesel_price_per_l:           { baseValue: 88.93, d2530: 0.0208,  d3135: 0.0208, d3640: 0.0208, d4145: 0.0208, d4650: 0.0208, d5155: 0.05 }, // +5% YoY after 2045
  },
  policy: {
    bet_demand_incentive_per_kwh: 10000, // until 2030, then 5000 till 2035
    fcet_demand_incentive_per_kwh: 30000,
    interest_rate_zet: 0.10,
    electricity_subsidy_per_kwh: 2,
    toll_waiver_pct_first_5y: 1.0,
    toll_waiver_pct_next_5y: 0.5,
    bet_inflection_year: 2032,
    bet_resale_2046_plus: 0.45,
  },
};

// ===========================================================================
// EMISSION FACTORS (Well-to-Wheel kgCO2e) — source: 'Emissions' sheet rows 2-7
// Each is WTT + TTW (Excel col D = SUM(WTT, TTW)):
//   Diesel 0.53 + 2.6 = 3.13 | CNG 0.4505 + 2.21 = 2.66 | LNG 0.4876 + 2.392 = 2.88
// BET uses a year-varying grid factor (Excel 'Emissions' R49): 0.7455 in 2025
// declining 3%/yr (grid decarbonisation) to 0.299 in 2055 — see betGridFactor().
// ===========================================================================
export const EMISSION_FACTORS = {
  diesel_kgCO2e_per_l:        3.13,  // 0.53 WTT + 2.6 TTW
  cng_kgCO2e_per_kg:          2.66,  // 0.4505 WTT + 2.21 TTW
  lng_kgCO2e_per_kg:          2.88,  // 0.4876 WTT + 2.392 TTW
  bet_grid_kgCO2e_per_kwh_2025: 0.7455,
  grid_decarb_rate_per_year:    0.03,
  h2ice_green_kgCO2e_per_km:  0.07,
  h2fcet_green_kgCO2e_per_km: 0.07,
};

/** BET grid CO2 factor (kgCO2e/kWh) for a year — Excel 'Emissions' R49. */
export function betGridFactor(year: number): number {
  const dy = Math.max(0, year - 2025);
  return EMISSION_FACTORS.bet_grid_kgCO2e_per_kwh_2025
    * Math.pow(1 - EMISSION_FACTORS.grid_decarb_rate_per_year, dy);
}

// ===========================================================================
// TCO PARITY YEARS (precomputed in Excel 'Buckets' sheet cols O-T)
// Used directly for Chart F — the year when each powertrain reaches TCO
// parity with diesel for a given bucket and scenario.
// ===========================================================================
export const TCO_PARITY_YEARS = {
  scenario4_BEST: { // 'Buckets' cols R-T (Scenario 4)
    'B1':  { BET: 2039, 'H2-ICE': 2045, 'H2-FCET': 2047 },
    'B2':  { BET: 2040, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B3':  { BET: 2034, 'H2-ICE': 2044, 'H2-FCET': 2045 },
    'B4':  { BET: 2036, 'H2-ICE': 2045, 'H2-FCET': 2046 },
    'B5':  { BET: 2039, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B6':  { BET: 2039, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B7':  { BET: 2039, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B8':  { BET: 2035, 'H2-ICE': 2045, 'H2-FCET': 2044 },
    'B9':  { BET: 2035, 'H2-ICE': 2045, 'H2-FCET': 2044 },
    'B10': { BET: 2032, 'H2-ICE': 2045, 'H2-FCET': 2044 },
    'B11': { BET: 2032, 'H2-ICE': 2045, 'H2-FCET': 2044 },
    'B12': { BET: 2043, 'H2-ICE': 2045, 'H2-FCET': 2048 },
    'B13': { BET: 2040, 'H2-ICE': 2045, 'H2-FCET': 2046 },
    'B14': { BET: 2042, 'H2-ICE': 2045, 'H2-FCET': 2047 },
  },
  scenario1_BAU: { // 'Buckets' cols O-Q (Scenario 1)
    'B1':  { BET: 2027, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B2':  { BET: 2028, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B3':  { BET: 2026, 'H2-ICE': 2045, 'H2-FCET': 2043 },
    'B4':  { BET: 2026, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B5':  { BET: 2027, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B6':  { BET: 2027, 'H2-ICE': 2046, 'H2-FCET': 2045 },
    'B7':  { BET: 2027, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B8':  { BET: 2026, 'H2-ICE': 2046, 'H2-FCET': 2043 },
    'B9':  { BET: 2027, 'H2-ICE': 2045, 'H2-FCET': 2042 },
    'B10': { BET: 2026, 'H2-ICE': 2043, 'H2-FCET': 2043 },
    'B11': { BET: 2026, 'H2-ICE': 2045, 'H2-FCET': 2043 },
    'B12': { BET: 2029, 'H2-ICE': 2047, 'H2-FCET': 2046 },
    'B13': { BET: 2027, 'H2-ICE': 2045, 'H2-FCET': 2045 },
    'B14': { BET: 2028, 'H2-ICE': 2040, 'H2-FCET': 2042 },
  },
};

// ===========================================================================
// BASELINE SANITY-CHECK ASSERTIONS (for Phase 4.5)
// Run these after simulation; warn if any fail
// ===========================================================================
export const BAU_BASELINE_CHECKS = {
  total_sales_2025: { value: 267370, tolerance: 0.02 },
  total_sales_2045: { value: 707250, tolerance: 0.02 },
  total_sales_2055: { value: 1029830, tolerance: 0.02 },
  // Excel PTTM sheet (BAU): ZET share 79.35% in 2045, 100% in 2055
  zet_share_2045_min: 0.70,
  zet_share_2045_max: 0.90,
  zet_share_2055_min: 0.95,
  zet_share_2055_max: 1.0,
  diesel_2025_units_min: 240000,
  diesel_2025_units_max: 270000,
};

// ===========================================================================
// VEHICLE-SIZE → BUCKET reverse mapping (used when projecting prices per size)
// ===========================================================================
export const SIZE_TO_BUCKETS: Record<VehicleSize, string[]> = (() => {
  const m: Partial<Record<VehicleSize, string[]>> = {};
  for (const b of BUCKETS) {
    if (!m[b.size]) m[b.size] = [];
    m[b.size]!.push(b.id);
  }
  return m as Record<VehicleSize, string[]>;
})();
