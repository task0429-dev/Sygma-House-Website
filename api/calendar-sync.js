import { json, supabaseEnv } from './supabase-admin.js';

async function supabaseRequest(path, options = {}) {
  const { url, key } = supabaseEnv();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || 'Supabase request failed');
  return text ? JSON.parse(text) : null;
}

async function getGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error_description || result.error || 'Google OAuth token exchange failed');
  return result.access_token;
}

function buildCalendarEvent(tour) {
  const start = tour.scheduled_at
    ? new Date(tour.scheduled_at)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + (tour.duration_mins || 60) * 60 * 1000);

  return {
    summary: `Sygma House Tour - ${tour.visitor_name || 'Family'}`,
    description: [
      `Visitor: ${tour.visitor_name || ''}`,
      `Phone: ${tour.visitor_phone || ''}`,
      `Email: ${tour.visitor_email || ''}`,
      `Resident: ${tour.resident_name || ''}`,
      `Preferred time: ${tour.preferred_time || ''}`,
      '',
      tour.notes || '',
    ].join('\n').trim(),
    start: { dateTime: start.toISOString(), timeZone: 'America/Chicago' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Chicago' },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    return json(res, 202, {
      synced: false,
      reason: 'google_calendar_oauth_not_configured',
    });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const tourId = payload?.tourId || payload?.id;
    if (!tourId) return json(res, 400, { error: 'missing_tour_id' });

    const tours = await supabaseRequest(`tours?id=eq.${encodeURIComponent(tourId)}&select=*`);
    const tour = tours?.[0];
    if (!tour) return json(res, 404, { error: 'tour_not_found' });

    const accessToken = await getGoogleAccessToken();
    const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'primary');
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildCalendarEvent(tour)),
    });

    const event = await response.json().catch(() => ({}));
    if (!response.ok) {
      await supabaseRequest(`tours?id=eq.${encodeURIComponent(tourId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ calendar_sync_status: 'failed' }),
      });
      return json(res, 502, { synced: false, reason: 'google_calendar_error', error: event.error?.message || 'Google Calendar request failed' });
    }

    await supabaseRequest(`tours?id=eq.${encodeURIComponent(tourId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ google_event_id: event.id, calendar_sync_status: 'synced' }),
    });

    return json(res, 200, { synced: true, eventId: event.id });
  } catch (error) {
    return json(res, 500, { synced: false, error: 'calendar_sync_failed', message: error.message });
  }
}
