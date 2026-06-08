/**
 * Validation harness: run the existing BAU simulation and diff against
 * Output Summary rows 29-59 from CoEZET_PTCM_v3.xlsx.
 *
 * Reads BAU reference from scripts/extracted_audit.json (produced by
 * scripts/extract_constants.py).
 */
import { SCENARIO_CONFIGS } from '../src/lib/constants/scenarios';
const SCENARIOS = SCENARIO_CONFIGS;
import { BUCKETS } from '../src/lib/constants/extracted';
import { buildTimeSeries } from '../src/lib/sim/timeSeries';
import { computeTCO } from '../src/lib/sim/tco';
import { computeShares } from '../src/lib/sim/choiceModel';
import { computePTTM } from '../src/lib/sim/pttm';
import fs from 'fs';
import path from 'path';

const audit = JSON.parse(
  fs.readFileSync(path.join(import.meta.dir, 'extracted_audit.json'), 'utf-8'),
);

const config = SCENARIOS.BAU;
const ts = buildTimeSeries(config.parameters, config.policy);
const tco2045 = computeTCO(ts, config.policy, BUCKETS, 2045, config.fixed, config.segmentBasePrices);
const tco2055 = computeTCO(ts, config.policy, BUCKETS, 2055, config.fixed, config.segmentBasePrices);
const shares2045 = computeShares(tco2045, BUCKETS, 2045, config.policy);
const shares2055 = computeShares(tco2055, BUCKETS, 2055, config.policy);
const annual = computePTTM(shares2045, shares2055, config.policy);

const START_YEAR = 2025;
const PTS = ['Diesel', 'CNG', 'LNG', 'BET', 'H2-ICE', 'H2-FCET'] as const;

const FLAG = 2; // % threshold
const fmt = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(0));
const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : Infinity) : ((a - b) / b) * 100);

console.log('=== BAU sim vs Output Summary (Δ% = sim - ref) ===');
console.log(
  'Year   '.padEnd(7) +
    PTS.map(p => p.padStart(20)).join(' '),
);

let flagged = 0;
for (let i = 0; i < annual.length; i++) {
  const year = START_YEAR + i;
  if (year > 2055) break;
  const ref = audit.bau_reference[year] || audit.bau_reference[String(year)];
  if (!ref) continue;
  const row = annual[i];
  const cells = PTS.map(pt => {
    const sim = row.sales[pt];
    const refv = Number(ref[pt] || 0);
    const d = pct(sim, refv);
    const tag = Math.abs(d) > FLAG && !(refv < 10 && Math.abs(sim - refv) < 10) ? '*' : ' ';
    if (tag === '*') flagged++;
    const dStr = isFinite(d) ? d.toFixed(1) + '%' : '—';
    return `${fmt(sim).padStart(8)}/${fmt(refv).padStart(7)}${tag}${dStr.padStart(7)}`;
  });
  console.log(`${year}  ${cells.join(' ')}`);
}

console.log(`\nTotal flagged cells (|Δ|>${FLAG}%): ${flagged}`);
