# PTCM Dashboard

**PTCM = Powertrain Choice Model.** A web dashboard that projects India's medium &
heavy-duty truck fleet moving from diesel to zero-emission powertrains (BET, H₂-ICE,
H₂-FCET) from **2026 to 2055**. It reproduces the CoEZET IIT Madras Excel model.

🔗 **Live:** [ptcm-rho.vercel.app](https://ptcm-rho.vercel.app)
📚 **Docs:** [`docs/`](docs/README.md) — start with
[docs/01-getting-started.md](docs/01-getting-started.md)

---

## Quick start

```bash
npm install
npm run dev        # → http://localhost:8080
npm test           # 37 tests, incl. 12 checks against Excel values
npm run build      # → dist/
```

No environment variables, no backend, no database. Everything runs in the browser.

## What it does

Reproduces a ~50-sheet Excel workbook (`CoEZET PTCM v2.xlsx`, committed at the repo root)
that projects annual sales, fleet stock, market share, CO₂ emissions and energy demand across
**6 powertrains × 14 truck types × 30 years**. Users change costs and policy settings and
watch the transition respond.

- **11 editable cost trajectories** — fuel and energy prices, battery, fuel cell, tanks —
  each with a 2026 value, six 5-year growth rates, and optional per-year pins
- **Policy settings** — funding terms, ZET toll waiver, extra GVW allowance, hydrogen source
  mix, battery and fuel-cell life
- **13 charts** across three tabs — powertrain projection, emissions, energy — each with a
  data table and PNG/CSV/Excel export
- **Settings file** — download all settings as CSV or Excel, edit, upload back
- **PDF report** — every chart plus the settings tables, laid out on A4
- **Model health badge** — 12 live checks against Excel reference values

## How the calculation works

Five stages, all in the browser, under 100 ms end to end:

```
config → timeSeries.ts    cost trajectories 2026→2055
       → tco.ts           cost per km per truck type × powertrain × year
       → choiceModel.ts   5-factor share model → 2045 / 2050 / 2055 targets
       → pttm.ts          Gompertz (BET/H₂) + Weibull (CNG/LNG) → yearly shares
       → stockEmissions.ts fleet stock, CO₂, energy, segment/application splits
```

See [docs/03-model-reference.md](docs/03-model-reference.md) for the formulas, which Excel
sheet each came from, and the workbook mistakes reproduced on purpose.

## Stack

React 18 · TypeScript · Vite 5 · Tailwind + shadcn/ui · Recharts · React Context ·
jsPDF / SheetJS / PapaParse for exports · deployed on Vercel from `main`.

## Documentation

| Doc | Contents |
|---|---|
| [01-getting-started](docs/01-getting-started.md) | Setup, commands, repo tour, debugging |
| [02-architecture](docs/02-architecture.md) | State, the 5 stages, rendering, conventions |
| [03-model-reference](docs/03-model-reference.md) | Formulas, Excel sources, checks, quirks |
| [04-parameters-and-ui](docs/04-parameters-and-ui.md) | Every input → the code that uses it; charts and exports |
| [05-deployment](docs/05-deployment.md) | The current GitHub → Vercel setup |
| [06-iitm-integration](docs/06-iitm-integration.md) | Hosting or embedding this on an IITM site |
| [07-known-issues](docs/07-known-issues.md) | Known gaps, surprising behaviour, to-do list |

## Acknowledgments

Model and source workbook courtesy of **CoEZET, IIT Madras**.

## License

MIT for the application code. The model, the workbook and the underlying data belong to
CoEZET IITM — see [docs/07](docs/07-known-issues.md#to-do-list-roughly-in-order); this needs
to be agreed explicitly before publishing on an institutional site.
