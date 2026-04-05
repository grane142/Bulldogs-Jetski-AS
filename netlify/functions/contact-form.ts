/**
 * Netlify Function: Handle booking inquiry form submissions.
 * 1. Validate input
 * 2. Upsert contact in GHL with custom fields
 * 3. Send notification email to admin (daglig leder)
 */

const API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY!;
const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const EMAIL_FROM = process.env.EMAIL_FROM;
const NOTIFICATION_CONTACT_ID = process.env.NOTIFICATION_CONTACT_ID;

const headers = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  'Content-Type': 'application/json',
  Version: '2021-07-28',
};

// Field mapping — update these IDs after running `npm run setup:ghl`
let fieldMapping: Record<string, { id: string; fieldKey: string; dataType: string }>;
try {
  fieldMapping = require('../../src/data/ghl-fields.json');
} catch {
  fieldMapping = {};
}

interface BookingPayload {
  name: string;
  phone: string;
  email: string;
  date: string;
  package: string;
  quantity: string;
  message?: string;
  honeypot?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(input: string, maxLength: number): string {
  return input.trim().slice(0, maxLength);
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(data: BookingPayload): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111; border-bottom: 2px solid #111; padding-bottom: 12px;">
        Ny forespørsel — Bulldogg Jetski
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 40%;">Navn</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${esc(data.name)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Telefon</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${esc(data.phone)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">E-post</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${esc(data.email)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Ønsket dato</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${esc(data.date)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Pakke</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${esc(data.package)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Antall vannscootere</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${esc(data.quantity)}</td>
        </tr>
        ${
          data.message
            ? `<tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Melding</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${esc(data.message)}</td>
        </tr>`
            : ''
        }
      </table>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        Sendt fra nettskjemaet på bulldoggjetski.no
      </p>
    </div>
  `;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: BookingPayload = await req.json();

    // Honeypot check
    if (body.honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!body.name || !body.email || !body.phone || !body.date || !body.package || !body.quantity) {
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

    // Build custom fields array
    const customFields: Array<{ id: string; key: string; field_value: string }> = [];

    if (fieldMapping.pakke) {
      const packageLabels: Record<string, string> = {
        timepris: 'Timepris',
        halvdag: 'Halvdag',
        heldag: 'Heldag',
        helgutleie: 'Helgutleie',
      };
      customFields.push({
        id: fieldMapping.pakke.id,
        key: fieldMapping.pakke.fieldKey,
        field_value: packageLabels[body.package] || body.package,
      });
    }

    if (fieldMapping.antall_vannscootere) {
      customFields.push({
        id: fieldMapping.antall_vannscootere.id,
        key: fieldMapping.antall_vannscootere.fieldKey,
        field_value: body.quantity,
      });
    }

    if (fieldMapping.oensket_dato) {
      customFields.push({
        id: fieldMapping.oensket_dato.id,
        key: fieldMapping.oensket_dato.fieldKey,
        field_value: body.date,
      });
    }

    if (fieldMapping.melding && body.message) {
      customFields.push({
        id: fieldMapping.melding.id,
        key: fieldMapping.melding.fieldKey,
        field_value: sanitize(body.message, 2000),
      });
    }

    // Split name into first/last
    const nameParts = sanitize(body.name, 100).split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Ensure phone has country code
    let phone = sanitize(body.phone, 20).replace(/\s/g, '');
    if (!phone.startsWith('+')) {
      phone = `+47${phone.replace(/^0+/, '')}`;
    }

    // Upsert contact in GHL
    const upsertBody = {
      locationId: LOCATION_ID,
      firstName,
      lastName,
      name: sanitize(body.name, 100),
      email: sanitize(body.email, 254),
      phone,
      source: 'Nettside forespørsel',
      tags: ['website-lead', 'vannscooter-forespørsel'],
      customFields,
    };

    let contactId: string | null = null;

    const upsertRes = await fetch(`${API_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify(upsertBody),
    });

    if (upsertRes.ok) {
      const upsertData = await upsertRes.json();
      contactId = upsertData.contact?.id;
    } else {
      // Handle "no duplicate contacts" setting
      const errorData = await upsertRes.json();
      if (errorData.meta?.contactId) {
        contactId = errorData.meta.contactId;
        // Update existing contact
        await fetch(`${API_BASE}/contacts/${contactId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ customFields, tags: ['website-lead', 'vannscooter-forespørsel'] }),
        });
      } else {
        console.error('GHL upsert failed:', upsertRes.status, JSON.stringify(errorData));
      }
    }

    // Send notification email to admin
    if (NOTIFICATION_CONTACT_ID && EMAIL_FROM) {
      try {
        await fetch(`${API_BASE}/conversations/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: 'Email',
            contactId: NOTIFICATION_CONTACT_ID,
            emailFrom: EMAIL_FROM,
            subject: `Ny forespørsel: ${body.package} — ${body.name}`,
            html: buildEmailHtml(body),
            message: `Ny forespørsel fra ${body.name} (${body.email}) - ${body.package}`,
          }),
        });
      } catch (emailErr) {
        // Don't fail the whole submission if email fails
        console.error('Email notification failed:', emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true, contactId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: 'En feil oppstod. Prøv igjen senere.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
