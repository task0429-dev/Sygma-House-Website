# Sygma House — Full System Implementation Plan

> Minnesota Residential Assisted Living | 5-Resident Home | Private Pay + Medicaid Waiver

---

## 1. SITE MAP

```
sygmahouse.com/
├── /                          Home
├── /about                     About Sygma House
├── /services                  Care Services
├── /living                    Living at Sygma House
├── /admissions                Admissions & Intake
│   └── /admissions/apply      Intake Form (multi-step)
├── /pricing                   Pricing & Payment Options
├── /resources                 Family Resources
├── /compliance                Compliance & Resident Rights
├── /tour                      Schedule a Tour
├── /contact                   Contact
├── /careers                   Careers
└── /admin (protected)
    ├── /admin/dashboard        Overview + analytics
    ├── /admin/leads            Lead list
    ├── /admin/leads/[id]       Lead detail + pipeline
    ├── /admin/pipeline         Kanban admission pipeline
    ├── /admin/calendar         Tour calendar
    └── /admin/settings         Facility settings
```

---

## 2. COMPONENT MAP

### Global
- `<Navbar />` — logo, nav links, "Schedule a Tour" CTA
- `<Footer />` — links, address placeholder, license number placeholder, disclaimer
- `<CTABanner />` — reusable tour/contact CTA strip
- `<ComplianceNote />` — small disclaimer used on legal/compliance pages

### Public Pages
| Component | Used on |
|---|---|
| `<HeroSection />` | Home |
| `<CapacityBadge />` | Home, Admissions |
| `<TrustPillars />` | Home, About |
| `<AdmissionSteps />` | Home, Admissions |
| `<ServiceCard />` | Services |
| `<PhotoPlaceholder />` | Living, Home |
| `<IntakePath />` | Admissions |
| `<DocumentChecklist />` | Admissions, Resources |
| `<PricingCard />` | Pricing |
| `<FAQAccordion />` | Resources |
| `<TourBookingForm />` | Tour |
| `<ContactForm />` | Contact |
| `<CareerForm />` | Careers |
| `<ResidentRightsSection />` | Compliance |

### Intake Form (multi-step)
- `Step1_ContactInfo` — family/resident name, phone, email, relationship
- `Step2_ResidentProfile` — age, current location, diagnosis notes, mobility
- `Step3_CareNeeds` — care needs checklist, medications, behaviors/safety
- `Step4_PaymentPath` — payment type, waiver type, case manager, county
- `Step5_TimingConsent` — move-in timeline, urgency, tour request, consent
- `FormRouter` — routes post-submit to correct automation path
- `ConfirmationPage` — thank you + next steps by path

### Admin Dashboard
- `<PipelineBoard />` — kanban with 9 columns
- `<LeadCard />` — drag-and-drop card with urgency badge
- `<CapacityTracker />` — 5-bed visual indicator
- `<AnalyticsBar />` — weekly stats
- `<LeadDetailPanel />` — full lead info, notes, docs, tasks
- `<TourCalendar />` — upcoming scheduled tours
- `<TaskList />` — follow-up tasks per lead
- `<FilterBar />` — payment type + urgency filters

---

## 3. DATA MODEL

### leads
```sql
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Contact
  family_name     TEXT NOT NULL,
  family_phone    TEXT,
  family_email    TEXT,
  relationship    TEXT,  -- 'spouse','child','sibling','self','case_manager','other'

  -- Resident
  resident_name   TEXT,
  resident_age    INT,
  current_location TEXT, -- 'home','hospital','rehab','facility','other'

  -- Care
  care_needs      TEXT[], -- array of care need tags
  mobility_level  TEXT,   -- 'independent','minimal_assist','full_assist','nonambulatory'
  medications     BOOLEAN,
  behaviors_safety TEXT,
  diagnosis_notes TEXT,

  -- Payment
  payment_type    TEXT,   -- 'private_pay','medicaid_waiver','unsure'
  waiver_type     TEXT,   -- 'elderly','cadi','bi','dd','other'
  case_manager_name TEXT,
  case_manager_phone TEXT,
  county          TEXT,

  -- Timing
  move_in_timeline TEXT,  -- 'asap','1_2_weeks','1_month','3_months','exploring'
  urgency_score   INT,    -- 1-5 (auto-calculated)
  tour_requested  BOOLEAN DEFAULT false,

  -- Pipeline
  status          TEXT DEFAULT 'new_lead',
  -- new_lead | contacted | tour_scheduled | assessment_needed |
  -- documents_pending | payment_review | approved | move_in_scheduled | closed_not_fit

  -- Meta
  is_fit          BOOLEAN,
  assigned_to     TEXT,
  consent_given   BOOLEAN DEFAULT false,
  notes           TEXT,
  tags            TEXT[]
);
```

### documents
```sql
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id),
  name        TEXT,
  type        TEXT,  -- 'id','insurance','physician_order','ped','face_sheet','other'
  url         TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  status      TEXT DEFAULT 'pending'  -- 'pending','received','verified'
);
```

### tours
```sql
CREATE TABLE tours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID REFERENCES leads(id),
  scheduled_at  TIMESTAMPTZ,
  duration_mins INT DEFAULT 60,
  status        TEXT DEFAULT 'scheduled', -- scheduled|completed|cancelled|no_show
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### tasks
```sql
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id),
  title       TEXT,
  due_at      TIMESTAMPTZ,
  completed   BOOLEAN DEFAULT false,
  assigned_to TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### facility_settings
```sql
CREATE TABLE facility_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_beds      INT DEFAULT 5,
  occupied_beds   INT DEFAULT 0,
  pending_beds    INT DEFAULT 0,
  license_number  TEXT,  -- placeholder
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. URGENCY SCORING LOGIC

```
urgency_score = base(timeline) + boost(payment) + boost(location)

timeline:
  asap         → 5
  1_2_weeks    → 4
  1_month      → 3
  3_months     → 2
  exploring    → 1

payment boost:
  private_pay  → +1
  medicaid_waiver → +0 (wait for eligibility)
  unsure       → +0

location boost:
  hospital     → +2
  rehab        → +1
  home         → +0
  facility     → +0

cap at 5
```

---

## 5. AUTOMATION MAP

```
INTAKE SUBMITTED
│
├─ [ALL] Save lead to DB
├─ [ALL] Calculate urgency score
├─ [ALL] Send confirmation email to family
├─ [ALL] Notify admin (email + optional SMS)
├─ [ALL] Create 24hr follow-up task
│
├─ [urgency ≥ 4] → Priority alert to admin
│
├─ [payment = private_pay]
│   └─ Send "Private Pay Consultation" email
│
├─ [payment = medicaid_waiver]
│   └─ Send "Waiver Information + Case Manager Request" email
│
├─ [payment = unsure]
│   └─ Send "Let Us Help You Understand Your Options" email
│
├─ [tour_requested = true]
│   └─ Create tour scheduling task
│       └─ Send "Tour Confirmation Request" email
│
├─ [current_location = hospital]
│   └─ Escalate urgency, flag for same-day contact
│
└─ [no admin response in 2 days]
    └─ Send internal follow-up reminder

DOCUMENT REMINDER (triggered if status = documents_pending for 3+ days)
└─ Send document checklist email to family

PIPELINE CHANGE
└─ Log status transition with timestamp

TOUR COMPLETED → advance to Assessment Needed
APPROVAL GRANTED → send move-in prep packet email
```

---

## 6. EMAIL TEMPLATES (Placeholder)

| Template ID | Trigger | Recipient |
|---|---|---|
| `confirm_intake` | Any submission | Family |
| `private_pay_consult` | payment=private_pay | Family |
| `waiver_info` | payment=medicaid_waiver | Family |
| `options_education` | payment=unsure | Family |
| `tour_confirm` | tour_requested=true | Family |
| `admin_new_lead` | Any submission | Admin |
| `admin_priority_alert` | urgency≥4 | Admin |
| `doc_reminder` | docs_pending 3+ days | Family |
| `followup_reminder` | no response 2 days | Admin |
| `movein_prep` | status→approved | Family |

---

## 7. BUILD PHASES

### Phase 1 — Foundation (Week 1)
- [ ] Next.js project init + Tailwind CSS setup
- [ ] Global layout: Navbar, Footer, CTABanner
- [ ] Home page (hero, trust pillars, admission steps)
- [ ] About page
- [ ] Contact page + basic form
- [ ] Deploy to Vercel (static)

### Phase 2 — Core Pages (Week 2)
- [ ] Services page (8 service cards)
- [ ] Living at Sygma House page
- [ ] Admissions overview page
- [ ] Pricing page
- [ ] Tour scheduling form

### Phase 3 — Intake System (Week 3)
- [ ] 5-step intake form with validation
- [ ] Urgency scoring logic
- [ ] Confirmation page with path-specific messaging
- [ ] Supabase integration: save leads
- [ ] Email confirmation via Resend/SendGrid

### Phase 4 — Admin Dashboard (Week 4)
- [ ] Auth (Supabase Auth or NextAuth)
- [ ] Lead list with filters
- [ ] Pipeline kanban board
- [ ] Capacity tracker
- [ ] Lead detail page
- [ ] Tour calendar

### Phase 5 — Automation + Polish (Week 5-6)
- [ ] Automation service layer (triggers, email flows)
- [ ] Document upload (Supabase Storage)
- [ ] Careers page + form
- [ ] Family Resources + FAQ
- [ ] Compliance page
- [ ] Performance, accessibility, SEO audit
- [ ] Production deployment

---

## 8. FILE STRUCTURE

```
sygma-house/
├── public/
│   ├── images/
│   │   ├── placeholder-exterior.jpg
│   │   ├── placeholder-room.jpg
│   │   └── placeholder-living.jpg
│   └── favicon.ico
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Home
│   │   ├── about/page.tsx
│   │   ├── services/page.tsx
│   │   ├── living/page.tsx
│   │   ├── admissions/
│   │   │   ├── page.tsx             # Admissions overview
│   │   │   └── apply/page.tsx       # Multi-step intake form
│   │   ├── pricing/page.tsx
│   │   ├── resources/page.tsx
│   │   ├── compliance/page.tsx
│   │   ├── tour/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── careers/page.tsx
│   │   └── admin/
│   │       ├── layout.tsx           # Admin layout (auth guard)
│   │       ├── dashboard/page.tsx
│   │       ├── leads/page.tsx
│   │       ├── leads/[id]/page.tsx
│   │       ├── pipeline/page.tsx
│   │       └── calendar/page.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── CTABanner.tsx
│   │   ├── home/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── TrustPillars.tsx
│   │   │   ├── AdmissionSteps.tsx
│   │   │   └── CapacityBadge.tsx
│   │   ├── services/
│   │   │   └── ServiceCard.tsx
│   │   ├── intake/
│   │   │   ├── IntakeForm.tsx
│   │   │   ├── Step1_Contact.tsx
│   │   │   ├── Step2_Resident.tsx
│   │   │   ├── Step3_CareNeeds.tsx
│   │   │   ├── Step4_Payment.tsx
│   │   │   ├── Step5_Timing.tsx
│   │   │   └── ConfirmationView.tsx
│   │   ├── admin/
│   │   │   ├── PipelineBoard.tsx
│   │   │   ├── LeadCard.tsx
│   │   │   ├── LeadDetailPanel.tsx
│   │   │   ├── CapacityTracker.tsx
│   │   │   ├── AnalyticsBar.tsx
│   │   │   ├── TourCalendar.tsx
│   │   │   └── FilterBar.tsx
│   │   └── shared/
│   │       ├── PhotoPlaceholder.tsx
│   │       ├── FAQAccordion.tsx
│   │       ├── DocumentChecklist.tsx
│   │       └── ComplianceNote.tsx
│   │
│   ├── lib/
│   │   ├── supabase.ts              # Supabase client
│   │   ├── urgency.ts               # Urgency scoring
│   │   ├── automation.ts            # Automation triggers
│   │   └── email.ts                 # Email service wrapper
│   │
│   ├── types/
│   │   └── index.ts                 # Lead, Tour, Task types
│   │
│   └── styles/
│       └── globals.css
│
├── supabase/
│   └── schema.sql                   # Full DB schema
│
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## 9. TECH STACK

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR/SSG, Vercel deployment, routing |
| Styling | Tailwind CSS | Rapid mobile-first development |
| Backend/DB | Supabase | Postgres + Auth + Storage + Realtime |
| Email | Resend (or SendGrid) | Reliable transactional email |
| File Upload | Supabase Storage | Documents bucket |
| Hosting | Vercel | Zero-config Next.js deployment |
| Calendar | react-big-calendar | Tour scheduling view |
| Forms | react-hook-form + zod | Validation |
| Auth (admin) | Supabase Auth | Row-level security for admin routes |

---

## 10. COMPLIANCE CHECKLIST (Site-level)

- [ ] License number placeholder visible on footer + compliance page
- [ ] "This site is informational only, not legal advice" footer disclaimer
- [ ] Resident Rights section referencing MN Statute 144G.91 (general reference only)
- [ ] UDALSA / Service Disclosure placeholder section
- [ ] Assisted Living Contract/Service Plan language placeholder
- [ ] MnCHOICES assessment reference for Elderly Waiver (eligibility info only)
- [ ] Medical Assistance (MA) eligibility note for waiver path
- [ ] No fake testimonials anywhere
- [ ] No guaranteed pricing claims
- [ ] No unverified licensing claim (use "licensed by MDH" only after confirmed)
- [ ] Complaint resource placeholder (MDH contact)
- [ ] Privacy Policy placeholder page
- [ ] HIPAA-aware data collection notice on intake form
