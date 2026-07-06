// Paste your Supabase project URL here.
const SUPABASE_URL = "https://sljpfoukaevwrjhdzvkd.supabase.co";

// Paste your public anon/publishable key here.
// Do not use a service role key in this static frontend.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsanBmb3VrYWV2d3JqaGR6dmtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzQ0MzEsImV4cCI6MjA5ODgxMDQzMX0.j_9JGvY6igezZ14TFQ6F8PaXxbqKt2QUIY8cT1BJAnY";

window.BOOKLIST_SUPABASE_BOOT_ERROR = null;
window.supabaseClient = null;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  window.BOOKLIST_SUPABASE_BOOT_ERROR = "Missing Supabase URL or anon key in supabase-config.js.";
} else if (!window.supabase || typeof window.supabase.createClient !== "function") {
  window.BOOKLIST_SUPABASE_BOOT_ERROR =
    "The Supabase browser library did not load. If you are opening the site from file://, make sure your browser can still reach the CDN script.";
} else {
  try {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    window.BOOKLIST_SUPABASE_BOOT_ERROR = error && error.message
      ? error.message
      : "Supabase could not be initialized.";
  }
}
