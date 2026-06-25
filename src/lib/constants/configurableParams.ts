import type { ParameterKey } from '@/lib/types';

/**
 * The user-configurable cost/energy trajectory parameters, in the grouping shown
 * in the InputPanel. Shared by the InputPanel, the parameter summary table above
 * the charts, and the downloadable report so they never drift apart.
 *
 * `label` is the short label used in the sidebar / table (overrides PARAMETER_META).
 */
export interface ConfigurableParam {
  key: ParameterKey;
  label: string;
}

export interface ConfigurableParamGroup {
  title: string;
  params: ConfigurableParam[];
}

export const CONFIGURABLE_PARAM_GROUPS: ConfigurableParamGroup[] = [
  {
    title: 'Fuel/Energy Cost',
    params: [
      { key: 'diesel_price_per_l', label: 'Diesel' },
      { key: 'cng_price_per_kg', label: 'CNG' },
      { key: 'lng_price_per_kg', label: 'LNG' },
      { key: 'electricity_incl_caas_per_kwh', label: 'Electricity at Charging Point' },
      { key: 'green_h2_production_per_kg', label: 'Green Hydrogen Production' },
      { key: 'grey_h2_production_per_kg', label: 'Grey Hydrogen Production' },
      { key: 'h2_compression_storage_per_kg', label: 'Hydrogen Compression, Transport & Dispensing' },
    ],
  },
  {
    title: 'Key Aggregate Cost',
    params: [
      { key: 'battery_cost_per_kwh', label: 'Battery' },
      { key: 'fuel_cell_cost_per_kw', label: 'Fuel Cell' },
      { key: 'h2_tank_cost_per_kg', label: 'Hydrogen Tank' },
      { key: 'lng_tank_cost_per_kg', label: 'LNG Tank' },
    ],
  },
];

/** Flat list of all configurable trajectory parameter keys. */
export const CONFIGURABLE_PARAM_KEYS: ParameterKey[] =
  CONFIGURABLE_PARAM_GROUPS.flatMap(g => g.params.map(p => p.key));
