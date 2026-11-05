import { createClient } from '@supabase/supabase-js';

/**
 * Validates the Supabase access token from the Authorization header.
 * Returns the user id, or null when the caller is not signed in.
 */
export async function requireUser(authorization: string | undefined): Promise<string | null> {
  // Read at call time: the dev server loads .env after imports are evaluated.
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase no está configurado en el servidor.');
  const token = (authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
