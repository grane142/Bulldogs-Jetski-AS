# Converting SPA Prototype to Astro

Step-by-step guide for converting a React SPA prototype (from AI Studio, v0.app, aura.build, or imported HTML template) into an Astro SSG site. Typical time for a 5-page Nettfokus site: 1-2 hours.

## Before You Start

Have these ready:
- The working SPA prototype (in a Git repo or local folder)
- Customer-approved design and content
- Domain name (for astro.config.mjs `site` and canonical URLs)

## Step 1: Create Fresh Astro Project

```bash
npm create astro@latest project-name
cd project-name
npx astro add react
npx astro add tailwind
```

Copy over any custom fonts, images, and CSS from the prototype.

## Step 2: Identify Static vs Interactive

Walk through every component in the prototype and categorize:

**Static (→ .astro files):** Content that doesn't respond to user interaction. Hero sections, about text, service cards, testimonials, footer, navigation links. This is usually 80-90% of a business website.

**Interactive (→ .tsx with client:load):** Components that need JavaScript in the browser. Contact forms, mobile menu toggle, cookie consent banner, accordions, carousels, tabs.

The key question: "Does this component use useState, useEffect, or event handlers?" If no → static. If yes → check if the interactivity is essential or just animation (CSS/Astro View Transitions can often replace simple animations).

## Step 3: Set Up BaseLayout

Create `src/layouts/BaseLayout.astro` with head metadata, skip-link, View Transitions, and font loading. See the main SKILL.md for the full template.

This replaces whatever layout/wrapper component the SPA prototype used (often App.tsx or Layout.tsx).

## Step 4: Convert Static Sections to .astro

For each static section/component in the prototype:

### JSX → Astro Syntax Changes

```jsx
// REACT (before)
<div className="flex items-center gap-4">
  <img src="/hero.jpg" alt="Hero" className="w-full" />
  {isVisible && <span>Hello</span>}
</div>
```

```astro
<!-- ASTRO (after) -->
<div class="flex items-center gap-4">
  <Image src={heroImage} alt="Hero" class="w-full" width={1200} height={600} />
  <span>Hello</span>
</div>
```

Key differences:
- `className` → `class`
- `<img>` → `<Image />` (import from `astro:assets`)
- Remove conditional rendering that was based on React state (decide at build time or use client directive)
- Remove `onClick`, `onChange` etc. from static elements
- Remove React imports (`import React from 'react'`)
- Remove hooks (`useState`, `useEffect`, `useRef`) from static content
- Astro components don't export — they're the file itself

### Frontmatter (Server-Side Code)

Astro components have a frontmatter section between `---` fences for server-side code:

```astro
---
// This runs at build time, not in the browser
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';

const currentYear = new Date().getFullYear();
const services = ['Tjeneste 1', 'Tjeneste 2', 'Tjeneste 3'];
---

<footer>
  <p>© {currentYear} Firmanavn AS</p>
  <ul>
    {services.map(s => <li>{s}</li>)}
  </ul>
</footer>
```

## Step 5: Move Interactive Components

Keep React components (.tsx) for truly interactive parts. Import them in .astro files with a client directive:

```astro
---
import ContactForm from '../components/ContactForm.tsx';
import MobileMenu from '../components/MobileMenu.tsx';
---

<header>
  <nav class="hidden md:flex"><!-- static nav links --></nav>
  <MobileMenu client:load />
</header>

<main id="main-content">
  <ContactForm client:load />
</main>
```

The React components themselves stay almost identical. The only changes are usually:
- Remove routing-related code (Link, useNavigate, useLocation)
- Ensure imports reference the new file locations
- Environment variables use `import.meta.env.VITE_*` (same in Astro)

## Step 6: Set Up Content Collections

Move editable text from hardcoded JSX/TSX to Content Collections in `src/content/`. This is the step that makes the site maintainable — the client can update text without touching code.

For the full Content Collections setup, load the `managing-content-collections` skill.

Quick version:
1. Create `src/content/config.ts` with schemas
2. Create markdown files in `src/content/pages/` for each page
3. Use `getEntry()` in .astro pages to fetch content
4. Render with `<Content />` component

## Step 7: Move Images

| From prototype | To Astro | Reason |
|---|---|---|
| `public/images/hero.jpg` | `src/assets/hero.jpg` | Gets optimized (WebP, srcset) |
| Inline `<img src="...">` | `<Image src={import} />` | Width/height prevents CLS |
| Content images | `src/content/*/images/` | Referenced in frontmatter, optimized |
| og-image.png, favicon | Stay in `public/` | Need fixed URL paths |

## Step 8: Replace Routing

Delete React Router entirely. No `react-router-dom`, no `<Routes>`, no `<Route>`, no `<Link>` components.

Astro uses file-based routing: every file in `src/pages/` becomes a URL.

```
src/pages/index.astro      → /
src/pages/om-oss.astro     → /om-oss
src/pages/tjenester.astro  → /tjenester
src/pages/kontakt.astro    → /kontakt
src/pages/blogg/index.astro     → /blogg
src/pages/blogg/[slug].astro    → /blogg/my-post
```

Replace `<Link to="/om-oss">` with `<a href="/om-oss">`. Astro's View Transitions handle smooth navigation automatically.

## Step 9: Handle Navigation

The prototype likely has a `<Header>` or `<Navbar>` component with React Router's `<Link>`. Convert to Astro:

```astro
---
// src/components/Header.astro
const pathname = Astro.url.pathname;

const links = [
  { href: '/', label: 'Hjem' },
  { href: '/om-oss', label: 'Om oss' },
  { href: '/tjenester', label: 'Tjenester' },
  { href: '/kontakt', label: 'Kontakt' },
];
---
<header>
  <nav aria-label="Hovedmeny">
    {links.map(link => (
      <a
        href={link.href}
        class:list={['nav-link', { 'active': pathname === link.href }]}
      >
        {link.label}
      </a>
    ))}
  </nav>
</header>
```

`Astro.url.pathname` replaces `useLocation()` for active link detection. `class:list` is Astro's conditional class syntax.

## Step 10: Verify

After conversion, verify:

1. **`npm run build`** completes without errors
2. **View Page Source** on dev server — full HTML content visible (not empty div)
3. **Every page** loads directly by URL (no 404, no blank screen)
4. **Interactive components** work (form submits, mobile menu toggles, consent banner shows)
5. **Tailwind** styles look identical to prototype
6. **Images** load and display correctly

## Common Conversion Issues

### Component uses window/document
Some React components access `window` or `document` directly. These don't exist at build time in Astro.

Fix: Use `client:only="react"` instead of `client:load`. This skips SSR entirely and only runs in the browser.

```astro
<MapComponent client:only="react" />
```

### Third-party libraries that assume browser
Libraries like animation libraries or map SDKs may fail during Astro's build. Same fix: `client:only="react"`.

### Shared state between islands
Astro islands are independent React roots. They don't share context or state by default.

Options:
- Use [nanostores](https://github.com/nanostores/nanostores) for shared state between islands
- Combine related interactive elements into a single island
- Use custom events (`window.dispatchEvent`) for simple communication

### CSS-in-JS doesn't work in .astro
If the prototype uses styled-components or emotion in static sections, replace with Tailwind classes or regular CSS in .astro files. CSS-in-JS only works in React islands (client-directed components).

## File Mapping Reference

Typical prototype structure → Astro structure:

```
PROTOTYPE                          ASTRO
src/App.tsx                    →   (deleted — routing is file-based)
src/main.tsx                   →   (deleted — Astro handles entry)
src/pages/Home.tsx             →   src/pages/index.astro
src/pages/About.tsx            →   src/pages/om-oss.astro
src/components/Header.tsx      →   src/components/Header.astro (if static)
                                   OR keep as .tsx with client:load (if mobile menu)
src/components/Footer.tsx      →   src/components/Footer.astro
src/components/ContactForm.tsx →   src/components/ContactForm.tsx (keep, add client:load)
src/components/HeroSection.tsx →   inline in page .astro file or separate .astro component
src/styles/globals.css         →   src/styles/global.css (import in BaseLayout)
public/*                       →   public/* (same)
```
