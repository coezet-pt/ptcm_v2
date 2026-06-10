# Revision: drop adapter, re-encode presets natively, keep PolicyLevers

## 1. Native 6-range preset encoding (no adapter)

Remove `adaptParam` / `adaptParameters` from `ScenarioContext.tsx`; revert `ensureFullConfig` to a plain merge against the BAU defaults. Remove `expandV3ToV6` from `extracted.ts` and delete the `BAU_PARAMETERS_V3` literal. Re-declare `BAU_PARAMETERS` directly in the 6-range shape (`baseValue, d2530, d3135, d3640, d4145, d4650, d5155`).

For each of the 25 params, the source of truth for the 6 CAGRs is the v4 workbook's `Changing with year` sheet. Endpoints per range:

- d2530 = (V2030/V2025)^(1/5) − 1
- d3135 = (V2035/V2030)^(1/5) − 1
- d3640 = (V2040/V2035)^(1/5) − 1
- d4145 = (V2045/V2040)^(1/5) − 1
- d4650 = (V2050/V2045)^(1/5) − 1
- d5155 = (V2055/V2050)^(1/5) − 1

Categories:

**A. Native v4 6-range (extractable this round)** — values pulled directly from `Changing with year`:

- `diesel_price_per_l`, `cng_price_per_kg`, `lng_price_per_kg`
- `electricity_incl_caas_per_kwh`
- `green_h2_production_per_kg`
- `h2_compression_storage_per_kg`
- `battery_cost_per_kwh`, `fuel_cell_cost_per_kw`
- `adblue_per_l`, `grey_h2_production_per_kg`
- `discom_electricity_per_kwh`, `fixed_demand_charges_per_kwh`, `charging_infra_per_kwh`
- `green_h2_electricity_per_kg`, `green_h2_capex_per_kg`, `green_h2_opex_margin_per_kg`
- `grey_h2_blend_fraction`

**B. Fallback (kept as `// FLAG: v3 fallback — v4 trajectory not extracted this round`)** — values not found cleanly in v4 `Changing with year`, kept on the prior v3-shaped numbers but spread across all six ranges using a constant CAGR (the v3 d3140 for the middle four ranges, v3 d2630 for d2530, v3 d5155 for d5155). These are non-trivial to derive cleanly from v4 and aren't the Dashboard spec's 13 user-editable params:

- `electricity_per_kwh` (superseded by `electricity_incl_caas_per_kwh` in v4)
- `lng_tank_cost_per_kg`, `lng_valves_piping_per_vehicle`
- `h2_tank_cost_per_kg`
- `diesel_vehicle_growth`, `engine_trans_growth`, `e_powertrain_growth`

Each Category-B entry gets an inline `// FLAG` comment naming what v4 source row to re-extract from later.

For the 4 scenario presets:

- **BAU**: uses `BAU_PARAMETERS` directly — fully native v4 for Category A, flagged fallback for Category B.
- **BWS-1 / BWS-2**: inherit `...BAU_PARAMETERS` (same trajectories as BAU per existing structure) — already native.
- **BEST**: 3 native 6-range overrides already in place (`green_h2_production_per_kg`, `h2_compression_storage_per_kg`, `diesel_price_per_l`) — keep as-is, they're hand-encoded in the 6-range shape.

No adapter runs on DB-loaded preset configs. If a DB row's `config.parameters` is missing or in old shape, `ensureFullConfig` simply falls back to `BAU_PARAMETERS` for that key (existing spread merge), which is the safe default.

## 2. Keep PolicyLevers mounted

Add a third item to the Advanced accordion in `InputPanel.tsx`:

```text
▸ Maintenance (per bucket)
▸ Constants (battery / FC life, funding)
▸ Policy Levers   ← new, mounts <PolicyLevers />
```

`PolicyLevers.tsx` is not modified — same incentives, toll waivers, inflection years, electricity subsidy, ZET interest controls it ships with today. This preserves the ability to differentiate BAU vs BWS vs BEST in the UI even though the Dashboard sheet doesn't spec policy.

`FixedParamGroup` and `SegmentBasePricesTable` stay unmounted (superseded by the 13-param spec). The files remain in the repo unused.

## Files touched (delta vs. the build that just shipped)

- `src/contexts/ScenarioContext.tsx` — remove `adaptParam` / `adaptParameters` and the `LegacyParameterConfig` import; restore the plain spread in `ensureFullConfig`.
- `src/lib/types.ts` — remove `LegacyParameterConfig` (no longer referenced).
- `src/lib/constants/extracted.ts` — delete `BAU_PARAMETERS_V3`, `expandV3ToV6`, and the `V4_PRIMARY_CAGRS` mutation block; rewrite `BAU_PARAMETERS` as a single 6-range literal with native CAGRs for Category A and `// FLAG` fallbacks for Category B.
- `src/components/InputPanel.tsx` — add the `Policy Levers` accordion item importing and rendering `PolicyLevers`.

## Out of scope

- No engine changes. No DB writes. No re-encoding of BWS-1/BWS-2/BEST trajectories beyond what already exists (their differences live in `policy`, which `PolicyLevers` continues to expose).
- Category-B trajectory re-extraction from v4 is deferred to a follow-up round.

## Acceptance

- `extracted.ts` has no v3-shaped data and no adapter function; every param literal uses the 6 new delta keys.
- `ScenarioContext.tsx` does not transform parameter shapes on load.
- Advanced accordion shows three items, the third one renders `PolicyLevers` and edits flow through `updatePolicy` as before.
- Build passes; charts continue to update on Apply.

&nbsp;

pproved — this correctly removes the adapter I should have caught before shipping the last plan. Ship it.

One verification, not a blocker: confirm in v4 that BWS-1/BWS-2 genuinely share BAU's cost trajectories (differing only in policy levers). In v3 that was true. If v4 changed it, flag it — otherwise inheriting `...BAU_PARAMETERS` is correct.

The Category-B `// FLAG` fallbacks are fine as scoped — they're all non-user-facing params and explicitly marked for v4 re-extraction. Just keep those flags visible so we don't forget them when we do the full v4 cost refresh.