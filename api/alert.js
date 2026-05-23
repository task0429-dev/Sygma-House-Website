const json = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
};

async function sendResendEmail(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) {
    return { sent: false, reason: 'email_provider_not_configured' };
  }

  const subject = payload.subject || 'Sygma House admin alert';
  const lines = [
    payload.title || subject,
    '',
    payload.summary || '',
    '',
    payload.details ? JSON.stringify(payload.details, null, 2) : '',
  ].filter(Boolean);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.ALERT_FROM_EMAIL || 'Sygma House <onboarding@resend.dev>',
      to: adminEmail,
      subject,
      text: lines.join('\n'),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { sent: false, reason: 'email_provider_error', error: errorText };
  }

  return { sent: true };
}

async function sendTwilioSms(payload) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.ADMIN_PHONE;

  if (!accountSid || !authToken || !from || !to) {
    return { sent: false, reason: 'sms_provider_not_configured' };
  }

  const message = [
    payload.title || payload.subject || 'New Sygma House alert',
    payload.summary || '',
  ].filter(Boolean).join(' - ').slice(0, 1200);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: message }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { sent: false, reason: 'sms_provider_error', error: errorText };
  }

  return { sent: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!payload || typeof payload !== 'object') {
      return json(res, 400, { error: 'invalid_payload' });
    }

    const [email, sms] = await Promise.all([
      sendResendEmail(payload),
      sendTwilioSms(payload),
    ]);
    return json(res, 200, { email, sms, sent: Boolean(email.sent || sms.sent) });
  } catch (error) {
    return json(res, 500, { error: 'alert_failed', message: error.message });
  }
}
