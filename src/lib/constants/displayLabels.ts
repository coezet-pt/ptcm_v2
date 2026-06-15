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
export const CUMULATIVE_EMISSIONS_SUBTITLE = 'for the period 2025–55 over diesel-only scenario';
export const SEGMENT_GROUPING = 'grouped by vehicle category';
