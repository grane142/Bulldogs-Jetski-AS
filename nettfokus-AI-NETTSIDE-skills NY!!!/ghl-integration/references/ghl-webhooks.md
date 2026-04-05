# Approach B: Webhook + GHL Automations

Custom React form on the website → Netlify Function → GHL Inbound Webhook → GHL Workflow handles everything else.

**Use when:** You want a custom-designed form that matches the website, but GHL workflows should own the post-submission logic (create contact, send emails, add to pipeline, etc.).

## How It Works

```
Browser                    Netlify Function              GHL
┌──────────┐  POST        ┌──────────────┐  POST       ┌──────────────────┐
│ React    │ ──────────→  │ contact-form │ ─────────→  │ Inbound Webhook  │
│ Form     │              │              │             │ Workflow Trigger  │
│          │              │ 1. reCAPTCHA │             │                  │
│          │              │ 2. Validate  │             │ → Create contact │
│          │ ←──────────  │ 3. Forward   │             │ → Send email     │
│ Success! │   200 OK     │              │             │ → Add tag        │
└──────────┘              └──────────────┘             │ → Pipeline stage │
                                                       └──────────────────┘
```

The Netlify Function handles spam protection (reCAPTCHA + honeypot) and forwards the data to GHL. GHL workflows handle all business logic.

## GHL Inbound Webhook Setup

### 1. Create Workflow in GHL

1. GHL Dashboard → Automations → Workflows → Create Workflow → Start from scratch
2. Add trigger: **Inbound Webhook**
   - This is a Premium trigger — available on GHL's $297/mo or $497/mo plans
   - After adding the trigger, GHL generates a unique webhook URL
3. Copy the webhook URL — format: `https://services.leadconnectorhq.com/hooks/XXXXXXXX`

### 2. Configure Workflow Actions

After the Inbound Webhook trigger, add actions:

1. **Create/Update Contact** — Map webhook fields to GHL contact fields:
   - `{{trigger.name}}` → Full Name
   - `{{trigger.email}}` → Email
   - `{{trigger.phone}}` → Phone
   - `{{trigger.message}}` → Custom field (e.g., "Melding")
   - `{{trigger.interests}}` → Custom field (e.g., "Interesser")
   - `{{trigger.source}}` → Source

2. **Add Tag** — e.g., "website-lead", "kontaktskjema"

3. **Send Internal Notification** — Email to business owner with lead details

4. **Send Email/SMS to Lead** — Confirmation to the person who submitted

5. **Add to Pipeline** (optional) — Place in a sales stage

### 3. Store Webhook URL in Netlify

```
# Netlify Dashboard → Environment Variables
GHL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/XXXXXXXX
```

**Never put this in frontend code or .env committed to Git.**

## Netlify Function

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

interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
  interests?: string[];
  recaptchaToken: string;
}

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY!;
const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL!;
const SCORE_THRESHOLD = 0.5;

// Validation helpers
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(input: string, maxLength: number): string {
  return input.trim().slice(0, maxLength);
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: ContactPayload = await req.json();

    // Validate required fields
    if (!body.name || !body.email || !body.message) {
      return new Response(JSON.stringify({ error: 'Alle påkrevde felt må fylles ut.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isValidEmail(body.email)) {
      return new Response(JSON.stringify({ error: 'Ugyldig e-postadresse.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify reCAPTCHA (required when secret is configured)
    if (RECAPTCHA_SECRET && body.recaptchaToken) {
      const recaptchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${RECAPTCHA_SECRET}&response=${body.recaptchaToken}`,
      });
      const recaptchaResult = await recaptchaRes.json();

      if (!recaptchaResult.success || recaptchaResult.score < SCORE_THRESHOLD) {
        return new Response(JSON.stringify({ error: 'Verifisering feilet.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (RECAPTCHA_SECRET && !body.recaptchaToken) {
      return new Response(JSON.stringify({ error: 'reCAPTCHA-token mangler.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward to GHL Inbound Webhook
    // GHL workflow maps these fields to contact properties
    const webhookPayload = {
      name: sanitize(body.name, 100),
      email: sanitize(body.email, 254),
      phone: body.phone ? sanitize(body.phone, 20) : '',
      message: sanitize(body.message, 2000),
      interests: body.interests || [],
      source: 'website-contact-form',
      submitted_at: new Date().toISOString(),
    };

    const webhookRes = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookRes.ok) {
      console.error('GHL webhook failed:', webhookRes.status);
      Sentry?.captureMessage(`GHL webhook failed: ${webhookRes.status}`);
      // Still return success to user — we'll handle the error internally
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    Sentry?.captureException(err);
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: 'En feil oppstod. Prøv igjen senere.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

## React Form Component

Same as the generic form component in Approach C (`ghl-api.md`). The form posts to `/.netlify/functions/contact-form` — the only difference from Approach C is that the Netlify Function forwards to a webhook URL instead of calling the API directly.

See `crm-forms.md` in the website production skill for the full React component with reCAPTCHA, honeypot, success/error states, and loading state.

## GHL Workflow Field Mapping

When configuring the "Create/Update Contact" action in the GHL workflow:

| Webhook field | GHL Contact field | Map as |
|---|---|---|
| `{{trigger.name}}` | Full Name | Built-in field |
| `{{trigger.email}}` | Email | Built-in field |
| `{{trigger.phone}}` | Phone | Built-in field |
| `{{trigger.message}}` | Custom field | Use field key from GHL |
| `{{trigger.interests}}` | Custom field (checkbox/multi-select) | Use field key from GHL |
| `{{trigger.source}}` | Source | Built-in field |
| `{{trigger.submitted_at}}` | Custom field (date) or ignore | Optional |

### Finding Custom Field Keys

1. GHL Dashboard → Settings → Custom Fields
2. Click on the field → the "Field Key" is shown (e.g., `melding_kontaktskjema`)
3. In the workflow, use `{{trigger.FIELD_NAME}}` where FIELD_NAME matches the key in your webhook payload

## Advantages Over Direct API

- **Simpler code:** Netlify Function just forwards data, no API logic
- **GHL owns business logic:** Workflows handle email, tags, pipeline — changeable without code
- **No API token needed:** Webhook URL is the only credential
- **No duplicate handling needed:** GHL workflow's "Create/Update Contact" handles duplicates
- **Visual workflow editor:** Client or team can modify the automation flow in GHL UI

## Limitations

- **Inbound Webhook is a Premium feature** — requires GHL $297/mo or $497/mo plan
- **Less control over contact data:** Can't programmatically search, update, or read contacts
- **No media uploads:** Can't upload files to GHL media library
- **No email sending via API:** Email notifications must be configured in GHL workflows
- **Webhook payload format:** Limited to what GHL's Inbound Webhook trigger accepts

## Troubleshooting

### Webhook returns error
- Verify the webhook URL is correct and hasn't expired
- Check that the GHL workflow is published (not draft)
- Test the webhook manually with curl:
  ```bash
  curl -X POST "YOUR_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@test.no","message":"Test"}'
  ```

### Contact not created in GHL
- Check the workflow execution log in GHL → Automations → Workflows → your workflow → History
- Verify field mapping matches the webhook payload keys
- Check if "Create/Update Contact" action is configured correctly

### Duplicate contacts
- Use "Create or Update Contact" action (not just "Create Contact") in the workflow
- Set the dedup key to email or phone

## Checklist

- [ ] GHL Workflow created with Inbound Webhook trigger
- [ ] Webhook URL stored in Netlify env vars as GHL_WEBHOOK_URL
- [ ] Netlify Function forwards form data to webhook
- [ ] reCAPTCHA v3 verification in Netlify Function
- [ ] Honeypot field in React form
- [ ] Input validation (email format, max lengths)
- [ ] Workflow field mapping matches webhook payload
- [ ] "Create or Update Contact" action configured (handles duplicates)
- [ ] Email notification action in workflow (to business owner)
- [ ] Test submission verified in GHL contacts
- [ ] Workflow published (not in draft mode)
- [ ] Sentry configured on Netlify Function
