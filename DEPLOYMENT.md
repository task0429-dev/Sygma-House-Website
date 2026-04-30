# Sygma House — Deployment Guide

## Quick Start (Local Preview)
Open these files directly in a browser — no server needed:
- `public-website.html` — Full public website with all pages + intake form
- `admin-dashboard.html` — Admin dashboard (leads, pipeline, calendar)

---

## Production Deployment

### Option A: Vercel (Recommended for Next.js)
```bash
# 1. Init Next.js project
npx create-next-app@latest sygma-house --typescript --tailwind --app

# 2. Copy src/ files into project

# 3. Install dependencies
npm install @supabase/supabase-js resend react-hook-form zod

# 4. Set environment variables in Vercel dashboard:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-key
ADMIN_EMAIL=admin@sygmahouse.com
ADMIN_PHONE=+16120000000

# 5. Deploy
vercel deploy --prod
```

### Option B: Static Site (HTML prototype only)
Upload `public-website.html` and `admin-dashboard.html` to any static host:
- Netlify: drag and drop
- GitHub Pages: push to repo
- Any web server

---

## Supabase Setup
```bash
# 1. Create project at supabase.com
# 2. Run schema
psql -h db.your-project.supabase.co -U postgres -f supabase/schema.sql
# OR paste into Supabase SQL editor

# 3. Create admin user
# Go to: Supabase > Authentication > Users > Add User
# Set email/password for admin access
```

---

## Email Setup (Resend)
```bash
npm install resend
# Get API key from resend.com
# Verify domain: sygmahouse.com → add DNS records
# From address: hello@sygmahouse.com
```

---

## Environment Variables
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ADMIN_EMAIL=
ADMIN_PHONE=
NEXT_PUBLIC_SITE_URL=https://sygmahouse.com
```

---

## Checklist Before Going Live
- [ ] Real phone number added to all pages
- [ ] Real address added (footer, contact page, map)
- [ ] MDH license number confirmed and added
- [ ] Owner/operator story filled in (About page)
- [ ] Real photos uploaded (Living page)
- [ ] Privacy Policy page added
- [ ] SSL certificate confirmed (Vercel provides automatically)
- [ ] Domain connected (sygmahouse.com → Vercel)
- [ ] Admin email/password set in Supabase
- [ ] Email domain verified in Resend
- [ ] Test intake form end-to-end
- [ ] Test admin dashboard with real lead
- [ ] Legal review of compliance page content
- [ ] Pricing updated with confirmed rates (or keep "contact for pricing")
