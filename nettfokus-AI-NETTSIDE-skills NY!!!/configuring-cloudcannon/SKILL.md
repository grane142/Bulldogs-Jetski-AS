---
name: configuring-cloudcannon
description: "Configures CloudCannon CMS for Astro websites, enabling content editing and visual editing for Nettfokus clients. Use when setting up cloudcannon.config.yml, creating blog post schemas, mapping collections to Astro Content Collections, configuring image upload paths, setting up visual editing with Editable Regions (data-editable/data-prop attributes), implementing the @cloudcannon/editable-regions Astro integration, inviting client editors, configuring publishing workflows (direct or staging), or troubleshooting CloudCannon sync issues. Prerequisite: Content Collections must be set up first — see managing-content-collections skill."
---

# Configuring CloudCannon

Set up CloudCannon CMS so Nettfokus clients can edit content, write blog posts, and upload images through a visual web interface. CloudCannon commits to Git → Netlify rebuilds → live in ~30 seconds.

Prerequisite: Content Collections must be set up first. Load `managing-content-collections` skill if not done.

## How It Works (CloudCannon + Netlify)

Nettfokus uses Netlify for production hosting and CloudCannon for content editing. Both connect to the same Git repo:

```
Content editor writes/edits in CloudCannon
  ↓
CloudCannon commits .md file to Git repo
  ↓
Netlify detects push, runs `npm run build`
  ↓
Astro builds static HTML from Content Collections
  ↓
Live on production site in ~30 seconds
```

CloudCannon also builds the site internally for its own Visual Editor preview. This is separate from Netlify — CloudCannon handles the editing experience, Netlify handles production hosting. No API calls at runtime. No database. Just markdown files → HTML.

## When to Add CloudCannon

Start without it. Build the site with Content Collections and handle updates via Git. Add CloudCannon when the client needs to make frequent text/image changes or publish blog posts themselves.

Cost: ~$10/month per client site on Lite plan (agency pricing through Partner Program).

## Setup Steps

1. Create CloudCannon organization for Nettfokus at cloudcannon.com
2. Apply for Agency Partner Program for reduced client pricing
3. Create new Site → authenticate with GitHub → select the Astro repository
4. CloudCannon auto-detects Astro — set build command: `npm run build`, output path: `dist`
5. Add `cloudcannon.config.yml` to project root
6. Create blog post schema in `.cloudcannon/schemas/post.md`
7. Invite client as Editor role
8. Optionally: set up Visual Editing with Editable Regions (see `references/visual-editing.md`)

## cloudcannon.config.yml

Standard Nettfokus template. Place in project root next to `astro.config.mjs`.

```yaml
# cloudcannon.config.yml

source: ''
paths:
  uploads: public/uploads
  dam_uploads: public/uploads
  static: public

collections_config:
  pages:
    path: src/content/pages
    url: '/[slug]/'
    output: true
    icon: wysiwyg
    disable_add_folder: true
    _enabled_editors:
      - content
      - data
    singular_name: Side
    description: Rediger innholdet på nettsidene

  posts:
    path: src/content/blog
    url: '/blogg/[slug]/'
    output: true
    icon: post_add
    disable_add_folder: true
    _enabled_editors:
      - content
    singular_name: Innlegg
    description: Blogg og nyheter
    add_options:
      - name: Nytt innlegg
        schema: default
        icon: post_add
    schemas:
      default:
        name: Blogginnlegg
        path: .cloudcannon/schemas/post.md
    sort:
      key: publishedDate
      order: descending
    sort_options:
      - key: publishedDate
        order: descending
        label: Nyeste først
      - key: title
        order: ascending
        label: Tittel (A-Å)

  team:
    path: src/content/team
    icon: groups
    disable_add_folder: true
    disable_url: true
    singular_name: Teammedlem
    description: Teammedlemmer
    _enabled_editors:
      - data
    sort:
      key: order
      order: ascending

  data:
    path: data
    disable_add: true
    disable_add_folder: true
    disable_url: true
    icon: settings
    description: Generelle innstillinger (firmanavn, kontaktinfo, etc.)
    _enabled_editors:
      - data

collection_groups:
  - heading: Innhold
    collections:
      - pages
  - heading: Blogg
    collections:
      - posts
  - heading: Team
    collections:
      - team
  - heading: Innstillinger
    collections:
      - data

_inputs:
  title:
    type: text
    label: Tittel
  description:
    type: textarea
    label: Beskrivelse (maks 160 tegn)
    comment: Brukes i søkeresultater og sosiale medier
  publishedDate:
    type: date
    label: Publiseringsdato
    instance_value: now
  updatedDate:
    type: date
    label: Oppdatert dato
  author:
    type: text
    label: Forfatter
  tags:
    type: multiselect
    label: Emneknagger
    allow_create: true
  draft:
    type: switch
    label: Utkast
    comment: Utkast publiseres ikke på nettsiden
  heroImage:
    type: image
    label: Hovedbilde
    comment: Anbefalt størrelse 1200x600px
  heroImageAlt:
    type: text
    label: Bildetekst (alt-tekst)
    comment: Beskriv bildet for søkemotorer og skjermlesere
  featuredImage:
    type: image
    label: Utvalgt bilde
    comment: Vises i blogglisten. Anbefalt 800x400px
  featuredImageAlt:
    type: text
    label: Bildetekst (alt-tekst)
  ogImage:
    type: image
    label: OG-bilde (deling i sosiale medier)
    comment: 1200x630px. Vises når siden deles på LinkedIn, Facebook etc.
  body:
    type: markdown
    label: Innhold
  order:
    type: number
    label: Rekkefølge
  name:
    type: text
    label: Navn
  role:
    type: text
    label: Stilling
  email:
    type: email
    label: E-post
  phone:
    type: text
    label: Telefon
  photo:
    type: image
    label: Bilde
  photoAlt:
    type: text
    label: Bildetekst (alt-tekst)

_editables:
  content:
    blockquote: true
    bold: true
    italic: true
    strike: true
    link: true
    bulletedlist: true
    numberedlist: true
    image: true
    table: true
    heading2: true
    heading3: true
    heading4: true
    code: true
    horizontalrule: true
    undo: true
    redo: true
```

## Blog Post Schema

Create `.cloudcannon/schemas/post.md` — the template for new blog posts:

```markdown
---
title:
description:
publishedDate:
author: Firmanavn
featuredImage:
featuredImageAlt:
tags: []
draft: true
---

Skriv innholdet ditt her...
```

When an editor clicks "Nytt innlegg", this template pre-fills the frontmatter fields.

## Site Data File (Global Settings)

For company name, phone, address that appear across the whole site:

```json
// data/site.json
{
  "name": "Firmanavn AS",
  "org_number": "123 456 789",
  "phone": "+47 123 45 678",
  "email": "post@firmanavn.no",
  "address": {
    "street": "Gateadresse 1",
    "postal_code": "0001",
    "city": "Oslo"
  },
  "social": {
    "facebook": "https://facebook.com/firmanavn",
    "linkedin": "https://linkedin.com/company/firmanavn",
    "google_business": "https://www.google.com/maps/place/?q=place_id:ChIJ..."
  }
}
```

Read in Astro:
```astro
---
import site from '../../data/site.json';
---
<footer>
  <p>© {new Date().getFullYear()} {site.name}</p>
  <p>Org.nr: {site.org_number}</p>
  <p>{site.address.street}, {site.address.postal_code} {site.address.city}</p>
</footer>
```

CloudCannon lets editors update this through a form (Data Editor).

## Image Upload Handling

```yaml
paths:
  uploads: public/uploads
```

Images uploaded via CloudCannon go to `public/uploads/` — these are not processed by Astro's `<Image />` component. For blog post featured images this is acceptable.

If you need Astro image optimization on CMS-uploaded images, use `src/content/blog/images/` instead:
```yaml
paths:
  uploads: src/content/blog/images
```

Recommendation: Use `public/uploads` for simplicity. Add explicit width/height in templates to prevent CLS.

## Client Access

Invite client in CloudCannon → Site Settings → Sharing. Set role to **Editor** (not Developer).

What the editor sees: page list, blog collection with "Nytt innlegg" button, WYSIWYG editor, sidebar fields. What they don't see: code files, config files, Netlify settings, Git history.

## Publishing Workflow

**Simple (default):** Editor saves → CloudCannon commits to main → Netlify deploys. Live immediately.

**With review (optional):** Set up a staging branch. Editor saves to staging → preview builds → Nettfokus reviews → merge to main → production deploys.

## Visual Editing with Editable Regions (Advanced)

CloudCannon's Editable Regions let clients edit text, images, and components directly on a live preview of their site. Yellow boxes appear around editable content — click to edit inline.

This is more advanced than the Content Editor. Start with Content Editor and Data Editor — they cover most Nettfokus clients' needs. Add Visual Editing only when the client specifically wants inline page editing.

See [references/visual-editing.md](references/visual-editing.md) for full setup with `@cloudcannon/editable-regions`.

## CloudCannon Checklist

- [ ] CloudCannon account created, site connected to repo
- [ ] `cloudcannon.config.yml` in project root
- [ ] Collections match `src/content/config.ts` structure
- [ ] Blog schema file created (`.cloudcannon/schemas/post.md`)
- [ ] Image upload path configured
- [ ] Site data file created (`data/site.json`) if needed
- [ ] Client invited as Editor role
- [ ] Client can create a new blog post and save
- [ ] Blog post appears on live site after save (~30 sec)
- [ ] Client can edit existing page content
- [ ] Client can upload images through editor
- [ ] Draft mode works (draft: true = not published)
- [ ] If Visual Editing: Editable Regions configured and working

## Related Skills

| Task | Skill |
|------|-------|
| Content Collections setup (prerequisite) | `managing-content-collections` |
| Astro pages, layouts, Image component | `developing-astro-sites` |
| SEO meta tags, OG images, structured data | `configuring-seo-analytics` |
