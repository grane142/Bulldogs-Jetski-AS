---
name: ghl-integration
description: "GoHighLevel (GHL) CRM integration for Nettfokus websites. Use when connecting contact forms, lead capture, email notifications, media uploads, or any CRM functionality to GoHighLevel. Covers three integration approaches: GHL Form Embed (iframe — zero code), Inbound Webhook + Workflow Automations (low-code), and Direct GHL V2 API (full control). Also covers media library uploads, conversation/email sending, and contact management. Triggers on any task involving GoHighLevel, GHL, CRM webhooks, lead capture forms, contact upsert, or CRM email notifications."
---

# GoHighLevel (GHL) Integration

Connect Nettfokus websites to GoHighLevel CRM. Three approaches — choose based on the project's needs.

## Decision Tree

```
How much control do you need over the form and data flow?

├── MINIMAL (just capture leads, GHL handles everything)
│   → Approach A: GHL Form Embed (iframe)
│     Fastest setup. GHL-hosted form. No serverless function needed.
│     → references/ghl-form-embed.md
│
├── MODERATE (custom form, trigger GHL workflows)
│   → Approach B: Webhook + GHL Automations
│     Custom React form → Netlify Function → GHL Inbound Webhook → Workflow
│     → references/ghl-webhooks.md
│
└── FULL CONTROL (custom form, API operations, email, media)
    → Approach C: Direct GHL V2 API
      Custom React form → Netlify Function → GHL API (contacts, conversations, media)
      → references/ghl-api.md
```

## Quick Comparison

| Feature | A: Form Embed | B: Webhook | C: Direct API |
|---|---|---|---|
| Setup time | 10 min | 30 min | 1-2 hours |
| Custom form design | No (GHL styling) | Yes (React/Tailwind) | Yes (React/Tailwind) |
| reCAPTCHA | GHL built-in | You add it | You add it |
| Honeypot spam filter | No | Yes | Yes |
| Custom fields | GHL form builder | Webhook payload mapping | API field keys |
| Email notifications | GHL workflow | GHL workflow | API or GHL workflow |
| Contact upsert | Automatic | Via workflow | API endpoint |
| Media uploads | No | No | Yes (API) |
| Conversations/email | No | Via workflow | API endpoint |
| Serverless function | Not needed | Required | Required |
| Design matches site | No (iframe) | Yes | Yes |
| Works without JS | Yes (iframe) | No | No |

## When to Use What

**Approach A — GHL Form Embed** when:
- Quick lead capture is the only goal
- Design match with the website is not critical
- You want zero backend code
- The client already has GHL forms built

**Approach B — Webhook + Automations** when:
- You need a custom-designed form matching the website
- GHL workflows should handle the post-submission logic (emails, pipeline, tags)
- You want GHL to own the automation logic, not code
- Simple contact creation + workflow trigger is enough

**Approach C — Direct API** when:
- You need full control over contact data (upsert, update, custom fields)
- You want to send email notifications via API (not just workflows)
- You need to upload files to GHL media library
- You need to read/search contacts programmatically
- The project has complex data flows (e.g., conditional field mapping)

## Combining Approaches

Approaches are not mutually exclusive. Common combinations:

- **A + C:** Embed GHL form for simple pages, use API for admin/dashboard features
- **B + C:** Webhook for contact form, API for media uploads or email sending
- **A + B:** Embed form on landing page, custom form on main site with webhook

## Authentication (All API/Webhook Approaches)

GHL V2 API uses **Private Integration Tokens** for Nettfokus projects (single-location, internal use).

### Setup

1. GHL Dashboard → Settings → Integrations → Private Integrations
2. Click "Create new Integration"
3. Name it (e.g., "Nettfokus Website Integration")
4. Select required scopes (see below)
5. **Copy the token immediately** — you cannot view it again
6. Store as `GHL_API_KEY` in Netlify environment variables

### Required Scopes by Approach

| Scope | B: Webhook | C: API |
|---|---|---|
| contacts.write | — | ✅ |
| contacts.readonly | — | ✅ |
| conversations/message.write | — | ✅ (if sending email) |
| conversations/message.readonly | — | ✅ (if sending email) |
| medias.write | — | ✅ (if uploading files) |
| medias.readonly | — | ✅ (if uploading files) |

Webhooks (Approach B) don't need API scopes — they use GHL's Inbound Webhook trigger which works with a webhook URL, not an API token.

### Rate Limits

- **Burst:** 100 requests per 10 seconds per location
- **Daily:** 200,000 requests per day per location
- For typical Nettfokus websites (< 50 form submissions/day), rate limits are never a concern

### Security Rules

1. **GHL_API_KEY** → Netlify environment variables ONLY, never in frontend code
2. **GHL_LOCATION_ID** → Netlify environment variables ONLY
3. All GHL API calls go through **Netlify Functions** (server-side)
4. Never expose the Private Integration Token in client-side JavaScript
5. Rotate tokens every 90 days (GHL recommendation)
6. Select only the scopes you actually need

## Environment Variables

| Variable | Where | Used by | Approach |
|---|---|---|---|
| VITE_RECAPTCHA_SITE_KEY | .env + Netlify | Frontend (React form) | B, C |
| RECAPTCHA_SECRET_KEY | Netlify only | Netlify Function | B, C |
| GHL_API_KEY | Netlify only | Netlify Function | C |
| GHL_LOCATION_ID | Netlify only | Netlify Function | C |
| GHL_WEBHOOK_URL | Netlify only | Netlify Function | B |
| NOTIFICATION_EMAIL_TO | Netlify only | Netlify Function | C (if email) |
| NOTIFICATION_EMAIL_FROM | Netlify only | Netlify Function | C (if email) |
| SENTRY_DSN | Netlify only | Netlify Function | B, C |

## References

Load based on chosen approach:

- **[references/ghl-form-embed.md](references/ghl-form-embed.md)** — Approach A: GHL Form Embed (iframe)
- **[references/ghl-webhooks.md](references/ghl-webhooks.md)** — Approach B: Webhook + GHL Automations
- **[references/ghl-api.md](references/ghl-api.md)** — Approach C: Direct GHL V2 API (contacts, conversations, media)

## Integration Checklist

### All Approaches
- [ ] GHL sub-account (location) set up for the client
- [ ] Custom fields created in GHL matching form fields
- [ ] Test submission sent and verified in GHL contacts
- [ ] Client notified of new lead (email, GHL notification, or workflow)

### Approach A (Form Embed)
- [ ] Form created in GHL form builder
- [ ] Embed code (iframe or JS) added to website
- [ ] Form submissions appear in GHL contacts
- [ ] GHL workflow triggers on form submission
- [ ] iframe styled/sized to fit page layout

### Approach B (Webhook)
- [ ] Inbound Webhook workflow created in GHL
- [ ] Webhook URL stored in Netlify env vars
- [ ] Netlify Function routes form data to webhook
- [ ] reCAPTCHA v3 verification in serverless function
- [ ] Honeypot field in React form
- [ ] GHL workflow actions configured (create contact, send email, add to pipeline)

### Approach C (Direct API)
- [ ] Private Integration Token created with correct scopes
- [ ] Token stored as GHL_API_KEY in Netlify env vars
- [ ] Location ID stored as GHL_LOCATION_ID in Netlify env vars
- [ ] Custom fields created via setup script (`npm run setup:ghl`) — IDs saved to JSON
- [ ] Contact upsert working (new + existing contacts)
- [ ] Custom field `field_value` types correct (number for NUMERICAL, string for TEXT/SELECT)
- [ ] Phone numbers include country code (+47...)
- [ ] Duplicate contact handling tested (upsert or update fallback)
- [ ] File upload to GHL Media Library working (`hosted: false`)
- [ ] Email via Conversations API with BCC for internal notification
- [ ] HTML escaping on all user input in email templates
- [ ] File validation on backend (type + size — frontend can be bypassed)
- [ ] Content-Security-Policy header configured
- [ ] reCAPTCHA mandatory when secret is configured, score >= 0.7
- [ ] Error handling doesn't expose API details to frontend

## Relationship to Nettfokus Website Production Skill

This skill handles CRM integration specifically. For the full website production workflow (Astro, SEO, security, deploy), use the `building-nettfokus-websites` skill.

```
building-nettfokus-websites/
├── SKILL.md                    ← Full website workflow
├── references/
│   └── spa-tracks.md          ← SPA exception tracks

ghl-integration/
├── SKILL.md                    ← This file (GHL-specific)
├── references/
│   ├── ghl-form-embed.md      ← Approach A
│   ├── ghl-webhooks.md        ← Approach B
│   └── ghl-api.md             ← Approach C
```
