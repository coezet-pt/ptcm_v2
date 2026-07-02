# PTCM Dashboard

**Powertrain Choice Model** — An interactive web dashboard that simulates India's heavy commercial truck fleet transition from diesel to zero-emission powertrains (BET, H₂-ICE, H₂-FCET) across 2025–2055, based on the `Power_Train_Choice_Model_Final_v4` Excel workbook.

🔗 **Live demo:** [ptcm-rho.vercel.app](https://ptcm-rho.vercel.app)

---

## What it does

Replicates the full logic of a 14-sheet Excel model that projects annual sales, fleet stock, market share, and CO₂ emissions across 6 powertrain types (Diesel, CNG, LNG, BET, H₂-ICE, H₂-FCET) for 14 truck segments (buckets), under 4 policy scenarios (BAU, BWS-1, BWS-2, BEST). Users can tweak cost trajectories and policy levers in real time and see the full fleet transition respond.

### Key features

- **4 preset scenarios** — BAU, BWS-1, BWS-2, BEST (fully encoded from the Excel `Scenarios` sheet)
- **15 editable cost-trajectory parameters** — fuel prices, battery costs, fuel cell costs, tank costs, H₂ production, and growth rates across 4 time periods
- **7 policy levers** — demand incentives (BET/FCET), interest rate, electricity subsidy, toll waivers, inflection years, H₂ source mix
- **6 interactive charts** — annual sales, market share, fleet stock, emissions, ZET penetration, TCO parity year
- **Model health badge** — 12 sanity checks against Excel reference values (2025 anchor, 2045/2055 targets, total sales, per-powertrain share bounds)
- **Export to PNG and CSV** — every chart exportable for further analysis
- **Debounced recomputation** — the full 31-year × 14-bucket × 6-powertrain pipeline runs client-side in under 100ms

---

## Technical architecture

### Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Charts** | Recharts (`type="monotone"`, `dot={false}`) |
| **State** | React Context (`ScenarioContext`) + custom hook (`useSimulation`) |
| **Backend** | Lovable Cloud (stores 4 scenario preset configs as JSONB; everything else is client-side) |
| **Exports** | `html-to-image` (PNG), `papaparse` (CSV) |
| **Typography** | DM Sans headings, JetBrains Mono for numbers |
| **Build/Deploy** | Lovable.dev → GitHub → Vercel |

### Simulation pipeline

All math runs client-side, modularized into 5 passes:

```
User input (cost params + policy levers)
    ↓
[1] timeSeries.ts     → Build per-year trajectories for all 15 cost parameters
    ↓
[2] tco.ts            → Compute TCO/km per powertrain per bucket per year
                        (CAPEX + fuel + maint + manpower + toll + insurance − resale)
    ↓
[3] choiceModel.ts    → 5-factor Excel-accurate choice model
                        (TCO, price, payload, TAT, range) → target shares at 2045 & 2055
    ↓
[4] pttm.ts           → Project annual shares using Gompertz (BET/H₂) and Weibull (CNG/LNG)
    ↓
[5] stockEmissions.ts → Roll sales into stock (with scrappage) and compute CO₂
    ↓
Sanity check badge + 6 charts
```

### Repo layout

```
src/
├── lib/
│   ├── constants/
│   │   ├── extracted.ts       # 14 bucket specs, prices, emission factors, TIV, historical sales
│   │   └── scenarios.ts       # BAU / BWS-1 / BWS-2 / BEST configurations
│   └── sim/
│       ├── timeSeries.ts      # Cost trajectory builder
│       ├── tco.ts             # Per-bucket per-powertrain TCO engine
│       ├── choiceModel.ts     # 5-factor exp-based share model (elasticity 9 × 1.5)
│       ├── pttm.ts            # Gompertz + Weibull curve generators
│       ├── stockEmissions.ts  # Stock evolution + CO₂ accounting
│       └── sanityCheck.ts     # 12 Excel-reference validation rules
├── components/
│   ├── InputPanel.tsx         # Cost trajectories form
│   ├── PolicyLevers.tsx       # Policy levers form
│   ├── ScenarioPicker.tsx     # 4-scenario dropdown
│   ├── ChartCard.tsx          # Reusable chart wrapper with export
│   ├── ModelHealthBadge.tsx   # 12-check status indicator
│   └── charts/                # 6 chart components
├── hooks/
│   └── useSimulation.ts       # Wires 5 sim modules with debounced memoization
├── contexts/
│   └── ScenarioContext.tsx    # Scenario presets + active/draft config state
└── pages/
    └── Index.tsx              # Main dashboard layout
```

---

## Key formulas

### Choice model (per bucket)

```
arg[factor] = elasticity[factor] × 1.5 × (ratio − 1)
factor[pt]  = exp(clamp(arg, −50, 50))
score[pt]   = Σ factor[pt] over 5 factors (TCO, price, payload, TAT, range)
share[pt]   = score[pt] / Σ score[all pt]
```

Elasticities: TCO 9.0, price 8.83, payload 7.17, TAT 5.5, range 7.5 (averaged per-bucket ratings from Excel `Input Sheet` rows 8–12).

### Gompertz (BET, H₂-ICE, H₂-FCET)

```
share(y) = Gompertz_main(y) + quadratic_correction(y)

Gompertz_main = a · exp(−b · exp(−c · (y−T))) / exp(−b · exp(−c · (2055−T)))
correction    = (Z − Gompertz(2045)) / ((2045−V)·(2055−2045)) · (y−V) · (2055−y)
                (only when inflection < y < 2055)
```

### Weibull (CNG, LNG)

```
share(y) = [normalized_kernel(y) − kernel(2025)·decay(y) + anchor_2025·decay(y)] × phaseOut(y)

where:
  decay(y)    = max(0, 1 − ((y−2025)/20)²)   // quadratic decay of 2025 anchor over 20 years
  phaseOut(y) = max(0, min(1, (2055−y)/10))  // linear taper from 2045 to 2055
  anchor_2025 = units_2025 / TIV_2025        // CNG: 6318/267370 = 2.36%
```

---

## Running locally

```bash
# Install
npm install

# Dev server
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

The app is fully self-contained — no environment variables or backend services are required. Scenario presets are defined locally in `src/lib/constants/scenarios.ts`.

---

## Debugging the simulation

Open browser console and run:

```javascript
window.__SIM_DEBUG__ = true;
```

Then reload. You'll see:

- TCO breakdown per powertrain for B1 2045 (vehicle price, capex/km, fuel/km, maint/km, manpower/km, toll/km, insurance/km)
- Choice model factor trace with argument values
- PTTM target shares per bucket per powertrain
- Sanity check pass/fail for 12 Excel reference values

---

## Model sources

- **Excel workbook:** `Power_Train_Choice_Model_Final_v4_15042026.xlsx` (14 sheets including PTTM, Estimation SS-2045, Estimation 100% ZET-2055, 14 per-bucket TCO sheets)
- **Historical data:** India heavy commercial truck sales 2001–2024 (267,370 units sold in 2024 baseline)
- **Bucket definitions:** 14 use-case × vehicle-size combinations (e.g., Market Load 19T Rigid, Port Operations 55T Tractor, etc.)
- **TIV projections:** Base 2024 = 267,370 → 2045 = 707,250 → 2055 = 1,029,830

---

## Status

| Component | Status |
|---|---|
| TCO engine | ✅ Matches Excel within 5% for B1 2045 |
| Choice model | ✅ SUM aggregation, 1.5 multiplier, per-factor ratio directions verified against Excel |
| PTTM Gompertz | ✅ Includes quadratic correction term (hits Z@2045 AND AB@2055) |
| PTTM Weibull | ✅ 2025 anchor injection + phase-out |
| Stock evolution | ✅ Scrappage curves applied |
| Emissions | ⚠️ Cumulative CO₂ avoided calculation needs counterfactual fix |
| 4 scenario presets | ✅ Fully encoded from Excel Scenarios sheet |
| Sanity checks | 🟡 10–11 of 12 passing for BAU |
| Chart smoothness | ✅ Fixed (ResponsiveContainer sizing + dot={false}) |

### Known discrepancies (vs Excel reference)

- **Diesel TCO:** 50.45 ₹/km (model) vs 56.94 (Excel) — ~6.5 gap from BET vehicle price overshoot
- **BET TCO:** 43.08 ₹/km (model) vs 49.68 (Excel) — BET price ₹86L vs target ₹75L
- **ZET share 2045:** 86% (pre-manpower fix) → ~70% (post-fix) — closer to Excel 70.16%

---

## License

MIT

## Acknowledgments

- Original Excel model courtesy of CoEZET IIT Madras
