/**
 * Stock evolution & emissions calculation.
 */
import type { Powertrain } from '@/lib/constants/extracted';
import {
  POWERTRAINS,
  BUCKETS,
  HISTORICAL_SALES,
  TIV_PROJECTION,
  DIESEL_STOCK_END_2024,
  SCRAPPAGE_AGE_YEARS,
  PRE_2001_DIESEL_SCRAPPAGE_PER_YEAR,
  PRE_2001_SCRAPPAGE_END_YEAR,
  EMISSION_FACTORS,
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

function computeWeightedEmissionRate(): Record<Powertrain, number> {
  const rates: Record<Powertrain, number> = {
    Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0,
  };
  let totalWeight = 0;
  for (const b of BUCKETS) {
    rates.Diesel += (b.annualKm / b.dieselKMPL * EMISSION_FACTORS.diesel_kgCO2e_per_l) * b.tivShare2045;
    rates.CNG += (b.annualKm / b.cngKmPerKg * EMISSION_FACTORS.cng_kgCO2e_per_kg) * b.tivShare2045;
    rates.LNG += (b.annualKm / b.lngKmPerKg * EMISSION_FACTORS.lng_kgCO2e_per_kg) * b.tivShare2045;
    rates.BET += (b.annualKm * b.betKwhPerKm * EMISSION_FACTORS.bet_kgCO2e_per_kwh) * b.tivShare2045;
    rates['H2-ICE'] += (b.annualKm * EMISSION_FACTORS.h2ice_green_kgCO2e_per_km) * b.tivShare2045;
    rates['H2-FCET'] += (b.annualKm * EMISSION_FACTORS.h2fcet_green_kgCO2e_per_km) * b.tivShare2045;
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
  // Pre-2025: all diesel
  const hist = HISTORICAL_SALES[year];
  if (hist !== undefined) {
    return { Diesel: hist, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 };
  }
  return { Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 };
}

export function computeStockEmissions(annualSales: AnnualPTSales[]): SimulationResult {
  const emissionRates = computeWeightedEmissionRate();
  const dieselCounterfactualRate = computeWeightedDieselEmissionRate();

  // Stock arrays
  const stock: Record<Powertrain, number>[] = [];
  const prevStock: Record<Powertrain, number> = {
    Diesel: DIESEL_STOCK_END_2024,
    CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0,
  };

  const years: AnnualResult[] = [];
  let totalZetSales = 0;
  let year50PctZet: number | null = null;
  let cumulativeCO2Avoided = 0;
  let dieselStockPeakYear = 2025;
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

    // Emissions
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

    // ZET metrics
    const zetSales = sales.BET + sales['H2-FCET'];
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
    // Sales by bucket = per-bucket share × bucket TIV (proportional to tivShare2045).
    const tivByBucket: Record<string, number> = {};
    const totalShare = BUCKETS.reduce((s, b) => s + b.tivShare2045, 0);
    for (const b of BUCKETS) {
      tivByBucket[b.id] = tiv * (b.tivShare2045 / totalShare);
    }

    const salesBySegment: Record<string, number> = {};
    const salesByApplication: Record<string, number> = {};
    for (const seg of SEGMENTS) salesBySegment[seg] = 0;
    for (const app of APPLICATIONS) salesByApplication[app] = 0;

    const bucketShares = annualSales[i].sharesByBucket;
    for (const b of BUCKETS) {
      const sb = bucketShares[b.id];
      let bucketSales = 0;
      for (const pt of POWERTRAINS) bucketSales += sb[pt] * tivByBucket[b.id];
      const seg = SEGMENT_OF_BUCKET[b.id];
      const app = APPLICATION_OF_BUCKET[b.id];
      salesBySegment[seg] = (salesBySegment[seg] ?? 0) + bucketSales;
      salesByApplication[app] = (salesByApplication[app] ?? 0) + bucketSales;
    }

    // Stock by segment / application: distribute total stock across buckets by
    // bucket tivShare (steady-state weight). A reasonable approximation until
    // per-bucket stock history is tracked.
    const totalStockAll = totalStock;
    const stockBySegment: Record<string, number> = {};
    const stockByApplication: Record<string, number> = {};
    for (const seg of SEGMENTS) stockBySegment[seg] = 0;
    for (const app of APPLICATIONS) stockByApplication[app] = 0;
    for (const b of BUCKETS) {
      const share = b.tivShare2045 / totalShare;
      const seg = SEGMENT_OF_BUCKET[b.id];
      const app = APPLICATION_OF_BUCKET[b.id];
      stockBySegment[seg] = (stockBySegment[seg] ?? 0) + totalStockAll * share;
      stockByApplication[app] = (stockByApplication[app] ?? 0) + totalStockAll * share;
    }

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
      salesBySegment,
      stockBySegment,
      salesByApplication,
      stockByApplication,
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
