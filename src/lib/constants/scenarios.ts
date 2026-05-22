/**
 * Full scenario configs for BAU, BWS-1, BWS-2, BEST.
 */
import type { ScenarioConfig } from '@/lib/types';
import { BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES } from './extracted';

const baseExtras = {
  fixed: structuredClone(BAU_FIXED) as ScenarioConfig['fixed'],
  segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES) as ScenarioConfig['segmentBasePrices'],
};

export const SCENARIO_CONFIGS: Record<string, ScenarioConfig> = {
  BAU: {
    parameters: { ...BAU_PARAMETERS } as ScenarioConfig['parameters'],
    policy: { ...BAU_POLICY },
    ...structuredClone(baseExtras),
  },

  'BWS-1': {
    parameters: {
      ...BAU_PARAMETERS,
      // BWS-1: same cost trajectories as BAU
    } as ScenarioConfig['parameters'],
    policy: {
      ...BAU_POLICY,
      bet_inflection_year: 2036,
      h2ice_inflection_year: 2049,
      fcet_inflection_year: 2049,
      bet_demand_incentive_per_kwh: 5000,
      fcet_demand_incentive_per_kwh: 15000,
      bet_incentive_phase1_end_year: 2030,
      bet_demand_incentive_phase2_per_kwh: 2500,
      bet_incentive_phase2_end_year: 2035,
      fcet_incentive_phase1_end_year: 2030,
      fcet_demand_incentive_phase2_per_kwh: 7500,
      fcet_incentive_phase2_end_year: 2035,
      interest_rate_zet: 0.11,
      electricity_subsidy_per_kwh: 1,
      electricity_subsidy_end_year: 2035,
      toll_waiver_pct_first_5y: 0.5,
      toll_waiver_pct_next_5y: 0.25,
      toll_waiver_first_period_years: 5,
      toll_waiver_second_period_years: 5,
      bet_maturity_year: 2035,
      h2ice_maturity_year: 2042,
      fcet_maturity_year: 2045,
    },
    ...structuredClone(baseExtras),
  },

  'BWS-2': {
    parameters: {
      ...BAU_PARAMETERS,
      // BWS-2: same cost trajectories as BAU
    } as ScenarioConfig['parameters'],
    policy: {
      ...BAU_POLICY,
      bet_inflection_year: 2036,
      h2ice_inflection_year: 2049,
      fcet_inflection_year: 2049,
      bet_demand_incentive_per_kwh: 7500,
      fcet_demand_incentive_per_kwh: 20000,
      bet_incentive_phase1_end_year: 2030,
      bet_demand_incentive_phase2_per_kwh: 3750,
      bet_incentive_phase2_end_year: 2035,
      fcet_incentive_phase1_end_year: 2030,
      fcet_demand_incentive_phase2_per_kwh: 10000,
      fcet_incentive_phase2_end_year: 2035,
      interest_rate_zet: 0.10,
      electricity_subsidy_per_kwh: 1.5,
      electricity_subsidy_end_year: 2035,
      toll_waiver_pct_first_5y: 0.75,
      toll_waiver_pct_next_5y: 0.50,
      toll_waiver_first_period_years: 5,
      toll_waiver_second_period_years: 5,
      bet_maturity_year: 2035,
      h2ice_maturity_year: 2042,
      fcet_maturity_year: 2045,
    },
    ...structuredClone(baseExtras),
  },

  BEST: {
    parameters: {
      ...BAU_PARAMETERS,
      green_h2_production_per_kg:    { baseValue: 600, d2630: -0.04, d3140: -0.035, d4150: -0.03, d5155: -0.03 },
      h2_compression_storage_per_kg: { baseValue: 175, d2630: -0.04, d3140: -0.03,  d4150: -0.03, d5155: -0.02 },
      diesel_price_per_l:            { baseValue: 88.93, d2630: 0.0208, d3140: 0.0208, d4150: 0.0208, d5155: 0.05 },
    } as ScenarioConfig['parameters'],
    policy: {
      ...BAU_POLICY,
      bet_demand_incentive_per_kwh: 10000,
      fcet_demand_incentive_per_kwh: 30000,
      interest_rate_zet: 0.10,
      electricity_subsidy_per_kwh: 2,
      toll_waiver_pct_first_5y: 1.0,
      toll_waiver_pct_next_5y: 0.5,
      bet_inflection_year: 2032,
      h2ice_inflection_year: 2049,
      fcet_inflection_year: 2049,
      bet_resale_2046_plus: 0.45,
      diesel_price_5pct_yoy_after_2045: true,
      bet_incentive_phase1_end_year: 2030,
      bet_demand_incentive_phase2_per_kwh: 5000,
      bet_incentive_phase2_end_year: 2035,
      fcet_incentive_phase1_end_year: 2030,
      fcet_demand_incentive_phase2_per_kwh: 15000,
      fcet_incentive_phase2_end_year: 2035,
      electricity_subsidy_end_year: 2040,
      toll_waiver_first_period_years: 5,
      toll_waiver_second_period_years: 5,
      bet_maturity_year: 2033,
      h2ice_maturity_year: 2040,
      fcet_maturity_year: 2045,
      range_filling_concern_after_2035: false,
      gvw_payload_compensation_t: 0,
    },
    ...structuredClone(baseExtras),
  },
};
