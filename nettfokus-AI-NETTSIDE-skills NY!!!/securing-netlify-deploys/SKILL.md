---
name: securing-netlify-deploys
description: "Secures and deploys Nettfokus websites on Netlify with production-grade security headers and monitoring. Use when configuring netlify.toml for any framework track (Astro, Astro Hybrid, React Router, SPA), setting up security headers (HSTS, X-Frame-Options, CSP, Permissions-Policy), managing environment variables between .env and Netlify dashboard, configuring CORS for serverless functions, configuring CDN cache headers for SSR pages in hybrid mode, setting up Sentry error monitoring, running broken link checkers, configuring custom domains and DNS, verifying HTTPS certificates, or submitting sitemaps to Google Search Console. Also use when debugging deploy failures or 404 errors after deployment."
---

# Securing & Deploying on Netlify

Configure security headers, environment variables, error monitoring, and deployment for Nettfokus websites. Applies to all framework tracks.

## Security Headers

Every Nettfokus site includes these headers in `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

HSTS forces HTTPS for 2 years including subdomains. X-Frame-Options prevents clickjacking via iframe embedding. X-Content-Type-Options stops MIME-type sniffing. Referrer-Policy limits referrer info sent to other sites. Permissions-Policy blocks camera/mic/geolocation unless explicitly needed.

### Content Security Policy (CSP)

Start in report-only mode to catch issues without breaking the site:

```toml
Content-Security-Policy-Report-Only = "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com; frame-src https://www.google.com;"
```

After testing with no violations in browser console, switch to `Content-Security-Policy` (enforcing).

### Production CSP Example (with GTM + reCAPTCHA + Google Fonts)

```toml
Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://www.googletagmanager.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https://www.google.com; connect-src 'self' https://www.google.com https://www.googletagmanager.com https://region1.google-analytics.com https://analytics.google.com;"
```

If using GHL form embed (iframe), add GHL domain to `frame-src`:
```
frame-src https://www.google.com https://link.domene.no https://*.leadconnectorhq.com https://*.msgsndr.com;
```

### Cookie Security

All cookies set from JavaScript should include `Secure` flag:

```typescript
document.cookie = 'cookie_consent=accepted; max-age=31536000; path=/; SameSite=Lax; Secure';
```

`Secure` ensures the cookie is only sent over HTTPS. `HttpOnly` cannot be set from JavaScript — only from server headers.

## Asset Caching

Astro and Vite hash asset filenames, making them safe to cache indefinitely:

```toml
# Astro (Track A/E)
[[headers]]
  for = "/_astro/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Vite (Track B/C/D)
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

## netlify.toml Per Track

### Track A / E (Astro) — no redirects needed

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/_astro/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### Track A-Hybrid / E-Hybrid (Astro Hybrid SSG/SSR) — adapter required

Requires `@astrojs/netlify` adapter. The adapter generates Netlify Functions for SSR pages automatically. Static pages are still served from CDN.

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/_astro/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# CDN caching for SSR pages — adjust paths per project
[[headers]]
  for = "/nyheter/*"
  [headers.values]
    Cache-Control = "public, s-maxage=60, stale-while-revalidate=120"

[[headers]]
  for = "/medlemmer/*"
  [headers.values]
    Cache-Control = "public, s-maxage=60, stale-while-revalidate=120"

[[headers]]
  for = "/arrangementer/*"
  [headers.values]
    Cache-Control = "public, s-maxage=60, stale-while-revalidate=120"
```

`s-maxage=60` caches SSR responses at CDN level for 60 seconds. `stale-while-revalidate=120` serves cached version while fetching fresh in background. Data is max 60 seconds old with near-SSG response times. Adjust paths to match the project's SSR routes.

### Track B / C (pre-rendered SPA) — trailing slash + fallback

```toml
[build]
  command = "npm run build"      # Track C: prepend "npx puppeteer browsers install chrome &&"
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
```

`force = false` is critical — it serves pre-rendered HTML when the file exists, falling back to index.html only for unknown paths.

### Track D (pure SPA) — all paths to index.html

```toml
[[redirects]]
  from = "/*/"
  to = "/:splat"
  status = 301

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

No `force = false` — there are no pre-rendered files to serve.

## Environment Variables

### Rules
1. Never hardcode API keys in source code
2. `.env` must be in `.gitignore`
3. Only `VITE_`-prefixed variables are exposed to frontend code
4. Sensitive keys go in Netlify dashboard only

### Local Development (.env)

```bash
VITE_RECAPTCHA_SITE_KEY=6Le...
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
RECAPTCHA_SECRET_KEY=6Le...      # No VITE_ prefix — server only
CRM_WEBHOOK_URL=https://...      # No VITE_ prefix — server only
SENTRY_DSN=https://...           # No VITE_ prefix — server only
```

### In Code

```typescript
// Frontend — only VITE_ vars available
const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;

// Netlify Function — all vars via process.env
const secret = process.env.RECAPTCHA_SECRET_KEY;
```

## CORS

Lock serverless function endpoints to the production domain:

```typescript
// In Netlify Functions
const ALLOWED_ORIGINS = [
  'https://domene.no',
  'https://www.domene.no',
];

if (process.env.CONTEXT !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:4321');
}

const origin = event.headers.get('origin') || '';
const corsHeaders = ALLOWED_ORIGINS.includes(origin)
  ? { 'Access-Control-Allow-Origin': origin }
  : {};
```

## Sentry Error Monitoring

Serverless functions can fail silently — CRM webhooks change, API keys expire, rate limits hit. Without monitoring, the first person to notice is an angry customer.

```typescript
// netlify/functions/contact-form.ts
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.CONTEXT || 'development',
    tracesSampleRate: 0.1,
  });
}

export default async function handler(req: Request) {
  try {
    // ... function logic
  } catch (err) {
    Sentry.captureException(err);
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}
```

Setup: Create project in Sentry (free tier covers small sites) → get DSN → add to Netlify env vars → initialize in each serverless function → set up email alerts.

At minimum, add Sentry to `contact-form.ts`. If the form breaks, you'll know before the customer does.

## Link Checker

Static sites accumulate broken links over time. Run a check before deploy and weekly.

```bash
npm install broken-link-checker-local --save-dev
```

```json
{
  "scripts": {
    "check-links": "npm run build && npx broken-link-checker-local dist --recursive"
  }
}
```

### Weekly CI/CD Check (GitHub Actions)

```yaml
# .github/workflows/link-check.yml
name: Check Links
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 8 * * 1'  # Every Monday 08:00
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npx broken-link-checker-local dist --recursive
```

## DNS & Domain Setup

### DNS Records

| Type | Oppføring | Verdi | Forklaring |
|---|---|---|---|
| ALIAS | `domene.no` | `apex-loadbalancer.netlify.com` | Apex domain → Netlify |
| CNAME | `www.domene.no` | `[site-name].netlify.app` | www subdomain |

**ALIAS til hostnavn — IKKE IP-adresse.** `apex-loadbalancer.netlify.com` er korrekt. Å bruke IP (`75.2.60.5`) kan forårsake SSL-problemer der sertifikatet er gyldig men nettleseren viser "Ikke sikker" (mixed content / feil sertifikat-matching).

Hvis DNS-leverandøren ikke støtter ALIAS, bruk A-record til `75.2.60.5` som fallback.

### www → non-www Redirect

Legg til i `netlify.toml` for å unngå duplikatinnhold i Google:

```toml
[[redirects]]
  from = "https://www.domene.no/*"
  to = "https://domene.no/:splat"
  status = 301
  force = true
```

### HTTPS Provisjonering

1. Add custom domain in Netlify → Domain management
2. Legg til både `domene.no` og `www.domene.no`
3. Under HTTPS → klikk "Verify DNS configuration" → "Provision certificate"
4. Let's Encrypt-sertifikat provisjoneres automatisk (kan ta 5-15 min)
5. Verifiser at `https://domene.no` viser riktig sertifikat (ikke `*.netlify.app`)

**Feilsøking SSL:**
- Nettleseren sier "Ikke sikker" men "Sertifikatet er gyldig" → mixed content eller feil ALIAS (bruk hostnavn, ikke IP)
- Sertifikat viser `*.netlify.app` → Let's Encrypt ikke provisjonert ennå, vent eller klikk "Retry DNS verification"
- Funker i curl men ikke i nettleser → tøm nettleserens SSL-cache (inkognitovindu for test)

## Deploy Checklist

- [ ] `npm run build` succeeds locally
- [ ] Link checker passed
- [ ] netlify.toml matches chosen track (including hybrid CDN cache headers if applicable)
- [ ] If hybrid mode: `@astrojs/netlify` adapter installed and SSR pages verified
- [ ] Environment variables set in Netlify dashboard
- [ ] Deploy preview tested
- [ ] All pages load correctly (direct URL access test)
- [ ] HTTPS active
- [ ] Custom domain configured
- [ ] 404 page works and looks correct
- [ ] Security headers verified (securityheaders.com)
- [ ] Sentry receiving test events
- [ ] Google Search Console property verified
- [ ] Sitemap submitted to Search Console
