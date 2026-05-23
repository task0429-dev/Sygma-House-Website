import { json, supabaseInsert } from './supabase-admin.js';

function requireText(payload, key) {
  const value = payload?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAttribution(payload) {
  const attribution = payload?.attribution && typeof payload.attribution === 'object' ? payload.attribution : {};
  return {
    source: attribution.source || payload?.source || null,
    medium: attribution.medium || payload?.medium || null,
    campaign: attribution.campaign || payload?.campaign || null,
    landing_page: attribution.landing_page || payload?.landing_page || null,
    referrer: attribution.referrer || payload?.referrer || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const familyName = requireText(payload, 'family_name');
    const familyPhone = requireText(payload, 'family_phone');
    const familyEmail = requireText(payload, 'family_email');
    const residentName = requireText(payload, 'resident_name');

    if (!familyName || !familyPhone || !familyEmail || !residentName || payload?.consent_given !== true) {
      return json(res, 400, { error: 'missing_required_fields' });
    }

    const attribution = normalizeAttribution(payload);
    const leadPayload = {
      ...payload,
      ...attribution,
      tags: Array.from(new Set([
        ...(Array.isArray(payload.tags) ? payload.tags : []),
        attribution.source ? `source:${attribution.source}` : null,
        attribution.campaign ? `campaign:${attribution.campaign}` : null,
        payload.tour_requested ? 'tour_requested' : null,
      ].filter(Boolean))),
    };
    delete leadPayload.attribution;

    const leadRows = await supabaseInsert('leads', leadPayload, 'id');
    const leadId = leadRows?.[0]?.id;

    if (leadId && payload.tour_requested) {
      await supabaseInsert('tours', {
        lead_id: leadId,
        visitor_name: familyName,
        visitor_email: familyEmail,
        visitor_phone: familyPhone,
        resident_name: residentName,
        tour_type: 'in_person',
        status: 'requested',
        notes: 'Tour requested from intake form',
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        landing_page: attribution.landing_page,
      }, 'id');
    }

    if (leadId) {
      await supabaseInsert('tasks', {
        lead_id: leadId,
        title: `Follow up with ${familyName}`,
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: Number(payload.urgency_score) >= 4 ? 'urgent' : 'normal',
      }, 'id');
    }

    return json(res, 200, { ok: true, id: leadId });
  } catch (error) {
    return json(res, 500, { error: 'intake_failed', message: error.message });
  }
}
