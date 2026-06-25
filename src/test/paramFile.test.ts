import { describe, it, expect } from 'vitest';
import { BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES } from '@/lib/constants/extracted';
import type { ScenarioConfig, FixedParameters } from '@/lib/types';
import { buildParamRows, applyParamRows, COL } from '@/lib/paramFile';

function bau(): ScenarioConfig {
  return {
    parameters: { ...BAU_PARAMETERS } as ScenarioConfig['parameters'],
    policy: { ...BAU_POLICY },
    fixed: structuredClone(BAU_FIXED) as FixedParameters,
    segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES) as ScenarioConfig['segmentBasePrices'],
  };
}

describe('param file round-trip', () => {
  it('export → import reproduces the source config', () => {
    const src = bau();
    const rows = buildParamRows(src);
    const { config, applied, unknownKeys } = applyParamRows(rows, bau());

    expect(unknownKeys).toEqual([]);
    expect(applied).toBe(rows.length);

    // Trajectory params: base + CAGRs survive the %↔decimal conversion.
    expect(config.parameters.diesel_price_per_l.baseValue)
      .toBeCloseTo(src.parameters.diesel_price_per_l.baseValue, 6);
    expect(config.parameters.battery_cost_per_kwh.d2530)
      .toBeCloseTo(src.parameters.battery_cost_per_kwh.d2530, 6);

    // Scalars / rates / enums.
    expect(config.fixed.battery_life_cycles).toBe(src.fixed.battery_life_cycles);
    expect(config.policy.interest_rate_zet).toBeCloseTo(src.policy.interest_rate_zet, 6);
    expect(config.policy.h2_source_mix).toBe(src.policy.h2_source_mix);
  });

  it('edited values are applied; blanks and pins are preserved', () => {
    const src = bau();
    // Add a per-year pin that the file does not represent.
    src.parameters.diesel_price_per_l.overrides = { 2030: 123 };

    const rows = buildParamRows(src);
    const dieselRow = rows.find(r => r[COL.key] === 'diesel_price_per_l')!;
    dieselRow[COL.value] = 200;            // edit the 2026 base
    const cellRow = rows.find(r => r[COL.key] === 'fixed.battery_life_cycles')!;
    cellRow[COL.value] = '';               // blank → keep current

    const { config } = applyParamRows(rows, src);

    expect(config.parameters.diesel_price_per_l.baseValue).toBe(200);
    expect(config.parameters.diesel_price_per_l.overrides).toEqual({ 2030: 123 });
    expect(config.fixed.battery_life_cycles).toBe(src.fixed.battery_life_cycles);
  });

  it('skips unrecognised keys without throwing', () => {
    const { applied, unknownKeys } = applyParamRows(
      [{ [COL.key]: 'totally.bogus', [COL.value]: 5 }],
      bau(),
    );
    expect(applied).toBe(0);
    expect(unknownKeys).toEqual(['totally.bogus']);
  });
});
