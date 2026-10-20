import { createClient } from "@supabase/supabase-js";

// These are public browser credentials. Row-level security is the actual access boundary.
// Never put a Supabase service-role/secret key in this module or any VITE_ variable.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://qmdxpvimryxwezqmjbge.supabase.co";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_Se0PBmOB7G4si686QDd6wA_x6e_UZ1S";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
