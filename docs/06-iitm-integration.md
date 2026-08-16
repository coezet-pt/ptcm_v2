# 6. Integrating into an IIT Madras Website

The plan is to publish this dashboard as a tool on an IITM (CoEZET) website rather than on
`ptcm-rho.vercel.app`. This document covers what that actually requires.

## The good news first

This app is about as easy to host as a web application gets:

- **It is 100 % static.** `npm run build` produces a folder of HTML/CSS/JS. There is no
  Node server, no Python, no database, no Redis, no cron job.
- **There are no environment variables and no secrets.** Nothing to configure per
  environment, nothing to leak.
- **There are no outbound network calls.** No API, no CDN font, no analytics beacon, no
  telemetry. Once loaded, the page talks to nobody. This matters for institutional
  security review — it is a very short conversation.
- **All computation is client-side.** No server load regardless of traffic. Hosting cost is
  the cost of serving ~680 kB gzipped per visitor.
- **No user data is collected or stored.** Nothing is persisted anywhere; a page refresh
  resets to defaults.

The whole integration question is therefore **"where do these static files go, and at what
URL"**, not "how do we run this service".

## Four integration options

### Option A — Subdomain (recommended)

Serve the app at its own hostname, e.g. `ptcm.coezet.iitm.ac.in` or
`tools.coezet.iitm.ac.in/`, and link to it from the main site's navigation.

| | |
|---|---|
| Effort | Low |
| Code changes | None |
| Needs from IITM IT | A DNS record + a vhost, or a DNS record pointing at Vercel |
| Trade-off | The tool feels adjacent to the site rather than part of it |

Two sub-variants:

- **A1 — Keep Vercel, point a custom domain at it.** Add
  `ptcm.coezet.iitm.ac.in` as a custom domain in the Vercel project; IITM IT adds a CNAME.
  You keep git-push deploys, preview URLs and one-click rollback, and IITM keeps the
  branding. This is the least work by a wide margin.
- **A2 — Host on IITM infrastructure.** Build locally or in CI, copy `dist/` to the
  server. See "Serving from nginx/Apache" below.

Choose A1 unless there is an institutional policy against third-party hosting. If there is,
go to A2 — the app does not care.

### Option B — Subpath on the existing site

Serve at `https://coezet.iitm.ac.in/ptcm/`.

| | |
|---|---|
| Effort | Low–medium |
| Code changes | **Yes — one config line, and it is mandatory** |
| Needs from IITM IT | A location block / alias + an SPA fallback |

**Required change** — `vite.config.ts`:

```ts
export default defineConfig(({ mode }) => ({
  base: "/ptcm/",          // ← add this; must match the subpath exactly, trailing slash included
  server: { host: "::", port: 8080, hmr: { overlay: false } },
  // …
}));
```

Without it, the built `index.html` requests `/assets/index-<hash>.js` from the domain root
and the page loads blank with 404s in the console.

The router also needs to know its base — in `src/App.tsx`:

```tsx
<BrowserRouter basename={import.meta.env.BASE_URL}>
```

`import.meta.env.BASE_URL` is populated by Vite from `base`, so this works in dev (`/`) and
in production (`/ptcm/`) without a second constant to keep in sync.

Verify with `npm run build && npx vite preview` before shipping.

### Option C — iframe embed in a CMS page

If the IITM site runs WordPress/Drupal/Joomla and the tool should live *inside* a normal
content page (with the site header, breadcrumbs and footer around it):

```html
<iframe
  src="https://ptcm.coezet.iitm.ac.in/"
  title="Powertrain Choice Model Dashboard"
  style="width:100%;height:1400px;border:0"
  loading="lazy"
  referrerpolicy="no-referrer">
</iframe>
```

| | |
|---|---|
| Effort | Very low — a content editor can do it |
| Code changes | None |
| Trade-off | Two scrollbars, awkward on mobile, and a **fixed iframe height** |

This is still the most common way institutional sites embed tools, and it composes with
Option A: host the app on a subdomain, embed that subdomain in a CMS page.

Two things to get right:

1. **Height.** The dashboard is a full-height app with a sticky header, a sticky sidebar
   action bar and its own internal scroll regions. It does not shrink gracefully into a
   600 px iframe. Give it at least 1200–1400 px, or make the iframe `height:100vh` on a
   dedicated near-full-bleed page. Auto-resizing (postMessage → parent) would require adding
   a small script on both sides; only do that if the fixed height is genuinely unacceptable.
2. **Framing headers.** If the app is served with `X-Frame-Options: DENY` or a
   `Content-Security-Policy: frame-ancestors 'none'`, the iframe renders blank. Whoever
   configures the host must allow the IITM origin:
   `Content-Security-Policy: frame-ancestors https://*.iitm.ac.in;`

### Option D — Mount into an existing app / micro-frontend

Export the dashboard as a component or a custom element and mount it into an existing React
or non-React page.

| | |
|---|---|
| Effort | High |
| Code changes | Significant — extract a mount function, scope Tailwind's preflight, handle style collisions |
| Trade-off | Genuine single-page integration; also the only option that can break in subtle ways |

Only worth it if the IITM site is itself a modern SPA and the tool must share its shell.
`main.tsx` is a three-line mount, so the mechanics are easy; the hard part is CSS isolation —
Tailwind's preflight will restyle the host page unless it is scoped or the app is put in a
shadow root.

**Recommendation: A1 now, and C on top of it if the tool needs to appear inside a CMS page.**
Reach for B if institutional URL policy requires a subpath. Avoid D.

## Serving from IITM infrastructure (A2 / B)

### Build

```bash
npm ci
npm run build      # → dist/
```

Ship the contents of `dist/`. Nothing else from the repo is needed at runtime.

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name ptcm.coezet.iitm.ac.in;

    root /var/www/ptcm;
    index index.html;

    # SPA fallback — REQUIRED. react-router uses history mode.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Hashed assets are immutable; cache them hard.
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # index.html must never be cached, or users get stale asset references.
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    # brotli is better if the build has it
}
```

For a **subpath** deployment (Option B), with `base: "/ptcm/"` set:

```nginx
location /ptcm/ {
    alias /var/www/ptcm/;
    try_files $uri $uri/ /ptcm/index.html;
}
```

### Apache

```apache
<Directory /var/www/ptcm>
    Options -Indexes
    AllowOverride None
    Require all granted

    RewriteEngine On
    RewriteBase /
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</Directory>

<FilesMatch "\.(js|css|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
```

### The three ways this goes wrong

1. **No SPA fallback** → the root loads, any other path 404s. Fix: `try_files`.
2. **Wrong `base`** → blank page, 404s for `/assets/*.js` in the console. Fix: set `base` and
   rebuild.
3. **`index.html` cached** → users keep loading an old `index.html` that points at asset
   hashes you have already deleted. Fix: `no-cache` on `index.html`, long cache on `/assets/`.

### Content-Security-Policy

If IITM IT requires a CSP, this is a workable starting point. The app inlines no external
resources but Vite/React do use inline styles:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
frame-ancestors https://*.iitm.ac.in;
```

`data:` and `blob:` in `img-src` are needed by the PNG/PDF export path (`html-to-image`
renders to a data URL; CSV/XLSX downloads use blob URLs). If exports break under CSP, that is
the directive to look at first.

### Automating the deploy to an IITM server

If IITM IT gives you a deploy target, a GitHub Actions workflow keeps the git-push habit:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Rsync to server
        run: rsync -az --delete dist/ ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}:/var/www/ptcm/
        # requires an SSH key in secrets and the runner's IP allowed through
```

Note `npm test` before `npm run build` — that is the 12-check model health suite, and it is
the thing standing between a bad merge and a published dashboard with wrong numbers.

## Pre-launch checklist for an institutional site

Branding and metadata (all in `index.html` unless noted):

- [ ] Replace `<title>PTCM</title>` with something a search result can use, e.g.
      "Powertrain Choice Model — CoEZET, IIT Madras"
- [ ] Remove the two scaffold `<!-- TODO: … -->` comments
- [ ] Add a favicon (there is none) — IITM or CoEZET mark, `public/favicon.ico` + a `<link>`
- [ ] Add `og:image` and `twitter:card` so shared links render a preview
- [ ] Add `<link rel="canonical">` pointing at the final URL
- [ ] Consider adding the CoEZET / IITM logo to the app header in `pages/Index.tsx`
      (currently a generic truck icon)
- [ ] Decide on `public/robots.txt` — it currently allows all crawlers

Code hygiene:

- [ ] Gate the diagnostic console output behind `import.meta.env.DEV` (see
      `useSimulation.ts` and the `console.log('SimulationResult:', …)` in `Index.tsx`)
- [ ] Delete `lovable-tagger` from `vite.config.ts` and `package.json`, and the `.lovable/`
      folder, if the Lovable lineage should not be visible
- [ ] Consolidate to one lockfile ([05](05-deployment.md))

Content and governance:

- [ ] Add an "About this model" panel or page: what the model is, that it comes from the
      CoEZET workbook, the base year (2026), the scenario shown (BAU), and a version/date
- [ ] Add a disclaimer — these are projections under stated assumptions, not forecasts
- [ ] Decide whether the BWS-1 / BWS-2 / BEST scenarios should be re-exposed in the picker
      (they are implemented; see [02](02-architecture.md))
- [ ] Add a contact / feedback route
- [ ] Confirm the licence. `README.md` says MIT, but the model and the workbook are CoEZET
      IITM's — the code licence and the data licence are not necessarily the same, and this
      should be settled explicitly before an institutional publication.

Accessibility and compatibility (likely required for a `.ac.in` site):

- [ ] Keyboard navigation through the sidebar inputs and chart tabs
- [ ] Colour contrast on the chart palettes
- [ ] Behaviour at 1366×768, the most common Indian institutional desktop resolution
- [ ] Mobile: the layout stacks below `lg`, but the dashboard is genuinely desktop-first —
      decide whether that is acceptable or worth investment
