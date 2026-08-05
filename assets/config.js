/* Rutas Antiguas — backend configuration.
 *
 * Paste the two values from your own Supabase project here, then commit.
 * Supabase → Project Settings → Data API (URL) and API Keys (anon/publishable).
 *
 * The anon key is designed to be public — it ships in the browser on every
 * Supabase site. It is not a password. What actually protects your menu is the
 * row-level security policy in supabase-setup.sql: anyone may READ the menu,
 * only your signed-in operator account may WRITE it.
 *
 * Never put the service_role key here. That one bypasses every policy.
 *
 * Leave both blank and the app runs entirely on this device, reading the
 * committed tours.json — no backend, no live publishing.
 */
window.RA_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
