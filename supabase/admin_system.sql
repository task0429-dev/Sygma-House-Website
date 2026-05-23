-- Sygma House production admin system additions.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  family_name TEXT NOT NULL,
  family_phone TEXT,
  family_email TEXT,
  relationship TEXT,
  resident_name TEXT,
  resident_age INT,
  current_location TEXT,
  care_needs TEXT[],
  mobility_level TEXT,
  medications TEXT,
  behaviors_safety TEXT,
  diagnosis_notes TEXT,
  payment_type TEXT,
  waiver_type TEXT,
  case_manager_name TEXT,
  case_manager_phone TEXT,
  county TEXT,
  move_in_timeline TEXT,
  urgency_score INT CHECK (urgency_score BETWEEN 1 AND 5),
  tour_requested BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'new_lead',
  is_fit BOOLEAN,
  assigned_to TEXT,
  consent_given BOOLEAN DEFAULT false,
  notes TEXT,
  tags TEXT[],
  confirmation_sent BOOLEAN DEFAULT false,
  admin_notified BOOLEAN DEFAULT false,
  followup_email_sent BOOLEAN DEFAULT false,
  last_contact_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  source TEXT DEFAULT 'contact_form',
  status TEXT DEFAULT 'new' CHECK (status IN ('new','read','replied','archived')),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  scheduled_at TIMESTAMPTZ,
  preferred_date DATE,
  preferred_time TEXT,
  duration_mins INT DEFAULT 60,
  tour_type TEXT DEFAULT 'in_person',
  status TEXT DEFAULT 'requested' CHECK (status IN ('requested','scheduled','confirmed','completed','cancelled','no_show')),
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  resident_name TEXT,
  notes TEXT,
  google_event_id TEXT,
  calendar_sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  assigned_to TEXT,
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.traffic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  session_id TEXT,
  visitor_id TEXT,
  page TEXT NOT NULL,
  referrer TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  user_agent TEXT,
  screen_width INT,
  screen_height INT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.facility_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_beds INT DEFAULT 5,
  occupied_beds INT DEFAULT 0,
  pending_beds INT DEFAULT 0,
  license_number TEXT,
  license_type TEXT DEFAULT 'Assisted Living Facility',
  facility_name TEXT DEFAULT 'Sygma House',
  address TEXT,
  phone TEXT,
  email TEXT,
  admin_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.facility_settings (facility_name)
SELECT 'Sygma House'
WHERE NOT EXISTS (SELECT 1 FROM public.facility_settings);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['leads','messages','tours','tasks','notes','traffic_events','facility_settings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin full access" ON public.%I', table_name);
    EXECUTE format('CREATE POLICY "Admin full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;
CREATE POLICY "Public can insert leads" ON public.leads FOR INSERT TO anon WITH CHECK (consent_given = true);

DROP POLICY IF EXISTS "Public can insert messages" ON public.messages;
CREATE POLICY "Public can insert messages" ON public.messages FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert tours" ON public.tours;
CREATE POLICY "Public can insert tours" ON public.tours FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert traffic events" ON public.traffic_events;
CREATE POLICY "Public can insert traffic events" ON public.traffic_events FOR INSERT TO anon WITH CHECK (true);

CREATE OR REPLACE VIEW public.admin_overview AS
SELECT
  (SELECT COUNT(*) FROM public.leads) AS total_leads,
  (SELECT COUNT(*) FROM public.leads WHERE created_at > now() - interval '7 days') AS leads_7d,
  (SELECT COUNT(*) FROM public.leads WHERE urgency_score >= 4) AS urgent_leads,
  (SELECT COUNT(*) FROM public.tours WHERE status IN ('requested','scheduled','confirmed')) AS active_tours,
  (SELECT COUNT(*) FROM public.messages WHERE status = 'new') AS unread_messages,
  (SELECT COUNT(*) FROM public.traffic_events WHERE created_at > now() - interval '24 hours') AS visits_24h;

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tours_created ON public.tours(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_created ON public.traffic_events(created_at DESC);
