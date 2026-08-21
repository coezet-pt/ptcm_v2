# 6. Putting This on an IIT Madras Website

The plan is to publish this dashboard as a tool on a CoEZET / IITM website instead of
`ptcm-rho.vercel.app`. This is what that takes.

## Why this is easy

- **It is fully static.** `npm run build` gives you a folder of HTML, CSS and JS. No Node
  server, no Python, no database.
- **No environment variables and no secrets.** Nothing to set up per environment.
- **No outbound network calls.** No API, no CDN font, no analytics, no tracking. Once the
  page loads it talks to nobody. This makes a security review very short.
- **All the maths runs in the browser.** No server load, whatever the traffic. Hosting cost
  is just serving ~680 kB gzipped per visitor.
- **No user data is collected or stored.** Nothing is saved; refreshing resets to defaults.

So the question is only **where do these files go and at what URL**, not "how do we run this
service".

## Four options

### Option A — Its own subdomain (recommended)

Serve the app at its own address, e.g. `ptcm.coezet.iitm.ac.in`, and link to it from the main
site's menu.

| | |
|---|---|
| Effort | Low |
| Code changes | None |
| Needed from IITM IT | A DNS record plus either a vhost or a pointer to Vercel |
| Downside | The tool sits next to the site rather than inside it |

Two ways to do it:

- **A1 — Keep Vercel, point a custom domain at it.** Add `ptcm.coezet.iitm.ac.in` as a custom
  domain in the Vercel project; IITM IT adds a CNAME record. You keep push-to-deploy, preview
  URLs and one-click rollback, and IITM keeps the branding. Much less work than anything else.
- **A2 — Host on IITM servers.** Build locally or in CI and copy `dist/` to the server. See
  "Serving from IITM servers" below.

Pick A1 unless there is a policy against third-party hosting. If there is, A2 works fine.

### Option B — A folder on the existing site

Serve at `https://coezet.iitm.ac.in/ptcm/`.

| | |
|---|---|
| Effort | Low to medium |
| Code changes | **Yes — one config line, and it is required** |
| Needed from IITM IT | A location block plus a fallback rule |

**Required change** in `vite.config.ts`:

```ts
export default defineConfig(({ mode }) => ({
  base: "/ptcm/",          // ← add this; must match the folder exactly, trailing slash included
  server: { host: "::", port: 8080, hmr: { overlay: false } },
  // …
}));
```

Without it, the built `index.html` asks for `/assets/index-<hash>.js` at the domain root and
the page loads blank with 404s in the console.

The router also needs to know the folder — in `src/App.tsx`:

```tsx
<BrowserRouter basename={import.meta.env.BASE_URL}>
```

Vite fills `import.meta.env.BASE_URL` from `base`, so this works both in development (`/`)
and in production (`/ptcm/`) without a second setting to keep in sync.

Check it with `npm run build && npx vite preview` before shipping.

### Option C — An iframe inside a CMS page

If the IITM site runs WordPress, Drupal or Joomla and the tool should sit inside a normal
page, with the site header and footer around it:

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
| Downside | Two scrollbars, awkward on mobile, and a **fixed height** |

This is still the most common way institutional sites embed tools, and it works together with
Option A: host on a subdomain, embed that subdomain in a CMS page.

Two things to get right:

1. **Height.** The dashboard is a full-height app with a sticky header, a sticky action bar
   and its own scrolling areas. It does not fit into a 600 px iframe. Give it at least
   1200–1400 px, or use `height:100vh` on a page with little else on it. Auto-resizing
   (postMessage to the parent) needs a small script on both sides — only do that if a fixed
   height is really not acceptable.
2. **Framing headers.** If the app is served with `X-Frame-Options: DENY` or
   `Content-Security-Policy: frame-ancestors 'none'`, the iframe shows up blank. Whoever
   configures the host must allow the IITM origin:
   `Content-Security-Policy: frame-ancestors https://*.iitm.ac.in;`

### Option D — Mount it inside an existing app

Turn the dashboard into a component or custom element and mount it into an existing React or
non-React page.

| | |
|---|---|
| Effort | High |
| Code changes | A lot — extract a mount function, scope Tailwind's base styles, fix style clashes |
| Downside | The only option that can break in ways that are hard to spot |

Only worth it if the IITM site is itself a modern single-page app and the tool has to share
its shell. `main.tsx` is a three-line mount so the mechanics are simple; the hard part is CSS
isolation — Tailwind's base styles will restyle the host page unless they are scoped or the
app runs in a shadow root.

**Recommendation: A1 now, plus C on top if the tool needs to appear inside a CMS page.** Use
B if URL policy requires a subfolder. Avoid D.

## Serving from IITM servers (A2 / B)

### Build

```bash
npm ci
npm run build      # → dist/
```

Ship the contents of `dist/`. Nothing else from the repo is needed to run it.

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name ptcm.coezet.iitm.ac.in;

    root /var/www/ptcm;
    index index.html;

    # Fallback for unknown paths — REQUIRED. react-router needs it.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Asset filenames include a hash, so they never change. Cache them hard.
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # index.html must never be cached, or users get stale asset links.
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    # brotli is better if available
}
```

For a **subfolder** deployment (Option B), with `base: "/ptcm/"` set:

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

### Three things that commonly go wrong

1. **No fallback rule** → the home page loads, every other path 404s. Fix: `try_files`.
2. **Wrong `base`** → blank page, 404s for `/assets/*.js` in the console. Fix: set `base` and
   rebuild.
3. **`index.html` gets cached** → users keep loading an old `index.html` that points at asset
   files you have already replaced. Fix: `no-cache` on `index.html`, long cache on `/assets/`.

### Content-Security-Policy

If IITM IT wants a CSP, this is a good starting point. The app loads nothing from outside,
but Vite and React do use inline styles:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
frame-ancestors https://*.iitm.ac.in;
```

`data:` and `blob:` in `img-src` are needed by the PNG and PDF exports (`html-to-image`
renders to a data URL; CSV and XLSX downloads use blob URLs). If exports stop working under a
CSP, check that line first.

### Automating the deploy

If IITM IT gives you a server to deploy to, this GitHub Actions workflow keeps the
push-to-deploy habit:

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
        # needs an SSH key in secrets and the runner's IP allowed through
```

Note `npm test` runs before `npm run build`. That is the model health suite, and it is the
only thing standing between a bad merge and a live dashboard showing wrong numbers.

## Before launching on an institutional site

Branding and metadata (all in `index.html` unless noted):

- [ ] Replace `<title>PTCM</title>` with something useful in a search result, e.g.
      "Powertrain Choice Model — CoEZET, IIT Madras"
- [ ] Remove the two `<!-- TODO: … -->` comments
- [ ] Add a favicon (there is none) — an IITM or CoEZET mark, `public/favicon.ico` + a `<link>`
- [ ] Add `og:image` and `twitter:card` so shared links show a preview
- [ ] Add `<link rel="canonical">` pointing at the final URL
- [ ] Consider putting the CoEZET / IITM logo in the app header in `pages/Index.tsx`
      (it is a generic truck icon right now)
- [ ] Decide on `public/robots.txt` — it currently allows all crawlers

Code cleanup:

- [ ] Put the console output behind `import.meta.env.DEV` (see `useSimulation.ts` and the
      `console.log('SimulationResult:', …)` in `Index.tsx`)
- [ ] Remove `lovable-tagger` from `vite.config.ts` and `package.json`, and delete
      `.lovable/`, if the Lovable origin should not be visible
- [ ] Keep only one lockfile ([05](05-deployment.md))

Content and ownership:

- [ ] Add an "About this model" panel: what it is, that it comes from the CoEZET workbook,
      the base year (2026), the scenario shown (BAU), and a version or date
- [ ] Add a note that these are projections under stated assumptions, not forecasts
- [ ] Decide whether BWS-1 / BWS-2 / BEST should be shown in the scenario picker (they are
      built, see [02](02-architecture.md))
- [ ] Add a contact or feedback link
- [ ] Settle the licence. `README.md` says MIT, but the model and workbook belong to CoEZET
      IITM. The code licence and the data licence are not necessarily the same, and this
      should be agreed before publishing.

Accessibility and compatibility (likely required for a `.ac.in` site):

- [ ] Keyboard navigation through the sidebar inputs and chart tabs
- [ ] Colour contrast in the charts
- [ ] Behaviour at 1366×768, the most common Indian institutional screen size
- [ ] Mobile: the layout does stack below `lg`, but this is a desktop-first dashboard —
      decide whether that is acceptable
