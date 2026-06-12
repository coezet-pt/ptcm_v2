/**
 * Validation harness — run BAU simulation and diff against
 * CoEZET_PTCM_v3.xlsx 'Output Summary' rows 29-59 (years 2025-2055).
 *
 * Column mapping is POSITIONAL (workbook row-2 headers are buggy):
 *   A=year, B=Diesel sale,  C=Diesel stock,
 *           D=BET sale,     E=BET stock,
 *           F=H2-ICE sale,  G=H2-ICE stock,
 *           H=FCET sale,    I=FCET stock,
 *           J=CNG sale,     K=CNG stock,
 *           L=LNG sale,     M=LNG stock,
 *           N=Total sale.
 */
import { SCENARIO_CONFIGS } from '../src/lib/constants/scenarios';
import { BUCKETS } from '../src/lib/constants/extracted';
import { buildTimeSeries } from '../src/lib/sim/timeSeries';
import { computeTCO } from '../src/lib/sim/tco';
import { computeShares } from '../src/lib/sim/choiceModel';
import { computePTTM } from '../src/lib/sim/pttm';
import { computeStockEmissions } from '../src/lib/sim/stockEmissions';
import fs from 'fs';
import path from 'path';

const audit = JSON.parse(
  fs.readFileSync(path.join(import.meta.dir, 'extracted_audit.json'), 'utf-8'),
);

const config = SCENARIO_CONFIGS.BAU;
const ts = buildTimeSeries(config.parameters, config.policy);
const tco2045 = computeTCO(ts, config.policy, BUCKETS, 2045, config.fixed, config.segmentBasePrices);
const tco2050 = computeTCO(ts, config.policy, BUCKETS, 2050, config.fixed, config.segmentBasePrices);
const tco2055 = computeTCO(ts, config.policy, BUCKETS, 2055, config.fixed, config.segmentBasePrices);
const shares2045 = computeShares(tco2045, BUCKETS, 2045, config.policy);
const shares2050 = computeShares(tco2050, BUCKETS, 2050, config.policy);
const shares2055 = computeShares(tco2055, BUCKETS, 2055, config.policy, true);
const annual = computePTTM(shares2045, shares2050, shares2055, config.policy);
const sim = computeStockEmissions(annual);

// ── 1. Headers ──────────────────────────────────────────────────────────────
console.log('\n=== (1) OUTPUT SUMMARY HEADER ROWS (raw, workbook-as-shipped) ===');
console.log('Row 1:', JSON.stringify(audit.output_summary_headers?.row1 ?? '(re-run extract_constants.py)'));
console.log('Row 2:', JSON.stringify(audit.output_summary_headers?.row2 ?? ''));
console.log('Positional map used by harness:');
console.log('  A=year | B=Diesel sale | C=Diesel stock | D=BET sale | E=BET stock');
console.log('  F=H2ICE sale | G=H2ICE stock | H=FCET sale | I=FCET stock');
console.log('  J=CNG sale | K=CNG stock | L=LNG sale | M=LNG stock | N=Total');

// ── 2. B1 2045 TCO TRACE — component-by-component vs v3 sheet ──────────────
console.log('\n=== (2) B1 2045 TCO TRACE — component-by-component ===');
console.log('v3 sheet header confirmation:', JSON.stringify(audit.b1_header_row));

const tco2025 = computeTCO(ts, config.policy, BUCKETS, 2025, config.fixed, config.segmentBasePrices);
const b1 = tco2045['B1'];
const b1_2025 = tco2025['B1'];
const B1_ANNUAL_KM = 108000;
const B1_LIFE_YEARS = 7;
const B1_TOTAL_KM = B1_ANNUAL_KM * B1_LIFE_YEARS;

// Raw v3 block dump — show 2025 & 2045 side by side so flat vs escalating is obvious
console.log('\n--- v3 raw rows 55-170 (col C=2025, col W=2045) ---');
console.log('row   label                                              2025          2045');
for (const c of audit.b1_tco_components as Array<{row:number; label:string; v2025:any; v2045:any}>) {
  const f = (x: any) => x === null || x === undefined ? '       —'
    : typeof x === 'number' ? x.toLocaleString(undefined,{maximumFractionDigits:3}).padStart(14)
    : String(x).padStart(14);
  console.log(`[${String(c.row).padStart(3)}] ${c.label.slice(0,48).padEnd(48)} ${f(c.v2025)} ${f(c.v2045)}`);
}

// Build {row -> v2045} lookup
const v3 = new Map<number, number>();
for (const c of audit.b1_tco_components as Array<{row:number; v2045:any}>) {
  if (typeof c.v2045 === 'number') v3.set(c.row, c.v2045);
}

// Compute sim component breakdown (mirroring v3 row layout)
function simBreakdown(r: typeof b1.Diesel) {
  // sim's `capexPerKm` already includes interest+insurance (v3 row 74/142 also does)
  // sim's `opexPerKm` = fuel + maint + manpower + toll. v3 splits: r75=fuel(+adblue for diesel), r76=O&M (maint+manpower+toll+insurance), r77=resale credit
  const resaleCreditPerKm = (r.vehiclePrice * r.resalePct) / B1_TOTAL_KM;
  const oemPerKm = r.maintPerKm + r.manpowerPerKm + r.tollPerKm; // insurance already inside capex on our side
  return {
    capex: r.capexPerKm,
    fuel: r.fuelCostPerKm,
    maint: r.maintPerKm,
    manpower: r.manpowerPerKm,
    toll: r.tollPerKm,
    oem: oemPerKm,
    resale: resaleCreditPerKm,
    tco: r.tcoPerKm,
  };
}

function compareTable(name: string, sim: ReturnType<typeof simBreakdown>, rows: {label:string; simKey:keyof typeof sim; v3Row:number; sign?:number}[]) {
  console.log(`\n--- ${name} — Sim vs v3 (₹/km, 2045) ---`);
  console.log('Component             Sim ₹/km   v3 ₹/km     Δ       v3-row');
  let maxAbs = 0, maxLabel = '';
  for (const r of rows) {
    const s = (sim as any)[r.simKey] as number;
    const ref = v3.get(r.v3Row);
    if (ref === undefined) { console.log(`${r.label.padEnd(22)} ${s.toFixed(2).padStart(8)}  (v3 row ${r.v3Row} missing)`); continue; }
    const sgn = r.sign ?? 1;
    const sShow = s * sgn, refShow = ref * sgn;
    const d = sShow - refShow;
    if (Math.abs(d) > Math.abs(maxAbs)) { maxAbs = d; maxLabel = r.label; }
    console.log(`${r.label.padEnd(22)} ${sShow.toFixed(2).padStart(8)}  ${refShow.toFixed(2).padStart(8)}  ${(d>=0?'+':'')}${d.toFixed(2).padStart(6)}   r${r.v3Row}`);
  }
  console.log(`Largest |Δ|: ${maxLabel} (${maxAbs>=0?'+':''}${maxAbs.toFixed(2)} ₹/km)`);
}

if (b1) {
  const dSim = simBreakdown(b1.Diesel);
  compareTable('DIESEL B1 2045', dSim, [
    { label: 'CAPEX (incl int+ins)', simKey: 'capex',    v3Row: 74 },
    { label: 'OPEX Fuel (+adblue)',  simKey: 'fuel',     v3Row: 75 },
    { label: 'O&M (maint+mp+toll)',  simKey: 'oem',      v3Row: 76 },
    { label: '  └ maint',            simKey: 'maint',    v3Row: 55 },
    { label: '  └ manpower (info)',  simKey: 'manpower', v3Row: 76 }, // no dedicated per-km row
    { label: '  └ toll',             simKey: 'toll',     v3Row: 76 }, // toll lives inside r76
    { label: 'Resale credit',        simKey: 'resale',   v3Row: 77, sign: -1 },
    { label: 'TCO /km',              simKey: 'tco',      v3Row: 78 },
  ]);

  const bSim = simBreakdown(b1.BET);
  compareTable('BET B1 2045', bSim, [
    { label: 'CAPEX (incl int+ins)', simKey: 'capex',    v3Row: 142 },
    { label: 'OPEX Energy',          simKey: 'fuel',     v3Row: 143 },
    { label: 'O&M (maint+mp+toll)',  simKey: 'oem',      v3Row: 144 },
    { label: '  └ maint',            simKey: 'maint',    v3Row: 57 },
    { label: '  └ manpower (info)',  simKey: 'manpower', v3Row: 144 },
    { label: '  └ toll',             simKey: 'toll',     v3Row: 144 },
    { label: 'Resale credit',        simKey: 'resale',   v3Row: 145, sign: -1 },
    { label: 'TCO /km',              simKey: 'tco',      v3Row: 146 },
  ]);

  console.log(`\nRatio Diesel/BET — sim ${(b1.Diesel.tcoPerKm/b1.BET.tcoPerKm).toFixed(4)} | v3 ${((v3.get(78)!)/(v3.get(146)!)).toFixed(4)}`);
}

// ── 3 & 4. Sales + Stock diff tables ────────────────────────────────────────
const PTS = ['Diesel', 'CNG', 'LNG', 'BET', 'H2-ICE', 'H2-FCET'] as const;
const FLAG = 2;
const fmt = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(0));
const pct = (a: number, b: number) =>
  b === 0 ? (a === 0 ? 0 : Infinity) : ((a - b) / b) * 100;

function diffTable(title: string, getSim: (y: number) => Record<string, number>, refKey: 'sale' | 'stock'): { flagged: number; total: number } {
  console.log(`\n=== ${title} (Δ% = sim − ref; * = |Δ|>${FLAG}%) ===`);
  console.log('Year   ' + PTS.map(p => p.padStart(22)).join(' '));
  let flagged = 0, total = 0;
  for (let year = 2025; year <= 2055; year++) {
    const refRow = audit.bau_reference[year] || audit.bau_reference[String(year)];
    if (!refRow) continue;
    const simRow = getSim(year);
    const cells = PTS.map(pt => {
      const sim = simRow[pt] ?? 0;
      const refKeyName = refKey === 'sale' ? pt : `${pt}_stock`;
      const refv = Number(refRow[refKeyName] ?? 0);
      const d = pct(sim, refv);
      const small = refv < 10 && Math.abs(sim - refv) < 10;
      const tag = Math.abs(d) > FLAG && !small ? '*' : ' ';
      total++;
      if (tag === '*') flagged++;
      const dStr = isFinite(d) ? d.toFixed(1) + '%' : '—';
      return `${fmt(sim).padStart(9)}/${fmt(refv).padStart(9)}${tag}${dStr.padStart(7)}`;
    });
    console.log(`${year}  ${cells.join(' ')}`);
  }
  console.log(`Flagged cells: ${flagged} / ${total}`);
  return { flagged, total };
}

const salesDiff = diffTable('(3) BAU SALES — sim vs Output Summary', year => {
  const row = sim.years.find(y => y.year === year);
  return row ? row.salesByPT as any : {};
}, 'sale');

const stockDiff = diffTable('(4) BAU STOCK — sim vs Output Summary', year => {
  const row = sim.years.find(y => y.year === year);
  return row ? row.stockByPT as any : {};
}, 'stock');

// ── 5. 2025-2030 CNG/LNG anchor check ───────────────────────────────────────
console.log('\n=== (5) 2025-2030 CNG/LNG ANCHOR CHECK ===');
console.log('Year   CNG sim / ref       LNG sim / ref');
for (let year = 2025; year <= 2030; year++) {
  const row = sim.years.find(y => y.year === year)!;
  const ref = audit.bau_reference[year] || audit.bau_reference[String(year)];
  console.log(
    `${year}  ${fmt(row.salesByPT['CNG']).padStart(8)} / ${fmt(Number(ref.CNG)).padStart(8)}    ` +
    `${fmt(row.salesByPT['LNG']).padStart(8)} / ${fmt(Number(ref.LNG)).padStart(8)}`,
  );
}

// ── 6. Derived Gompertz a/b/c vs v3 literals ────────────────────────────────
console.log('\n=== (6) GOMPERTZ PARAMS — sim-derived vs v3 literals ===');
import { PTTM_PILOT_SHARE, PTTM_PILOT_START_YEAR } from '../src/lib/constants/extracted';
const V3_LITERAL = {
  BET:       { startYear: 2025, infl: 2031, a: 1.109,  b: 7.111, c: 0.1130, W: 0.0009052 },
  'H2-ICE':  { startYear: 2028, infl: 2051, a: 0.0659, b: 6.491, c: 0.0917, W: 0.0001 },
  'H2-FCET': { startYear: 2030, infl: 2051, a: 0.0616, b: 6.423, c: 0.1043, W: 0.0001 },
} as const;
// Use the bucket with the largest tivShare2045 as the representative
const repBucket = [...BUCKETS].sort((x, y) => y.tivShare2045 - x.tivShare2045)[0];
console.log(`Representative bucket: ${repBucket.id} (TIV share ${(repBucket.tivShare2045*100).toFixed(1)}%)`);
console.log('PT        startYr  infl   a(sim/v3)         b(sim/v3)        c(sim/v3)         W(sim/v3)');
for (const pt of ['BET','H2-ICE','H2-FCET'] as const) {
  const lit = V3_LITERAL[pt];
  const startYear = PTTM_PILOT_START_YEAR[pt];
  const inflYear = (config.policy as any)[pt === 'BET' ? 'bet_inflection_year' : pt === 'H2-ICE' ? 'h2ice_inflection_year' : 'fcet_inflection_year'];
  const W = PTTM_PILOT_SHARE[pt];
  const AB = shares2055[repBucket.id]?.[pt] ?? 0;
  // Mirror gompertzShare derivation:
  const aInitial = AB;
  const b = Math.log(Math.max(aInitial, W*1.01) / W);
  const inflDelta = Math.max(inflYear - startYear, 1);
  const c = -(1/inflDelta) * Math.log(Math.log(Math.max(aInitial, 0.1001)/0.1) / b);
  const endDelta = 2055 - startYear;
  const a = AB / Math.exp(-b * Math.exp(-c * endDelta));
  const fmt2 = (x:number,d=4)=>x.toFixed(d).padStart(8);
  console.log(`${pt.padEnd(9)} ${String(startYear).padEnd(7)} ${String(inflYear).padEnd(6)} ${fmt2(a)}/${fmt2(lit.a)}  ${fmt2(b)}/${fmt2(lit.b)}  ${fmt2(c)}/${fmt2(lit.c)}  ${fmt2(W,7)}/${fmt2(lit.W,7)}`);
}

// ── 7. Sanity checks + diff verdict ─────────────────────────────────────────
import { runSanityChecks } from '../src/lib/sim/sanityCheck';
const checks = runSanityChecks(sim as any);
const passed = checks.filter(c => c.passed).length;
console.log(`\n=== (7) SANITY CHECKS: ${passed}/${checks.length} passed ===`);
for (const c of checks) console.log(`  [${c.passed ? 'OK ' : 'FAIL'}] ${c.name}: actual=${c.actual} expected=${c.expected}`);

// BET 2045 share
const y2045 = sim.years.find(y => y.year === 2045)!;
const totalSales2045 = (Object.values(y2045.salesByPT) as number[]).reduce((s,n)=>s+n,0);
console.log(`\nBET 2045 share: ${(y2045.salesByPT['BET']/totalSales2045*100).toFixed(1)}%  (target ~76%)`);

console.log(`\n=== (8) DIFF TOTALS (|Δ|>${FLAG}%) ===`);
console.log(`Sales: ${salesDiff.flagged}/${salesDiff.total}   Stock: ${stockDiff.flagged}/${stockDiff.total}   Combined: ${salesDiff.flagged+stockDiff.flagged}/${salesDiff.total+stockDiff.total}`);

// ── 9. Sanity thresholds vs v3 actuals (READ-ONLY) ──────────────────────────
console.log('\n=== (9) SANITY THRESHOLDS vs v3 ACTUALS (no changes made) ===');
function v3Totals(year: number) {
  const r = audit.bau_reference[year] || audit.bau_reference[String(year)];
  const pts = ['Diesel','CNG','LNG','BET','H2-ICE','H2-FCET'] as const;
  const byPT: Record<string, number> = {};
  let total = 0;
  for (const p of pts) { byPT[p] = Number(r?.[p] ?? 0); total += byPT[p]; }
  return { byPT, total };
}
const v25 = v3Totals(2025), v30 = v3Totals(2030), v45 = v3Totals(2045), v55 = v3Totals(2055);
const zet45 = (v45.byPT['BET']+v45.byPT['H2-ICE']+v45.byPT['H2-FCET'])/v45.total;
const zet55 = (v55.byPT['BET']+v55.byPT['H2-ICE']+v55.byPT['H2-FCET'])/v55.total;
const cng30 = v30.byPT['CNG']/v30.total, cng45 = v45.byPT['CNG']/v45.total, cng55 = v55.byPT['CNG']/Math.max(v55.total,1);
const lng30 = v30.byPT['LNG']/v30.total, lng45 = v45.byPT['LNG']/v45.total, lng55 = v55.byPT['LNG']/Math.max(v55.total,1);

type Row = { check: string; threshold: string; actual: string; stale: boolean };
const rows: Row[] = [
  { check: 'total_sales_2025',  threshold: '262,023–272,717',     actual: Math.round(v25.total).toLocaleString(),    stale: v25.total < 262023 || v25.total > 272717 },
  { check: 'total_sales_2045',  threshold: '693,105–721,395',     actual: Math.round(v45.total).toLocaleString(),    stale: v45.total < 693105 || v45.total > 721395 },
  { check: 'total_sales_2055',  threshold: '1,009,233–1,050,427', actual: Math.round(v55.total).toLocaleString(),    stale: v55.total < 1009233 || v55.total > 1050427 },
  { check: 'zet_share_2045',    threshold: '10%–45%',              actual: (zet45*100).toFixed(1)+'%',                stale: zet45 < 0.10 || zet45 > 0.45 },
  { check: 'zet_share_2055',    threshold: '30%–70%',              actual: (zet55*100).toFixed(1)+'%',                stale: zet55 < 0.30 || zet55 > 0.70 },
  { check: 'diesel_2025_units', threshold: '240,000–270,000',     actual: Math.round(v25.byPT['Diesel']).toLocaleString(), stale: v25.byPT['Diesel'] < 240000 || v25.byPT['Diesel'] > 270000 },
  { check: 'cng_share_2030',    threshold: '1%–15%',               actual: (cng30*100).toFixed(2)+'%',                stale: cng30 < 0.01 || cng30 > 0.15 },
  { check: 'cng_share_2045',    threshold: '≥2%',                  actual: (cng45*100).toFixed(2)+'%',                stale: cng45 < 0.02 },
  { check: 'cng_share_2055',    threshold: '≤0.5%',                actual: (cng55*100).toFixed(2)+'%',                stale: cng55 > 0.005 },
  { check: 'lng_share_2030',    threshold: '≥0.5%',                actual: (lng30*100).toFixed(2)+'%',                stale: lng30 < 0.005 },
  { check: 'lng_share_2045',    threshold: '≥1.5%',                actual: (lng45*100).toFixed(2)+'%',                stale: lng45 < 0.015 },
  { check: 'lng_share_2055',    threshold: '≤0.5%',                actual: (lng55*100).toFixed(2)+'%',                stale: lng55 > 0.005 },
];
console.log('check                  threshold              v3 actual        stale?');
for (const r of rows) {
  console.log(`${r.check.padEnd(22)} ${r.threshold.padEnd(22)} ${r.actual.padEnd(16)} ${r.stale ? 'STALE' : 'OK'}`);
}

// ── 10. 2045 per-PT shares (sim) ────────────────────────────────────────────
console.log('\n=== (10) BAU 2045 SHARES (sim, target BET~76% H2-ICE~1.7% H2-FCET~1.6%) ===');
for (const pt of ['BET','H2-ICE','H2-FCET'] as const) {
  console.log(`  ${pt.padEnd(9)} sim ${(y2045.salesByPT[pt]/totalSales2045*100).toFixed(2)}%`);
}

console.log(`\n=== VERDICT ===`);
console.log(`Sanity ${passed}/${checks.length} passed. Diff cells over 2%: ${salesDiff.flagged+stockDiff.flagged}/${salesDiff.total+stockDiff.total}.`);

// ── 11. Choice factor trace — B1 2045 ──────────────────────────────────────
console.log('\n=== (11) CHOICE FACTOR TRACE — B1 2045 ===');
import { POWERTRAIN_RATINGS, START_OF_SUPPLY } from '../src/lib/constants/extracted';
const ELAST = { TCO: 9.0, vehiclePrice: 8.83, ratedPayload: 7.17, tatGradeability: 5.5, rangeFillingTime: 7.5 };
const GM = 1.5;
const b1Bucket = BUCKETS.find(b => b.id === 'B1')!;
const dieselPayload = b1Bucket.gvw - b1Bucket.ulw;
const PT_PEN = (pt: string) => ({
  'Diesel': 0,
  'CNG': 200,
  'LNG': 300,
  'BET': b1Bucket.betBatteryKWh * 8,
  'H2-ICE': b1Bucket.h2TankKg * 40,
  'H2-FCET': b1Bucket.fcetFuelCellKW * 4 + b1Bucket.fcetBatteryKWh * 8 + b1Bucket.h2TankKg * 40,
} as any)[pt];
const dTco = tco2045['B1']['Diesel'].tcoPerKm;
const dPrice = tco2045['B1']['Diesel'].vehiclePrice;
const dTAT = POWERTRAIN_RATINGS.tatGradeability['Diesel'];
const dRng = POWERTRAIN_RATINGS.rangeFillingTime['Diesel'];

const trace: any[] = [];
for (const pt of ['Diesel','BET','H2-ICE','H2-FCET'] as const) {
  const r = tco2045['B1'][pt];
  const supplyYear = (START_OF_SUPPLY as any)[b1Bucket.size]?.[pt] ?? 2025;
  const plRatio = Math.max(1, dieselPayload - PT_PEN(pt)) / dieselPayload;
  const tatR = POWERTRAIN_RATINGS.tatGradeability[pt];
  const rngR = POWERTRAIN_RATINGS.rangeFillingTime[pt];
  const fTCO = Math.exp(ELAST.TCO * GM * (dTco / r.tcoPerKm - 1));
  const fPrice = Math.exp(ELAST.vehiclePrice * GM * (dPrice / r.vehiclePrice - 1));
  const fPL = Math.exp(ELAST.ratedPayload * GM * (plRatio - 1));
  const fTAT = Math.exp(ELAST.tatGradeability * GM * (tatR / dTAT - 1));
  const fRng = Math.exp(ELAST.rangeFillingTime * GM * (dRng / rngR - 1));
  const score = fTCO + fPrice + fPL + fTAT + fRng;
  trace.push({ pt, supplyYear, tco: r.tcoPerKm, price: r.vehiclePrice, fuel: r.fuelCostPerKm, plRatio,
    fTCO, fPrice, fPL, fTAT, fRng, score });
}
const totalScore = trace.reduce((s,t)=>s+t.score,0);
trace.forEach(t => t.share = t.score / totalScore);

const colHdr = trace.map(t => t.pt.padStart(10)).join(' ');
const row = (lbl: string, fmt: (t:any)=>string) =>
  console.log(lbl.padEnd(22) + trace.map(t => fmt(t).padStart(10)).join(' '));
console.log(' '.repeat(22) + colHdr);
row('Supply start year',   t => String(t.supplyYear));
row('TCO ₹/km',             t => t.tco.toFixed(2));
row('VehiclePrice ₹M',      t => (t.price/1e6).toFixed(2));
row('FuelCost ₹/km',        t => t.fuel.toFixed(2));
row('PayloadRatio',         t => t.plRatio.toFixed(3));
console.log('─ factors exp(...) ──');
row(' TCO',                 t => t.fTCO.toFixed(3));
row(' vehiclePrice',        t => t.fPrice.toFixed(3));
row(' ratedPayload',        t => t.fPL.toFixed(3));
row(' tatGradeability',     t => t.fTAT.toFixed(3));
row(' rangeFillingTime',    t => t.fRng.toFixed(3));
console.log('─ score / share ─────');
row(' score (sum)',         t => t.score.toFixed(2));
row(' share',               t => (t.share*100).toFixed(2) + '%');

for (const pt of ['H2-ICE','H2-FCET'] as const) {
  const t = trace.find(x => x.pt === pt)!;
  const items = [['TCO',t.fTCO],['vehiclePrice',t.fPrice],['ratedPayload',t.fPL],['tatGradeability',t.fTAT],['rangeFillingTime',t.fRng]] as [string,number][];
  items.sort((a,b)=>b[1]-a[1]);
  console.log(`Largest factor for ${pt}: ${items[0][0]} = ${items[0][1].toFixed(3)}`);
}

// ── 12. B1 2045 H2 TCO — sim vs v3 ─────────────────────────────────────────
console.log('\n=== (12) B1 2045 H2 TCO — sim vs v3 (user-provided ground truth) ===');
const V3_TCO_B1_2045 = { Diesel: 59.24, CNG: 62.58, LNG: 61.75, BET: 45.44, 'H2-ICE': 59.38, 'H2-FCET': 61.70 } as const;
console.log('PT        sim TCO ₹/km   v3 TCO ₹/km    Δ');
for (const pt of ['Diesel','BET','H2-ICE','H2-FCET','CNG','LNG'] as const) {
  const s = tco2045['B1'][pt].tcoPerKm;
  const v = V3_TCO_B1_2045[pt];
  console.log(`${pt.padEnd(9)} ${s.toFixed(2).padStart(8)}      ${v.toFixed(2).padStart(8)}     ${(s-v>=0?'+':'')}${(s-v).toFixed(2)}`);
}
// H2 fuel cost sanity: green H2 ~₹546.50/kg + compression ₹175/kg = ~₹721.5/kg
// H2-ICE: ₹/km = 721.5 / h2iceKmPerKg = 721.5/15.6 = ₹46.25/km
// H2-FCET: ₹/km = 721.5 / fcetKmPerKg = 721.5/20.8 = ₹34.69/km
console.log('Expected 2025-base H2 fuel cost (₹546.5/kg green + ₹175/kg compression):');
console.log(`  H2-ICE  @ ${b1Bucket.h2iceKmPerKg} km/kg → ${(721.5/b1Bucket.h2iceKmPerKg).toFixed(2)} ₹/km (2025 basis)`);
console.log(`  H2-FCET @ ${b1Bucket.fcetKmPerKg} km/kg → ${(721.5/b1Bucket.fcetKmPerKg).toFixed(2)} ₹/km (2025 basis)`);
console.log(`  sim H2-ICE fuel/km @ 2045: ${tco2045['B1']['H2-ICE'].fuelCostPerKm.toFixed(2)}`);
console.log(`  sim H2-FCET fuel/km @ 2045: ${tco2045['B1']['H2-FCET'].fuelCostPerKm.toFixed(2)}`);
