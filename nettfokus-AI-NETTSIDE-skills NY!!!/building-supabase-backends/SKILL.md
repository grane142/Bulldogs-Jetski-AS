---
name: building-supabase-backends
description: "Builds Supabase backend features for Nettfokus Astro websites (Track E / E-Hybrid). Use when adding authentication (magic link, OAuth), database with Row Level Security (RLS), file storage, realtime features, or Edge Functions to an Astro site. Covers Supabase client setup, RLS policies (mandatory on all tables), auth state management, hybrid rendering mode for live Supabase data without rebuilds, the decision between Netlify Functions vs Supabase Edge Functions, environment variable placement across Netlify and Supabase dashboards, database triggers, file uploads, PITR backups, and CORS configuration. For projects with frequently changing data (members, news, events), use hybrid mode (Track E-Hybrid) so SSR pages always show fresh Supabase data."
---

# Building Supabase Backends

Add backend features to Astro websites: authentication, database, file storage, and realtime. Public pages remain SSG with Content Collections (same as Track A). Interactive features run as React islands with `client:load`.

For projects with frequently changing Supabase data (members, news, events), use hybrid mode (Track E-Hybrid) — dynamic pages are server-rendered with fresh data on every request, eliminating the need for rebuilds. See the developing-astro-sites skill for hybrid setup.

## Architecture

### Track E (Pure SSG) — data changes infrequently

```
PUBLIC PAGES (SSG — real HTML, SEO-friendly)
├── Frontpage, About, Services, Contact → Astro + Content Collections
│   (identical to Track A)

AUTHENTICATED/DYNAMIC PAGES (React islands with client:load)
├── Dashboard, Admin, User profile → React components
│   └── Talk to Supabase via supabase-js (anon key + RLS)

SERVER-SIDE FUNCTIONS
├── Netlify Functions → CRM webhooks, reCAPTCHA, non-Supabase integrations
└── Supabase Edge Functions → Database operations, triggers, Supabase-heavy logic
```

Rebuild required when Supabase data changes and public pages need to reflect it.

### Track E-Hybrid (Recommended for frequently changing data)

```
STATIC PAGES (SSG — CDN, ~50ms)
├── Frontpage, About, Contact, Privacy, Join → Astro + Content Collections
│   (identical to Track A — rarely change)

SERVER-RENDERED PAGES (SSR — always fresh Supabase data, ~200ms)
├── /medlemmer, /nyheter, /arrangementer → Astro pages with prerender = false
│   └── Query Supabase at request time → full HTML response → CDN-cached (60s)
│   SEO identical to SSG — crawlers receive complete HTML

AUTHENTICATED/DYNAMIC PAGES (React islands with client:load)
├── Dashboard, Admin, User profile → React components
│   └── Talk to Supabase via supabase-js (anon key + RLS)

SERVER-SIDE FUNCTIONS
├── Netlify Functions → CRM webhooks, reCAPTCHA, non-Supabase integrations
└── Supabase Edge Functions → Database operations, triggers, Supabase-heavy logic
```

No rebuild for data changes. Members edit their profile → visible on site within 60 seconds (CDN cache). New articles published → appear immediately. Only code changes or static page edits require a deploy.

## Netlify Functions vs Supabase Edge Functions

Both run server-side code with access to secrets. Use the right one:

```
Does the function talk to Supabase database?
├── NO → Netlify Function (contact form, CRM, external APIs)
└── YES → Does it need service_role key?
    ├── NO → Client-side with supabase-js (anon key + RLS)
    └── YES → Supabase Edge Function (admin ops, triggers, bulk data)
```

Typical project:
- Contact form → Netlify Function → reCAPTCHA → GHL webhook
- Admin dashboard → Supabase Edge Function → DB with service_role
- User reads data → Client-side → supabase-js (anon key + RLS)
- New order event → Supabase trigger → Edge Function → send email

## Setup

```bash
# Start with standard Astro (Track A)
npm create astro@latest
npx astro add react
npx astro add tailwind

# Add Supabase
npm install @supabase/supabase-js

# For hybrid mode (Track E-Hybrid) — add Netlify adapter
npx astro add netlify

# Supabase CLI (for Edge Functions)
npm install supabase --save-dev
npx supabase init
npx supabase login
npx supabase link --project-ref your-project-ref
```

For hybrid mode, also set `output: 'hybrid'` and `adapter: netlify()` in `astro.config.mjs`. See the developing-astro-sites skill for full config.

## Supabase Client

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are safe in frontend — designed for public use. `SUPABASE_SERVICE_ROLE_KEY` goes only in server-side functions.

## Environment Variables

Secrets need to be in the right place depending on which functions use them:

| Secret | Netlify Dashboard | Supabase Secrets | .env (local) |
|---|---|---|---|
| VITE_SUPABASE_URL | ✅ | Automatic | ✅ |
| VITE_SUPABASE_ANON_KEY | ✅ | Automatic | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | ✗ | Automatic | ✅ |
| RECAPTCHA_SECRET_KEY | ✅ | ✗ | ✅ |
| CRM_WEBHOOK_URL | ✅ | ✗ | ✅ |
| RESEND_API_KEY | ✗ | ✅ | ✅ |
| STRIPE_SECRET_KEY | ✗ | ✅ | ✅ |

Supabase Edge Functions automatically have access to `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Set additional secrets via CLI:

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx
npx supabase secrets set STRIPE_SECRET_KEY=sk_xxx
```

## Row Level Security (RLS) — Mandatory

Every table must have RLS enabled. Without it, the anon key gives full access to all data.

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);
```

Public data (no auth required):
```sql
CREATE POLICY "Anyone can read published content"
  ON blog_posts FOR SELECT
  USING (published = true);
```

## Authentication

```tsx
// src/components/auth/LoginForm.tsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setMessage(error ? 'Noe gikk galt. Prøv igjen.' : 'Sjekk e-posten din for innloggingslenken.');
    setLoading(false);
  };

  return (
    <form onSubmit={handleLogin}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="din@epost.no" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Sender...' : 'Logg inn'}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}
```

### Auth State Provider

```tsx
// src/components/auth/AuthProvider.tsx
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null, loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

## Edge Functions

See [references/edge-functions.md](references/edge-functions.md) for detailed examples including admin actions with service_role, database triggers, email sending, Stripe webhooks, CORS configuration, and deployment.

Quick reference:

```bash
# Create
npx supabase functions new admin-action

# Deploy
npx supabase functions deploy admin-action

# Test locally
npx supabase functions serve admin-action --env-file .env
```

Call from frontend:
```typescript
const { data, error } = await supabase.functions.invoke('admin-action', {
  body: { action: 'delete_user', targetUserId: '...' },
});
```

## File Storage

```tsx
// Upload
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${user.id}/avatar.png`, file, {
    cacheControl: '3600',
    upsert: true,
  });

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${user.id}/avatar.png`);
```

Configure bucket policies in Supabase dashboard (similar to RLS).

## Backup & Recovery

Data loss is permanent without backups. Enable Point-in-Time Recovery (PITR) on Supabase Pro plan for any project with customer data. Verify daily backups in Supabase dashboard → Settings → Database → Backups.

Manual backup:
```bash
npx supabase db dump -f backup.sql --db-url "postgresql://..."
```

## Supabase Checklist

- [ ] Supabase project created
- [ ] RLS enabled on all tables
- [ ] RLS policies created for each table
- [ ] Auth providers configured (magic link, Google, etc.)
- [ ] Redirect URLs set in Supabase auth settings
- [ ] Environment variables in .env, Netlify dashboard, and Supabase secrets
- [ ] Auth flow tested end-to-end
- [ ] RLS tested (try accessing other users' data — should fail)
- [ ] Service role key only in server-side functions
- [ ] Edge Functions deployed and tested
- [ ] CORS on Edge Functions locked to production domain
- [ ] PITR enabled or daily backups verified
- [ ] Backup/restore procedure documented in README
- [ ] If hybrid mode: `@astrojs/netlify` adapter configured
- [ ] If hybrid mode: SSR pages marked with `export const prerender = false`
- [ ] If hybrid mode: CDN cache headers set in netlify.toml for SSR routes
- [ ] If hybrid mode: SSR pages verified to return full HTML (View Page Source)
