export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase server environment is not configured.');
  }
  return { url, key };
}

export async function supabaseInsert(table, payload, select = 'id') {
  const { url, key } = supabaseEnv();
  const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase insert failed for ${table}`);
  }

  return text ? JSON.parse(text) : null;
}

export function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}
