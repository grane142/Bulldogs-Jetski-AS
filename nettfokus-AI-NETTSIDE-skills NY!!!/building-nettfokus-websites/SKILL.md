---
name: building-nettfokus-websites
description: "Orchestrates Nettfokus web agency website projects from prototype to production. Use when starting any website project, choosing a framework, converting prototypes from AI Studio/v0/aura.build/imported templates, running production checklists, or planning web development work for Nettfokus. Also use when the task spans multiple concerns (SEO + forms + deploy) and you need to know which specialized skills to load. Covers the decision tree for framework tracks: Astro SSG (default), Astro Hybrid SSG/SSR (frequent data changes), React Router v7 SSG, SPA + Puppeteer (migration only), pure SPA (no-SEO only), and Astro + Supabase (fullstack, with optional hybrid mode). Points to specialized skills for implementation."
---

# Building Nettfokus Websites

Orchestrate any Nettfokus website project from prototype to production. This skill helps you choose the right framework, plan the work, and verify everything is production-ready. For implementation details, load the specialized skills listed at the bottom.

## SSG is the Default

Use static site generation (Astro) for all new projects. SPAs cause recurring problems that have cost significant time across projects:

- Direct URL access breaks when trailing slashes don't match route definitions. With SSG, every URL is a real file — the problem doesn't exist.
- OG previews fail on LinkedIn, Facebook, and Slack because they don't execute JavaScript. SSG puts meta tags directly in the HTML.
- Prerendering with Puppeteer adds 300-400 MB Chromium to builds, uses fragile timing heuristics, and captures third-party scripts in snapshots that break on hydration.
- Every SPA ships the full React bundle (~200-400 KB) before users see content. Astro ships zero JS for static content.

These aren't theoretical concerns — they're bugs that appeared repeatedly in production projects.

## Typical Nettfokus Project

Norwegian business websites for service companies, typically 3-12 pages. SEO matters (local Google ranking). No auth or database — static files on Netlify with serverless functions for forms. Tailwind CSS for styling, React for interactive components (forms, mobile menu). Contact form connects to CRM via serverless function. Content editable by client through Content Collections or CMS.

Some projects need backend features (auth, database, file uploads) — those add Supabase.

## Workflow: Prototype → Production

```
PHASE 1-3: DESIGN
  Prototype in AI Studio / v0.app / aura.build / imported template
  Customer approves design and content
  Prototype is typically a React SPA — that's fine here

PHASE 4: TECHNICAL PASS
  1. Choose framework track → decision tree below
  2. Convert prototype → developing-astro-sites skill (or relevant track skill)
  3. Content Collections → managing-content-collections skill
  4. SEO + analytics + consent → configuring-seo-analytics skill
  5. Contact form + CRM → ghl-integration skill
  6. Security + deploy config → securing-netlify-deploys skill
  7. If backend needed → building-supabase-backends skill
  8. If CMS needed → configuring-cloudcannon skill

PHASE 5: QA
  Run production checklist (bottom of this file)

PHASE 6: DEPLOY
  Merge to main → verify deploy preview → connect domain → submit sitemap
```

## Framework Decision Tree

```
Does the project need a backend (auth, user data, database)?
├── YES → Does data change frequently (members, news, events)?
│   ├── YES → Track E-Hybrid: Astro Hybrid + Supabase ✅
│   │         Static pages stay SSG. Dynamic pages use SSR (always fresh data, no rebuild).
│   │         Load: building-supabase-backends + developing-astro-sites skills
│   │
│   └── NO → Track E: Astro SSG + Supabase
│             All pages static, rebuild on data changes.
│             Load: building-supabase-backends skill
│
└── NO → Is SEO important?
    ├── NO → Track D: Pure SPA
    │         Only for internal tools or paid-traffic-only campaigns.
    │         See references/spa-tracks.md
    │
    └── YES → Is this an EXISTING finished SPA?
        ├── YES → Track C: SPA + Puppeteer prerender
        │         Migration path only. Use Track A for the next project.
        │         See references/spa-tracks.md
        │
        └── NO → New project (most Nettfokus projects)
            │
            ├── Does data change frequently (blog, listings, profiles)?
            │   └── YES → Track A-Hybrid: Astro Hybrid SSG/SSR ✅
            │             Static pages from CDN, dynamic pages rendered live.
            │             No rebuilds for data changes. SEO identical to full SSG.
            │             Load: developing-astro-sites skill
            │
            ├── DEFAULT → Track A: Astro SSG ✅
            │   Load: developing-astro-sites skill
            │   Best performance, best SEO, fewest production issues.
            │
            └── EXCEPTION → Track B: React Router v7 SSG
                Only if converting the template to Astro would take >4 hours.
                Document the reason in README.
                See references/spa-tracks.md
```

Track A is the standard. Choose something else only with a documented reason.

### When to Use Hybrid Mode

Use hybrid (`output: 'hybrid'` in Astro) when a project has pages that pull data from Supabase or an API and that data changes frequently (members, news, events, listings). With pure SSG, every data change requires a full site rebuild. Hybrid mode lets you keep static pages (frontpage, about, contact, privacy) on CDN while dynamic pages are server-rendered per request — always showing fresh data without rebuild.

Key facts about hybrid mode:
- SEO is identical — SSR delivers complete HTML to Google, same as SSG
- Performance: SSG ~50ms (CDN), SSR ~200ms (server render). Add CDN caching (60s) to get near-SSG speed
- Cost: each SSR page view uses a small amount of serverless compute. Much cheaper than per-deploy credits for frequent rebuilds
- Requires the `@astrojs/netlify` adapter — see developing-astro-sites skill for setup
- Works on both Netlify and Vercel

## What Changes Between Tracks (What Doesn't)

Design is always preserved across tracks. Tailwind classes, custom CSS, images, icons, fonts, and layout remain identical.

What changes: page file structure, how meta tags are rendered, how interactive components load, and how much JavaScript reaches the browser.

| Track | Framework | SEO | JS to browser | Use case |
|-------|-----------|-----|---------------|----------|
| A ✅ | Astro SSG | Perfect | 10-50 KB | New projects (default) |
| A-Hybrid | Astro Hybrid SSG/SSR | Perfect | 10-50 KB | Frequent data changes (blog, listings) |
| B | React Router v7 SSG | Good | 200-400 KB | Heavy React template |
| C | SPA + Puppeteer | OK | 200-400 KB | Existing SPA migration |
| D | Pure SPA | None | 200-400 KB | No SEO needed |
| E | Astro SSG + Supabase | Perfect | 10-50 KB + Supabase | Backend, infrequent data changes |
| E-Hybrid ✅ | Astro Hybrid + Supabase | Perfect | 10-50 KB + Supabase | Backend, frequent data changes |

## Project Structure (Track A — Standard)

```
src/
├── content/                  # Editable content (markdown + schemas)
│   ├── config.ts
│   ├── pages/
│   └── blog/                 # If needed
├── components/               # React for interactive parts
├── layouts/
│   └── BaseLayout.astro
├── pages/
│   ├── index.astro
│   ├── om-oss.astro
│   ├── tjenester.astro
│   ├── kontakt.astro
│   ├── personvern.astro
│   ├── 404.astro
│   └── blogg/                # If needed
└── styles/
    └── global.css
public/
├── favicon.svg
├── favicon.png               # 48x48 fallback
├── apple-touch-icon.png      # 180x180
├── og-image.png              # 1200x630, <300KB
├── robots.txt
├── sitemap.xml
├── llms.txt
└── llms-full.txt
netlify/
└── functions/
    └── contact-form.ts
netlify.toml
```

## Environment Variables

| Variable | Where | Visible in browser? |
|---|---|---|
| VITE_RECAPTCHA_SITE_KEY | .env | Yes (by design) |
| VITE_GA_MEASUREMENT_ID | .env | Yes (by design) |
| VITE_SUPABASE_URL | .env | Yes (Track E) |
| VITE_SUPABASE_ANON_KEY | .env | Yes (Track E) |
| RECAPTCHA_SECRET_KEY | Netlify dashboard only | No |
| CRM_WEBHOOK_URL | Netlify dashboard only | No |
| SUPABASE_SERVICE_ROLE_KEY | Netlify dashboard only | No |
| SENTRY_DSN | Netlify dashboard only | No |

Any variable prefixed with `VITE_` is bundled into frontend code and visible in browser dev tools. This is by design for public keys (reCAPTCHA site key, GA measurement ID, Supabase anon key). Secrets (webhook URLs, service role keys) go only in Netlify dashboard environment variables and are accessed in serverless functions via `process.env`.

## Key Principles

**SSG by default.** Only use SPA when explicitly justified. Document the reason in README. For projects with frequently changing data (members, news, events), use hybrid mode (`output: 'hybrid'`) — static pages stay on CDN, dynamic pages are server-rendered with fresh data.

**No CDN frameworks in production.** Prototypes often use CDN links for convenience. Replace all CDN imports with npm packages before deploying — CDN links break, change versions, and can't be cached reliably.

**No API keys in source code.** Use .env locally, Netlify dashboard in production.

**Forms always go through serverless functions.** Frontend → Netlify Function → reCAPTCHA → CRM webhook. The webhook URL is never visible to the browser.

**Consent before any tracking.** Cookie consent must block all analytics until the user accepts. Norwegian GDPR requirements.

**Security headers on every site.** HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — configured in netlify.toml.

**Content in Content Collections.** Text and images the client might edit belong in src/content/ as markdown files, not hardcoded in templates.

**Accessibility is legally required.** Norwegian law (likestillings- og diskrimineringsloven) mandates accessible websites. Keyboard navigation, skip links, focus indicators, contrast ratios, alt text, semantic HTML, and lang="nb" are all required.

**Organisasjonsnummer in footer.** Norwegian law requires businesses to display their organization number on their website.

## Specialized Skills

Load the skill matching your current task:

| Task | Skill to load |
|------|---------------|
| Setting up Astro, converting SPA to Astro, View Transitions, islands, hybrid mode | `developing-astro-sites` |
| Content Collections, blog, images, privacy policy, Norwegian legal content | `managing-content-collections` |
| Meta tags, OG images, JSON-LD, GA4, Consent Mode, sitemap, llms.txt | `configuring-seo-analytics` |
| Contact forms, reCAPTCHA, honeypot, CRM webhooks | `ghl-integration` |
| Security headers, netlify.toml, env vars, CORS, Sentry, DNS, deploy | `securing-netlify-deploys` |
| CloudCannon CMS setup, visual editing, client onboarding | `configuring-cloudcannon` |
| Supabase auth, database, RLS, Edge Functions, file storage | `building-supabase-backends` |
| React Router v7 SSG, SPA prerender, pure SPA (legacy/exception tracks) | See references/spa-tracks.md |

For tasks that span multiple areas (e.g., "make this site production-ready"), work through the Phase 4 steps above and load each specialized skill as needed.

## Production Checklist

Run through before every deploy. Items reference specialized skills for implementation details.

### Architecture
- [ ] Framework track chosen and documented (default: Track A Astro)
- [ ] If not Astro, reason documented in README
- [ ] If hybrid mode: `@astrojs/netlify` adapter installed and configured
- [ ] If hybrid mode: pages correctly marked with `export const prerender = false` (SSR) or left default (SSG)
- [ ] View Page Source shows full HTML content (SSG and SSR tracks)
- [ ] All CDN imports replaced with npm packages
- [ ] `npm run build` completes without errors
- [ ] No console.log/console.error in production code
- [ ] Direct URL access works for all routes
- [ ] Custom 404 page exists

### Content → managing-content-collections
- [ ] Editable text in Content Collections, not hardcoded
- [ ] Images use Astro `<Image />` (not manual `<img>`)
- [ ] Content schema defined in src/content/config.ts
- [ ] Personvernerklæring page exists with correct content
- [ ] Footer has organisasjonsnummer, address, privacy policy link
- [ ] Blog/news collection (if applicable)

### SEO → configuring-seo-analytics
- [ ] Unique title per page (50-60 chars)
- [ ] Unique meta description per page (150-160 chars)
- [ ] Canonical URL per page
- [ ] OG meta tags with image (1200x630), og:image:width/height
- [ ] JSON-LD (Organization + LocalBusiness) with Google Business Profile
- [ ] robots.txt with sitemap reference
- [ ] sitemap.xml with all pages
- [ ] One H1 per page
- [ ] llms.txt and llms-full.txt in public/

### SEO Verification
- [ ] View Page Source — content visible in HTML
- [ ] LinkedIn Post Inspector — correct preview
- [ ] Facebook Sharing Debugger — correct preview
- [ ] Lighthouse: Performance ≥90, SEO ≥95, Accessibility ≥90

### Analytics + Consent → configuring-seo-analytics
- [ ] GA4 with Consent Mode v2 (consent default before gtag loads)
- [ ] Cookie banner blocks all tracking until accepted
- [ ] Declining verified to block tracking (Network tab)
- [ ] Accepting verified to enable tracking (GA4 Realtime)

### Forms → ghl-integration
- [ ] Form → serverless function (not direct to CRM)
- [ ] reCAPTCHA v3 verification
- [ ] Honeypot field
- [ ] CRM receives data (tested with real submission)
- [ ] Success and error states shown to user

### Security → securing-netlify-deploys
- [ ] No API keys in source code
- [ ] .env in .gitignore
- [ ] CORS locked to production domain
- [ ] Only VITE_ vars in frontend code
- [ ] Security headers in netlify.toml
- [ ] Sentry on serverless functions

### Accessibility (legally required in Norway)
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Skip-link to main content
- [ ] Visible focus indicators (:focus-visible)
- [ ] Color contrast ≥4.5:1 text, ≥3:1 large
- [ ] Alt text on all images
- [ ] Semantic HTML (nav, main, section, footer)
- [ ] prefers-reduced-motion respected
- [ ] lang="nb" on html element

### Performance
- [ ] Images: Astro `<Image />`, lazy-loaded, width/height set
- [ ] Fonts: preconnect + display=swap, only used weights
- [ ] LCP <2.5s, INP <200ms, CLS <0.1
- [ ] favicon.svg with .png fallback

### Deploy → securing-netlify-deploys
- [ ] netlify.toml correct for chosen track
- [ ] Environment variables set in Netlify dashboard
- [ ] Deploy preview tested
- [ ] HTTPS works
- [ ] 404 page works
- [ ] Link checker passed
- [ ] Google Search Console verified + sitemap submitted

### Backend (Track E only) → building-supabase-backends
- [ ] RLS policies on all tables
- [ ] Anon key in frontend, service role key in serverless only
- [ ] Auth flow tested
- [ ] PITR or daily backups configured
