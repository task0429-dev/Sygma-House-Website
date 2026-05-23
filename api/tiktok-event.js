import crypto from 'crypto';
import { json } from './supabase-admin.js';

const TIKTOK_EVENTS_URL = process.env.TIKTOK_EVENTS_URL || 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

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

function mapTikTokEvent(eventName) {
  const map = {
    ViewContent: 'ViewContent',
    ScheduleTourStart: 'ClickButton',
    ScheduleTourSubmit: 'SubmitForm',
    IntakeStart: 'ClickButton',
    IntakeSubmit: 'SubmitForm',
  };
  return map[eventName] || eventName;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const pixelCode = process.env.TIKTOK_PIXEL_ID;
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!pixelCode || !accessToken) {
    return json(res, 202, {
      sent: false,
      reason: 'tiktok_events_api_not_configured',
    });
  }

  try {
    const payload = parseBody(req) || {};
    const eventName = typeof payload.event_name === 'string' ? payload.event_name.trim() : '';
    if (!eventName) return json(res, 400, { error: 'missing_event_name' });

    const userData = payload.user_data || {};
    const eventPayload = {
      pixel_code: pixelCode,
      event: mapTikTokEvent(eventName),
      event_id: payload.event_id || crypto.randomUUID(),
      timestamp: Math.floor(Date.now() / 1000).toString(),
      context: {
        page: { url: payload.event_source_url },
        user: cleanObject({
          email: sha256(userData.email),
          phone_number: sha256(userData.phone),
          ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
          user_agent: req.headers['user-agent'],
          ttp: userData.ttp,
          ttclid: userData.ttclid,
        }),
      },
      properties: {
        ...payload.custom_data,
        original_event_name: eventName,
      },
    };

    const response = await fetch(TIKTOK_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_source: 'web', event_source_id: pixelCode, data: [eventPayload] }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.code) {
      return json(res, 502, {
        sent: false,
        reason: 'tiktok_events_api_error',
        error: result.message || result?.data?.message || 'TikTok Events API request failed',
      });
    }

    return json(res, 200, { sent: true, result });
  } catch (error) {
    return json(res, 500, { sent: false, error: 'tiktok_event_failed', message: error.message });
  }
}
