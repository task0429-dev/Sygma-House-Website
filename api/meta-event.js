import crypto from 'crypto';
import { json } from './supabase-admin.js';

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0';

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

function sha256(value) {
  if (!value || typeof value !== 'string') return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function cleanObject(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    return json(res, 202, {
      sent: false,
      reason: 'meta_capi_not_configured',
    });
  }

  try {
    const payload = parseBody(req) || {};
    const eventName = typeof payload.event_name === 'string' ? payload.event_name.trim() : '';
    if (!eventName) return json(res, 400, { error: 'missing_event_name' });

    const userData = payload.user_data || {};
    const metaPayload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: payload.event_id || crypto.randomUUID(),
          action_source: payload.action_source || 'website',
          event_source_url: payload.event_source_url,
          user_data: cleanObject({
            em: sha256(userData.email),
            ph: sha256(userData.phone),
            client_user_agent: req.headers['user-agent'],
            client_ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
            fbp: userData.fbp,
            fbc: userData.fbc,
          }),
          custom_data: payload.custom_data || {},
        },
      ],
    };

    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaPayload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(res, 502, {
        sent: false,
        reason: 'meta_capi_error',
        error: result?.error?.message || 'Meta CAPI request failed',
      });
    }

    return json(res, 200, { sent: true, result });
  } catch (error) {
    return json(res, 500, { sent: false, error: 'meta_event_failed', message: error.message });
  }
}
