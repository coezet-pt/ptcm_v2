import type { ParameterKey } from '../types';

export interface ParameterMeta {
  label: string;
  unit: string;
  tooltip: string;
  /** Absolute max on the 2025 base value. Undefined = no cap. */
  maxValue?: number;
}

export const PARAMETER_META: Record<ParameterKey, ParameterMeta> = {
  diesel_price_per_l:             { label: 'Diesel price',            unit: '₹/L',   tooltip: 'Retail diesel price at pump (2025 base)', maxValue: 500 },
  cng_price_per_kg:               { label: 'CNG price',              unit: '₹/kg',  tooltip: 'Compressed natural gas retail price', maxValue: 500 },
  lng_price_per_kg:               { label: 'LNG price',              unit: '₹/kg',  tooltip: 'Liquefied natural gas retail price', maxValue: 500 },
  green_h2_production_per_kg:     { label: 'Green H₂ production',    unit: '₹/kg',  tooltip: 'Green hydrogen production cost at plant gate', maxValue: 1500 },
  grey_h2_production_per_kg:      { label: 'Grey H₂ production',     unit: '₹/kg',  tooltip: 'Grey hydrogen (SMR) production cost' },
  h2_compression_storage_per_kg:  { label: 'H₂ compression & storage', unit: '₹/kg', tooltip: 'Hydrogen compression, storage & dispensing cost', maxValue: 500 },
  electricity_per_kwh:            { label: 'Electricity price',      unit: '₹/kWh', tooltip: 'Commercial electricity tariff for BET charging' },
  battery_cost_per_kwh:           { label: 'Battery pack cost',      unit: '₹/kWh', tooltip: 'Li-ion battery pack cost (cell + BMS + enclosure)', maxValue: 30000 },
  fuel_cell_cost_per_kw:          { label: 'Fuel cell cost',         unit: '₹/kW',  tooltip: 'PEM fuel cell stack cost per kW rated output', maxValue: 100000 },
  lng_tank_cost_per_kg:           { label: 'LNG tank cost',          unit: '₹/kg',  tooltip: 'Cryogenic LNG tank cost per kg capacity' },
  h2_tank_cost_per_kg:            { label: 'H₂ tank cost',           unit: '₹/kg',  tooltip: 'Type IV composite H₂ tank cost per kg storage' },
  adblue_per_l:                   { label: 'AdBlue (DEF) price',     unit: '₹/L',   tooltip: 'Diesel exhaust fluid price (consumed ~5% of diesel volume)' },
  diesel_vehicle_growth:          { label: 'Diesel vehicle price growth', unit: '%/yr', tooltip: 'Annual YoY price growth for diesel vehicle platform' },
  engine_trans_growth:            { label: 'Engine+trans growth',    unit: '%/yr',  tooltip: 'Annual YoY cost growth for engine + transmission (ZET glider)' },
  e_powertrain_growth:            { label: 'E-powertrain growth',    unit: '%/yr',  tooltip: 'Annual YoY cost change for electric motor + electronics' },
  // v9 additions
  electricity_incl_caas_per_kwh:  { label: 'Electricity incl CAAS',  unit: '₹/kWh', tooltip: 'All-in electricity cost for BET charging incl. DISCOM + demand charges + charging infra (Excel R18)', maxValue: 100 },
  discom_electricity_per_kwh:     { label: 'DISCOM electricity',     unit: '₹/kWh', tooltip: 'Commercial electricity tariff from DISCOM (component of Electricity incl CAAS)' },
  fixed_demand_charges_per_kwh:   { label: 'Fixed/Demand charges',   unit: '₹/kWh', tooltip: 'Fixed and demand-based charging fees per kWh' },
  charging_infra_per_kwh:         { label: 'Charging infra (land+capex+opex)', unit: '₹/kWh', tooltip: 'Charging infrastructure cost recovery per kWh — land, capex, opex incl margin' },
  green_h2_electricity_per_kg:    { label: 'Green H₂ electricity cost', unit: '₹/kg', tooltip: 'Electricity input cost for green H₂ production (component of total green H₂ cost)' },
  green_h2_capex_per_kg:          { label: 'Green H₂ capex',         unit: '₹/kg',  tooltip: 'Electrolyzer capex amortized per kg H₂ (~$1.25/kg per RIL benchmark)' },
  green_h2_opex_margin_per_kg:    { label: 'Green H₂ opex & margin', unit: '₹/kg',  tooltip: 'Operating cost and producer margin per kg green H₂' },
  grey_h2_blend_fraction:         { label: 'Grey H₂ blend fraction', unit: '0-1',   tooltip: 'Fraction of grey H₂ in the H₂ supply blend (0 = 100% green)' },
  lng_valves_piping_per_vehicle:  { label: 'LNG valves & piping',    unit: '₹/veh', tooltip: 'Per-vehicle cost of LNG valves and piping system' },
};
