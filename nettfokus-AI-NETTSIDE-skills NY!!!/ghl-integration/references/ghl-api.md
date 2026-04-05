# Approach C: Direct GHL V2 API

Full control over contact management, email notifications, and media uploads via the GHL V2 REST API. Custom React form → Netlify Function → GHL API endpoints.

**Use when:** You need full control — contact upsert with custom fields, sending email via conversations API, uploading files to media library, or reading/searching contacts.

## Architecture

```
Browser                    Netlify Function              GHL V2 API
┌──────────┐  POST        ┌──────────────┐              ┌──────────────────┐
│ React    │ ──────────→  │ contact-form │              │                  │
│ Form     │              │              │── upload ──→ │ Media API        │
│          │              │              │← fileUrl ──  │                  │
│          │              │              │              │                  │
│          │              │              │── upsert ──→ │ Contacts API     │
│          │              │              │← contactId   │                  │
│          │              │              │              │                  │
│          │ ←──────────  │              │── email ───→ │ Conversations API│
│ Success! │   200 OK     │              │              │                  │
└──────────┘              └──────────────┘              └──────────────────┘
```

All API calls happen server-side in Netlify Functions. The frontend only talks to the Netlify Function endpoint.

## API Base URL & Headers

```
https://services.leadconnectorhq.com
```

All endpoints use this base. Standard headers for JSON endpoints:

```typescript
const headers = {
  Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  'Content-Type': 'application/json',
  Version: '2021-07-28',
};
```

**For multipart/form-data endpoints (file upload): omit `Content-Type` — let `FormData` set it with the boundary.**

---

## Custom Fields API

Create custom fields programmatically to match your form. This avoids manual setup in GHL dashboard and ensures exact field matching.

### Important: Use the Locations Endpoint

There are TWO custom field endpoints in GHL. **Use the locations one for contact fields:**

```
POST /locations/{locationId}/customFields     ← USE THIS for contacts
POST /custom-fields/                          ← Only for Custom Objects (NOT contacts)
```

The `/custom-fields/` v2 endpoint returns `"Api does not support objectKey of type contact or opportunity"` if you try to use it for contact fields.

### Create a Custom Field

```typescript
const res = await fetch(
  `https://services.leadconnectorhq.com/locations/${LOCATION_ID}/customFields`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Bredde (cm)',
      dataType: 'NUMERICAL',
      model: 'contact',
    }),
  }
);

const data = await res.json();
// data.customField.id → "UjoNHShquAtvO1U4woqy"
// data.customField.fieldKey → "contact.bredde_cm"
```

### Available dataTypes

| dataType | Use for | field_value format |
|---|---|---|
| `TEXT` | Short text (name, color, URL) | `"string"` |
| `LARGE_TEXT` | Long text (description, notes) | `"string"` |
| `NUMERICAL` | Numbers (measurements, prices) | `123` (number, NOT string) |
| `SINGLE_OPTIONS` | Dropdown (one choice) | `"Option Label"` (exact match) |
| `MULTIPLE_OPTIONS` | Multi-select (multiple choices) | `["Option 1", "Option 2"]` |
| `CHECKBOX` | Checkboxes | `["Option 1", "Option 2"]` |
| `PHONE` | Phone number | `"+4712345678"` |
| `DATE` | Date | `"2026-03-26"` |
| `FILE_UPLOAD` | File attachment | Complex object (see below) |

### Creating Dropdown Fields (SINGLE_OPTIONS)

```typescript
// Use `options` (array of strings), NOT `picklistOptions`
const res = await fetch(`${BASE}/locations/${LOCATION_ID}/customFields`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: 'Motorside',
    dataType: 'SINGLE_OPTIONS',
    model: 'contact',
    options: ['Venstre', 'Høyre', 'Usikker'],
  }),
});
```

**Critical: `picklistOptions` does NOT work for creating fields. Use `options`.**
(However, the GET response returns options as `picklistOptions` — confusing but true.)

### Field Key Auto-Generation

GHL auto-generates `fieldKey` from the field name, stripping Norwegian special characters:

| Field Name | Generated fieldKey |
|---|---|
| Bredde (cm) | `contact.bredde_cm` |
| Høyde (cm) | `contact.hyde_cm` (ø stripped!) |
| Overhøyde (cm) | `contact.overhyde_cm` |
| Fjærtype | `contact.fjrtype` (æ stripped!) |
| Ønsket farge | `contact.nsket_farge` (Ø stripped!) |
| Gangdør i port | `contact.gangdr_i_port` |

**Always store the returned `id` and `fieldKey` — don't guess them from the name.**

### Setup Script Pattern

Create all custom fields programmatically and save IDs to a JSON file:

```typescript
// scripts/setup-ghl-fields.mjs
const FIELDS = [
  { key: 'porttype', name: 'Porttype', dataType: 'TEXT' },
  { key: 'bredde', name: 'Bredde (cm)', dataType: 'NUMERICAL' },
  { key: 'motorside', name: 'Motorside', dataType: 'SINGLE_OPTIONS',
    options: ['Venstre', 'Høyre', 'Usikker'] },
  // ... more fields
];

const mapping = {};
for (const field of FIELDS) {
  const res = await fetch(`${BASE}/locations/${LOCATION_ID}/customFields`, {
    method: 'POST', headers,
    body: JSON.stringify({
      name: field.name, dataType: field.dataType, model: 'contact',
      ...(field.options && { options: field.options }),
    }),
  });
  const data = await res.json();
  mapping[field.key] = {
    id: data.customField.id,
    fieldKey: data.customField.fieldKey,
    dataType: field.dataType,
  };
  await new Promise(r => setTimeout(r, 350)); // rate limit pause
}

// Save to src/data/ghl-fields.json — imported by Netlify Function at build time
writeFileSync('src/data/ghl-fields.json', JSON.stringify(mapping, null, 2));
```

Add to `package.json`: `"setup:ghl": "node scripts/setup-ghl-fields.mjs"`

The JSON file is imported by the Netlify Function and bundled at build time — field IDs are not secrets.

---

## Contacts API

### Upsert Contact (Create or Update)

```typescript
// POST /contacts/upsert
const res = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    locationId: process.env.GHL_LOCATION_ID,
    firstName: 'Ola',
    lastName: 'Nordmann',
    name: 'Ola Nordmann',
    email: 'ola@example.com',
    phone: '+4799999999',        // MUST include country code
    address1: 'Storgata 1',
    source: 'Nettside kontaktskjema',
    tags: ['website-lead'],
    customFields: [
      { id: 'Q4oV9blS1CeBpRgyMZYy', key: 'contact.porttype', field_value: 'Leddport' },
      { id: 'UjoNHShquAtvO1U4woqy', key: 'contact.bredde_cm', field_value: 300 },
      { id: '3opDBGvyY8y8XGLC2Lpc', key: 'contact.motorside', field_value: 'Venstre' },
    ],
  }),
});

const data = await res.json();
// data.contact.id → "SisCi2QnHCA3X7T9MZgy"
// data.new → true (new contact) or false (updated existing)
```

### Custom Fields Format (Critical)

Each custom field in the `customFields` array uses this format:

```typescript
{
  id: 'field_id',          // GHL field ID (from setup script)
  key: 'contact.fieldkey', // GHL field key (either id OR key works)
  field_value: value       // The value — type depends on dataType
}
```

**Type-specific `field_value` formats:**

```typescript
// TEXT / LARGE_TEXT → string
{ id: '...', key: '...', field_value: 'Some text' }

// NUMERICAL → number (NOT string!)
{ id: '...', key: '...', field_value: 300 }
// ❌ field_value: '300' — will be rejected or ignored

// SINGLE_OPTIONS → string matching option label exactly
{ id: '...', key: '...', field_value: 'Ja, 230V' }
// ❌ field_value: 'ja, 230v' — case must match

// MULTIPLE_OPTIONS / CHECKBOX → array of strings
{ id: '...', key: '...', field_value: ['Option A', 'Option B'] }
```

### Numeric Field Conversion (Frontend → Backend)

Frontend sends strings (from `<input type="number">`). Backend must convert:

```typescript
if (numeric) {
  const cleaned = String(value).replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = Number(cleaned);
  if (isNaN(num)) continue; // Skip invalid numbers
  result.push({ id: field.id, key: field.fieldKey, field_value: num });
}
```

### Phone Number Format

GHL requires international format with country code. Frontend should prepend it:

```typescript
// Frontend: combine country code + number
phone: `${phoneCountry}${rawPhone.replace(/^0+/, '')}`
// "+47" + "91904538" → "+4791904538"
```

### Handling "No Duplicate Contacts" Setting

Some GHL locations have "no duplicate contacts" enabled. `/contacts/upsert` returns 400 with the existing `contactId`:

```json
{
  "statusCode": 400,
  "message": "This location does not allow duplicated contacts.",
  "meta": { "contactId": "abc123", "matchingField": "email" }
}
```

**Solution:** Catch 400, extract contactId, update with PUT:

```typescript
if (!upsertRes.ok) {
  const errorData = await upsertRes.json();
  if (errorData.meta?.contactId) {
    const contactId = errorData.meta.contactId;
    await fetch(`${API_BASE}/contacts/${contactId}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ customFields, tags }),
    });
    return { contactId, isNew: false };
  }
  throw new Error(`GHL upsert failed: ${upsertRes.status}`);
}
```

### Search / Lookup Contacts

```typescript
// Search by query (name, email, phone)
const res = await fetch(
  `${API_BASE}/contacts/?locationId=${LOCATION_ID}&query=test@test.no&limit=1`,
  { method: 'GET', headers }
);
```

---

## Media Library API (File Uploads)

Upload files to GHL's hosted media library. Returns permanent CDN URLs.

### Upload a File (Binary)

```typescript
// POST /medias/upload-file — multipart/form-data
const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
const blob = new Blob([buffer], { type: mimeType });

const formData = new FormData();
formData.append('file', blob, fileName);
formData.append('hosted', 'false');  // ← CRITICAL: false = upload file
formData.append('name', fileName);

const res = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: '2021-07-28',
    // Do NOT set Content-Type — FormData sets it with boundary
  },
  body: formData,
});

const data = await res.json();
// data.fileId → "69c47de926d5576a6888cccc"
// data.url → "https://assets.cdn.filesafe.space/LOCATION_ID/media/UUID.png"
```

### The `hosted` Parameter (Critical)

| `hosted` | Meaning | Required fields |
|---|---|---|
| `false` | "Here is the actual file, store it" | `file` (binary) |
| `true` | "File is already hosted at this URL" | `fileUrl` (string) |

**`hosted: true` + `file` = ERROR**: `"fileUrl is required when hosted=true"`

### Register an Already-Hosted File

```typescript
const formData = new FormData();
formData.append('hosted', 'true');
formData.append('fileUrl', 'https://example.com/image.jpg');
formData.append('name', 'image.jpg');
```

### File Validation (Backend)

Always validate on the backend — frontend validation can be bypassed:

```typescript
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const maxSize = 5 * 1024 * 1024; // 5 MB
const fileSize = Math.ceil((file.base64.length * 3) / 4); // base64 → bytes

if (!allowedTypes.includes(file.type)) continue;
if (fileSize > maxSize) continue;
```

### Multiple File Uploads

Frontend sends array, backend uploads sequentially:

```typescript
const fileUrls: string[] = [];
for (const file of body.files.slice(0, 5)) { // max 5 files
  const url = await uploadToGHL(file);
  if (url) fileUrls.push(url);
}
// Store all URLs comma-separated in custom field
customFields.push({ id: vedleggFieldId, key: '...', field_value: fileUrls.join(', ') });
```

---

## Conversations API (Email Sending)

Send internal notification email via GHL Conversations API. The email goes to a **fixed notification contact** (bedriftseier/daglig leder) — NOT to the customer who submitted the form.

### Strategy: Fixed Notification Contact

1. **Create a GHL contact** for the person who should receive notifications (e.g., daglig leder)
2. **Store their contactId** as `NOTIFICATION_CONTACT_ID` environment variable
3. **Send email to this fixed contact** every time a form is submitted

This ensures:
- Customer does NOT receive email (only their data is saved in GHL)
- Daglig leder gets full lead details every time
- Email appears as conversation in GHL on the notification contact

### Setup: Create Notification Contact

Create the notification recipient as a contact in GHL (one-time setup):

```typescript
// Run once — or create manually in GHL dashboard
const res = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    locationId: LOCATION_ID,
    email: 'dagligleder@bedrift.no',    // ← Daglig leders e-post
    firstName: 'Fornavn',
    lastName: 'Etternavn',
    tags: ['notification-recipient'],
    source: 'Intern — e-postvarsling',
  }),
});

const data = await res.json();
console.log('Contact ID:', data.contact.id);
// Save this ID as NOTIFICATION_CONTACT_ID in Netlify env vars
```

**Important:** For hvert prosjekt/kunde må du opprette en egen notification-kontakt med daglig leders faktiske e-post og lagre IDen i miljøvariabelen.

### Send Internal Notification Email

```typescript
// POST /conversations/messages
const NOTIFICATION_CONTACT_ID = process.env.NOTIFICATION_CONTACT_ID;

const res = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    type: 'Email',
    contactId: NOTIFICATION_CONTACT_ID,  // Fixed: daglig leder, NOT the form submitter
    emailFrom: 'noreply@mg.domain.no',   // Must be verified in GHL location
    subject: `Ny forespørsel: ${portType} — ${name}`,
    html: buildEmailHtml(formData),      // Full HTML email with all lead info
    message: 'Plaintext fallback',       // Required field
    attachments: fileUrls,               // Optional: array of URLs from media upload
  }),
});
```

**Key points:**
- `contactId` is the **notification recipient** (daglig leder), NOT the customer
- The customer who fills out the form gets their data saved via upsert, but receives NO email
- `emailFrom` must be a verified sender in the GHL location's email settings
- `attachments` takes an array of public URLs (e.g., from media library upload)
- The email appears as a conversation in GHL on the notification contact's record

### Required Environment Variables

```bash
# Netlify env vars for email
EMAIL_FROM=noreply@mg.domain.no           # Verified sender in GHL
NOTIFICATION_CONTACT_ID=4y67ZNzcraENvyHd  # GHL contact ID for daglig leder
```

**Per-project checklist:**
- [ ] Create notification contact in GHL with daglig leders e-post
- [ ] Copy the contactId
- [ ] Set `NOTIFICATION_CONTACT_ID` in Netlify env vars
- [ ] Set `EMAIL_FROM` to a verified sender address
- [ ] Verify that email arrives at daglig leders innboks

### Building Email HTML

Always escape user input. Group related fields with subcategories:

```typescript
function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Only show sections that have data:
const hasLysaapning = m.width || m.height;
const hasKlaring = m.overhead || m.depth || m.sideroomL || m.sideroomR;

// Conditional rendering in template:
${hasLysaapning ? `
  <tr><td colspan="2"><strong>Lysåpning</strong></td></tr>
  ${row('Bredde', m.width ? `${m.width} cm` : undefined)}
  ${row('Høyde', m.height ? `${m.height} cm` : undefined)}
` : ''}
```

**Show images inline in email, PDFs as download links:**

```typescript
fileUrls.map((url, i) => {
  const isImage = /\.(jpg|jpeg|png|webp|gif)/i.test(url);
  return isImage
    ? `<img src="${esc(url)}" alt="Vedlegg ${i+1}" style="max-width:100%" />`
    : `<a href="${esc(url)}">Last ned vedlegg ${i+1}</a>`;
}).join('')
```

---

## Complete Production Flow

The recommended order of operations in the Netlify Function:

```
1. Validate required fields
2. Verify reCAPTCHA (if secret is configured)
3. Upload files to GHL Media Library → get URLs
4. Upsert CUSTOMER contact with custom fields + file URLs
5. Send notification email to DAGLIG LEDER (fixed NOTIFICATION_CONTACT_ID)
6. Return success to frontend
```

**Important distinction:**
- Step 4 creates/updates the **customer's** contact in GHL (the person who submitted the form)
- Step 5 sends email to a **fixed recipient** (daglig leder) — NOT the customer
- These are two separate contacts in GHL

**Error handling principle:** If file upload or email fails, still save the contact. Log the error but return success to the user — they shouldn't lose their submission because of a secondary operation failing.

### Required Environment Variables (complete list)

```bash
# GHL API
GHL_API_KEY=pit-xxxxx                    # Private Integration Token
GHL_LOCATION_ID=xxxxx                    # Sub-account location ID

# Email
EMAIL_FROM=noreply@mg.domain.no          # Verified sender
NOTIFICATION_CONTACT_ID=xxxxx            # Daglig leders GHL contact ID

# reCAPTCHA
VITE_RECAPTCHA_SITE_KEY=6Le...           # Public (frontend)
RECAPTCHA_SECRET_KEY=6Le...              # Secret (backend only)
```

---

## Security Checklist

- [ ] GHL_API_KEY stored in Netlify env vars only (never in frontend code)
- [ ] GHL_LOCATION_ID stored in Netlify env vars only
- [ ] All API calls happen in Netlify Functions (server-side)
- [ ] reCAPTCHA mandatory when RECAPTCHA_SECRET is configured
- [ ] reCAPTCHA score threshold >= 0.7
- [ ] Honeypot field in form
- [ ] HTML escaping on all user input in email templates
- [ ] File upload: backend validates type + size (frontend validation can be bypassed)
- [ ] Content-Security-Policy header configured
- [ ] Error responses don't expose API details to frontend
- [ ] Phone numbers include country code for GHL

## Troubleshooting

### Custom field values not appearing on contact
- For NUMERICAL fields: `field_value` MUST be a number, not a string
- For SINGLE_OPTIONS: value must match the option label exactly (case-sensitive)
- Use field `id` from setup script, not the auto-generated `fieldKey`

### Media upload returns 400 "fileUrl is required when hosted=true"
- You're sending `hosted: true` with a file binary. Use `hosted: false` (or omit it).

### Media upload returns empty/null
- Don't set `Content-Type` header manually — let `FormData` set it with boundary
- Use standard `FormData` + `Blob` API, not manual multipart construction

### "Api does not support objectKey of type contact"
- You're using `POST /custom-fields/` (v2 Custom Objects endpoint)
- Use `POST /locations/{locationId}/customFields` instead

### Email not sending
- Verify `emailFrom` is a verified sender in GHL location settings
- Verify the contact exists (upsert must succeed first to get contactId)
- Check that `conversations/message.write` scope is on the Private Integration

### reCAPTCHA blocking real users
- Lower score threshold from 0.7 to 0.5 if legitimate users are blocked
- Add fallback: if reCAPTCHA script fails to load, frontend catches error and sends without token
- Backend: only require token if `RECAPTCHA_SECRET` is configured

### Norwegian characters in field names
- GHL strips ø, æ, å from auto-generated fieldKeys
- Always use the returned `id` for field matching, not the fieldKey
