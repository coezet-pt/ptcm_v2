/**
 * Stock evolution & emissions calculation.
 */
import type { Powertrain } from '@/lib/constants/extracted';
import {
  POWERTRAINS,
  BUCKETS,
  HISTORICAL_SALES,
  TIV_PROJECTION,
  DIESEL_STOCK_END_2025,
  SCRAPPAGE_AGE_YEARS,
  PRE_2001_DIESEL_SCRAPPAGE_PER_YEAR,
  PRE_2001_SCRAPPAGE_END_YEAR,
  EMISSION_FACTORS,
  betGridFactor,
} from '@/lib/constants/extracted';
import {
  SEGMENTS,
  APPLICATIONS,
  SEGMENT_OF_BUCKET,
  APPLICATION_OF_BUCKET,
} from '@/lib/constants/segments';
import type { SimulationResult, AnnualResult } from '@/lib/types';
import type { AnnualPTSales } from './pttm';
import { START_YEAR, END_YEAR, YEAR_COUNT } from './timeSeries';

// Bucket-weighted average emission rates
function computeWeightedDieselEmissionRate(): number {
  let weightedRate = 0;
  let totalWeight = 0;
  for (const b of BUCKETS) {
    const rate = b.annualKm / b.dieselKMPL * EMISSION_FACTORS.diesel_kgCO2e_per_l;
    weightedRate += rate * b.tivShare2045;
    totalWeight += b.tivShare2045;
  }
  return totalWeight > 0 ? weightedRate / totalWeight : 0;
}

// Bucket-weighted per-vehicle annual emission rate (kgCO2e/yr) by powertrain.
// BET uses the year's grid factor (Excel 'Emissions' R49 declines ~3%/yr).
// greyFrac (0–1) is the share of grey (SMR) hydrogen in supply for the year;
// it lifts the H2-ICE/H2-FCET factor from green (0.07/km) toward grey
// (grey_h2_prod_kgCO2e_per_kg ÷ km/kg). 0 reproduces the green-only baseline.
function computeWeightedEmissionRate(year: number, greyFrac = 0): Record<Powertrain, number> {
  const betGrid = betGridFactor(year);
  const gf = Math.max(0, Math.min(1, greyFrac));
  const greyPerKg = EMISSION_FACTORS.grey_h2_prod_kgCO2e_per_kg;
  const rates: Record<Powertrain, number> = {
    Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0,
  };
  let totalWeight = 0;
  for (const b of BUCKETS) {
    // H2 per-km factor: green baseline blended with grey production intensity.
    const h2iceFactor = (1 - gf) * EMISSION_FACTORS.h2ice_green_kgCO2e_per_km
      + gf * (greyPerKg / b.h2iceKmPerKg);
    const h2fcetFactor = (1 - gf) * EMISSION_FACTORS.h2fcet_green_kgCO2e_per_km
      + gf * (greyPerKg / b.fcetKmPerKg);
    rates.Diesel += (b.annualKm / b.dieselKMPL * EMISSION_FACTORS.diesel_kgCO2e_per_l) * b.tivShare2045;
    rates.CNG += (b.annualKm / b.cngKmPerKg * EMISSION_FACTORS.cng_kgCO2e_per_kg) * b.tivShare2045;
    rates.LNG += (b.annualKm / b.lngKmPerKg * EMISSION_FACTORS.lng_kgCO2e_per_kg) * b.tivShare2045;
    rates.BET += (b.annualKm * b.betKwhPerKm * betGrid) * b.tivShare2045;
    rates['H2-ICE'] += (b.annualKm * h2iceFactor) * b.tivShare2045;
    rates['H2-FCET'] += (b.annualKm * h2fcetFactor) * b.tivShare2045;
    totalWeight += b.tivShare2045;
  }
  if (totalWeight > 0) {
    for (const pt of POWERTRAINS) {
      rates[pt] /= totalWeight;
    }
  }
  return rates;
}

function getSalesAtYear(year: number, annualSales: AnnualPTSales[]): Record<Powertrain, number> {
  if (year >= START_YEAR) {
    const idx = year - START_YEAR;
    if (idx < annualSales.length) return annualSales[idx].sales;
  }
  // Pre-2026: all diesel
  const hist = HISTORICAL_SALES[year];
  if (hist !== undefined) {
    return { Diesel: hist, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 };
  }
  return { Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 };
}

export function computeStockEmissions(
  annualSales: AnnualPTSales[],
  // Per-year (2026…2055) grey-hydrogen supply fraction. Omitted/undefined →
  // green-only (0), reproducing the Excel baseline.
  greyH2FractionByYear?: number[],
): SimulationResult {
  const dieselCounterfactualRate = computeWeightedDieselEmissionRate();

  // Stock arrays
  const stock: Record<Powertrain, number>[] = [];
  const prevStock: Record<Powertrain, number> = {
    Diesel: DIESEL_STOCK_END_2025,
    CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0,
  };

  // Per-bucket powertrain stock so segment/application stock reflects the real
  // per-bucket transition (not a static tivShare distribution). Bucket TIV
  // shares sum to ~1, so per-bucket sales reconcile with the aggregate.
  const totalShare = BUCKETS.reduce((s, b) => s + b.tivShare2045, 0);
  const bucketWeight = (b: typeof BUCKETS[number]) => b.tivShare2045 / totalShare;
  const emptyPT = (): Record<Powertrain, number> =>
    ({ Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 });

  const prevStockByBucket: Record<string, Record<Powertrain, number>> = {};
  for (const b of BUCKETS) {
    prevStockByBucket[b.id] = emptyPT();
    prevStockByBucket[b.id].Diesel = DIESEL_STOCK_END_2025 * bucketWeight(b);
  }

  // Per-bucket sales for any year: post-2025 from PTTM bucket shares × bucket
  // TIV; pre-2026 the historical (all-diesel) sales split by bucket weight.
  const bucketSalesAt = (yr: number): Record<string, Record<Powertrain, number>> => {
    const out: Record<string, Record<Powertrain, number>> = {};
    for (const b of BUCKETS) out[b.id] = emptyPT();
    if (yr >= START_YEAR) {
      const idx = yr - START_YEAR;
      if (idx >= 0 && idx < annualSales.length) {
        const tivY = TIV_PROJECTION[yr] ?? 0;
        for (const b of BUCKETS) {
          const sb = annualSales[idx].sharesByBucket[b.id];
          const tb = tivY * bucketWeight(b);
          for (const pt of POWERTRAINS) out[b.id][pt] = sb[pt] * tb;
        }
      }
      return out;
    }
    const hist = HISTORICAL_SALES[yr];
    if (hist !== undefined) for (const b of BUCKETS) out[b.id].Diesel = hist * bucketWeight(b);
    return out;
  };

  const years: AnnualResult[] = [];
  let totalZetSales = 0;
  let year50PctZet: number | null = null;
  let cumulativeCO2Avoided = 0;
  let dieselStockPeakYear = 2026;
  let dieselStockPeakValue = 0;

  for (let i = 0; i < YEAR_COUNT; i++) {
    const year = START_YEAR + i;
    const sales = annualSales[i].sales;
    const shares = annualSales[i].share;
    const tiv = TIV_PROJECTION[year] ?? 0;

    // Retirements: sales from 20 years ago
    const retireYear = year - SCRAPPAGE_AGE_YEARS;
    const retireSales = getSalesAtYear(retireYear, annualSales);

    // Pre-2001 diesel scrappage
    const pre2001Scrappage = year <= PRE_2001_SCRAPPAGE_END_YEAR
      ? PRE_2001_DIESEL_SCRAPPAGE_PER_YEAR : 0;

    const currentStock: Record<Powertrain, number> = {} as any;
    for (const pt of POWERTRAINS) {
      let s = prevStock[pt] + sales[pt] - retireSales[pt];
      if (pt === 'Diesel') s -= pre2001Scrappage;
      currentStock[pt] = Math.max(0, s);
    }

    // Emissions (BET rate falls each year as the grid decarbonises)
    const greyFrac = (year >= START_YEAR && greyH2FractionByYear)
      ? (greyH2FractionByYear[year - START_YEAR] ?? 0) : 0;
    const emissionRates = computeWeightedEmissionRate(year, greyFrac);
    const emissionsByPT: Record<Powertrain, number> = {} as any;
    let totalEmissions = 0;
    for (const pt of POWERTRAINS) {
      const e = currentStock[pt] * emissionRates[pt] / 1e9; // Mt CO2
      emissionsByPT[pt] = e;
      totalEmissions += e;
    }

    // Diesel counterfactual [fix #5]
    const totalStock = POWERTRAINS.reduce((s, pt) => s + currentStock[pt], 0);
    const dieselCounterfactualEmissions = totalStock * dieselCounterfactualRate / 1e9;

    cumulativeCO2Avoided += dieselCounterfactualEmissions - totalEmissions;

    // ZET metrics — Excel 'PTTM' Total ZET = BET + H2-ICE + H2-FCET (cols C+E+G).
    const zetSales = sales.BET + sales['H2-ICE'] + sales['H2-FCET'];
    totalZetSales += zetSales;
    const zetShare = tiv > 0 ? (sales.BET + sales['H2-ICE'] + sales['H2-FCET']) / tiv : 0;
    if (zetShare >= 0.5 && year50PctZet === null) {
      year50PctZet = year;
    }

    // Diesel stock peak
    if (currentStock.Diesel > dieselStockPeakValue) {
      dieselStockPeakValue = currentStock.Diesel;
      dieselStockPeakYear = year;
    }

    // ── Segment / Application breakdowns ──
    const curBucketSales = bucketSalesAt(year);
    const retireBucketSales = bucketSalesAt(retireYear);

    const salesBySegment: Record<string, number> = {};
    const salesByApplication: Record<string, number> = {};
    const stockBySegment: Record<string, number> = {};
    const stockByApplication: Record<string, number> = {};
    for (const seg of SEGMENTS) { salesBySegment[seg] = 0; stockBySegment[seg] = 0; }
    for (const app of APPLICATIONS) { salesByApplication[app] = 0; stockByApplication[app] = 0; }

    // Same breakdowns kept split by powertrain (the per-PT split is computed in
    // the bucket loop below anyway; here we keep it instead of collapsing it).
    const emptySegPT = (): Record<Powertrain, Record<string, number>> => {
      const o = {} as Record<Powertrain, Record<string, number>>;
      for (const pt of POWERTRAINS) { o[pt] = {}; for (const seg of SEGMENTS) o[pt][seg] = 0; }
      return o;
    };
    const emptyAppPT = (): Record<Powertrain, Record<string, number>> => {
      const o = {} as Record<Powertrain, Record<string, number>>;
      for (const pt of POWERTRAINS) { o[pt] = {}; for (const app of APPLICATIONS) o[pt][app] = 0; }
      return o;
    };
    const salesBySegmentPT = emptySegPT();
    const stockBySegmentPT = emptySegPT();
    const salesByApplicationPT = emptyAppPT();
    const stockByApplicationPT = emptyAppPT();

    // Per-bucket annual energy use (raw, pre-scaling). Diesel/CNG/LNG/H2 in their
    // fuel units (litres/kg), BET in kWh. Counterfactual = whole bucket as diesel.
    const energyRaw: Record<Powertrain, number> = emptyPT();
    let dieselCounterfactualLitresRaw = 0;

    for (const b of BUCKETS) {
      const seg = SEGMENT_OF_BUCKET[b.id];
      const app = APPLICATION_OF_BUCKET[b.id];

      // Roll per-bucket stock forward with this bucket's sales and retirements.
      const curStockB = emptyPT();
      let bucketSales = 0;
      let bucketStock = 0;
      for (const pt of POWERTRAINS) {
        bucketSales += curBucketSales[b.id][pt];
        let s = prevStockByBucket[b.id][pt] + curBucketSales[b.id][pt] - retireBucketSales[b.id][pt];
        if (pt === 'Diesel') s -= pre2001Scrappage * bucketWeight(b);
        curStockB[pt] = Math.max(0, s);
        bucketStock += curStockB[pt];
        salesBySegmentPT[pt][seg] += curBucketSales[b.id][pt];
        stockBySegmentPT[pt][seg] += curStockB[pt];
        salesByApplicationPT[pt][app] += curBucketSales[b.id][pt];
        stockByApplicationPT[pt][app] += curStockB[pt];
      }
      prevStockByBucket[b.id] = curStockB;

      // Energy = stock × annual km / efficiency (BET: × kWh-per-km).
      energyRaw.Diesel    += curStockB.Diesel    * b.annualKm / b.dieselKMPL;
      energyRaw.CNG       += curStockB.CNG        * b.annualKm / b.cngKmPerKg;
      energyRaw.LNG       += curStockB.LNG        * b.annualKm / b.lngKmPerKg;
      energyRaw.BET       += curStockB.BET        * b.annualKm * b.betKwhPerKm;
      energyRaw['H2-ICE'] += curStockB['H2-ICE']  * b.annualKm / b.h2iceKmPerKg;
      energyRaw['H2-FCET']+= curStockB['H2-FCET'] * b.annualKm / b.fcetKmPerKg;
      dieselCounterfactualLitresRaw += bucketStock * b.annualKm / b.dieselKMPL;

      salesBySegment[seg] += bucketSales;
      salesByApplication[app] += bucketSales;
      stockBySegment[seg] += bucketStock;
      stockByApplication[app] += bucketStock;
    }

    // Scale to display units: litres→million litres, kg→million kg, kWh→TWh.
    const energyByPT: Record<Powertrain, number> = {
      Diesel:    energyRaw.Diesel / 1e6,
      CNG:       energyRaw.CNG / 1e6,
      LNG:       energyRaw.LNG / 1e6,
      BET:       energyRaw.BET / 1e9,
      'H2-ICE':  energyRaw['H2-ICE'] / 1e6,
      'H2-FCET': energyRaw['H2-FCET'] / 1e6,
    };
    const dieselCounterfactualLitres = dieselCounterfactualLitresRaw / 1e6;

    years.push({
      year,
      tiv,
      salesByPT: { ...sales },
      shareByPT: { ...shares },
      stockByPT: { ...currentStock },
      emissionsByPT,
      totalEmissions,
      dieselCounterfactualEmissions,
      zetShare,
      energyByPT,
      dieselCounterfactualLitres,
      salesBySegment,
      stockBySegment,
      salesByApplication,
      stockByApplication,
      salesBySegmentPT,
      stockBySegmentPT,
      salesByApplicationPT,
      stockByApplicationPT,
    });

    // Advance stock
    for (const pt of POWERTRAINS) {
      prevStock[pt] = currentStock[pt];
    }
  }

  // DEBUG
  if (typeof window !== 'undefined' && (window as any).__SIM_DEBUG__) {
    const y2030 = years.find(y => y.year === 2030);
    const y2045 = years.find(y => y.year === 2045);
    if (y2030) {
      const total2030 = POWERTRAINS.reduce((s, pt) => s + y2030.stockByPT[pt], 0);
      console.log(`[StockEmissions DEBUG] 2030 total stock: ${Math.round(total2030).toLocaleString()}`);
    }
    if (y2045) {
      const total2045 = POWERTRAINS.reduce((s, pt) => s + y2045.stockByPT[pt], 0);
      console.log(`[StockEmissions DEBUG] 2045 total stock: ${Math.round(total2045).toLocaleString()}`);
    }
  }

  return {
    years,
    totalZetSales: Math.round(totalZetSales),
    year50PctZet,
    cumulativeCO2Avoided,
    dieselStockPeakYear,
    dieselStockPeakValue: Math.round(dieselStockPeakValue),
  };
}
