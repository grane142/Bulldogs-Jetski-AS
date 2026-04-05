# Supabase Edge Functions

Detailed examples for Edge Functions in Nettfokus Track E projects. Edge Functions run on Deno, co-located with the Supabase database for low latency.

## Shared CORS Headers

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // Lock to domain in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

Production: Replace `*` with your domain:
```typescript
const allowedOrigins = ['https://domene.no', 'https://www.domene.no']
const origin = req.headers.get('origin') || ''
const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
```

## Admin Action (service_role)

```typescript
// supabase/functions/admin-action/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()

    // Verify requesting user is admin
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await supabase
      .from('admin_logs')
      .insert({ action: body.action, performed_by: user.id })

    if (error) throw error

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

## Send Email on Database Event

```typescript
// supabase/functions/send-email/index.ts
Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const { record } = payload

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@domene.no',
        to: record.email,
        subject: 'Bekreftelse på din bestilling',
        html: `<p>Hei ${record.name}, vi har mottatt bestillingen din.</p>`,
      }),
    })

    if (!res.ok) throw new Error(`Resend error: ${res.status}`)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
```

Set up trigger: Supabase Dashboard → Database → Webhooks → Table: `orders`, Events: `INSERT`, Function: `send-email`.

## File Structure

```
supabase/
└── functions/
    ├── _shared/
    │   └── cors.ts
    ├── admin-action/
    │   └── index.ts
    ├── send-email/
    │   └── index.ts
    └── stripe-webhook/
        └── index.ts
```

## Deployment

```bash
npx supabase functions deploy admin-action    # Single function
npx supabase functions deploy                 # All functions
npx supabase functions serve admin-action --env-file .env  # Local testing
```
