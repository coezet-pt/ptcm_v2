/**
 * Sanity checks for SimulationResult — validates against BAU baseline expectations.
 */
import type { SimulationResult, SanityCheckResult } from '@/lib/types';
import { BAU_BASELINE_CHECKS, POWERTRAINS } from '@/lib/constants/extracted';

function check(
  name: string,
  actual: number,
  expected: string,
  passed: boolean,
  message: string,
): SanityCheckResult {
  return { name, passed, expected, actual: String(actual), message };
}

function yearData(result: SimulationResult, year: number) {
  return result.years.find(y => y.year === year);
}

export function runSanityChecks(result: SimulationResult): SanityCheckResult[] {
  const checks: SanityCheckResult[] = [];
  const bc = BAU_BASELINE_CHECKS;

  // Total sales checks at 2025, 2045, 2055
  for (const [key, { value, tolerance }] of Object.entries({
    total_sales_2025: bc.total_sales_2025,
    total_sales_2045: bc.total_sales_2045,
    total_sales_2055: bc.total_sales_2055,
  })) {
    const year = parseInt(key.split('_').pop()!);
    const yd = yearData(result, year);
    const totalSales = yd ? POWERTRAINS.reduce((s, pt) => s + yd.salesByPT[pt], 0) : 0;
    const lo = value * (1 - tolerance);
    const hi = value * (1 + tolerance);
    checks.push(check(
      key,
      Math.round(totalSales),
      `${Math.round(lo).toLocaleString()}–${Math.round(hi).toLocaleString()}`,
      totalSales >= lo && totalSales <= hi,
      `Total sales in ${year}: ${Math.round(totalSales).toLocaleString()} (target: ${value.toLocaleString()} ±${(tolerance * 100).toFixed(0)}%)`,
    ));
  }

  // ZET share checks
  const y2045 = yearData(result, 2045);
  const y2055 = yearData(result, 2055);

  if (y2045) {
    checks.push(check(
      'zet_share_2045',
      parseFloat((y2045.zetShare * 100).toFixed(2)),
      `${(bc.zet_share_2045_min * 100).toFixed(0)}%–${(bc.zet_share_2045_max * 100).toFixed(0)}%`,
      y2045.zetShare >= bc.zet_share_2045_min && y2045.zetShare <= bc.zet_share_2045_max,
      `ZET share 2045: ${(y2045.zetShare * 100).toFixed(1)}%`,
    ));
  }

  if (y2055) {
    checks.push(check(
      'zet_share_2055',
      parseFloat((y2055.zetShare * 100).toFixed(2)),
      `${(bc.zet_share_2055_min * 100).toFixed(0)}%–${(bc.zet_share_2055_max * 100).toFixed(0)}%`,
      y2055.zetShare >= bc.zet_share_2055_min && y2055.zetShare <= bc.zet_share_2055_max,
      `ZET share 2055: ${(y2055.zetShare * 100).toFixed(1)}%`,
    ));
  }

  // Diesel 2025
  const y2025 = yearData(result, 2025);
  if (y2025) {
    const d = y2025.salesByPT.Diesel;
    checks.push(check(
      'diesel_2025_units',
      Math.round(d),
      `${bc.diesel_2025_units_min.toLocaleString()}–${bc.diesel_2025_units_max.toLocaleString()}`,
      d >= bc.diesel_2025_units_min && d <= bc.diesel_2025_units_max,
      `Diesel sales 2025: ${Math.round(d).toLocaleString()}`,
    ));
  }

  // CNG share checks
  const y2030 = yearData(result, 2030);
  if (y2030) {
    const cngShare2030 = y2030.shareByPT.CNG;
    checks.push(check(
      'cng_share_2030',
      parseFloat((cngShare2030 * 100).toFixed(3)),
      '1%–15%',
      cngShare2030 >= 0.01 && cngShare2030 <= 0.15,
      `CNG share 2030: ${(cngShare2030 * 100).toFixed(2)}%`,
    ));
  }
  if (y2045) {
    const cngShare2045 = y2045.shareByPT.CNG;
    checks.push(check(
      'cng_share_2045',
      parseFloat((cngShare2045 * 100).toFixed(3)),
      '≥2%',
      cngShare2045 >= 0.02,
      `CNG share 2045: ${(cngShare2045 * 100).toFixed(2)}%`,
    ));
  }
  if (y2055) {
    const cngShare2055 = y2055.shareByPT.CNG;
    checks.push(check(
      'cng_share_2055',
      parseFloat((cngShare2055 * 100).toFixed(3)),
      '≤0.5%',
      cngShare2055 <= 0.005,
      `CNG share 2055: ${(cngShare2055 * 100).toFixed(2)}%`,
    ));
  }

  // LNG share checks — Excel PTTM (BAU): 0.14% in 2030, 0.48% in 2045
  if (y2030) {
    const lngShare2030 = y2030.shareByPT.LNG;
    checks.push(check(
      'lng_share_2030',
      parseFloat((lngShare2030 * 100).toFixed(3)),
      '0.05%–0.5%',
      lngShare2030 >= 0.0005 && lngShare2030 <= 0.005,
      `LNG share 2030: ${(lngShare2030 * 100).toFixed(2)}%`,
    ));
  }
  if (y2045) {
    const lngShare2045 = y2045.shareByPT.LNG;
    checks.push(check(
      'lng_share_2045',
      parseFloat((lngShare2045 * 100).toFixed(3)),
      '0.1%–1.5%',
      lngShare2045 >= 0.001 && lngShare2045 <= 0.015,
      `LNG share 2045: ${(lngShare2045 * 100).toFixed(2)}%`,
    ));
  }
  if (y2055) {
    const lngShare2055 = y2055.shareByPT.LNG;
    checks.push(check(
      'lng_share_2055',
      parseFloat((lngShare2055 * 100).toFixed(3)),
      '≤0.5%',
      lngShare2055 <= 0.005,
      `LNG share 2055: ${(lngShare2055 * 100).toFixed(2)}%`,
    ));
  }

  return checks;
}
