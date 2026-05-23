import crypto from 'crypto';
import { json } from './supabase-admin.js';

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

function mapSnapEvent(eventName) {
  const map = {
    ViewContent: 'VIEW_CONTENT',
    ScheduleTourStart: 'CUSTOM_EVENT_1',
    ScheduleTourSubmit: 'SIGN_UP',
    IntakeStart: 'CUSTOM_EVENT_2',
    IntakeSubmit: 'SIGN_UP',
  };
  return map[eventName] || 'CUSTOM_EVENT_3';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const pixelId = process.env.SNAPCHAT_PIXEL_ID;
  const accessToken = process.env.SNAPCHAT_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    return json(res, 202, {
      sent: false,
      reason: 'snapchat_capi_not_configured',
    });
  }

  try {
    const payload = parseBody(req) || {};
    const eventName = typeof payload.event_name === 'string' ? payload.event_name.trim() : '';
    if (!eventName) return json(res, 400, { error: 'missing_event_name' });

    const userData = payload.user_data || {};
    const snapPayload = {
      data: [
        {
          event_name: mapSnapEvent(eventName),
          event_time: Math.floor(Date.now() / 1000),
          event_id: payload.event_id || crypto.randomUUID(),
          action_source: 'WEB',
          event_source_url: payload.event_source_url,
          user_data: cleanObject({
            em: sha256(userData.email),
            ph: sha256(userData.phone),
            client_ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
            client_user_agent: req.headers['user-agent'],
            sc_click_id: userData.sc_click_id,
          }),
          custom_data: {
            ...payload.custom_data,
            original_event_name: eventName,
          },
        },
      ],
    };

    const response = await fetch(`https://tr.snapchat.com/v3/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapPayload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(res, 502, {
        sent: false,
        reason: 'snapchat_capi_error',
        error: result?.error?.message || result?.message || 'Snapchat CAPI request failed',
      });
    }

    return json(res, 200, { sent: true, result });
  } catch (error) {
    return json(res, 500, { sent: false, error: 'snapchat_event_failed', message: error.message });
  }
}
