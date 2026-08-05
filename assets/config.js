/* Rutas Antiguas — backend configuration.
 *
 * From your own Supabase project:
 *   Project Settings → Data API   → Project URL
 *   Project Settings → API Keys   → anon / publishable key
 *
 * The URL is the project root only. Do not include /rest/v1 — the app appends
 * /rest/v1 and /auth/v1 itself. (A pasted suffix is stripped in cloud.js, but
 * keep this clean so it reads correctly.)
 *
 * The publishable key is designed to be public — it ships in the browser on
 * every Supabase site and it is not a password. What actually protects the menu
 * is the row-level security policy in supabase-setup.sql: anyone may READ it,
 * only a signed-in operator may WRITE it.
 *
 * Never put the service_role or secret key here. Those bypass every policy.
 *
 * Leave both blank and the app runs entirely on the device from tours.json.
 */
window.RA_CONFIG = {
  supabaseUrl: 'https://bvypdrfphrwalhncffbk.supabase.co',
  supabaseAnonKey: 'sb_publishable_-NofadU_H3uC7YKfKLdmBw_MohppwJD'
};
