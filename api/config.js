export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    alertEmailEnabled: Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL),
    googleCalendarEnabled: Boolean(process.env.GOOGLE_CALENDAR_REFRESH_TOKEN),
  });
}
