import type { ParameterKey } from '../types';

export interface ParameterMeta {
  label: string;
  unit: string;
  tooltip: string;
  /** Absolute max on the 2025 base value. Undefined = no cap. */
  maxValue?: number;
}

export const PARAMETER_META: Record<ParameterKey, ParameterMeta> = {
  diesel_price_per_l:             { label: 'Diesel cost',            unit: '₹/L',   tooltip: 'Retail diesel cost at pump (2026 base)', maxValue: 500 },
  cng_price_per_kg:               { label: 'CNG cost',              unit: '₹/kg',  tooltip: 'Compressed natural gas retail cost', maxValue: 500 },
  lng_price_per_kg:               { label: 'LNG cost',              unit: '₹/kg',  tooltip: 'Liquefied natural gas retail cost', maxValue: 500 },
  green_h2_production_per_kg:     { label: 'Green Hydrogen production',    unit: '₹/kg',  tooltip: 'Green hydrogen production cost at plant gate', maxValue: 1500 },
  grey_h2_production_per_kg:      { label: 'Grey Hydrogen production',     unit: '₹/kg',  tooltip: 'Grey hydrogen (SMR) production cost' },
  h2_compression_storage_per_kg:  { label: 'Hydrogen compression & storage', unit: '₹/kg', tooltip: 'Hydrogen compression, storage & dispensing cost', maxValue: 500 },
  battery_cost_per_kwh:           { label: 'Battery pack cost',      unit: '₹/kWh', tooltip: 'Li-ion battery pack cost (cell + BMS + enclosure)', maxValue: 30000 },
  fuel_cell_cost_per_kw:          { label: 'Fuel cell cost',         unit: '₹/kW',  tooltip: 'PEM fuel cell stack cost per kW rated output', maxValue: 100000 },
  lng_tank_cost_per_kg:           { label: 'LNG tank cost',          unit: '₹/kg',  tooltip: 'Cryogenic LNG tank cost per kg capacity' },
  h2_tank_cost_per_kg:            { label: 'Hydrogen tank cost',           unit: '₹/kg',  tooltip: 'Type IV composite hydrogen tank cost per kg storage' },
  adblue_per_l:                   { label: 'AdBlue (DEF) cost',     unit: '₹/L',   tooltip: 'Diesel exhaust fluid cost (consumed ~5% of diesel volume)' },
  diesel_vehicle_growth:          { label: 'Diesel vehicle cost growth', unit: '%/yr', tooltip: 'Annual YoY cost growth for diesel vehicle platform' },
  engine_trans_growth:            { label: 'Engine+trans growth',    unit: '%/yr',  tooltip: 'Annual YoY cost growth for engine + transmission (ZET glider)' },
  e_powertrain_growth:            { label: 'E-powertrain growth',    unit: '%/yr',  tooltip: 'Annual YoY cost change for electric motor + electronics' },
  // v9 additions
  electricity_incl_caas_per_kwh:  { label: 'Electricity incl CAAS',  unit: '₹/kWh', tooltip: 'All-in electricity cost for BET charging incl. DISCOM + demand charges + charging infra (Excel R18)', maxValue: 100 },
  grey_h2_blend_fraction:         { label: 'Grey Hydrogen blend fraction', unit: '0-1',   tooltip: 'Fraction of grey hydrogen in the hydrogen supply blend (0 = 100% green)' },
  lng_valves_piping_per_vehicle:  { label: 'LNG valves & piping',    unit: '₹/veh', tooltip: 'Per-vehicle cost of LNG valves and piping system' },
};
