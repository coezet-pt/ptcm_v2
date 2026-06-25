import type { Powertrain } from './extracted';

export const POWERTRAIN_LABELS: Record<Powertrain, string> = {
  Diesel: 'Diesel',
  CNG: 'CNG',
  LNG: 'LNG',
  BET: 'BET',
  'H2-ICE': 'Hydrogen-ICE',
  'H2-FCET': 'Hydrogen-FCET',
};

export const EMISSIONS_UNIT = 'MMT (Million Metric Tons)';
export const EMISSIONS_UNIT_SHORT = 'MMT';
export const WTW_BASIS = 'Well To Wheel (WTW) basis';
export const WTW_KICKER = 'Well To Wheel (WTW) CO₂e';
export const SALE_VOLUME_SUBTITLE = 'Sale volume/year';
export const CUMULATIVE_EMISSIONS_SUBTITLE = 'for the period 2026–55 over diesel-only scenario';
export const SEGMENT_GROUPING = 'grouped by vehicle category';

// Energy requirement units, per powertrain (native units as in the workbook).
export const ENERGY_UNIT_BY_PT: Record<Powertrain, string> = {
  Diesel: 'Mn litres',
  CNG: 'Mn kg',
  LNG: 'Mn kg',
  BET: 'TWh',
  'H2-ICE': 'Mn kg',
  'H2-FCET': 'Mn kg',
};
export const DIESEL_FUEL_UNIT = 'Million litres';
export const ELECTRICITY_UNIT = 'TWh';
export const DIESEL_SAVINGS_SUBTITLE = 'Diesel consumption with vs w/o ZET adoption';
