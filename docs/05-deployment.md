# 5. Deployment (current state)

## What is deployed, where

| | |
|---|---|
| Repository | `github.com/coezet-pt/ptcm_v2`, branch **`main`** |
| Host | **Vercel** |
| Live URL | <https://ptcm-rho.vercel.app> |
| Trigger | Git push to `main` → Vercel builds and promotes to production automatically |
| Build command | `npm run build` (Vercel's Vite preset auto-detects this) |
| Output directory | `dist/` |
| Environment variables | **none** |
| Server-side runtime | **none** — this is a pure static build |

There is **no `vercel.json`** in the repo. Everything is Vercel's framework auto-detection.
The Vite preset also installs the SPA rewrite (all unmatched paths → `/index.html`) that
`react-router`'s `BrowserRouter` needs; that rewrite is why deep links do not 404 even
though only `/` and `*` are defined.

## The build output

```
dist/
├── index.html                       0.9 kB   — references assets with ABSOLUTE /assets/… paths
└── assets/
    ├── index-<hash>.css            66 kB     (12 kB gzip)
    ├── index-<hash>.js          1,370 kB     (432 kB gzip)   ← app + React + Recharts + SheetJS
    ├── jspdf.es.min-<hash>.js     416 kB     (137 kB gzip)   ┐
    ├── html2canvas.esm-<hash>.js  201 kB     (48 kB gzip)    ├ lazy-loaded, PDF report only
    ├── index.es-<hash>.js         151 kB     (52 kB gzip)    │
    └── purify.es-<hash>.js         28 kB     (11 kB gzip)    ┘
plus everything in public/ copied verbatim (robots.txt, placeholder.svg)
```

Total ~2.2 MB raw, ~680 kB gzipped, and the PDF chunks only download when the user clicks
"Download report" (`report.tsx` does `await import('jspdf')`).

**The absolute `/assets/…` paths matter.** They are correct only when the app is served from
a domain root. Serving from a subpath requires setting `base` in `vite.config.ts` — see
[06-iitm-integration.md](06-iitm-integration.md).

## Redeploying

```bash
git checkout main
git pull
# … make changes …
npm test && npm run build     # always, before pushing
git commit -am "…"
git push
```

Vercel picks it up within a minute or two. Pushes to any other branch produce a **preview
deployment** with its own URL — that is the right way to show work in progress without
touching production.

Rollback: Vercel dashboard → Deployments → pick a previous production deployment →
"Promote to Production". No rebuild needed.

## Access you will need to hand over

- [ ] GitHub: collaborator or org access to `coezet-pt/ptcm_v2`
- [ ] Vercel: team/project access to the `ptcm` project (this is separate from GitHub access —
      the new maintainer can push to `main` and still not be able to see build logs or roll back)
- [ ] The SSH key or GitHub identity used for pushes (the current remote uses the
      `github.com-coezet` SSH-config alias; a new machine should just use the plain
      `git@github.com:coezet-pt/ptcm_v2.git` form)

## Things a new maintainer should know before touching the deployment

### Three lockfiles are committed

`package-lock.json`, `bun.lock` and `bun.lockb` are all in the repo. Vercel picks its package
manager by which lockfile it finds, and the presence of `bun.lockb` can make it use Bun
rather than npm — a different resolution than you get locally with `npm install`. This has
not caused a problem so far, but it is an avoidable source of "works locally, breaks on
Vercel". **Recommendation:** pick one (npm, since `package-lock.json` is what the current
workflow uses), delete the other two, and verify one deployment before assuming it is fine.

### No pinned Node version

There is no `.nvmrc` and no `engines` field in `package.json`, so Vercel uses whatever its
current default Node is. Builds have been done locally on **Node 22.14.0**. Adding
`"engines": { "node": "22.x" }` to `package.json` would make this reproducible.

### `lovable-tagger` is a dev-only plugin

`vite.config.ts` loads it, but only when `mode === "development"`. It has no effect on the
production bundle. It is a leftover from the project's origin on Lovable.dev and can be
removed along with the `.lovable/` folder whenever you like.

### Diagnostic console output ships to production

`useSimulation.ts` prints a four-layer diagnostic dump on every recompute, and `Index.tsx`
logs the whole `SimulationResult`. Both run unconditionally in the browser — they are not
behind `import.meta.env.DEV` or the `window.__SIM_DEBUG__` flag. Harmless, but noisy and
mildly information-leaky for a public institutional site. See
[07](07-gotchas-and-backlog.md).

### `index.html` still carries scaffold TODOs

```html
<!-- TODO: Set the document title to the name of your application -->
<title>PTCM</title>
<!-- TODO: Update og:title to match your application name -->
```

There is no favicon and no `og:image`. Worth fixing before an institutional launch.

### `robots.txt` allows everything

`public/robots.txt` explicitly allows Googlebot, Bingbot, Twitterbot, facebookexternalhit and
`*`. If the IITM deployment should not be indexed (e.g. a staging copy), change it there.

## Alternatives to Vercel

Because the build is entirely static with no environment variables, it runs anywhere that
serves files:

| Host | Effort | Notes |
|---|---|---|
| Vercel (current) | none | Git-push deploys, preview URLs, instant rollback |
| Netlify / Cloudflare Pages | ~15 min | Same model. Needs an SPA fallback rule. |
| GitHub Pages | ~30 min | Needs `base: '/ptcm_v2/'` and a 404.html SPA shim |
| IITM's own web server (nginx/Apache) | ~1 hour | See [06](06-iitm-integration.md) — this is the likely destination |
| Any S3 + CDN | ~1 hour | Set the SPA fallback at the CDN |

The only real requirement is: **serve `dist/` over HTTPS, with a fallback rewrite of unknown
paths to `index.html`.**
