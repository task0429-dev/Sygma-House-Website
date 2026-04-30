-- =============================================
-- SYGMA HOUSE — SUPABASE SCHEMA
-- Full database schema for admissions system
-- =============================================

-- ENABLE extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- LEADS TABLE
-- =============================================
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Contact (family/referral)
  family_name     TEXT NOT NULL,
  family_phone    TEXT,
  family_email    TEXT,
  relationship    TEXT, -- 'adult_child','spouse','sibling','case_manager','discharge_planner','county','self','other'

  -- Resident
  resident_name   TEXT,
  resident_age    INT,
  current_location TEXT, -- 'home','hospital','rehab','facility','other'

  -- Care
  care_needs      TEXT[],
  mobility_level  TEXT,   -- 'independent','minimal','significant','nonambulatory'
  medications     TEXT,   -- 'none','assistance','full_management','unknown'
  behaviors_safety TEXT,
  diagnosis_notes TEXT,

  -- Payment
  payment_type    TEXT,   -- 'private_pay','medicaid_waiver','unsure'
  waiver_type     TEXT,   -- 'elderly','cadi','bi','dd','other'
  case_manager_name  TEXT,
  case_manager_phone TEXT,
  county          TEXT,

  -- Timing
  move_in_timeline TEXT,  -- 'asap','1_2_weeks','1_month','3_months','exploring'
  urgency_score   INT CHECK (urgency_score BETWEEN 1 AND 5),
  tour_requested  BOOLEAN DEFAULT false,

  -- Pipeline
  status TEXT DEFAULT 'new_lead' CHECK (status IN (
    'new_lead','contacted','tour_scheduled','assessment_needed',
    'documents_pending','payment_review','approved',
    'move_in_scheduled','closed_not_fit'
  )),

  -- Admin
  is_fit          BOOLEAN,
  assigned_to     TEXT,
  consent_given   BOOLEAN DEFAULT false,
  notes           TEXT,
  tags            TEXT[],

  -- Automation tracking
  confirmation_sent   BOOLEAN DEFAULT false,
  admin_notified      BOOLEAN DEFAULT false,
  followup_email_sent BOOLEAN DEFAULT false,
  last_contact_at     TIMESTAMPTZ
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- DOCUMENTS TABLE
-- =============================================
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  doc_type    TEXT, -- 'id','insurance','physician_order','medication_list','face_sheet','poa','mnc_hoices','county_auth','other'
  file_url    TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','received','verified','missing'))
);

-- =============================================
-- TOURS TABLE
-- =============================================
CREATE TABLE tours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  duration_mins INT DEFAULT 60,
  tour_type     TEXT DEFAULT 'in_person', -- 'in_person','phone','video'
  status        TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TASKS TABLE
-- =============================================
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_at      TIMESTAMPTZ,
  completed   BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  assigned_to TEXT,
  priority    TEXT DEFAULT 'normal', -- 'low','normal','high','urgent'
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- NOTES TABLE
-- =============================================
CREATE TABLE notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  author      TEXT DEFAULT 'Admin',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- STATUS HISTORY TABLE
-- =============================================
CREATE TABLE status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT,
  changed_by  TEXT,
  changed_at  TIMESTAMPTZ DEFAULT now(),
  notes       TEXT
);

-- Auto-log status changes
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO status_history (lead_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, 'system');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_status_change
AFTER UPDATE OF status ON leads
FOR EACH ROW EXECUTE FUNCTION log_status_change();

-- =============================================
-- AUTOMATION EVENTS TABLE
-- =============================================
CREATE TABLE automation_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL, -- 'confirmation_email','admin_alert','followup_email','doc_reminder','priority_alert'
  status      TEXT DEFAULT 'pending', -- 'pending','sent','failed','skipped'
  triggered_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata    JSONB
);

-- =============================================
-- FACILITY SETTINGS TABLE
-- =============================================
CREATE TABLE facility_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_beds      INT DEFAULT 5,
  occupied_beds   INT DEFAULT 0,
  pending_beds    INT DEFAULT 0,
  license_number  TEXT,
  license_type    TEXT DEFAULT 'Assisted Living Facility',
  facility_name   TEXT DEFAULT 'Sygma House',
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  admin_email     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO facility_settings (id) VALUES (gen_random_uuid());

-- =============================================
-- ROW LEVEL SECURITY (for Supabase)
-- =============================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Admin-only policy (all authenticated users = admin for now)
CREATE POLICY "Admin full access" ON leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON tours FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON notes FOR ALL USING (auth.role() = 'authenticated');

-- Public insert-only for intake form (unauthenticated)
CREATE POLICY "Public can insert leads" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can insert automation events" ON automation_events FOR INSERT WITH CHECK (true);

-- =============================================
-- VIEWS
-- =============================================
CREATE VIEW lead_summary AS
SELECT
  l.id,
  l.family_name,
  l.resident_name,
  l.family_phone,
  l.family_email,
  l.payment_type,
  l.urgency_score,
  l.status,
  l.current_location,
  l.tour_requested,
  l.move_in_timeline,
  l.created_at,
  COUNT(DISTINCT t.id) AS task_count,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'pending') AS pending_docs
FROM leads l
LEFT JOIN tasks t ON t.lead_id = l.id AND NOT t.completed
LEFT JOIN documents d ON d.lead_id = l.id
GROUP BY l.id;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_urgency ON leads(urgency_score DESC);
CREATE INDEX idx_leads_payment ON leads(payment_type);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_tours_scheduled ON tours(scheduled_at);
CREATE INDEX idx_tasks_lead ON tasks(lead_id, completed);
