import { createClient } from '@supabase/supabase-js';

// Public by design (data is protected by RLS). The fallback covers hosts without env settings, like AI Studio.
const PUBLIC_SUPABASE_URL = 'https://arnezevjcmcwgusluzvv.supabase.co';
const PUBLIC_SUPABASE_KEY = 'sb_publishable_-iOmG5v3yqHThyV_YCbf0w_syIyJBez';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || PUBLIC_SUPABASE_URL;
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || PUBLIC_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true }
});
