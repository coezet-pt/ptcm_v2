# PTCM Dashboard

**Powertrain Choice Model** — an interactive web dashboard that simulates India's medium &
heavy-duty truck fleet transition from diesel to zero-emission powertrains (BET, H₂-ICE,
H₂-FCET) across **2026–2055**, replicating the CoEZET IIT Madras Excel model.

🔗 **Live:** [ptcm-rho.vercel.app](https://ptcm-rho.vercel.app)
📚 **Full documentation:** [`docs/`](docs/README.md) — start with
[docs/01-getting-started.md](docs/01-getting-started.md)

---

## Quick start

```bash
npm install
npm run dev        # → http://localhost:8080
npm test           # 17 tests, incl. 12 Excel-reference sanity checks
npm run build      # → dist/
```

No environment variables, no backend, no database. Everything runs in the browser.

## What it does

Reproduces a ~50-sheet Excel workbook (`CoEZET PTCM v2.xlsx`, committed at the repo root)
that projects annual sales, fleet stock, market share, CO₂ emissions and energy demand across
**6 powertrains × 14 truck buckets × 30 years**. Users adjust cost trajectories and policy
levers and watch the fleet transition respond.

- **11 editable cost trajectories** — fuel and energy prices, battery, fuel cell, tanks —
  each with a 2026 base value, six 5-year CAGR bands, and optional per-year pins
- **Policy levers** — funding terms, ZET toll waiver, GVW allowance, hydrogen source mix,
  battery/fuel-cell life
- **13 charts** across three tabs — powertrain projection, emissions impact, energy impact —
  each with a data table and PNG/CSV/Excel export
- **Parameter file round-trip** — download the full configuration as CSV or Excel, edit it,
  upload it back
- **PDF report** — every chart plus the parameter tables, paginated onto A4
- **Model health badge** — 12 live sanity checks against Excel reference values

## Simulation pipeline

All client-side, five pure stages, under 100 ms end to end:

```
config → timeSeries.ts    cost trajectories 2026→2055
       → tco.ts           TCO/km per bucket × powertrain × year
       → choiceModel.ts   5-factor share model → 2045 / 2050 / 2055 anchors
       → pttm.ts          Gompertz (BET/H₂) + Weibull (CNG/LNG) → annual shares
       → stockEmissions.ts fleet stock, CO₂, energy, segment/application splits
```

See [docs/03-model-reference.md](docs/03-model-reference.md) for the formulas, the Excel
sheet provenance, and the deliberately reproduced workbook quirks.

## Stack

React 18 · TypeScript · Vite 5 · Tailwind + shadcn/ui · Recharts · React Context ·
jsPDF / SheetJS / PapaParse for exports · deployed on Vercel from `main`.

## Documentation

| Doc | Contents |
|---|---|
| [01-getting-started](docs/01-getting-started.md) | Setup, commands, repo tour, debugging |
| [02-architecture](docs/02-architecture.md) | State model, pipeline, rendering, conventions |
| [03-model-reference](docs/03-model-reference.md) | Formulas, Excel provenance, calibration, quirks |
| [04-parameters-and-ui](docs/04-parameters-and-ui.md) | Every input → the code that consumes it; charts and exports |
| [05-deployment](docs/05-deployment.md) | Current GitHub → Vercel setup |
| [06-iitm-integration](docs/06-iitm-integration.md) | Hosting/embedding this on an IITM site |
| [07-gotchas-and-backlog](docs/07-gotchas-and-backlog.md) | Traps, known discrepancies, cleanup list |

## Acknowledgments

Model and source workbook courtesy of **CoEZET, IIT Madras**.

## License

MIT for the application code. The model, the workbook and the underlying data are CoEZET
IITM's — see [docs/07](docs/07-gotchas-and-backlog.md#backlog--cleanup-roughly-in-priority-order),
this needs to be settled explicitly before institutional publication.
