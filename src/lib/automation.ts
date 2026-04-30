/**
 * SYGMA HOUSE — AUTOMATION SERVICE LAYER
 * Handles all intake submission triggers, email flows, and task creation.
 * Swap placeholder functions with real providers (Resend, Twilio, etc.)
 */

export type PaymentType = 'private_pay' | 'medicaid_waiver' | 'unsure';
export type Timeline = 'asap' | '1_2_weeks' | '1_month' | '3_months' | 'exploring';
export type Location = 'home' | 'hospital' | 'rehab' | 'facility' | 'other';

export interface IntakeLead {
  id: string;
  family_name: string;
  family_email: string;
  family_phone: string;
  resident_name: string;
  payment_type: PaymentType;
  move_in_timeline: Timeline;
  current_location: Location;
  tour_requested: boolean;
  urgency_score: number;
  case_manager_name?: string;
  county?: string;
}

// ─────────────────────────────────────────────
// URGENCY SCORING
// ─────────────────────────────────────────────
export function calculateUrgency(
  timeline: Timeline,
  location: Location,
  payment: PaymentType
): number {
  const timelineScore: Record<Timeline, number> = {
    asap: 5,
    '1_2_weeks': 4,
    '1_month': 3,
    '3_months': 2,
    exploring: 1,
  };
  let score = timelineScore[timeline] ?? 1;
  if (location === 'hospital') score = Math.min(5, score + 2);
  if (location === 'rehab') score = Math.min(5, score + 1);
  if (payment === 'private_pay') score = Math.min(5, score + 1);
  return score;
}

// ─────────────────────────────────────────────
// MAIN TRIGGER: on intake submitted
// ─────────────────────────────────────────────
export async function onIntakeSubmitted(lead: IntakeLead): Promise<void> {
  console.log(`[Automation] Intake received for ${lead.resident_name}`);

  // 1. Send family confirmation
  await sendConfirmationEmail(lead);

  // 2. Notify admin
  await notifyAdmin(lead);

  // 3. Create 24hr follow-up task
  await createFollowUpTask(lead);

  // 4. Route by payment type
  switch (lead.payment_type) {
    case 'private_pay':
      await sendPrivatePayEmail(lead);
      break;
    case 'medicaid_waiver':
      await sendWaiverInfoEmail(lead);
      break;
    case 'unsure':
      await sendOptionsEducationEmail(lead);
      break;
  }

  // 5. Tour requested
  if (lead.tour_requested) {
    await createTourTask(lead);
    await sendTourRequestEmail(lead);
  }

  // 6. Hospital urgency escalation
  if (lead.current_location === 'hospital') {
    await escalateUrgent(lead, 'Hospital discharge pending — same-day contact needed');
  }

  // 7. High urgency alert
  if (lead.urgency_score >= 4) {
    await sendPriorityAlert(lead);
  }
}

// ─────────────────────────────────────────────
// EMAIL FUNCTIONS (plug in Resend/SendGrid)
// ─────────────────────────────────────────────

async function sendConfirmationEmail(lead: IntakeLead): Promise<void> {
  const subject = `We received your inquiry about Sygma House`;
  const body = `
Hi ${lead.family_name},

Thank you for reaching out to Sygma House. We've received your intake form
for ${lead.resident_name} and a member of our team will contact you within 24 hours.

What to expect:
${lead.tour_requested ? '• We will reach out to schedule your tour.\n' : ''}${
  lead.payment_type === 'medicaid_waiver'
    ? '• We will send information about the Medicaid waiver process.\n'
    : ''
}${
  lead.payment_type === 'private_pay'
    ? '• We will share information about our services and pricing.\n'
    : ''
}
If this is urgent, please call us directly at [PHONE PLACEHOLDER].

Warm regards,
Sygma House Team
`;
  await emailProvider({
    to: lead.family_email,
    subject,
    body,
    templateId: 'confirm_intake',
  });
}

async function sendPrivatePayEmail(lead: IntakeLead): Promise<void> {
  await emailProvider({
    to: lead.family_email,
    subject: 'Next Steps: Private Pay at Sygma House',
    templateId: 'private_pay_consult',
    data: { name: lead.family_name, resident: lead.resident_name },
  });
}

async function sendWaiverInfoEmail(lead: IntakeLead): Promise<void> {
  await emailProvider({
    to: lead.family_email,
    subject: 'Medicaid Waiver Information — Sygma House',
    templateId: 'waiver_info',
    data: {
      name: lead.family_name,
      resident: lead.resident_name,
      case_manager: lead.case_manager_name,
      county: lead.county,
    },
  });
}

async function sendOptionsEducationEmail(lead: IntakeLead): Promise<void> {
  await emailProvider({
    to: lead.family_email,
    subject: 'Understanding Your Payment Options — Sygma House',
    templateId: 'options_education',
    data: { name: lead.family_name },
  });
}

async function sendTourRequestEmail(lead: IntakeLead): Promise<void> {
  await emailProvider({
    to: lead.family_email,
    subject: 'Tour Request Received — Sygma House',
    templateId: 'tour_confirm',
    data: { name: lead.family_name, resident: lead.resident_name },
  });
}

async function notifyAdmin(lead: IntakeLead): Promise<void> {
  await emailProvider({
    to: process.env.ADMIN_EMAIL!,
    subject: `New Intake: ${lead.resident_name} [Urgency: ${lead.urgency_score}]`,
    templateId: 'admin_new_lead',
    data: lead,
  });
}

async function sendPriorityAlert(lead: IntakeLead): Promise<void> {
  await emailProvider({
    to: process.env.ADMIN_EMAIL!,
    subject: `🚨 PRIORITY LEAD: ${lead.resident_name} — Urgency ${lead.urgency_score}`,
    templateId: 'admin_priority_alert',
    data: lead,
  });
  // Optional: SMS alert via Twilio
  // await smsProvider({ to: process.env.ADMIN_PHONE, body: `URGENT intake: ${lead.resident_name}` });
}

// ─────────────────────────────────────────────
// TASK CREATION
// ─────────────────────────────────────────────
async function createFollowUpTask(lead: IntakeLead): Promise<void> {
  const due = new Date();
  due.setHours(due.getHours() + 24);
  await taskProvider({
    lead_id: lead.id,
    title: `Follow up with ${lead.family_name} — ${lead.family_phone}`,
    due_at: due.toISOString(),
    priority: lead.urgency_score >= 4 ? 'urgent' : 'normal',
  });
}

async function createTourTask(lead: IntakeLead): Promise<void> {
  const due = new Date();
  due.setHours(due.getHours() + 4);
  await taskProvider({
    lead_id: lead.id,
    title: `Schedule tour for ${lead.resident_name} — contact ${lead.family_name}`,
    due_at: due.toISOString(),
    priority: 'high',
  });
}

async function escalateUrgent(lead: IntakeLead, reason: string): Promise<void> {
  await taskProvider({
    lead_id: lead.id,
    title: `⚠️ SAME-DAY CONTACT: ${lead.resident_name} — ${reason}`,
    due_at: new Date().toISOString(),
    priority: 'urgent',
  });
}

// ─────────────────────────────────────────────
// SCHEDULED: Document reminder (run daily)
// ─────────────────────────────────────────────
export async function sendDocumentReminders(): Promise<void> {
  // Query leads in 'documents_pending' status for 3+ days
  // For each: send checklist email to family
  console.log('[Automation] Checking for document reminder candidates...');
  // Implementation: query Supabase, filter, send emails
}

// ─────────────────────────────────────────────
// SCHEDULED: No-response follow-up (run daily)
// ─────────────────────────────────────────────
export async function checkNoResponseLeads(): Promise<void> {
  // Query leads with last_contact_at > 48 hours ago, status not closed
  // Create internal follow-up reminder task for admin
  console.log('[Automation] Checking for no-response leads...');
}

// ─────────────────────────────────────────────
// PROVIDER STUBS (swap with real integrations)
// ─────────────────────────────────────────────

interface EmailParams {
  to: string;
  subject: string;
  body?: string;
  templateId: string;
  data?: Record<string, unknown>;
}

async function emailProvider(params: EmailParams): Promise<void> {
  // SWAP WITH: Resend, SendGrid, Postmark, etc.
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({ from: 'Sygma House <hello@sygmahouse.com>', ...params });
  console.log(`[Email Placeholder] → ${params.to} | ${params.subject}`);
}

interface TaskParams {
  lead_id: string;
  title: string;
  due_at: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

async function taskProvider(params: TaskParams): Promise<void> {
  // SWAP WITH: Supabase insert to tasks table
  // const { error } = await supabase.from('tasks').insert(params);
  console.log(`[Task Placeholder] Created: ${params.title}`);
}

// SMS placeholder
// async function smsProvider(params: { to: string; body: string }): Promise<void> {
//   // SWAP WITH: Twilio, etc.
//   console.log(`[SMS Placeholder] → ${params.to}: ${params.body}`);
// }
