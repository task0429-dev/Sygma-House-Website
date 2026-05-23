const json = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    return json(res, 202, {
      synced: false,
      reason: 'google_calendar_oauth_not_configured',
    });
  }

  return json(res, 501, {
    synced: false,
    reason: 'calendar_sync_hook_ready_provider_not_implemented',
  });
}
