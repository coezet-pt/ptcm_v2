# 5. Deployment

## What is running now

| | |
|---|---|
| Repository | `github.com/coezet-pt/ptcm_v2`, branch **`main`** |
| Host | **Vercel** |
| Live URL | <https://ptcm-v2.vercel.app> |
| Trigger | Push to `main` → Vercel builds and publishes automatically |
| Build command | `npm run build` (Vercel detects this from the Vite setup) |
| Output folder | `dist/` |
| Environment variables | **none** |
| Server code | **none** — this is a plain static build |

### An old URL is still live and serving a stale build

`ptcm-rho.vercel.app` was an earlier deployment of this app. It still resolves, still returns
200, and still serves a build from before August 2026 — it does **not** update when you push.
Anyone given that link sees old numbers with no warning that they are old.

Before handover, either delete that deployment/alias in Vercel or point it at the current
project. Until then, only share **ptcm-v2.vercel.app**.

There is **no `vercel.json`**. Everything comes from Vercel's automatic detection. The Vite
preset also sets up the rule that sends unknown paths to `/index.html`, which react-router
needs. That is why deep links do not 404 even though only `/` and a catch-all exist.

## What the build produces

```
dist/
├── index.html                       0.9 kB   — links assets with ABSOLUTE /assets/… paths
└── assets/
    ├── index-<hash>.css            66 kB     (12 kB gzip)
    ├── index-<hash>.js          1,373 kB     (433 kB gzip)   ← app + React + Recharts + SheetJS
    ├── jspdf.es.min-<hash>.js     416 kB     (137 kB gzip)   ┐
    ├── html2canvas.esm-<hash>.js  201 kB     (48 kB gzip)    ├ only downloaded for the PDF
    ├── index.es-<hash>.js         151 kB     (52 kB gzip)    │
    └── purify.es-<hash>.js         28 kB     (11 kB gzip)    ┘
plus everything in public/ copied as-is (robots.txt)
```

About 2.2 MB raw, 680 kB gzipped. The PDF files only download when the user clicks
"Download report" (`report.tsx` does `await import('jspdf')`).

**Those absolute `/assets/…` paths matter.** They only work when the app is served from the
root of a domain. Serving from a subfolder needs `base` set in `vite.config.ts` — see
[06](06-iitm-integration.md).

## Redeploying

```bash
git checkout main
git pull
# … make changes …
npm test && npm run build     # always, before pushing
git commit -am "…"
git push
```

Vercel picks it up in a minute or two. Pushing to any other branch gives you a **preview
deployment** with its own URL — that is how to show work in progress without touching the
live site.

To roll back: Vercel dashboard → Deployments → pick an older production deployment →
"Promote to Production". No rebuild needed.

**To check a deploy actually went live**, do not rely on the page looking right — the CDN
serves cached HTML and a stale copy looks identical. Request a file you know changed, or use
this trick: pick something the new build removed and confirm it 404s.

```bash
curl -s https://ptcm-v2.vercel.app/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
# compare that hash against your local dist/assets/ after npm run build
```

## Access to hand over

- [ ] GitHub: collaborator or org access to `coezet-pt/ptcm_v2`
- [ ] Vercel: team or project access to the `ptcm` project. **This is separate from GitHub
      access** — the new maintainer can push to `main` and still not be able to see build
      logs or roll back.
- [ ] The SSH key or GitHub account used for pushing. The current remote uses the
      `github.com-coezet` SSH alias; a new machine should just use plain
      `git@github.com:coezet-pt/ptcm_v2.git`.

## Things to know before touching the deployment

### Three lockfiles are committed

`package-lock.json`, `bun.lock` and `bun.lockb` are all in the repo. Vercel picks its package
manager based on which lockfile it finds, so it may build with Bun rather than npm, which
resolves packages differently from `npm install` locally.

**This has been left alone on purpose.** The current setup builds and deploys correctly, and
changing which package manager Vercel uses is not worth the risk on a working deployment.
If you ever do want to consolidate to `package-lock.json` alone, do it on a branch first and
confirm the preview deployment builds before merging.

### `lovable-tagger` is dev-only

`vite.config.ts` loads it, but only when `mode === "development"`, so it has no effect on the
production bundle. It is left over from the project starting on Lovable.dev. Removing it also
means editing `package.json`, which puts the lockfiles out of sync with each other — so it has
been left in place for the same reason as above.

### The Node version is not pinned

There is no `.nvmrc` and no `engines` field in `package.json`, so Vercel uses whatever Node
version it defaults to. Builds here were done on **Node 22.14.0**. Adding
`"engines": { "node": "22.x" }` to `package.json` would make this predictable.

### Debug output goes to production

`useSimulation.ts` prints a large diagnostic dump on every recalculation, and `Index.tsx`
logs the whole result object. Both run in the browser with no condition — they are not behind
`import.meta.env.DEV` or the `window.__SIM_DEBUG__` flag. Harmless, but noisy for a public
site. See [07](07-known-issues.md).

### `index.html` still has scaffold TODOs

```html
<!-- TODO: Set the document title to the name of your application -->
<title>PTCM</title>
<!-- TODO: Update og:title to match your application name -->
```

There is no favicon and no `og:image`. Worth fixing before a public launch.

### `robots.txt` allows everything

`public/robots.txt` allows Googlebot, Bingbot, Twitterbot, facebookexternalhit and `*`. If a
deployment should not be indexed (a staging copy, for example), change it there.

## Moving off Vercel

The only planned move is onto an IIT Madras site. [06](06-iitm-integration.md) covers that in
full: the four options, the nginx and Apache configs, the CSP, and the pre-launch checklist.

The short version is that the build is static with no environment variables, so the only real
requirement anywhere is: **serve `dist/` over HTTPS, and send unknown paths to `index.html`.**
The recommended route is to keep Vercel and point a custom IITM domain at it, which needs no
code change at all.
