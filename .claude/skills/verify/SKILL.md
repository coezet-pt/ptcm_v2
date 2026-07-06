---
name: verify
description: Build, launch, and drive the PTCM dashboard headlessly to verify UI changes end-to-end.
---

# Verifying the PTCM dashboard

SPA (Vite + React), no backend. Everything observable lives in the browser.

## Build & serve

```bash
npm run build
npx vite preview --port 4173 --strictPort   # run in background
```

(`npm run dev` also works but preview serves the production bundle.)

## Drive headlessly

No playwright in this repo's deps, but Playwright chromium builds are installed at
`%LOCALAPPDATA%\ms-playwright\chromium-1228\chrome-win64\chrome.exe`.
Install `playwright-core` in the scratchpad and launch with `executablePath` pointing there
(use forward slashes in the path when passing through bash → node).

## Flows worth driving

- **Configured Parameters (Inputs)** panel: `getByText('Configured Parameters (Inputs)')`,
  click to expand, screenshot; 2026/2055 cost cells are `tbody tr td:nth-child(3)`.
- **Param file download**: sidebar "Download" button → dropdown "CSV (.csv)" / "Excel (.xlsx)";
  use `page.waitForEvent('download')`.
- **Param file upload**: `input[type="file"]` (hidden) → `setInputFiles`; success shows a
  `[data-sonner-toast]` with "Loaded N parameters … Click Apply Changes". Upload merges into
  the *draft* — charts/tables only change after clicking "Apply Changes".
- **PDF report**: button "Download report". Generation renders an off-screen
  `.report-capture` host; to screenshot its content, `page.evaluate` setting
  `host.style.left='0'` after `waitForSelector('.report-capture')` (+~2.3s for charts),
  then restore `left:-10000px` before capture finishes. PDF page count:
  count `/\/Type\s*\/Page[^s]/g` in the file read as latin1. Takes ~1–2 min; use a
  long `waitForEvent('download', {timeout: 240000})`.

## Gotchas

- One transient 404 on very first page load (doesn't reproduce; harmless).
- Recharts entry animation: wait ~2s after load before screenshots.
- Kill the preview server via the process owning port 4173 when done.
