# Visual Editing with Editable Regions

CloudCannon's Editable Regions enable inline editing on a live preview of the website. Editors see yellow boxes around editable content — click to edit text, images, and arrays directly on the page.

**Source:** https://cloudcannon.com/documentation/developer-guides/set-up-visual-editing/

## When to Add

Start with Content Editor (markdown) and Data Editor (sidebar forms). These cover most Nettfokus client needs. Add Editable Regions only when the client specifically wants inline visual editing.

## How It Works

CloudCannon builds the site internally for its Visual Editor preview. You add `data-editable` and `data-prop` HTML attributes to your Astro templates. These attributes tell CloudCannon which elements are editable and which data keys they map to.

5 types of Editable Regions:
- **Text** — edit front matter text values inline (`data-editable="text"`)
- **Image** — upload/swap images inline (`data-editable="image"`)
- **Source** — edit HTML content stored in template files (`data-editable="source"`)
- **Array** — reorder, add, remove array items (`data-editable="array"`)
- **Component** — edit Astro/React component props (`<editable-component>`)

## Setup

### 1. Install the Editable Regions package

```bash
npm install @cloudcannon/editable-regions
```

### 2. Add the Astro integration

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import editableRegions from '@cloudcannon/editable-regions/astro-integration';

export default defineConfig({
  integrations: [react(), tailwind(), editableRegions()],
  output: 'static',
  site: 'https://domene.no',
  trailingSlash: 'never',
});
```

### 3. Add Editable Regions to templates

Work from parent elements towards child elements to avoid misconfiguration.

## Text Editable Regions

Edit front matter text values inline on the page.

```astro
---
// src/layouts/BlogLayout.astro
const { title, author } = Astro.props;
---
<article>
  <h1 data-editable="text" data-prop="title">{title}</h1>
  <p data-editable="text" data-prop="author">{author}</p>
</article>
```

`data-editable="text"` tells CloudCannon this is editable text. `data-prop="title"` maps it to the `title` key in the file's front matter.

For rich text (bold, italic, links), use `data-editable="text"` with `options.allow_create` configured in `_inputs`.

## Source Editable Regions

Edit text that is hard-coded in template files (not from front matter). Use when the text lives directly in the `.astro` file.

```astro
---
// src/pages/index.astro
---
<section>
  <h1
    data-editable="source"
    data-path="/src/pages/index.astro"
    data-key="hero-heading"
  >
    Velkommen til Firmanavn
  </h1>
  <p
    data-editable="source"
    data-path="/src/pages/index.astro"
    data-key="hero-description"
  >
    Vi leverer profesjonelle tjenester i Oslo-regionen.
  </p>
</section>
```

`data-path` points to the file containing the text. `data-key` is a unique identifier for each editable region in that file. CloudCannon edits the actual source file.

**Recommendation:** For most Nettfokus sites, prefer Content Collections (Text regions with `data-prop`) over Source regions. Content Collections separate content from templates, which is cleaner.

## Image Editable Regions

Upload or swap images inline in the Visual Editor.

```astro
---
const { heroImage, heroImageAlt, heroImageTitle } = Astro.props;
---
<div class="hero-image">
  {heroImage && (
    <img
      data-editable="image"
      data-prop-src="heroImage"
      data-prop-alt="heroImageAlt"
      data-prop-title="heroImageTitle"
      src={heroImage}
      alt={heroImageAlt}
      title={heroImageTitle}
      width={1200}
      height={600}
    />
  )}
</div>
```

For images, use `data-prop-src`, `data-prop-alt`, and `data-prop-title` to map to the corresponding front matter keys. The `data-editable="image"` attribute tells CloudCannon to show the image editing panel when clicked.

## Array Editable Regions

Let editors reorder, add, or remove items in an array.

```astro
---
const { features } = Astro.props;
---
<ul data-editable="array" data-prop="features">
  {features.map((feature) => (
    <li>
      <h3 data-editable="text" data-prop="title">{feature.title}</h3>
      <p data-editable="text" data-prop="description">{feature.description}</p>
    </li>
  ))}
</ul>
```

Define the Array region on the parent element first, then Text/Image regions on child elements.

## Component Editable Regions

Edit Astro or React component props in the Visual Editor. Currently available for Astro and React components.

### Register components

Create a registration script and include it in your layout:

```javascript
// src/scripts/register-components.js
import { registerAstroComponent } from '@cloudcannon/editable-regions/astro';
import CTA from '../components/CTA.astro';

registerAstroComponent('cta', CTA);
```

If you use React components nested in Astro:
```javascript
import '@cloudcannon/editable-regions/astro-react-renderer';
```

### Load the script conditionally in layout

Only load in CloudCannon's Visual Editor, not on the live site:

```astro
---
// src/layouts/BaseLayout.astro
---
<html lang="nb">
<body>
  <script>
    if (window.inEditorMode) {
      import("../scripts/register-components.js").catch((error) => {
        console.warn("Failed to load CloudCannon component registration:", error);
      });
    }
  </script>
  <slot />
</body>
</html>
```

### Wrap the component with editable-component

```astro
---
// In a page or layout that uses the CTA component
import CTA from '../components/CTA.astro';
const { cta } = Astro.props;  // cta object from front matter
---
<editable-component data-prop="cta" data-component="cta">
  <CTA {...cta} />
</editable-component>
```

`data-prop="cta"` maps to the front matter key. `data-component="cta"` references the registered component name.

## Best Practices

1. **Start simple** — add Text and Image regions first, then Array and Component
2. **Work root to child** — define parent Editable Regions before children to avoid misconfiguration
3. **Content Collections first** — use Text regions (`data-prop`) for front matter values, not Source regions for hardcoded text
4. **Check yellow boxes** — orange/red boxes in the Visual Editor indicate misconfiguration
5. **Test in CloudCannon** — Editable Regions only work in CloudCannon's Visual Editor, not on the live site

## Troubleshooting

**Orange warning box in Visual Editor:**
- Missing `data-prop` or `data-prop-*` attribute
- Invalid data type (e.g., Text region on a number value)
- Image region missing `<img>` child element

**Editable Regions not appearing:**
- Check that `editableRegions()` integration is in `astro.config.mjs`
- Verify the site builds successfully in CloudCannon
- Ensure the file outputs to an HTML page (CloudCannon needs `.html` output)

**Changes not reflected on production:**
- CloudCannon commits to Git → Netlify picks up the change
- Verify the commit appeared in GitHub/GitLab
- Check Netlify build logs for errors
