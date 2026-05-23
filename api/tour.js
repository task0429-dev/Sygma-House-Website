import { json, supabaseInsert } from './supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!payload?.visitor_name || !payload?.visitor_phone) {
      return json(res, 400, { error: 'missing_required_fields' });
    }

    const rows = await supabaseInsert('tours', payload, 'id');
    return json(res, 200, { ok: true, id: rows?.[0]?.id });
  } catch (error) {
    return json(res, 500, { error: 'tour_failed', message: error.message });
  }
}
