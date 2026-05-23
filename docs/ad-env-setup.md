# Sygma House Ad Environment Setup

Add these to Vercel production when TASK is ready to activate live ad delivery.

## TikTok

```text
TIKTOK_PIXEL_ID=
TIKTOK_ACCESS_TOKEN=
```

Optional override:

```text
TIKTOK_EVENTS_URL=https://business-api.tiktok.com/open_api/v1.3/event/track/
```

## Snapchat

```text
SNAPCHAT_PIXEL_ID=
SNAPCHAT_ACCESS_TOKEN=
```

## Alerts

Email:

```text
RESEND_API_KEY=
ALERT_FROM_EMAIL=
ADMIN_EMAIL=
```

SMS:

```text
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
ADMIN_PHONE=
```

## Google Calendar

Already added:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Still required:

```text
GOOGLE_CALENDAR_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
```

## Production Test URLs

```text
https://www.sygmahouse.com/?landing=tour&utm_source=tiktok&utm_medium=paid_social&utm_campaign=launch
https://www.sygmahouse.com/?landing=tour&utm_source=snapchat&utm_medium=paid_social&utm_campaign=launch
```

## Event Names

```text
ViewContent
ScheduleTourStart
ScheduleTourSubmit
IntakeStart
IntakeSubmit
```
