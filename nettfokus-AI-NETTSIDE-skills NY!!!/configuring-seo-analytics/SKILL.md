---
name: configuring-seo-analytics
description: "Configures SEO optimization and Google Analytics with GDPR-compliant consent for Norwegian business websites. Use when implementing meta tags (title, description, OG, canonical), creating OG images, setting up JSON-LD structured data with Google Business Profile, configuring robots.txt and sitemap.xml, implementing GA4 with Google Consent Mode v2, building cookie consent banners, creating llms.txt for AI SEO, or verifying SEO with LinkedIn Post Inspector, Facebook Debugger, and Lighthouse. Also use when fixing OG preview failures or GA4 tracking issues, especially the prerender gtag bug in Track C. SEO is identical for SSG and hybrid SSR tracks — both deliver full HTML to crawlers."
---

# Configuring SEO & Analytics

Set up SEO meta tags, structured data, Google Analytics with consent, and AI SEO files for Nettfokus websites. Applies to all tracks, but SSG tracks (A, B, E) get most of this for free in the HTML. Hybrid tracks (A-Hybrid, E-Hybrid) have identical SEO — SSR pages deliver complete HTML to crawlers, same as SSG pages.

## Meta Tags Per Page

Every page needs unique, descriptive meta tags. In Astro, these live in BaseLayout.astro and are statically rendered — always visible to crawlers.

```astro
---
const { title, description, canonical, ogImage } = Astro.props;
const siteUrl = 'https://domene.no';
---
<head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical || Astro.url.href} />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="nb_NO" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical || Astro.url.href} />
  <meta property="og:site_name" content="Firmanavn" />
  <meta property="og:image" content={ogImage || `${siteUrl}/og-image.png`} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
```

For SPA tracks (B, C), use a centralized seo-config object:

```typescript
// src/lib/seo-config.ts
export const seoConfig: Record<string, {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
}> = {
  "/": {
    title: "Firmanavn | Profesjonelle tjenester i Oslo",
    description: "Kort, unik beskrivelse av bedriften (150-160 tegn).",
    canonical: "https://domene.no/",
  },
  "/om-oss": {
    title: "Om oss | Firmanavn",
    description: "Les mer om hvem vi er og hva vi gjør.",
    canonical: "https://domene.no/om-oss",
  },
};
```

Track D (pure SPA): Meta tags set via useEffect are invisible to social platforms. OG previews will fail.

## OG Image

Size: 1200×630 pixels, PNG or JPG, under 300 KB. Place in `public/og-image.png`.

Always include `og:image:width` and `og:image:height` — without these, some platforms skip the image entirely. Per-page OG images are optional but recommended for key pages.

## JSON-LD Structured Data

For Norwegian business sites, combine Organization + LocalBusiness. The Google Business Profile URL in `sameAs` strengthens the connection between the website and GBP listing — critical for local SEO.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Firmanavn AS",
  "description": "Kort beskrivelse av bedriften.",
  "url": "https://domene.no",
  "telephone": "+47 123 45 678",
  "email": "post@domene.no",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Gateadresse 1",
    "addressLocality": "Oslo",
    "postalCode": "0001",
    "addressCountry": "NO"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 59.9139,
    "longitude": 10.7522
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens": "08:00",
    "closes": "16:00"
  },
  "sameAs": [
    "https://www.google.com/maps/place/?q=place_id:ChIJ...",
    "https://www.facebook.com/firmanavn",
    "https://www.linkedin.com/company/firmanavn"
  ]
}
</script>
```

Find your Place ID: Google Maps → "Share" → copy URL, or use the [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id). This is the most important `sameAs` entry for local Norwegian businesses.

### Multiple Locations

For businesses with several offices, use array for `address`:

```json
{
  "@type": "LocalBusiness",
  "name": "Firmanavn AS",
  "alternateName": "Firmanavn",
  "address": [
    {
      "@type": "PostalAddress",
      "addressLocality": "Tromsø",
      "addressRegion": "Troms og Finnmark",
      "addressCountry": "NO"
    },
    {
      "@type": "PostalAddress",
      "addressLocality": "Bardufoss",
      "addressRegion": "Troms og Finnmark",
      "addressCountry": "NO"
    }
  ],
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Troms og Finnmark"
  }
}
```

`alternateName` hjelper Google å koble søk uten "AS" til bedriften.

### FAQPage Schema (Rich Results)

Hvis siden har en FAQ-seksjon, legg til FAQPage schema for å få dropdown-resultater i Google:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Spørsmålet her?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Svaret her."
      }
    }
  ]
}
```

Ha dette som et separat `<script type="application/ld+json">` i tillegg til LocalBusiness. Ikke kombiner dem.

In Astro, place in BaseLayout.astro or as a component receiving data as props.

## robots.txt

```
User-agent: *
Allow: /

Sitemap: https://domene.no/sitemap.xml
```

Place in `public/robots.txt`.

## sitemap.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://domene.no/</loc>
    <lastmod>2026-01-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://domene.no/om-oss</loc>
    <lastmod>2026-01-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

Place in `public/sitemap.xml` for manual control.

### Auto-generert Sitemap (Anbefalt for Astro)

Bruk `@astrojs/sitemap` for automatisk generering som oppdager alle sider:

```bash
npm install @astrojs/sitemap
```

```javascript
// astro.config.mjs
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [react(), sitemap()],
  site: 'https://domene.no',
});
```

**Fjern manuell `public/sitemap.xml`** — den auto-genererte tar over ved build. `robots.txt` peker fortsatt til `/sitemap.xml`.

## llms.txt (AI SEO)

Help AI assistants understand and recommend the business.

```
# public/llms.txt
# Firmanavn AS

> Kort one-liner om bedriften.

## Tjenester
- Tjeneste 1: Kort beskrivelse
- Tjeneste 2: Kort beskrivelse

## Kontakt
- Nettside: https://domene.no
- E-post: post@domene.no
- Telefon: +47 123 45 678
- Adresse: Gateadresse 1, 0001 Oslo
```

`llms-full.txt` can include more detail: pricing, FAQ, case studies. Both go in `public/`.

## Google Analytics 4 + Consent Mode v2

Two approaches: **Direct gtag** (simpler) or **GTM** (more control over events). Both support Consent Mode v2.

### Approach 1: Direct gtag (enklest)

```html
<!-- 1. Consent defaults FIRST -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'wait_for_update': 500
  });
</script>

<!-- 2. Load gtag.js -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', { send_page_view: true });
</script>
```

### Approach 2: Google Tag Manager (anbefalt for event tracking)

GTM gir kontroll over events (telefon-klikk, e-postklikk, skjemainnsending) uten kodeendringer. GA4-konfigurering skjer i GTM-dashboardet, ikke i kode.

```html
<!-- 1. Consent defaults FIRST (before GTM) -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'wait_for_update': 500
  });
</script>

<!-- 2. Load GTM (replaces gtag.js) -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXXX');</script>

<!-- 3. GTM noscript fallback (right after <body>) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

**GTM-oppsett i dashboardet:**
1. GA4 Configuration tag med Measurement ID (`G-XXXXXXXXXX`)
2. Trigger: Click URL contains `tel:` → GA4 Event `phone_click`
3. Trigger: Click URL contains `mailto:` → GA4 Event `email_click`
4. Trigger: Custom Event = `form_submit` → GA4 Event `form_submit`

**dataLayer push fra kode (for GTM Custom Event triggers):**

```typescript
// Push event fra skjema-submit
if (typeof window.dataLayer !== 'undefined') {
  window.dataLayer.push({
    event: 'form_submit',
    form_type: 'contact',
    port_type: selectedPorts.join(', '),
  });
}
```

### Klikkbare telefon/e-post-lenker

Bruk `tel:` og `mailto:` — GTM fanger disse automatisk via Click URL trigger:

```html
<a href="tel:+4712345678">123 45 678</a>
<a href="mailto:post@domene.no">post@domene.no</a>
```

Viktig: Sett `text-decoration: none` og riktig farge så lenkene ikke ser ut som standard blå linker:

```html
<a href="tel:..." class="text-gray-400 no-underline hover:text-brand-yellow">
```

### Cookie Consent Component

```tsx
// src/components/CookieConsent.tsx
import { useState, useEffect } from 'react';

declare function gtag(...args: any[]): void;

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = document.cookie
      .split('; ')
      .find(c => c.startsWith('cookie_consent='));
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    document.cookie = 'cookie_consent=accepted; max-age=31536000; path=/; SameSite=Lax';
    setVisible(false);
  };

  const handleDecline = () => {
    document.cookie = 'cookie_consent=declined; max-age=31536000; path=/; SameSite=Lax';
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="Informasjonskapsler" className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white shadow-lg border-t">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-gray-700 flex-1">
          Vi bruker informasjonskapsler for å analysere trafikk og forbedre brukeropplevelsen.
          Les mer i vår <a href="/personvern" className="underline">personvernerklæring</a>.
        </p>
        <div className="flex gap-2">
          <button onClick={handleDecline} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
            Avslå
          </button>
          <button onClick={handleAccept} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Godta
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Prerender GA4 Bug (Track C)

If using Puppeteer prerendering, the prerender process captures the gtag script tag in the HTML snapshot. When a real user loads the page, any initialization function that checks the DOM for this script finds it and skips configuration. Result: gtag.js loads but collects zero data.

Fix: Use a module-level boolean flag instead of DOM queries. Separate script injection (only if not present) from consent/config commands (always run):

```typescript
let ga4Initialized = false;

function initGA4() {
  if (ga4Initialized) return;
  ga4Initialized = true;

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  // Always push consent defaults + config
  gtag('consent', 'default', {
    analytics_storage: storedConsent === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied',
  });

  // Only inject script tag if not already present
  if (!document.querySelector('script[src*="googletagmanager.com/gtag"]')) {
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    document.head.appendChild(script);
  }

  // Always send these commands
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
}
```

Two additional pitfalls:

Use `function gtag() { dataLayer.push(arguments); }` — not `(...args) => { dataLayer.push(args); }`. Google's dataLayer processor expects the `arguments` object, not an Array. TypeScript rest params produce an Array, which GA silently ignores.

Remove `debug_mode: true` before deploying to production. It forces all events to DebugView and can interfere with normal data collection.

### Consent Verification (7 steps)

1. Fresh browser — clear cookies, open site in incognito
2. Network tab — filter by "google" or "analytics". No requests before consent.
3. Click Decline — still no analytics requests in Network tab.
4. Clear cookies, reload — click Accept this time.
5. Network tab — should now see requests to google-analytics.com.
6. GA4 Realtime — check GA4 dashboard → Realtime → verify active user appears.
7. Console check (Track C) — verify `dataLayer` contains `consent`, `js`, and `config` commands.

## SEO Verification Checklist

- [ ] View Page Source — full HTML content visible (not empty `<div id="root">`) — applies to both SSG and SSR pages
- [ ] LinkedIn Post Inspector — paste URL, verify title + image + description
- [ ] Facebook Sharing Debugger — paste URL, verify OG preview
- [ ] Google Rich Results Test — paste URL, verify JSON-LD
- [ ] Google Business Profile — verified and linked in JSON-LD sameAs
- [ ] Lighthouse — Performance ≥90, SEO ≥95, Accessibility ≥90
- [ ] Google Search Console — property verified, sitemap submitted
