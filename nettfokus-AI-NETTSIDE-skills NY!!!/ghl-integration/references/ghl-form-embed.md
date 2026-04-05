# Approach A: GHL Form Embed (iframe)

Embed a GoHighLevel-hosted form directly on the website. Zero backend code. GHL handles form rendering, validation, submission, and contact creation.

**Use when:** Quick lead capture, design match is not critical, client already has GHL forms.

## How It Works

```
Visitor loads page → iframe loads GHL form → Visitor submits
    ↓
GHL receives submission directly (no Netlify Function involved)
    ↓
GHL creates/updates contact → triggers workflow (email, pipeline, tags)
```

No serverless function. No reCAPTCHA setup. No API keys. GHL handles everything.

## Setup

### 1. Create Form in GHL

1. GHL Dashboard → Sites → Forms → Builder
2. Click "Add Form"
3. Drag fields: Full Name, Email, Phone, Message (or custom fields)
4. Style the form (colors, fonts, button text)
5. Configure submission action:
   - Create/update contact
   - Add to pipeline (optional)
   - Trigger workflow (optional)
   - Redirect URL after submission (optional — set to your thank-you page)

### 2. Get Embed Code

1. In the form builder, click "Integrate" or the share/embed icon
2. Choose embed type:
   - **Inline** — form is part of the page content (recommended for contact sections)
   - **Popup** — form appears in a modal overlay
   - **Sticky Sidebar** — form sticks to screen edge while scrolling
   - **Polite Slide-In** — form slides in from the side
3. Copy the embed code (iframe or JavaScript snippet)

### 3. Embed in Astro

For **inline** embedding (most common for Nettfokus sites):

```astro
---
// src/pages/kontakt.astro
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Kontakt oss | Firmanavn" description="Ta kontakt med oss.">
  <main id="main-content" class="max-w-3xl mx-auto py-12 px-4">
    <h1 class="text-3xl font-bold mb-6">Kontakt oss</h1>
    <p class="text-gray-600 mb-8">
      Fyll ut skjemaet under, så tar vi kontakt med deg.
    </p>

    <!-- GHL Form Embed -->
    <div class="ghl-form-wrapper">
      <iframe
        src="https://link.yourdomain.com/widget/form/FORM_ID"
        style="width:100%;height:600px;border:none;border-radius:8px;"
        id="ghl-contact-form"
        title="Kontaktskjema"
        loading="lazy"
      ></iframe>
    </div>

    <!-- GHL embed script (required for dynamic height) -->
    <script
      src="https://link.yourdomain.com/js/form_embed.js"
      is:inline
    ></script>
  </main>
</BaseLayout>
```

For **popup** embedding (triggered by button click):

```astro
<!-- Button triggers the popup form -->
<button
  data-form-popup="FORM_ID"
  data-form-url="https://link.yourdomain.com/widget/form/FORM_ID"
  class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
>
  Kontakt oss
</button>

<script
  src="https://link.yourdomain.com/js/form_embed.js"
  is:inline
></script>
```

### 4. Configure GHL Workflow

After form submission, GHL can automatically:

1. Create/update contact with submitted data
2. Add tags (e.g., "website-lead", "kontaktskjema")
3. Add to pipeline stage
4. Send email notification to business owner
5. Send SMS/email confirmation to the lead
6. Trigger any GHL automation

Set this up in GHL → Automations → Workflows → New Workflow:
- Trigger: "Form Submitted" (select your form)
- Actions: Create contact, send email, add tag, etc.

## Styling Considerations

GHL forms have their own styling that may not match the website. Options:

### Option 1: Style in GHL (recommended)
Use GHL's form builder to match colors, fonts, and button styles to the website's design system. Not pixel-perfect but usually good enough.

### Option 2: CSS Override (limited)
Some GHL form elements can be targeted with CSS, but this is fragile and breaks when GHL updates their form renderer.

```css
/* Only works for some elements — test thoroughly */
.ghl-form-wrapper iframe {
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
```

### Option 3: Switch to Approach B or C
If design match is critical, use a custom React form with webhook or API integration instead.

## CSP (Content Security Policy) Consideration

If the site has a Content Security Policy header, the GHL iframe domain must be allowed:

```toml
# In netlify.toml — add GHL domain to frame-src
Content-Security-Policy = "... frame-src 'self' https://link.yourdomain.com https://*.leadconnectorhq.com https://*.msgsndr.com; ..."
```

The exact domain depends on whether the client has a custom GHL domain or uses the default `*.msgsndr.com`.

## Custom Domain for GHL Forms

GHL forms default to `https://LOCATION_ID.msgsndr.com/...` which looks unprofessional. Set up a custom domain:

1. GHL Dashboard → Settings → Custom Domains
2. Add domain (e.g., `link.firmanavn.no`)
3. Configure DNS: CNAME `link` → GHL's provided CNAME target
4. Form URLs become `https://link.firmanavn.no/widget/form/FORM_ID`

## Limitations

- **No design control:** Form looks like a GHL form, not your website
- **iframe size:** Fixed height or requires GHL's embed script for dynamic height
- **No honeypot:** GHL has its own spam protection but no custom honeypot
- **No custom reCAPTCHA:** GHL uses its own captcha/bot detection
- **SEO:** iframe content is not indexed by search engines (but form content shouldn't be anyway)
- **Accessibility:** Depends on GHL's form accessibility (not fully customizable)
- **Data flow:** You cannot intercept or transform data before it reaches GHL

## When to Upgrade to Approach B or C

Switch from iframe to custom form when:
- Client wants the form to look exactly like the rest of the site
- You need custom validation logic
- You need to send data to multiple systems (GHL + another CRM/email)
- Accessibility requirements exceed what GHL forms offer
- You need full control over spam protection

## Checklist

- [ ] Form created in GHL with correct fields
- [ ] Embed code added to Astro page
- [ ] iframe loads correctly on desktop and mobile
- [ ] Form submission creates contact in GHL
- [ ] GHL workflow triggers on submission
- [ ] Custom domain configured (optional but recommended)
- [ ] CSP header allows GHL domain (if CSP is enabled)
- [ ] Thank-you page or redirect configured
