import { json, supabaseInsert } from './supabase-admin.js';

function normalizeAttribution(payload) {
  const attribution = payload?.attribution && typeof payload.attribution === 'object' ? payload.attribution : {};
  return {
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
    if (!payload?.name || !payload?.message) {
      return json(res, 400, { error: 'missing_required_fields' });
    }

    const messagePayload = {
      ...payload,
      ...normalizeAttribution(payload),
    };
    delete messagePayload.attribution;

    const rows = await supabaseInsert('messages', messagePayload, 'id');
    return json(res, 200, { ok: true, id: rows?.[0]?.id });
  } catch (error) {
    return json(res, 500, { error: 'message_failed', message: error.message });
  }
}
