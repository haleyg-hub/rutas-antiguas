/* Rutas Antiguas — Supabase transport.
 *
 * A small hand-rolled client over Supabase's HTTP APIs (GoTrue for auth,
 * PostgREST for data). No SDK and no CDN script, so the app stays a set of
 * static files with nothing to build and nothing to go stale.
 *
 * The whole menu is one row: menu.data holds { settings, tours } — exactly the
 * shape Export produces, so the file and the database stay interchangeable.
 */
window.RA_CLOUD = (function () {
  'use strict';

  var cfg = window.RA_CONFIG || {};
  var AUTH_KEY = 'rutasantiguas.auth.v1';
  var session = null;

  try { session = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { session = null; }

  function configured() {
    return !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  /* The project root only — the API paths are appended below. Supabase's
   * dashboard shows the URL with /rest/v1 attached, so tolerate a pasted
   * suffix rather than failing with an opaque 404. */
  function base() {
    return String(cfg.supabaseUrl)
      .replace(/\/+$/, '')
      .replace(/\/(rest|auth)\/v1$/, '')
      .replace(/\/+$/, '');
  }

  function user() {
    return session && session.user ? session.user : null;
  }

  function email() {
    var u = user();
    return u ? u.email : null;
  }

  function persist(s) {
    session = s;
    try {
      if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
      else localStorage.removeItem(AUTH_KEY);
    } catch (e) { /* private mode — session lives for this tab only */ }
  }

  /* GoTrue returns messages under different keys depending on the failure. */
  function errorFrom(body, res) {
    var msg = body && (body.error_description || body.msg || body.message || body.error || body.hint);
    if (!msg && res) msg = 'Request failed (' + res.status + ')';
    return new Error(msg || 'Request failed');
  }

  function readBody(res) {
    return res.text().then(function (text) {
      if (!text) return null;
      try { return JSON.parse(text); } catch (e) { return { message: text }; }
    });
  }

  function signIn(mail, password) {
    if (!configured()) return Promise.reject(new Error('No backend configured'));
    return fetch(base() + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail, password: password })
    }).then(function (res) {
      return readBody(res).then(function (body) {
        if (!res.ok || !body || !body.access_token) throw errorFrom(body, res);
        persist({
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          expires_at: body.expires_at || (Math.floor(Date.now() / 1000) + (body.expires_in || 3600)),
          user: body.user || null
        });
        return user();
      });
    });
  }

  function signOut() {
    var had = session;
    persist(null);
    if (!had || !configured()) return Promise.resolve();
    // Best effort — the local session is already gone either way.
    return fetch(base() + '/auth/v1/logout', {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + had.access_token }
    }).catch(function () {}).then(function () {});
  }

  function refresh() {
    if (!session || !session.refresh_token) return Promise.reject(new Error('Signed out'));
    return fetch(base() + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (res) {
      return readBody(res).then(function (body) {
        if (!res.ok || !body || !body.access_token) { persist(null); throw errorFrom(body, res); }
        persist({
          access_token: body.access_token,
          refresh_token: body.refresh_token || session.refresh_token,
          expires_at: body.expires_at || (Math.floor(Date.now() / 1000) + (body.expires_in || 3600)),
          user: body.user || session.user
        });
        return session;
      });
    });
  }

  /* Access tokens last an hour. Refresh a minute early rather than letting a
   * save fail and asking the operator to sign in again mid-edit. */
  function withFreshToken() {
    if (!session) return Promise.resolve(null);
    var now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at - 60 > now) return Promise.resolve(session);
    return refresh().catch(function () { return null; });
  }

  function rest(path, options, authed) {
    var opts = options || {};
    var run = function (sess) {
      /* Anonymous requests still carry the publishable key as the bearer token.
       * Legacy anon keys are JWTs that PostgREST can fall back on; the newer
       * sb_publishable_* keys are not, and are resolved at the gateway — which
       * only happens when the header is present. Sending it either way matches
       * what supabase-js does and works with both key formats. */
      var headers = {
        apikey: cfg.supabaseAnonKey,
        Authorization: 'Bearer ' + ((sess && sess.access_token) || cfg.supabaseAnonKey),
        'Content-Type': 'application/json'
      };
      if (opts.prefer) headers.Prefer = opts.prefer;
      return fetch(base() + '/rest/v1' + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store'
      }).then(function (res) {
        return readBody(res).then(function (body) {
          if (!res.ok) throw errorFrom(body, res);
          return body;
        });
      });
    };
    return authed ? withFreshToken().then(run) : run(null);
  }

  /* Guests read anonymously; the operator reads with their token so the same
   * call works either way. Returns null when the menu row doesn't exist yet. */
  function fetchMenu() {
    if (!configured()) return Promise.resolve(null);
    return rest('/menu?select=data,updated_at&id=eq.1', {}, !!session)
      .then(function (rows) {
        if (!rows || !rows.length || !rows[0].data) return null;
        var payload = rows[0].data;
        payload.updated_at = rows[0].updated_at;
        return payload;
      });
  }

  function saveMenu(payload) {
    if (!configured()) return Promise.reject(new Error('No backend configured'));
    if (!session) return Promise.reject(new Error('Signed out'));
    return rest('/menu', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: [{ id: 1, data: payload, updated_at: new Date().toISOString() }]
    }, true).then(function (rows) {
      return rows && rows[0] ? rows[0].updated_at : null;
    });
  }

  return {
    configured: configured,
    user: user,
    email: email,
    signIn: signIn,
    signOut: signOut,
    fetchMenu: fetchMenu,
    saveMenu: saveMenu
  };
})();
