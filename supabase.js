const SUPABASE_URL = "https://lvrwupmqvcfcewvjjopr.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_t8hgHW7GuREWVA3oyVbhXg_53GSV4Dv";

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
