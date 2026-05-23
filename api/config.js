export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    alertEmailEnabled: Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL),
    alertSmsEnabled: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.ADMIN_PHONE
    ),
    googleCalendarEnabled: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
    ),
    metaPixelId: process.env.META_PIXEL_ID || '',
    metaPixelEnabled: Boolean(process.env.META_PIXEL_ID),
    metaCapiEnabled: Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN),
  });
}
