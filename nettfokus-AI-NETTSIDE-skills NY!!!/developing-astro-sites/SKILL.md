---
name: developing-astro-sites
description: "Develops Astro websites with React islands for Nettfokus projects. Use when creating new Astro projects, setting up astro.config.mjs, building .astro pages and layouts, configuring View Transitions, using client:load/client:visible/client:idle directives for React components, handling images with Astro Image component, converting React SPA prototypes (from AI Studio, v0.app, aura.build, imported templates) into Astro, or setting up hybrid rendering mode (SSG + SSR) for projects with frequently changing data. The default framework for all new Nettfokus web projects. Also use when working with Astro file-based routing, BaseLayout patterns, Netlify adapter for SSR, or 404 pages."
---

# Developing Astro Sites

Set up and build Astro websites with React islands. This is the default framework (Track A) for all new Nettfokus projects. Supports pure SSG (default) and hybrid SSG/SSR mode for projects with frequently changing data.

Astro generates a real HTML file per page at build time. In hybrid mode, selected pages are server-rendered per request instead. Interactive React components (forms, mobile menu, cookie consent) hydrate as "islands" — zero JavaScript ships for static content.

## Setup

```bash
npm create astro@latest
npx astro add react
npx astro add tailwind
```

### Dependencies

```json
{
  "dependencies": {
    "@astrojs/react": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.500.0"
  },
  "devDependencies": {
    "astro": "^5.0.0",
    "@astrojs/tailwind": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'static',
  site: 'https://domene.no',       // Replace with actual domain
  trailingSlash: 'never',          // Consistent URLs without trailing slash
});
```

`output: 'static'` is the default but being explicit makes it clear this is SSG. `site` is used for canonical URLs and sitemap generation. `trailingSlash: 'never'` prevents the slash mismatch problems that plague SPAs.

## Hybrid Rendering Mode (SSG + SSR)

When a project has pages that pull data from Supabase or an API and that data changes frequently (members, news, events, blog), use hybrid mode instead of pure SSG. This eliminates rebuilds for data changes — dynamic pages are server-rendered per request with always-fresh data, while static pages stay on CDN.

### Setup

Install the Netlify adapter:

```bash
npx astro add netlify
```

Update `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'hybrid',                    // Changed from 'static'
  adapter: netlify(),                   // Required for SSR pages
  site: 'https://domene.no',
  trailingSlash: 'never',
});
```

### Marking Pages as SSR

In hybrid mode, all pages default to SSG (prerendered at build time). To make a page server-rendered, add `export const prerender = false` in the frontmatter:

```astro
---
// src/pages/nyheter/index.astro — server-rendered, always fresh data
export const prerender = false;

import { supabase } from '../../lib/supabase';
import BaseLayout from '../../layouts/BaseLayout.astro';

const { data: articles } = await supabase
  .from('articles')
  .select('*')
  .eq('published', true)
  .order('published_at', { ascending: false });
---
<BaseLayout title="Nyheter" description="Siste nytt">
  <main id="main-content">
    {articles?.map(article => (
      <a href={`/nyheter/${article.slug}`}>{article.title}</a>
    ))}
  </main>
</BaseLayout>
```

```astro
---
// src/pages/nyheter/[slug].astro — server-rendered dynamic route
export const prerender = false;

import { supabase } from '../../lib/supabase';
import BaseLayout from '../../layouts/BaseLayout.astro';

const { slug } = Astro.params;
const { data: article } = await supabase
  .from('articles')
  .select('*')
  .eq('slug', slug)
  .eq('published', true)
  .single();

if (!article) return Astro.redirect('/404');
---
<BaseLayout title={article.title} description={article.excerpt}>
  <main id="main-content">
    <h1>{article.title}</h1>
    <div set:html={article.content} />
  </main>
</BaseLayout>
```

### Which Pages Go Where

```
STATIC (prerender = true, default) — rarely change, served from CDN (~50ms)
├── Forside (index.astro)
├── Om oss
├── Kontakt
├── Personvern
├── Medlemsfordeler / Tjenester
└── Bli medlem

SERVER-RENDERED (prerender = false) — change frequently, always fresh data (~200ms)
├── /medlemmer (listing)
├── /medlemmer/[slug] (profiles, editable by users)
├── /nyheter (listing)
├── /nyheter/[slug] (published via CMS/Supabase)
├── /arrangementer (listing)
└── /arrangementer/[slug] (published via CMS/Supabase)
```

### CDN Caching for SSR Pages

SSR pages are ~200ms per request (Supabase query + render). Add CDN caching so subsequent requests within the cache window are served from CDN at SSG speed:

```toml
# netlify.toml — cache SSR pages for 60 seconds
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

`s-maxage=60` tells the CDN to cache the page for 60 seconds. `stale-while-revalidate=120` serves the cached version while fetching a fresh one in the background. Result: data is always max 60 seconds old, with CDN-speed response times.

### Key Differences from Pure SSG

| Aspect | Pure SSG (`output: 'static'`) | Hybrid (`output: 'hybrid'`) |
|---|---|---|
| Config | No adapter needed | Requires `@astrojs/netlify` adapter |
| Static pages | All pages | Pages without `prerender = false` |
| Dynamic pages | None (must rebuild) | Pages with `prerender = false` |
| Data freshness | Stale until rebuild | Always fresh (or max cache age) |
| Rebuild needed | On every data change | Only on code changes or static page edits |
| SEO | Perfect | Perfect (SSR serves full HTML) |
| Deploy cost | One build per data change | Minimal — only code deploys |
| Performance | ~50ms (CDN) | Static: ~50ms, SSR: ~200ms (or ~50ms with CDN cache) |

## File Structure

```
src/
├── content/              # Editable content → managing-content-collections skill
│   ├── config.ts
│   ├── pages/
│   ├── blog/
│   └── team/
├── components/           # React islands for interactive parts
│   ├── ContactForm.tsx
│   ├── MobileMenu.tsx
│   └── CookieConsent.tsx
├── layouts/
│   └── BaseLayout.astro  # Head, header, footer, View Transitions
├── pages/                # Each file = one HTML page
│   ├── index.astro
│   ├── om-oss.astro
│   ├── tjenester.astro
│   ├── kontakt.astro
│   ├── personvern.astro
│   ├── 404.astro
│   └── blogg/
│       ├── index.astro
│       └── [slug].astro
├── styles/
│   └── global.css
└── assets/               # Template images (logo, patterns) — optimized by Astro
    └── logo.svg
```

### Build Output

Each .astro page becomes a real HTML file:

```
dist/
├── index.html              ← /
├── om-oss/index.html       ← /om-oss
├── tjenester/index.html    ← /tjenester
├── kontakt/index.html      ← /kontakt
├── personvern/index.html   ← /personvern
└── blogg/
    ├── index.html          ← /blogg
    └── ny-tjeneste/index.html ← /blogg/ny-tjeneste
```

No client-side routing. No trailing slash bugs. Netlify serves the files directly.

## BaseLayout

The shared layout handles head metadata, skip-link, View Transitions, and font loading.

```astro
---
// src/layouts/BaseLayout.astro
import { ViewTransitions } from 'astro:transitions';

interface Props {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
}

const { title, description, canonical, ogImage } = Astro.props;
const siteUrl = 'https://domene.no';
const defaultOg = `${siteUrl}/og-image.png`;
---
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- SEO -->
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical || Astro.url.href} />

  <!-- OG -->
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="nb_NO" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical || Astro.url.href} />
  <meta property="og:site_name" content="Firmanavn" />
  <meta property="og:image" content={ogImage || defaultOg} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <!-- Fonts: preconnect first, then load -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />

  <!-- View Transitions -->
  <ViewTransitions />
</head>
<body>
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded">
    Hopp til innhold
  </a>
  <slot />
</body>
</html>
```

The skip-link is a Norwegian accessibility requirement. The `sr-only focus:not-sr-only` pattern hides it visually until a keyboard user tabs to it.

Customize fonts per project — only load the weights actually used.

## View Transitions

View Transitions add smooth crossfade animations between pages, making navigation feel like a SPA without any SPA problems. Adding `<ViewTransitions />` in the head is all that's needed — it works with all Astro pages automatically.

To animate specific elements across pages, use the same `transition:name` on both pages:

```astro
<!-- Page A -->
<h1 transition:name="page-title">Om oss</h1>

<!-- Page B -->
<h1 transition:name="page-title">Tjenester</h1>
```

The element morphs between the two positions during navigation.

## React Islands (Client Directives)

Static content (hero, about, services, footer) lives in .astro files — zero JavaScript. Interactive parts are React components with a client directive:

| Directive | When JS loads | Use for |
|---|---|---|
| `client:load` | Immediately on page load | Forms, consent banner, mobile menu |
| `client:visible` | When scrolled into view | Carousels, maps, counters |
| `client:idle` | After page is interactive | Non-critical widgets |
| `client:only="react"` | Client only, no SSR attempt | Components using browser-only APIs |

```astro
---
import ContactForm from '../components/ContactForm.tsx';
import CookieConsent from '../components/CookieConsent.tsx';
---
<main id="main-content">
  <h1>Kontakt oss</h1>
  <!-- Hydrates immediately — user needs to interact with the form -->
  <ContactForm client:load />
</main>
<!-- Hydrates immediately — consent banner must be ready -->
<CookieConsent client:load />
```

`client:load` is the right choice for forms and consent because users need to interact with them right away. Use `client:visible` for content further down the page to defer loading.

## Image Handling

Always use Astro's `<Image />` component instead of manual `<img>` tags. It automatically converts to WebP, generates srcset for responsive sizes, sets width/height to prevent layout shift, and lazy-loads images below the fold.

```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';
---
<!-- Astro optimizes: WebP, srcset, width/height, lazy -->
<Image src={heroImage} alt="Beskrivende alt-tekst" width={1200} height={600} />
```

For content collection images (referenced in frontmatter), they're already imported via the schema:

```astro
---
import { getEntry } from 'astro:content';
import { Image } from 'astro:assets';
const page = await getEntry('pages', 'om-oss');
---
<Image src={page.data.heroImage} alt={page.data.heroImageAlt || ''} width={1200} height={600} />
```

### Image Locations

| Location | Use for | Optimized by Astro? |
|---|---|---|
| `src/content/*/images/` | Content images (in frontmatter) | Yes |
| `src/assets/` | Template images (logo, patterns, icons) | Yes |
| `public/` | Files needing fixed URLs (og-image.png, favicon) | No |

If an image can go in `src/`, put it there. Only use `public/` for files that need a fixed, predictable URL path.

## Pages from Content Collections

```astro
---
// src/pages/om-oss.astro
import { getEntry } from 'astro:content';
import { Image } from 'astro:assets';
import BaseLayout from '../layouts/BaseLayout.astro';

const page = await getEntry('pages', 'om-oss');
if (!page) throw new Error('Content not found: pages/om-oss');
const { Content } = await page.render();
---
<BaseLayout title={page.data.title} description={page.data.description} ogImage={page.data.ogImage}>
  <main id="main-content">
    {page.data.heroImage && (
      <Image
        src={page.data.heroImage}
        alt={page.data.heroImageAlt || ''}
        width={1200}
        height={600}
        class="w-full h-64 object-cover"
      />
    )}
    <article class="prose max-w-3xl mx-auto py-12 px-4">
      <Content />
    </article>
  </main>
</BaseLayout>
```

For Content Collections setup (schemas, blog, team, privacy policy), load the `managing-content-collections` skill.

## Custom 404 Page

```astro
---
// src/pages/404.astro
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Side ikke funnet | Firmanavn" description="Siden du leter etter finnes ikke.">
  <main id="main-content" class="flex flex-col items-center justify-center min-h-[60vh] px-4">
    <h1 class="text-4xl font-bold mb-4">404</h1>
    <p class="text-gray-600 mb-6">Beklager, denne siden finnes ikke.</p>
    <a href="/" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
      Tilbake til forsiden
    </a>
  </main>
</BaseLayout>
```

Astro generates `dist/404.html` automatically. Netlify serves it for any path without a matching file.

## Converting SPA Prototype to Astro

Most Nettfokus projects start as React SPA prototypes (from AI Studio, v0.app, aura.build, or imported templates). Converting to Astro typically takes 1-2 hours for a 5-page site.

See [references/spa-conversion.md](references/spa-conversion.md) for the detailed step-by-step guide.

Quick summary of what changes and what stays:

**Stays identical:** Tailwind classes, custom CSS, images, icons, fonts, visual design, React component logic for interactive parts.

**Changes:**
1. Static sections (hero, about, services, footer) → `.astro` files. Copy JSX, change `className` → `class`, remove React hooks from static content.
2. Editable text → Content Collections as markdown files.
3. Interactive components (forms, mobile menu) → Keep as `.tsx`, import with `client:load`.
4. Images → Move to `src/assets/` or `src/content/*/images/`, use `<Image />`.
5. Routing → Delete React Router entirely. File-based routing in `src/pages/`.

## Multi-Language Sites

Use Astro's built-in i18n routing instead of separate projects:

```javascript
// astro.config.mjs
export default defineConfig({
  i18n: {
    defaultLocale: 'nb',
    locales: ['nb', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
```

This gives `/om-oss` (Norwegian, default — no prefix) and `/en/about` (English) from the same project.

## netlify.toml

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

No redirect rules needed. Astro generates real HTML files that Netlify serves directly. The `/_astro/*` cache header applies to hashed assets (CSS, JS) that are safe to cache indefinitely.

For Content Security Policy (CSP), CORS configuration, environment variable management, Sentry error monitoring, link checking, DNS setup, and netlify.toml templates for other tracks, load the `securing-netlify-deploys` skill.

## Expected Bundle Size

```
CSS:  ~50-80 KB (gzip: ~10-15 KB)
JS:   ~10-50 KB (gzip: ~5-15 KB) — only interactive islands
HTML: ~5-10 KB per page
Images: auto-optimized by Astro <Image />
```

Compare to SPA tracks: 200-400 KB JavaScript before the user sees anything.

## Related Skills

| Task | Skill |
|------|-------|
| Content Collections, blog, images, privacy policy | `managing-content-collections` |
| Meta tags, JSON-LD, GA4, consent | `configuring-seo-analytics` |
| Contact forms, reCAPTCHA, CRM | `ghl-integration` |
| Security headers, deploy, Sentry, hybrid netlify.toml | `securing-netlify-deploys` |
| CloudCannon CMS | `configuring-cloudcannon` |
| Supabase backend (Track E / E-Hybrid) | `building-supabase-backends` |
