# Turn 4 — Component-level TCO diff for B1 2045 BET

One change, one deliverable. No code touched outside the harness and a read-only extractor. Banners stay on.

## Goal

Identify which TCO component(s) account for the ~6-7 ₹/km shortfall in both Diesel and BET at B1 2045. The choice-model formula is correct; the gap is in the TCO inputs. Hypothesis: at least one per-km charge (toll, or another) scales with year in v3 and our constant is stale, but we do not guess — we line up every row.

## Scope

Touch only:

- `scripts/validate_against_xlsx.ts` — extend the B1 2045 trace to print a component stack for BET (and Diesel, for symmetry) alongside the v3 reference values pulled live from the workbook.

Do NOT touch: `tco.ts`, `choiceModel.ts`, `pttm.ts`, `extracted.ts`, `useSimulation.ts`, any constants, any UI.

## What the trace must print

For B1 (Rigid 12-19T bucket), year 2045, BET and Diesel side by side:

```text
Component            Sim ₹/km   v3 ₹/km   Δ
-------------------  ---------  --------  ------
Capex (amortized)    x.xx       x.xx      ±x.xx
Opex (fixed)         ...
Fuel / energy        ...
Maintenance          ...
Manpower / driver    ...
Toll                 ...
Insurance            ...
AdBlue               ...
Resale credit        (x.xx)     (x.xx)    ±x.xx
-------------------  ---------  --------  ------
TCO ₹/km             x.xx       x.xx      ±x.xx
```

## v3 reference extraction

From sheet `B1 - TCO ML 19T`:

- Diesel component rows are in the block ending at row 78 (TCO/km row).
- BET component rows are in the block ending at row 146 (TCO/km row).
- 2045 is column W (index 23). Confirm by printing the header row (row with 2025..2055) once.

Steps in the script:

1. Open the v3 xlsx with the same loader the harness already uses.
2. Print column-W header label to confirm year = 2045.
3. For each component row in the Diesel block (78 and the ~17 rows above it) and the BET block (146 and the rows above it), print `[rowIndex] label = value` for col W. This gives us the authoritative component list before mapping.
4. Build a name→value map for each powertrain.

## Sim-side extraction

Call the existing `computeTCO` (or whatever the harness already uses for the B1 2045 trace) and, instead of just returning the totals, return its component object. If `tco.ts` doesn't already expose components in a structured way, read it (without editing) and have the harness re-derive each component from the same inputs it would pass — replicating the math in the harness only, not in product code. Preferred: if `tco.ts` already builds a `breakdown` object, just print it.

## Mapping

Manual one-to-one map in the harness from v3 row label → sim component key. Print any unmapped rows as `UNMAPPED` so we see workbook components the sim is missing entirely (likely the real bug).

## Deliverable to paste back

1. Column-W header confirmation line.
2. Raw row-by-row dump of Diesel block (rows ~62-78) and BET block (rows ~130-146) at col W.
3. The two side-by-side tables above (Diesel and BET).
4. A one-line call-out of the largest `Δ` row for each powertrain.

No code changes outside the harness. No conclusions drawn in this turn — we collect the evidence first, then decide the fix in Turn 5.

One add: when you print the raw v3 block dumps (deliverable #2), also print the row's value at 2025 (col C) next to its 2045 value (col W). That tells us at a glance which components scale with year vs stay flat — a component that's 4.1 in both 2025 and 2045 is a flat charge, one that goes 33→59 is escalating. That distinction tells us whether the stale constant is a base value or a missing growth rate.