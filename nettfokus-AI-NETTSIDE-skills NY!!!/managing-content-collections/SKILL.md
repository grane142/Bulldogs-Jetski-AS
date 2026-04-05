---
name: managing-content-collections
description: "Manages Astro Content Collections for client-editable content in Nettfokus websites. Use when setting up content schemas in src/content/config.ts, creating page/blog/team collections as markdown or YAML files, handling images with Astro Image component, writing personvernerklæring (privacy policy), implementing Norwegian legal footer requirements (organisasjonsnummer), setting up blog with draft mode and date sorting, or choosing between CMS options (CloudCannon, TinaCMS, Decap). Also use when moving hardcoded text from .astro/.tsx files into Content Collections."
---

# Managing Content Collections

Set up and manage Astro Content Collections so clients can update their website content without touching code. Editable text and images live in `src/content/` as Markdown files with typed frontmatter schemas.

## Core Principle

Never hardcode client-editable text in .astro or .tsx files.

```
BAD:  <h1>Velkommen til Firmanavn</h1>           ← hardcoded in template
GOOD: <h1>{page.data.title}</h1>                  ← from Content Collection
```

Client changes text → edits a markdown file → site rebuilds → live. No developer needed.

## Schema Definition

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string().max(160),
    ogImage: image().optional(),
    heroImage: image().optional(),
    heroImageAlt: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string().max(160),
    publishedDate: z.date(),
    updatedDate: z.date().optional(),
    author: z.string().default('Firmanavn'),
    featuredImage: image(),
    featuredImageAlt: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const team = defineCollection({
  type: 'data',    // JSON/YAML, no markdown body
  schema: ({ image }) => z.object({
    name: z.string(),
    role: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    photo: image(),
    photoAlt: z.string(),
    order: z.number(),
  }),
});

export const collections = { pages, blog, team };
```

The `image()` helper validates that image files exist at build time and enables Astro's automatic optimization. `type: 'content'` means markdown with a body; `type: 'data'` means JSON/YAML without a body.

## File Structure

```
src/content/
├── config.ts
├── pages/
│   ├── om-oss.md
│   ├── tjenester.md
│   └── personvern.md
├── blog/
│   ├── 2026-01-15-velkommen.md
│   ├── 2026-02-01-ny-tjeneste.md
│   └── images/
│       ├── velkommen-hero.jpg
│       └── ny-tjeneste-hero.jpg
└── team/
    ├── ola-nordmann.yaml
    └── kari-nordmann.yaml
```

The frontpage (index) usually has a unique layout and is often best kept as `src/pages/index.astro` with content from a config file rather than a collection. Pages with similar structure (about, services) benefit most from collections.

## Content Examples

### Page

```markdown
---
# src/content/pages/om-oss.md
title: "Om oss | Firmanavn AS"
description: "Vi er et team på 5 som leverer profesjonelle tjenester i Oslo-regionen."
heroImage: "./images/team-photo.jpg"
heroImageAlt: "Teamet vårt samlet på kontoret"
order: 2
draft: false
---

## Vår historie

Firmanavn ble grunnlagt i 2020 med en enkel visjon: å levere de beste
tjenestene til bedrifter i Oslo-regionen.
```

### Blog Post

```markdown
---
# src/content/blog/2026-02-01-ny-tjeneste.md
title: "Vi lanserer ny tjeneste"
description: "Les om vår nye konsulenttjeneste for bedrifter i Oslo."
publishedDate: 2026-02-01
author: "Ola Nordmann"
featuredImage: "./images/ny-tjeneste-hero.jpg"
featuredImageAlt: "Illustrasjon av vår nye tjeneste"
tags: ["nyheter", "tjenester"]
draft: false
---

Vi er glade for å annonsere at vi nå tilbyr en helt ny tjeneste
rettet mot små og mellomstore bedrifter.
```

### Team Member (YAML)

```yaml
# src/content/team/ola-nordmann.yaml
name: "Ola Nordmann"
role: "Daglig leder"
email: "ola@firmanavn.no"
phone: "+47 123 45 678"
photo: "./images/ola.jpg"
photoAlt: "Portrettbilde av Ola Nordmann"
order: 1
```

## Using Content in Astro Pages

### Single Page from Collection

```astro
---
// src/pages/om-oss.astro
import { getEntry } from 'astro:content';
import { Image } from 'astro:assets';
import BaseLayout from '../layouts/BaseLayout.astro';

const page = await getEntry('pages', 'om-oss');
if (!page) throw new Error('Page not found: om-oss');
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

### Blog Listing

```astro
---
// src/pages/blogg/index.astro
import { getCollection } from 'astro:content';
import { Image } from 'astro:assets';
import BaseLayout from '../../layouts/BaseLayout.astro';

const posts = (await getCollection('blog', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishedDate.valueOf() - a.data.publishedDate.valueOf());
---
<BaseLayout title="Blogg | Firmanavn" description="Les våre siste innlegg og nyheter.">
  <main id="main-content">
    <h1>Blogg</h1>
    <ul class="space-y-8">
      {posts.map((post) => (
        <li>
          <a href={`/blogg/${post.slug}`} class="group block">
            <Image
              src={post.data.featuredImage}
              alt={post.data.featuredImageAlt}
              width={800}
              height={400}
              class="rounded-lg"
            />
            <h2 class="text-xl font-bold mt-3 group-hover:text-blue-600">{post.data.title}</h2>
            <p class="text-gray-600 mt-1">{post.data.description}</p>
            <time class="text-sm text-gray-400">
              {post.data.publishedDate.toLocaleDateString('nb-NO')}
            </time>
          </a>
        </li>
      ))}
    </ul>
  </main>
</BaseLayout>
```

### Blog Post (Dynamic Route)

```astro
---
// src/pages/blogg/[slug].astro
import { getCollection } from 'astro:content';
import { Image } from 'astro:assets';
import BaseLayout from '../../layouts/BaseLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---
<BaseLayout title={post.data.title} description={post.data.description}>
  <main id="main-content">
    <article class="max-w-3xl mx-auto py-12 px-4">
      <Image
        src={post.data.featuredImage}
        alt={post.data.featuredImageAlt}
        width={1200}
        height={600}
        class="w-full rounded-lg"
      />
      <h1 class="text-3xl font-bold mt-6">{post.data.title}</h1>
      <time class="text-gray-500">
        {post.data.publishedDate.toLocaleDateString('nb-NO')}
      </time>
      <div class="prose mt-8">
        <Content />
      </div>
    </article>
  </main>
</BaseLayout>
```

### Team Section

```astro
---
import { getCollection } from 'astro:content';
import { Image } from 'astro:assets';

const team = (await getCollection('team'))
  .sort((a, b) => a.data.order - b.data.order);
---
<section class="py-16">
  <h2 class="text-2xl font-bold text-center mb-8">Vårt team</h2>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
    {team.map((member) => (
      <div class="text-center">
        <Image
          src={member.data.photo}
          alt={member.data.photoAlt}
          width={200}
          height={200}
          class="rounded-full mx-auto"
        />
        <h3 class="font-bold mt-3">{member.data.name}</h3>
        <p class="text-gray-600">{member.data.role}</p>
      </div>
    ))}
  </div>
</section>
```

## Image Handling

Always use Astro `<Image />` — it converts to WebP, generates srcset, sets width/height to prevent layout shift, and lazy-loads.

| Location | Use for | Optimized? |
|---|---|---|
| `src/content/*/images/` | Content images (in frontmatter) | Yes |
| `src/assets/` | Template images (logo, patterns) | Yes |
| `public/` | Fixed-URL files (og-image.png, favicon) | No |

If an image can go in `src/`, put it there.

## Personvernerklæring (Privacy Policy)

Every Norwegian site with analytics or contact forms needs this. Create as a content collection entry and customize per project based on what data the site actually collects.

```markdown
---
# src/content/pages/personvern.md
title: "Personvernerklæring | Firmanavn AS"
description: "Les om hvordan vi behandler personopplysninger."
order: 99
---

## Behandlingsansvarlig

Firmanavn AS (org.nr. 123 456 789)
Gateadresse 1, 0001 Oslo
E-post: post@firmanavn.no

## Hvilke opplysninger samler vi inn?

### Kontaktskjema
Når du fyller ut kontaktskjemaet vårt, lagrer vi:
- Navn, e-postadresse og telefonnummer
- Innholdet i meldingen din
- Tidspunkt for innsendelse

Opplysningene lagres i vårt CRM-system og brukes kun til å besvare din henvendelse.

### Analyse av nettstedet
Vi bruker Google Analytics 4 for å forstå hvordan nettstedet brukes.
Ingen data samles inn før du har gitt samtykke via informasjonskapselbanneret.

Vi bruker Google Consent Mode v2, som betyr:
- **Før samtykke:** Ingen informasjonskapsler settes, ingen persondata samles
- **Etter samtykke:** Anonymisert bruksdata sendes til Google Analytics

### Informasjonskapsler
Vi bruker kun informasjonskapsler knyttet til Google Analytics,
og bare etter at du har gitt ditt samtykke.

## Dine rettigheter

Du har rett til å:
- Be om innsyn i personopplysninger vi har om deg
- Be om retting eller sletting av dine opplysninger
- Trekke tilbake samtykke til informasjonskapsler

Kontakt oss på post@firmanavn.no for henvendelser om personvern.

## Datatilsynet
Dersom du mener vi behandler personopplysninger i strid med regelverket,
kan du klage til Datatilsynet: https://www.datatilsynet.no
```

## Footer: Norwegian Legal Requirements

Norwegian law requires businesses to display their organization number on their website. Standard footer:

```astro
<footer>
  <p>© {new Date().getFullYear()} Firmanavn AS</p>
  <p>Org.nr: 123 456 789</p>
  <p>Gateadresse 1, 0001 Oslo</p>
  <nav aria-label="Footer-lenker">
    <a href="/personvern">Personvernerklæring</a>
  </nav>
</footer>
```

## CMS Options

Content Collections work with any git-based CMS. Start without a CMS — add one when the client needs frequent updates. The structure is CMS-ready from day one.

**CloudCannon** — Best Astro support, visual editing, ~$10/month per client site. Load the `configuring-cloudcannon` skill for setup.

**TinaCMS** — Open source, sidebar editing, free tier. Setup: `tina/config.ts` mirroring `src/content/config.ts`.

**Decap CMS** — Simplest, basic UI, free. Setup: `public/admin/config.yml`.

**No CMS (Git-only)** — Nettfokus handles updates via Git. Client requests changes by email/phone.

## Content Checklist

- [ ] All client-editable text in Content Collections (not hardcoded)
- [ ] Content schema defined with proper types and validation
- [ ] Images referenced in content use Astro `<Image />`
- [ ] Personvernerklæring page exists with accurate content
- [ ] Footer has org.nr, address, and privacy policy link
- [ ] Blog/news collection set up if client needs it
- [ ] Draft mode working (draft: true hides posts from build)
- [ ] Sitemap includes all content pages and blog posts
