# Start Here

**If you read nothing else, read this page.** It is the whole project in one page. The other
seven docs are there when you need detail.

## What this is

**PTCM = Powertrain Choice Model.** A web dashboard that projects how India's medium &
heavy-duty truck fleet shifts from diesel to zero-emission trucks between **2026 and 2055**.

It is a re-implementation of an Excel workbook, `CoEZET PTCM v2.xlsx`, which sits at the root
of this repo. **The workbook is the source of truth.** If the app and the workbook disagree,
the workbook is right unless [07](07-known-issues.md) explains why not. The model belongs to
CoEZET, IIT Madras — questions about *why a number is what it is* are workbook questions, not
code questions.

## Run it

```bash
npm install
npm run dev        # → http://localhost:8080   (not 5173)
npm test           # 37 tests — must stay green
npm run build      # → dist/
```

No database, no backend, no API keys, no `.env`. Everything runs in the browser.

## How it works

Five pure functions in `src/lib/sim/`, run one after another. The whole thing takes under
100 ms.

```
your settings → timeSeries.ts    cost of fuel, batteries etc. for each year
              → tco.ts           cost per km, per truck type, per powertrain
              → choiceModel.ts   which powertrain gets bought → 2045 / 2050 / 2055
              → pttm.ts          fills in every year between those three
              → stockEmissions.ts fleet size, CO₂, energy demand
```

6 powertrains (Diesel, CNG, LNG, H2-ICE, BET, H2-FCET) × 14 truck types × 30 years.

## The five files that matter

| File | What it holds |
|---|---|
| `src/lib/constants/extracted.ts` | Every number pulled out of the workbook. The most important data file in the repo. |
| `src/lib/sim/` | The model itself, five files, in the order above. |
| `src/contexts/ScenarioContext.tsx` | All user input state. |
| `src/lib/types.ts` | The shape of the settings and the results. |
| `src/pages/Index.tsx` | The dashboard page. |

## Five things that confuse everyone

1. **Nothing updates until you click "Apply Changes."** Edits go to a draft copy. The charts
   read the applied copy. This is deliberate.
2. **Total truck sales are fixed.** No setting changes them. Settings only move share between
   powertrains. This is the most common "is it broken?" question. It is not broken.
3. **2055 is 100% zero-emission because the model is told to be.** The workbook has a sheet
   called "100% ZET 2055". It is an assumption, not a result. Never present it as a finding.
4. **Costs are only calculated for 2045, 2050 and 2055.** Every earlier year is drawn as a
   curve working backwards from those three. So a policy that only applies before 2045
   cannot change any output — that is the model's design, not a bug.
5. **Some Excel mistakes are copied on purpose.** They are marked `Excel quirk:` in the code.
   Do not "fix" them without asking CoEZET — they change published numbers.

## Before you change anything in the model

1. Find the number or formula in the workbook first. Note the sheet and cell.
2. Change the code, and put that sheet and cell in a comment. Everyone does this here.
3. Run `npm test`. Twelve of those tests compare the model against known Excel values, and
   they drive the health badge in the app header. If one fails, you have moved the model away
   from the workbook. That may be intentional — it must never be accidental.

## Deploying

Push to `main` on GitHub → Vercel builds and publishes automatically to
<https://ptcm-rho.vercel.app>. There is nothing to configure. To roll back, use the Vercel
dashboard.

**Do not change `package.json`, the lockfiles or `vite.config.ts` casually.** The build works;
leave the packaging alone unless you have a reason and can test it on a preview deployment.

## Where to go next

| I need to… | Read |
|---|---|
| Set up and find my way around | [01-getting-started](01-getting-started.md) |
| Understand how the app is wired | [02-architecture](02-architecture.md) |
| Change a formula | [03-model-reference](03-model-reference.md) |
| Add an input, chart or export | [04-parameters-and-ui](04-parameters-and-ui.md) |
| Deal with the deployment | [05-deployment](05-deployment.md) |
| Move this onto an IITM site | [06-iitm-integration](06-iitm-integration.md) |
| Know what is broken or unfinished | [07-known-issues](07-known-issues.md) |

Acronyms you will hit immediately: **TIV** = total truck sales in a year, **TCO** = total cost
of ownership, **ZET** = zero-emission truck, **bucket** = one use case + one truck size (there
are 14). Full list in [README](README.md).
