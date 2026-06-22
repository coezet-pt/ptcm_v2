#!/usr/bin/env python3
"""
Generate 2026-rebased constants from 'CoEZET PTCM v2.xlsx' (source of truth).
Prints ready-to-paste TS literals + scalar anchors for extracted.ts.

Year->column: 2025=C(3); year Y -> col 3 + (Y-2025).
  2026=4, 2030=8, 2035=13, 2040=18, 2045=23, 2050=28, 2055=33
"""
import sys
from pathlib import Path
import openpyxl

WB = Path(sys.argv[1] if len(sys.argv) > 1 else "CoEZET PTCM v2.xlsx")
wb = openpyxl.load_workbook(WB, data_only=True)
cw = wb["Changing with year"]
osum = wb["Output Summary"]
emis = wb["Emissions "]

def col(year): return 3 + (year - 2025)
def val(ws, r, c): return ws.cell(r, c).value
def num(v): return float(v) if isinstance(v, (int, float)) else 0.0

def deltas_from_row(r):
    """baseValue@2026 + 6 endpoint CAGRs matching buildSeriesFromConfig ranges."""
    v = {y: num(val(cw, r, col(y))) for y in (2026, 2030, 2035, 2040, 2045, 2050, 2055)}
    base = v[2026]
    def cagr(a, b, n):
        if a <= 0 or b <= 0: return 0.0
        return (b / a) ** (1 / n) - 1
    return base, [
        cagr(v[2026], v[2030], 4),   # d2530 -> 2027..2030 (4 steps from 2026 base)
        cagr(v[2030], v[2035], 5),   # d3135
        cagr(v[2035], v[2040], 5),   # d3640
        cagr(v[2040], v[2045], 5),   # d4145
        cagr(v[2045], v[2050], 5),   # d4650
        cagr(v[2050], v[2055], 5),   # d5155
    ]

PARAM_ROWS = {
    "diesel_price_per_l": 3, "adblue_per_l": 4, "cng_price_per_kg": 5,
    "lng_price_per_kg": 6, "green_h2_production_per_kg": 11,
    "grey_h2_production_per_kg": 12, "grey_h2_blend_fraction": 13,
    "h2_compression_storage_per_kg": 14, "electricity_incl_caas_per_kwh": 18,
    "battery_cost_per_kwh": 19, "fuel_cell_cost_per_kw": 20,
    "lng_tank_cost_per_kg": 21, "lng_valves_piping_per_vehicle": 22,
    "h2_tank_cost_per_kg": 23,
}

print("=" * 70)
print("BAU_PARAMETERS cost trajectories (2026 base + recomputed deltas)")
print("=" * 70)
for name, r in PARAM_ROWS.items():
    base, d = deltas_from_row(r)
    bv = f"{base:.4f}".rstrip("0").rstrip(".") if base else "0"
    ds = ", ".join(f"{name2}: {x:+.4f}" for name2, x in zip(
        ["d2530", "d3135", "d3640", "d4145", "d4650", "d5155"], d))
    print(f"  {name:30s} {{ baseValue: {bv:>10}, {ds} }},")

# Vehicle base prices @2026
SIZES = ['15T Rigid','19T Rigid','28T Rigid','35T Rigid','48T Rigid',
         '28T Tipper','35T Tipper','40T Tractor','55T Tractor']
eng_rows = list(range(26, 35)); ep_rows = list(range(37, 46)); dt_rows = list(range(81, 90))
print("\n" + "=" * 70)
print("VEHICLE_BASE_PRICES_2026")
print("=" * 70)
for i, s in enumerate(SIZES):
    et = num(val(cw, eng_rows[i], 4)); ep = num(val(cw, ep_rows[i], 4)); dt = num(val(cw, dt_rows[i], 4))
    print(f"  '{s}': {{ engine_trans: {et:.0f}, e_powertrain: {ep:.0f}, diesel_total: {dt:.0f} }},")

# CNG tank base @2026 (15T small vs large), from CNG cost - diesel cost
cng_15t = num(val(cw, 92, 4)) - num(val(cw, 81, 4))   # 15T
cng_19t = num(val(cw, 93, 4)) - num(val(cw, 82, 4))   # 19T (large)
print(f"\nCNG_TANK_BASE_SMALL (15T) @2026 = {cng_15t:.0f}")
print(f"CNG_TANK_BASE_LARGE       @2026 = {cng_19t:.0f}")

# Per-bucket OPEX calibration
# bucket -> size index (into SIZES / toll & manpower rows)
B_SIZE_IDX = [1,2,4,1,2,0,5,6,4,8,8,2,2,7]
B_ANNUAL_KM = [108000,99000,108000,108000,108000,120000,67200,67200,115200,108000,96000,75000,90000,60000]
toll_rows = list(range(265, 274)); mpi_rows = list(range(287, 296)); mpz_rows = list(range(298, 307))

print("\n" + "=" * 70)
print("BUCKET_OPEX_CALIBRATION (2026-anchored, full literal)")
print("=" * 70)
for i in range(14):
    bid = f"B{i+1}"
    mbet = [num(val(cw, 217+i, c)) for c in (4, 23, 28, 33)]
    mfcet = [num(val(cw, 249+i, c)) for c in (4, 23, 28, 33)]
    si = B_SIZE_IDX[i]; km = B_ANNUAL_KM[i]
    toll26 = num(val(cw, toll_rows[si], 4)) * km
    toll45 = num(val(cw, toll_rows[si], 23)) * km
    mpi = [num(val(cw, mpi_rows[si], 4)), num(val(cw, mpi_rows[si], 23))]
    mpz = [num(val(cw, mpz_rows[si], 4)), num(val(cw, mpz_rows[si], 23))]
    cng = ""
    if bid == "B7":
        cng = f", manpowerCng: [{num(val(cw, mpi_rows[si],4)):.0f}, {num(val(cw, mpi_rows[si],23)):.0f}]"
    print(f"  {bid}: {{ maintBET: [{mbet[0]:.3f}, {mbet[1]:.3f}, {mbet[2]:.3f}, {mbet[3]:.3f}], "
          f"maintFCET: [{mfcet[0]:.3f}, {mfcet[1]:.3f}, {mfcet[2]:.3f}, {mfcet[3]:.3f}], "
          f"tollPerYear: [{toll26:.2f}, {toll45:.2f}], "
          f"manpowerIce: [{mpi[0]:.0f}, {mpi[1]:.0f}], manpowerZet: [{mpz[0]:.0f}, {mpz[1]:.0f}]{cng} }},")

# BUCKETS maint @2026 (diesel r153+i, cnglng r185+i)
print("\n" + "=" * 70)
print("BUCKETS maint @2026: maintDieselPerKm, maintCngLngH2icePerKm")
print("=" * 70)
for i in range(14):
    md = num(val(cw, 153+i, 4)); mc = num(val(cw, 185+i, 4))
    print(f"  B{i+1}: maintDieselPerKm: {md:.4f}, maintCngLngH2icePerKm: {mc:.4f}")

# Scalar anchors
print("\n" + "=" * 70)
print("SCALAR ANCHORS")
print("=" * 70)
print(f"CNG_UNITS_2026 (OutSum r30 J) = {num(val(osum,30,10)):.0f}")
print(f"LNG_UNITS_2026 (OutSum r30 L) = {num(val(osum,30,12)):.0f}")
print(f"TIV 2026       (OutSum r30 N) = {num(val(osum,30,14)):.0f}")
print(f"bet_grid_2026  (Emissions r49 C) = {num(val(emis,49,3))}")
# stock baseline end-2025 (OutSum r29 stock cols): Diesel C=3,BET E=5,CNG K=11,LNG M=13
d25 = num(val(osum,29,3)); bet25 = num(val(osum,29,5)); cng25 = num(val(osum,29,11)); lng25 = num(val(osum,29,13))
print(f"end-2025 stock: Diesel={d25:.0f} BET={bet25:.0f} CNG={cng25:.0f} LNG={lng25:.0f} total={d25+bet25+cng25+lng25:.0f}")
print(f"2025 total sales (OutSum r29 N) = {num(val(osum,29,14)):.0f}")
print(f"2026 total sales (OutSum r30 N) = {num(val(osum,30,14)):.0f}")
print(f"2026 diesel sales (OutSum r30 B) = {num(val(osum,30,2)):.0f}")
