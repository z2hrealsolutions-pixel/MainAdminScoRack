import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced on screen too, in App.jsx, but this catches it immediately
  // in the browser console during local preview or a misconfigured deploy.
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in the Vercel project settings.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
