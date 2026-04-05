# SPA Tracks (B, C, D) — Exception and Migration Only

These tracks exist for specific situations where Astro SSG (Track A) is not feasible. Track A remains the default for all new projects. If using any of these tracks, document the reason in README.

## Common SPA Issues (All Tracks)

All SPA tracks share these problems that Track A avoids entirely:

### Trailing Slash Mismatch
URLs shared as `/om-oss/` (with trailing slash) break if the route map only has `/om-oss`. Fix by normalizing before route matching:

```typescript
const rawPath = window.location.pathname;
const pathname = rawPath.length > 1 && rawPath.endsWith('/')
  ? rawPath.slice(0, -1)
  : rawPath;
```

Also add trailing slash redirect in netlify.toml:
```toml
[[redirects]]
  from = "/*/"
  to = "/:splat"
  status = 301
```

### Direct URL Access
After deploy, test every page by pasting its URL directly in a new browser tab. This is how Google, LinkedIn, and shared links access the site. If it shows 404 or blank, routing is broken.

### OG Preview Limitations
Track B: Works if page is in the prerender list. Track C: Works via Puppeteer snapshots. Track D: OG previews will fail — meta tags set via useEffect are invisible to social platforms.

---

## Track B: React Router v7 SSG

Use only when the template is deeply React-dependent and converting to Astro would take >4 hours.

React Router v7 has built-in prerender support. Define routes to prerender, and `npm run build` generates static HTML per route.

### Prerender Config

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  async prerender() {
    return ["/", "/om-oss", "/tjenester", "/kontakt", "/personvern"];
  },
} satisfies Config;
```

Every page the user can visit must be in this list. Missing a route means SPA fallback and broken OG previews for that page.

### Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0"
  },
  "devDependencies": {
    "@react-router/dev": "^7.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0"
  }
}
```

### SEO Config (Centralized)

```typescript
// src/lib/seo-config.ts
export const seoConfig: Record<string, {
  title: string;
  description: string;
  canonical: string;
}> = {
  "/": {
    title: "Firmanavn | Profesjonelle tjenester i Oslo",
    description: "Kort, unik beskrivelse (150-160 tegn).",
    canonical: "https://domene.no/",
  },
  "/om-oss": {
    title: "Om oss | Firmanavn",
    description: "Les mer om hvem vi er.",
    canonical: "https://domene.no/om-oss",
  },
};
```

### netlify.toml

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/*/"
  to = "/:splat"
  status = 301

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false

[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

`force = false` is critical — it ensures pre-rendered HTML is served when the file exists, with SPA fallback only for unknown paths.

### Bundle Size
CSS: ~50-80 KB (gzip: ~10-15 KB), JS: ~200-400 KB (gzip: ~60-100 KB), HTML: ~5-10 KB per page

---

## Track C: SPA + Puppeteer Prerender (Migration Only)

Renders the existing SPA with headless Chrome at build time, saving static HTML snapshots. Use only for projects already finished as SPAs where the customer has approved the design.

### Why Not for New Projects
- 300-400 MB Chromium dependency in build
- `renderAfterTime` is a guess — breaks silently if pages load slowly
- Third-party scripts (GA4, chat widgets) get captured in snapshots and break on hydration
- More moving parts means more things that break in CI/CD

### GA4/gtag Breaks After Prerendering

This is a critical bug: Puppeteer captures dynamically injected gtag script tags in the HTML snapshot. When the real user loads the page, any initialization function that checks the DOM for this script finds it and skips configuration commands. Result: gtag.js loads but collects zero data.

Fix: Use a module-level boolean flag instead of DOM queries. Separate script injection (only if not present) from consent/config commands (always run). See the configuring-seo-analytics skill for the full pattern.

### Prerender Script

```javascript
// scripts/prerender.mjs
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import http from 'http';

const DIST = path.resolve('dist');
const ROUTES = ['/', '/om-oss', '/tjenester', '/kontakt', '/personvern'];
const PORT = 4173;

const server = http.createServer((req, res) => {
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (!path.extname(filePath)) filePath = path.join(DIST, 'index.html');
  try {
    res.writeHead(200);
    res.end(readFileSync(filePath));
  } catch {
    res.writeHead(200);
    res.end(readFileSync(path.join(DIST, 'index.html')));
  }
});

server.listen(PORT, async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  for (const route of ROUTES) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-prerender-ready]', { timeout: 10000 })
      .catch(() => console.warn(`Warning: data-prerender-ready not found for ${route}`));

    const html = await page.content();
    const dir = path.join(DIST, route === '/' ? '' : route);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), html);
    console.log(`Pre-rendered: ${route}`);
    await page.close();
  }

  await browser.close();
  server.close();
});
```

Use `data-prerender-ready` attribute instead of `renderAfterTime`:
```tsx
useEffect(() => {
  document.getElementById('root')?.setAttribute('data-prerender-ready', 'true');
}, []);
```

### package.json
```json
{
  "scripts": {
    "build": "vite build && node scripts/prerender.mjs"
  }
}
```

### netlify.toml
```toml
[build]
  command = "npx puppeteer browsers install chrome && npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/*/"
  to = "/:splat"
  status = 301

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false

[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

`npx puppeteer browsers install chrome` in the build command is required — without it, Netlify builds fail because Chrome isn't available.

---

## Track D: Pure SPA (No SEO)

Standard React SPA with no pre-rendering. Only use when SEO does not matter: internal tools, paid-traffic-only campaigns, or web apps behind login.

What you give up: Google indexing, OG previews on social platforms, and direct URL access without fallback redirects.

### netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/*/"
  to = "/:splat"
  status = 301

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

No `force = false` here — there are no pre-rendered files to serve.

### OG Meta Tags
Dynamic meta tags set via useEffect or react-helmet-async are not visible to social platforms. If you need OG previews, switch to Track A or B.
