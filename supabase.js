const SUPABASE_URL = "https://lvrwupmqvcfcewvjjopr.supabase.co";

// ضع الـ Publishable Key الجديد هنا
const SUPABASE_PUBLISHABLE_KEY = "ضع_المفتاح_هنا";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
