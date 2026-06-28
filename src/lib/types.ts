import type { Powertrain, ScenarioName, VehicleSize } from './constants/extracted';

// ── Parameter config (cost trajectories) ──
// 6 CAGR ranges (v4 Dashboard spec): 2026-30, 2031-35, 2036-40, 2041-45, 2046-50, 2051-55
export interface ParameterConfig {
  baseValue: number;
  d2530: number;
  d3135: number;
  d3640: number;
  d4145: number;
  d4650: number;
  d5155: number;
  /** Per-year absolute-value overrides (2026–2055). Cleared when the CAGR for the containing range is edited. */
  overrides?: Record<number, number>;
}



export type ParameterKey =
  // Primary fuel/energy
  | 'diesel_price_per_l'
  | 'cng_price_per_kg'
  | 'lng_price_per_kg'
  | 'electricity_incl_caas_per_kwh'
  | 'green_h2_production_per_kg'
  | 'grey_h2_production_per_kg'
  // Existing other trajectories
  | 'h2_compression_storage_per_kg'
  | 'battery_cost_per_kwh'
  | 'fuel_cell_cost_per_kw'
  | 'lng_tank_cost_per_kg'
  | 'h2_tank_cost_per_kg'
  | 'adblue_per_l'
  | 'diesel_vehicle_growth'
  | 'engine_trans_growth'
  | 'e_powertrain_growth'
  | 'grey_h2_blend_fraction'
  | 'lng_valves_piping_per_vehicle';

// ── Fixed (non-year-varying) parameters ──
export interface FixedParameters {
  interest_rate_ice: number;
  insurance_rate_per_year: number;
  adblue_consumption_l_per_l_diesel: number;
  battery_energy_density_kg_per_kwh: number;
  fuel_cell_power_density_kg_per_kw: number;
  // Key Aggregate Life — Excel 'No change with year' D22/D23. Drives the
  // battery / fuel-cell replacement portion of BET/FCET maintenance (see
  // getMaintenancePerKm). Defaults: 3000 cycles, 25000 hrs.
  battery_life_cycles: number;
  fuel_cell_life_hours: number;
  tat_gradeability: Record<Powertrain, number>;
  range_filling_time: Record<Powertrain, number>;
  // v4 Dashboard: non-ZET funding tenure (rate already lives on interest_rate_ice).
  // Held in state for the input UI; engine still reads policy.loan_tenure_years for ZET.
  loan_tenure_years_nonzet?: number;
  // v4 Dashboard bucket-level maintenance trajectories (Pattern A per B1–B14).
  // Consumed by the sim engine via tco.ts getMaintenancePerKm (diesel/bet/fcet);
  // unedited buckets fall back to defaultMaintConfig (== Excel baseline).
  bucket_maintenance?: {
    diesel: Record<string, ParameterConfig>;
    bet: Record<string, ParameterConfig>;
    fcet: Record<string, ParameterConfig>;
  };
}

// ── Per-segment vehicle base prices (2026 INR) ──
export interface SegmentBasePrice {
  engine_trans: number;
  e_powertrain: number;
  diesel_total: number;
}
export type SegmentBasePrices = Record<VehicleSize, SegmentBasePrice>;

export type H2SourceMix = 'green_only' | 'blend_2046_green' | 'cheapest';

// Input style for the grey/green blend: a single uniform % vs per-5-year-band.
export type H2BlendMode = 'uniform' | 'bands';

// ── Policy levers ──
export interface PolicyConfig {
  bet_demand_incentive_per_kwh: number;
  fcet_demand_incentive_per_kwh: number;
  interest_rate_zet: number;
  loan_tenure_years: number;
  electricity_subsidy_per_kwh: number;
  toll_waiver_pct_first_5y: number;
  toll_waiver_pct_next_5y: number;
  bet_inflection_year: number;
  h2ice_inflection_year: number;
  fcet_inflection_year: number;
  h2_source_mix: H2SourceMix;
  // How the grey/green blend is entered when h2_source_mix is the blend option:
  // 'uniform' = a single grey % across 2026–2045; 'bands' = per-5-year-band.
  grey_h2_blend_mode: H2BlendMode;
  // Single grey-hydrogen fraction (0–1) applied 2026–2045, used when
  // grey_h2_blend_mode === 'uniform'.
  grey_h2_blend_uniform: number;
  // Grey-hydrogen blend fraction (0–1) per 5-year band, used when
  // grey_h2_blend_mode === 'bands'. Keyed by the period keys d2530…d5155.
  grey_h2_blend_bands: Record<string, number>;
  bet_resale_2046_plus: number;
  diesel_price_5pct_yoy_after_2045: boolean;
  // Phase 2 incentive fields
  bet_incentive_phase1_end_year: number;
  bet_demand_incentive_phase2_per_kwh: number;
  bet_incentive_phase2_end_year: number;
  fcet_incentive_phase1_end_year: number;
  fcet_demand_incentive_phase2_per_kwh: number;
  fcet_incentive_phase2_end_year: number;
  electricity_subsidy_end_year: number;
  toll_waiver_first_period_years: number;
  toll_waiver_second_period_years: number;
  // Maturity years
  bet_maturity_year: number;
  h2ice_maturity_year: number;
  fcet_maturity_year: number;
  // Additional flags
  range_filling_concern_after_2035: boolean;
  gvw_payload_compensation_t: number;
  // Policy support — additional GVW (kg) granted to ZETs (BET/FCET) per size
  // class, keyed by the display label (e.g. '19T Rigid'). Raises rated payload.
  // Excel 'No change with year' AT/AU ("GVW Increase for BETs/FCETs").
  zet_additional_gvw_kg: Record<string, number>;
}

// ── Full scenario config ──
export interface ScenarioConfig {
  parameters: Record<ParameterKey, ParameterConfig>;
  policy: PolicyConfig;
  fixed: FixedParameters;
  segmentBasePrices: SegmentBasePrices;
}

// ── Simulation output ──
export interface AnnualResult {
  year: number;
  tiv: number;
  salesByPT: Record<Powertrain, number>;
  shareByPT: Record<Powertrain, number>;
  stockByPT: Record<Powertrain, number>;
  emissionsByPT: Record<Powertrain, number>;
  totalEmissions: number;
  dieselCounterfactualEmissions: number;
  zetShare: number;
  // Annual energy requirement by powertrain in native units:
  // Diesel = million litres, BET = TWh, CNG/LNG/H2-ICE/H2-FCET = million kg.
  energyByPT: Record<Powertrain, number>;
  // Diesel (million litres) the whole fleet would burn if it had stayed all-diesel.
  dieselCounterfactualLitres: number;
  // Segment / Application breakdowns (aggregated across powertrains)
  salesBySegment: Record<string, number>;
  stockBySegment: Record<string, number>;
  salesByApplication: Record<string, number>;
  stockByApplication: Record<string, number>;
  // Same breakdowns split by powertrain. For each powertrain, the per-band
  // values sum (across powertrains) to the aggregated fields above.
  salesBySegmentPT: Record<Powertrain, Record<string, number>>;
  stockBySegmentPT: Record<Powertrain, Record<string, number>>;
  salesByApplicationPT: Record<Powertrain, Record<string, number>>;
  stockByApplicationPT: Record<Powertrain, Record<string, number>>;
}

export interface SimulationResult {
  years: AnnualResult[];
  totalZetSales: number;
  year50PctZet: number | null;
  cumulativeCO2Avoided: number;
  dieselStockPeakYear: number;
  dieselStockPeakValue: number;
}

// ── Sanity check ──
export interface SanityCheckResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  message: string;
}

// ── DB row ──
export interface ScenarioRow {
  id: string;
  name: ScenarioName;
  description: string;
  config: Record<string, unknown>;
  created_at: string;
}
