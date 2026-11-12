import type { IncomingMessage, ServerResponse } from 'http';

type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

// Public by design, same values the web app ships with.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://arnezevjcmcwgusluzvv.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_-iOmG5v3yqHThyV_YCbf0w_syIyJBez';

// Called once a day by the Vercel cron (vercel.json) so the free Supabase plan does not pause the project.
export default async function handler(_req: IncomingMessage, res: VercelResponse) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/keepalive`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: '{}'
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, database: r.status });
  } catch {
    res.status(502).json({ ok: false });
  }
}
