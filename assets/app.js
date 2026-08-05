/* Rutas Antiguas — Build Your Own Tour
 * Vanilla JS, no dependencies, no backend.
 *
 * Two audiences share one page:
 *   Guests  — browse the menu, add any combination of experiences, get a timed itinerary.
 *   Operator — edit that menu from a phone (⚙), then Export to publish for everyone.
 *
 * Menu edits live in this browser's localStorage. tours.json in the repo is the
 * "published" menu: the seed for first-time visitors and the target of Export.
 */
(function () {
  'use strict';

  var STORE_KEY = 'rutasantiguas.v1';

  /* Mirrors tours.json so the app still works opened straight from a file,
   * where fetch() of a local path is blocked. */
  var FALLBACK = {
    settings: {
      operator: 'Rutas Antiguas',
      tagline: 'Luxury private tours',
      currencySymbol: '$',
      contactEmail: '',
      whatsapp: '',
      bufferMin: 30,
      dayStart: '09:00',
      adminPin: ''
    },
    tours: []
  };

  var CLOUD = window.RA_CLOUD;
  var I18N = window.RA_I18N;

  /* Named L, not t — `t` is used throughout as a tour variable and shadowing it
   * inside those loops would silently break every translated string. */
  function L(key, vars) { return I18N.t(key, vars); }
  function dayShort() { return I18N.days('short'); }
  function dayPlural() { return I18N.days('plural'); }

  var state = null;
  var view = 'menu';
  var filter = 'All';
  var adminUnlocked = false;
  var published = null;      // last known tours.json, for "Reset to published"
  var liveMenu = false;      // true once the menu has been read from Supabase
  var lastSeenAt = null;     // updated_at of the menu revision we hold

  /* ══════════════════════════ utilities ══════════════════════════ */

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tour';
  }

  function toMin(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  function toHHMM(min) {
    var m = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  function clockLabel(min) {
    var m = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mi = m % 60;
    var ap = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    var next = min >= 1440 ? ' +1' : '';
    return h12 + ':' + String(mi).padStart(2, '0') + ' ' + ap + next;
  }

  function durLabel(min) {
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + 'm';
    return h + 'h' + (m ? ' ' + m + 'm' : '');
  }

  function money(n) {
    var sym = state.settings.currencySymbol || '$';
    var v = Math.round(Number(n) || 0);
    return sym + v.toLocaleString(I18N.locale());
  }

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* Weekday of a YYYY-MM-DD string, read as a local date (not UTC). */
  function weekdayOf(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]).getDay();
  }

  function dateLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return L('txt.dateTBC');
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(I18N.locale(), {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  /* ══════════════════════════ model ══════════════════════════ */

  /* Operator-written translations. English is the base record, so only the
   * other languages are stored, and only fields actually filled in. */
  function normaliseI18n(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    I18N.available.forEach(function (lang) {
      if (lang === 'en' || !raw[lang]) return;
      var v = raw[lang], entry = {};
      ['name', 'blurb', 'details', 'category', 'meetingPoint'].forEach(function (k) {
        if (typeof v[k] === 'string' && v[k].trim()) entry[k] = v[k].trim();
      });
      if (Array.isArray(v.includes)) {
        var inc = v.includes.filter(Boolean);
        if (inc.length) entry.includes = inc;
      }
      if (Object.keys(entry).length) out[lang] = entry;
    });
    return out;
  }

  /* The guest's language when the operator has written it, the original
   * otherwise. Nothing here is ever machine-translated. */
  function tf(tour, field) {
    var alt = tour.i18n && tour.i18n[I18N.get()];
    var v = alt && alt[field];
    if (v == null || v === '') return tour[field];
    if (Array.isArray(v) && !v.length) return tour[field];
    return v;
  }

  function normaliseTour(t) {
    t = t || {};
    return {
      id: t.id || uid(),
      name: t.name || 'Untitled tour',
      blurb: t.blurb || '',
      details: t.details || '',
      category: t.category || 'Experiences',
      emoji: t.emoji || '🧭',
      durationMin: Math.max(15, Number(t.durationMin) || 120),
      price: Math.max(0, Number(t.price) || 0),
      priceUnit: t.priceUnit === 'group' ? 'group' : 'person',
      minGuests: Math.max(1, Number(t.minGuests) || 1),
      maxGuests: Math.max(1, Number(t.maxGuests) || 12),
      days: Array.isArray(t.days) && t.days.length ? t.days.map(Number) : [0, 1, 2, 3, 4, 5, 6],
      startTimes: (Array.isArray(t.startTimes) ? t.startTimes : []).filter(function (x) { return toMin(x) !== null; }),
      meetingPoint: t.meetingPoint || '',
      includes: Array.isArray(t.includes) ? t.includes.filter(Boolean) : [],
      i18n: normaliseI18n(t.i18n),
      active: t.active !== false
    };
  }

  function normalise(raw) {
    raw = raw || {};
    var s = Object.assign({}, FALLBACK.settings, raw.settings || {});
    s.bufferMin = Math.max(0, Number(s.bufferMin) || 0);
    if (toMin(s.dayStart) === null) s.dayStart = '09:00';
    return {
      settings: s,
      tours: (Array.isArray(raw.tours) ? raw.tours : []).map(normaliseTour)
    };
  }

  function blankForm() {
    return { name: '', phone: '', email: '', message: '' };
  }

  function blankPlan() {
    return { date: todayISO(), guests: 2, start: null, items: [], form: blankForm() };
  }

  /* ══════════════════════════ enquiry form ══════════════════════════ */

  var DISCLAIMER = 'NO TOUR BOOKED UNTIL CONFIRMED BY OUR AGENCY — ' +
                   'WE WILL CONTACT YOU DIRECTLY TO CONFIRM.';

  /* One definition, rendered in both the Contact page and the itinerary, so the
   * two can never drift apart in fields or validation. */
  function formHTML(p, v, messageLabel, messagePlaceholder) {
    v = v || blankForm();
    return '' +
      '<label class="field"><span>' + L('form.name') + ' <i>' + L('form.required') + '</i></span>' +
        '<input type="text" id="' + p + 'Name" autocomplete="name" value="' + esc(v.name) + '" placeholder="' + esc(L('form.namePh')) + '" /></label>' +
      '<label class="field"><span>' + L('form.phone') + ' <i>' + L('form.required') + '</i></span>' +
        '<input type="tel" id="' + p + 'Phone" autocomplete="tel" inputmode="tel" value="' + esc(v.phone) + '" placeholder="' + esc(L('form.phonePh')) + '" /></label>' +
      '<label class="field"><span>' + L('form.email') + ' <i>' + L('form.required') + '</i></span>' +
        '<input type="email" id="' + p + 'Email" autocomplete="email" inputmode="email" value="' + esc(v.email) + '" placeholder="' + esc(L('form.emailPh')) + '" /></label>' +
      '<label class="field"><span>' + esc(messageLabel) + ' <i>' + L('form.required') + '</i></span>' +
        '<textarea id="' + p + 'Message" rows="4" placeholder="' + esc(messagePlaceholder) + '">' + esc(v.message) + '</textarea></label>';
  }

  function readForm(p) {
    return {
      name: ($(p + 'Name') || {}).value ? $(p + 'Name').value.trim() : '',
      phone: ($(p + 'Phone') || {}).value ? $(p + 'Phone').value.trim() : '',
      email: ($(p + 'Email') || {}).value ? $(p + 'Email').value.trim() : '',
      message: ($(p + 'Message') || {}).value ? $(p + 'Message').value.trim() : ''
    };
  }

  /* All four are required. Phone and email are both checked because either one
   * may be the only way back to a guest whose other detail was mistyped. */
  function formErrors(v) {
    var errs = [];
    if (!v.name) errs.push({ key: 'Name', msg: L('err.name') });
    if (!v.phone) errs.push({ key: 'Phone', msg: L('err.phone') });
    else if ((v.phone.replace(/\D/g, '') || '').length < 7) errs.push({ key: 'Phone', msg: L('err.phoneShort') });
    if (!v.email) errs.push({ key: 'Email', msg: L('err.email') });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errs.push({ key: 'Email', msg: L('err.emailBad') });
    if (!v.message) errs.push({ key: 'Message', msg: L('err.message') });
    else if (v.message.length > 4000) errs.push({ key: 'Message', msg: L('err.messageLong') });
    return errs;
  }

  function markErrors(p, errs) {
    ['Name', 'Phone', 'Email', 'Message'].forEach(function (k) {
      var el = $(p + k);
      if (el) el.classList.remove('is-bad');
    });
    errs.forEach(function (e) {
      var el = $(p + e.key);
      if (el) el.classList.add('is-bad');
    });
    if (errs.length) {
      var first = $(p + errs[0].key);
      if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
  }

  function tourById(id) {
    for (var i = 0; i < state.tours.length; i++) if (state.tours[i].id === id) return state.tours[i];
    return null;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        settings: state.settings, tours: state.tours, plan: state.plan, contact: state.contact
      }));
    } catch (e) { /* private mode / quota — the session still works, it just won't persist */ }
  }

  function menuPayload() {
    return { version: 1, settings: state.settings, tours: state.tours };
  }

  /* Every menu change goes through here: keep it locally so the operator never
   * loses an edit, then push it live. A failed push is reported, not swallowed —
   * silently keeping a change that guests can't see is the worst outcome. */
  function publish(what) {
    save();
    render();
    if (!CLOUD.configured()) { toast(what + ' · this device only'); return; }
    if (!CLOUD.user()) { toast(what + ' · sign in to publish'); return; }
    toast(what + ' · publishing…');
    CLOUD.saveMenu(menuPayload()).then(function (at) {
      lastSeenAt = at;
      toast(what + ' · live for guests');
      renderCloudStatus();
    }, function (err) {
      toast('Saved on this phone, but publishing failed: ' + err.message);
      renderCloudStatus();
    });
  }

  /* ══════════════════════════ scheduling ══════════════════════════ */

  function sortedTimes(tour) {
    return tour.startTimes.map(toMin).sort(function (a, b) { return a - b; });
  }

  /* Lay the chosen experiences out along the day, back to back, with a travel
   * buffer between them. A tour that only runs at fixed times waits for its next
   * departure; if none is left that day, it's flagged rather than silently moved.
   *
   * The requested start time is a preference, not a constraint: if the first stop
   * only departs before it, the day is pulled earlier to meet that departure —
   * otherwise a 7am market breakfast would strand the whole itinerary. */
  function buildSchedule() {
    var plan = state.plan;
    var buffer = state.settings.bufferMin;
    var weekday = weekdayOf(plan.date);
    var legs = [];

    var cursor = toMin(plan.start || state.settings.dayStart);
    if (cursor === null) cursor = 540;

    var opener = plan.items.length ? tourById(plan.items[0].tourId) : null;
    var pulledTo = null;
    if (opener && opener.startTimes.length) {
      var open = sortedTimes(opener);
      if (open[open.length - 1] < cursor) {
        // Every departure is earlier than requested — take the closest one.
        pulledTo = open[open.length - 1];
        cursor = pulledTo;
      }
    }

    plan.items.forEach(function (item, i) {
      var tour = tourById(item.tourId);
      if (!tour) return;
      var warnings = [];
      var notes = [];
      var start = cursor;

      if (i === 0 && pulledTo !== null) {
        notes.push(L('note.dayStarts', { time: clockLabel(pulledTo) }));
      }

      if (tour.startTimes.length) {
        var times = sortedTimes(tour);
        var next = null;
        for (var k = 0; k < times.length; k++) {
          if (times[k] >= cursor) { next = times[k]; break; }
        }
        if (next === null) {
          warnings.push(L('warn.noDeparture', { times: times.map(clockLabel).join(' / ') }));
        } else {
          if (next > cursor && i > 0) {
            notes.push(L('note.waits', { dur: durLabel(next - cursor), time: clockLabel(next) }));
          }
          start = next;
        }
      }

      if (weekday !== null && tour.days.indexOf(weekday) === -1) {
        warnings.push(L('warn.notOffered', { day: dayPlural()[weekday] }));
      }
      if (plan.guests > tour.maxGuests) {
        warnings.push(L('warn.maxGuests', { n: tour.maxGuests }));
      }
      if (plan.guests < tour.minGuests) {
        warnings.push(L('warn.minGuests', { n: tour.minGuests }));
      }

      var end = start + tour.durationMin;
      legs.push({ item: item, tour: tour, start: start, end: end, warnings: warnings, notes: notes });
      cursor = end + buffer;
    });

    var totalPrice = legs.reduce(function (sum, l) {
      return sum + (l.tour.priceUnit === 'group' ? l.tour.price : l.tour.price * plan.guests);
    }, 0);
    var totalDur = legs.reduce(function (sum, l) { return sum + l.tour.durationMin; }, 0);

    return {
      legs: legs,
      total: totalPrice,
      duration: totalDur,
      startsAt: legs.length ? legs[0].start : null,
      endsAt: legs.length ? legs[legs.length - 1].end : null,
      warnCount: legs.reduce(function (n, l) { return n + l.warnings.length; }, 0)
    };
  }

  /* ══════════════════════════ rendering ══════════════════════════ */

  function render() {
    I18N.applyStatic();
    var langBtn = $('langBtn');
    if (langBtn) langBtn.textContent = I18N.get().toUpperCase();

    $('brandName').textContent = state.settings.operator || 'Rutas Antiguas';
    $('brandTagline').textContent = state.settings.tagline || '';
    document.title = (state.settings.operator || 'Rutas Antiguas') + ' — Build Your Own Tour';

    ['menu', 'plan', 'contact', 'admin'].forEach(function (v) { $('view-' + v).hidden = v !== view; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('is-active', t.dataset.view === view);
    });
    $('adminTab').hidden = !adminUnlocked;

    var count = state.plan.items.length;
    var badge = $('tabBadge');
    badge.hidden = count === 0;
    badge.textContent = count;

    if (view === 'menu') renderMenu();
    if (view === 'plan') renderPlan();
    if (view === 'contact') renderContact();
    if (view === 'admin') renderAdmin();
  }

  function renderMenu() {
    var live = state.tours.filter(function (t) { return t.active; });
    var cats = [L('filter.all')];
    live.forEach(function (t) {
      var c = tf(t, 'category');
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    if (cats.indexOf(filter) === -1) filter = cats[0];

    $('filters').innerHTML = cats.map(function (c) {
      return '<button class="chip' + (c === filter ? ' is-on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');

    var shown = live.filter(function (t) { return filter === L('filter.all') || tf(t, 'category') === filter; });
    $('menuEmpty').hidden = live.length !== 0;

    var counts = {};
    state.plan.items.forEach(function (it) { counts[it.tourId] = (counts[it.tourId] || 0) + 1; });

    renderInstall();

    $('tourGrid').innerHTML = shown.map(function (t) {
      var n = counts[t.id] || 0;
      var priceLine = money(t.price) +
        ' <small>' + L(t.priceUnit === 'group' ? 'price.perGroup' : 'price.perGuest') + '</small>';
      return '' +
        '<article class="tour-card">' +
          '<div class="tc-top" data-detail="' + esc(t.id) + '" role="button" tabindex="0">' +
            '<div class="tc-emoji">' + esc(t.emoji) + '</div>' +
            '<div class="tc-head">' +
              '<div class="tc-cat">' + esc(tf(t, 'category')) + '</div>' +
              '<div class="tc-name">' + esc(tf(t, 'name')) + '</div>' +
              '<p class="tc-blurb">' + esc(tf(t, 'blurb')) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="tc-meta">' +
            '<span>◷ ' + durLabel(t.durationMin) + '</span>' +
            '<span>· ' + (t.days.length === 7 ? L('common.daily') : t.days.map(function (d) { return dayShort()[d]; }).join(' ')) + '</span>' +
            (t.startTimes.length ? '<span>· ' + t.startTimes.map(function (s) { return clockLabel(toMin(s)); }).join(', ') + '</span>' : '') +
          '</div>' +
          '<div class="tc-foot">' +
            '<div class="tc-price">' + priceLine + '</div>' +
            (n
              ? '<div class="qty"><button data-dec="' + esc(t.id) + '" aria-label="Remove one">−</button>' +
                '<span>' + n + '</span>' +
                '<button data-add="' + esc(t.id) + '" aria-label="Add another">+</button></div>'
              : '<button class="btn primary small" data-add="' + esc(t.id) + '">' + L('common.add') + '</button>') +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* Never rewrite a field the guest is currently typing in — it would fight the
   * caret and, on a number input, snap a half-typed value back to its minimum. */
  function setValue(id, value) {
    var el = $(id);
    if (document.activeElement !== el) el.value = value;
  }

  /* ══════════════════════════ add to home screen ══════════════════════════ */

  var INSTALL_KEY = 'rutasantiguas.install.v1';
  var deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  /* iPadOS reports itself as MacIntel, so touch points are the reliable tell. */
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function installDismissed() {
    try { return localStorage.getItem(INSTALL_KEY) === 'dismissed'; } catch (e) { return false; }
  }

  /* Chrome hands us a prompt we can fire ourselves. Safari has no such API, so
   * iOS gets the manual instructions instead of a button that cannot work. */
  function renderInstall() {
    var card = $('installCard');
    if (!card) return;

    if (isStandalone() || installDismissed()) { card.hidden = true; return; }

    if (deferredPrompt) {
      $('installNote').textContent = L('install.chrome');
      $('installRow').innerHTML = '<button class="btn primary" id="installGo">' + L('install.button') + '</button>';
      card.hidden = false;
      return;
    }

    if (isIOS()) {
      $('installNote').innerHTML = L('install.ios');
      $('installRow').innerHTML = '';
      card.hidden = false;
      return;
    }

    card.hidden = true;
  }

  function renderPlan() {
    var plan = state.plan;
    setValue('planDate', plan.date);
    setValue('planGuests', plan.guests);
    setValue('planStart', plan.start || state.settings.dayStart);


    var has = plan.items.length > 0;
    $('planEmpty').hidden = has;
    $('planSummary').hidden = !has;
    $('requestPanel').hidden = !has;

    if (!has) {
      $('planItems').innerHTML = '';
      $('sendRow').innerHTML = '';
      $('bookingFormHost').innerHTML = '';
      return;
    }

    // Rebuilding the form would wipe what the guest is typing, so build it once
    // and leave it alone until the itinerary is emptied.
    if (!$('bookingFormHost').firstChild) {
      $('bookingFormHost').innerHTML = formHTML('bk', state.plan.form,
        L('form.message'), L('form.messagePhBooking'));
    }

    var sched = buildSchedule();

    $('planItems').innerHTML = sched.legs.map(function (leg, i) {
      var t = leg.tour;
      var per = t.priceUnit === 'group'
        ? money(t.price) + ' ' + L('price.perGroup')
        : L('plan.perLine', { amount: money(t.price), guests: plan.guests, total: money(t.price * plan.guests) });
      return '' +
        '<div class="leg">' +
          '<div class="leg-rail">' +
            '<div class="leg-time">' + clockLabel(leg.start) + '</div>' +
            '<div class="leg-end">to ' + clockLabel(leg.end) + '</div>' +
          '</div>' +
          '<div class="leg-card">' +
            '<h3 class="leg-name">' + esc(t.emoji) + ' ' + esc(tf(t, 'name')) + '</h3>' +
            '<p class="leg-sub">' + durLabel(t.durationMin) + ' · ' + per +
              (tf(t, 'meetingPoint') ? ' · ' + esc(tf(t, 'meetingPoint')) : '') + '</p>' +
            leg.notes.map(function (n) { return '<span class="note">' + esc(n) + '</span>'; }).join('') +
            leg.warnings.map(function (w) { return '<span class="warn">' + esc(w) + '</span>'; }).join('') +
            '<div class="leg-actions">' +
              '<button class="btn small" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="' + esc(L('plan.moveEarlier')) + '">↑</button>' +
              '<button class="btn small" data-down="' + i + '"' + (i === sched.legs.length - 1 ? ' disabled' : '') + ' aria-label="' + esc(L('plan.moveLater')) + '">↓</button>' +
              '<span class="spacer"></span>' +
              '<button class="btn small danger" data-drop="' + esc(leg.item.uid) + '">' + L('common.remove') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    $('sumCount').textContent = sched.legs.length;
    $('sumDuration').textContent = durLabel(sched.duration);
    $('sumWindow').textContent = sched.startsAt === null ? '—'
      : clockLabel(sched.startsAt) + ' – ' + clockLabel(sched.endsAt);
    $('sumTotal').textContent = money(sched.total);

    $('sendRow').innerHTML = sendButtons('bk', 'bookingHint', 'booking');
  }

  function renderCloudStatus() {
    var el = $('cloudStatus');
    if (!el) return;

    if (!CLOUD.configured()) {
      el.className = 'panel status is-local';
      el.innerHTML = '<strong>This device only</strong>' +
        '<p class="fineprint">No backend is configured, so edits stay on this phone. ' +
        'Add your Supabase keys to <code>assets/config.js</code> to publish instantly. ' +
        'Until then, use Export below.</p>';
      return;
    }

    var who = CLOUD.email();
    if (!who) {
      el.className = 'panel status is-out';
      el.innerHTML = '<strong>Signed out</strong>' +
        '<p class="fineprint">Sign in to publish changes to your guests.</p>' +
        '<div class="btn-row"><button class="btn primary" id="signInBtn">Sign in</button></div>';
      return;
    }

    el.className = 'panel status is-live';
    el.innerHTML = '<strong>● Live</strong>' +
      '<p class="fineprint">Signed in as ' + esc(who) + '. Every change you save below ' +
      'goes to your guests immediately.' +
      (lastSeenAt ? ' Last published ' + esc(new Date(lastSeenAt).toLocaleString()) + '.' : '') +
      '</p>' +
      '<div class="btn-row"><button class="btn" id="signOutBtn">Sign out</button></div>';
  }

  function openSignIn() {
    openSheet('Operator sign-in',
      '<label class="field"><span>Email</span><input type="email" id="authEmail" autocomplete="username" inputmode="email" /></label>' +
      '<label class="field"><span>Password</span><input type="password" id="authPass" autocomplete="current-password" /></label>' +
      '<p class="fineprint">This is the operator account from your Supabase project. ' +
      'Guests never sign in — they only read the menu.</p>',
      '<button class="btn primary wide" id="authGo">Sign in</button>');

    var go = function () {
      var mail = $('authEmail').value.trim();
      var pass = $('authPass').value;
      if (!mail || !pass) { toast('Email and password required'); return; }
      $('authGo').disabled = true;
      $('authGo').textContent = 'Signing in…';
      CLOUD.signIn(mail, pass).then(function () {
        closeSheet();
        adminUnlocked = true;
        view = 'admin';
        return refreshFromCloud(true).then(function () {
          render();
          toast('Signed in');
        });
      }, function (err) {
        if ($('authGo')) {
          $('authGo').disabled = false;
          $('authGo').textContent = 'Sign in';
        }
        toast(err.message || 'Sign-in failed');
      });
    };
    $('authGo').addEventListener('click', go);
    $('authPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { $('authEmail').focus(); }, 60);
  }

  /* Pull the published menu back down. Skipped while a sheet is open so a
   * background refresh can never yank the form out from under an edit. */
  function refreshFromCloud(force) {
    if (!CLOUD.configured()) return Promise.resolve(false);
    if (!force && !$('sheet').hidden) return Promise.resolve(false);
    return CLOUD.fetchMenu().then(function (remote) {
      if (!remote) return false;
      if (!force && lastSeenAt && remote.updated_at === lastSeenAt) return false;
      var next = normalise(remote);
      state.settings = next.settings;
      state.tours = next.tours;
      state.plan.items = state.plan.items.filter(function (it) { return !!tourById(it.tourId); });
      lastSeenAt = remote.updated_at || null;
      liveMenu = true;
      save();
      render();
      return true;
    }, function () { return false; });
  }

  function renderAdmin() {
    renderCloudStatus();

    var live = CLOUD.configured() && !!CLOUD.user();
    $('backupTitle').textContent = L(live ? 'admin.backup' : 'admin.publishBackup');
    $('backupNote').innerHTML = live
      ? 'Your menu is already live for guests — nothing here is needed to publish it. ' +
        'Export keeps an offline copy, and Import restores one or moves a menu between projects.'
      : 'Your menu lives in this browser. Export saves a <code>tours.json</code> you can commit ' +
        'so every guest sees the update.';
    $('adminList').innerHTML = state.tours.length
      ? state.tours.map(function (t, i) {
          return '' +
            '<div class="admin-row' + (t.active ? '' : ' is-off') + '">' +
              '<div class="ar-emoji">' + esc(t.emoji) + '</div>' +
              '<div class="ar-main">' +
                '<div class="ar-name">' + esc(t.name) + '</div>' +
                '<div class="ar-sub">' + esc(t.category) + ' · ' + durLabel(t.durationMin) + ' · ' +
                  money(t.price) + '/' + L(t.priceUnit === 'group' ? 'unit.group' : 'unit.guest') +
                  (t.active ? '' : ' · ' + L('admin.hidden')) + '</div>' +
              '</div>' +
              '<div class="ar-tools">' +
                '<button data-mv-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
                '<button data-mv-down="' + i + '"' + (i === state.tours.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>' +
                '<button data-edit="' + esc(t.id) + '" aria-label="Edit">✎</button>' +
              '</div>' +
            '</div>';
        }).join('')
      : '<p class="empty">' + L('admin.noTours') + '</p>';
  }

  /* ══════════════════════════ sheet ══════════════════════════ */

  function openSheet(title, bodyHTML, footHTML) {
    $('sheetTitle').textContent = title;
    $('sheetBody').innerHTML = bodyHTML;
    $('sheetFoot').innerHTML = footHTML || '';
    $('sheet').hidden = false;
    $('scrim').hidden = false;
    $('sheetBody').scrollTop = 0;
  }

  function closeSheet() {
    $('sheet').hidden = true;
    $('scrim').hidden = true;
  }

  function openTourDetail(id) {
    var t = tourById(id);
    if (!t) return;
    var body = '' +
      '<div class="detail-hero">' +
        '<div class="tc-emoji">' + esc(t.emoji) + '</div>' +
        '<div><div class="tc-cat">' + esc(tf(t, 'category')) + '</div>' +
        '<div class="tc-name">' + esc(tf(t, 'name')) + '</div></div>' +
      '</div>' +
      '<div class="detail-body"><p>' + esc(tf(t, 'details') || tf(t, 'blurb')) + '</p></div>' +
      (tf(t, 'includes').length
        ? '<h3 style="font-size:15px;margin:16px 0 6px">' + L('detail.included') + '</h3><ul class="detail-list">' +
          tf(t, 'includes').map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
        : '') +
      '<h3 style="font-size:15px;margin:18px 0 4px">' + L('detail.details') + '</h3>' +
      '<div class="spec"><span>' + L('spec.duration') + '</span><b>' + durLabel(t.durationMin) + '</b></div>' +
      '<div class="spec"><span>' + L('spec.price') + '</span><b>' +
        L('spec.priceEach', { amount: money(t.price), unit: L(t.priceUnit === 'group' ? 'unit.group' : 'unit.guest') }) + '</b></div>' +
      '<div class="spec"><span>' + L('spec.guests') + '</span><b>' + t.minGuests + '–' + t.maxGuests + '</b></div>' +
      '<div class="spec"><span>' + L('spec.available') + '</span><b>' + (t.days.length === 7 ? L('common.daily') : t.days.map(function (d) { return dayShort()[d]; }).join(', ')) + '</b></div>' +
      (t.startTimes.length ? '<div class="spec"><span>' + L('spec.departures') + '</span><b>' + t.startTimes.map(function (s) { return clockLabel(toMin(s)); }).join(', ') + '</b></div>' : '') +
      (tf(t, 'meetingPoint') ? '<div class="spec"><span>' + L('spec.meeting') + '</span><b>' + esc(tf(t, 'meetingPoint')) + '</b></div>' : '');

    openSheet(tf(t, 'name'), body,
      '<button class="btn primary wide" data-add="' + esc(t.id) + '">' + L('detail.add') + '</button>');
  }

  /* ── tour editor ─────────────────────────── */

  /* Optional per-language copy. Anything left blank falls back to the English
   * record at display time, so a half-translated tour still reads correctly. */
  function translationBlock(t) {
    var langs = I18N.available.filter(function (l) { return l !== 'en'; });
    return langs.map(function (lang) {
      var v = (t.i18n && t.i18n[lang]) || {};
      var label = lang === 'es' ? 'Español' : lang.toUpperCase();
      return '' +
        '<details class="trans"><summary>' + esc(label) + ' — optional translation</summary>' +
        '<p class="fineprint">Leave any field blank and guests reading ' + esc(label) +
        ' see your English version for that field.</p>' +
        '<label class="field"><span>Name</span><input type="text" data-tr="' + lang + '.name" value="' + esc(v.name || '') + '" /></label>' +
        '<label class="field"><span>Category</span><input type="text" data-tr="' + lang + '.category" value="' + esc(v.category || '') + '" /></label>' +
        '<label class="field"><span>Short line</span><input type="text" data-tr="' + lang + '.blurb" value="' + esc(v.blurb || '') + '" /></label>' +
        '<label class="field"><span>Full description</span><textarea rows="3" data-tr="' + lang + '.details">' + esc(v.details || '') + '</textarea></label>' +
        '<label class="field"><span>Meeting point</span><input type="text" data-tr="' + lang + '.meetingPoint" value="' + esc(v.meetingPoint || '') + '" /></label>' +
        '<label class="field"><span>Included (one per line)</span><textarea rows="3" data-tr="' + lang + '.includes">' + esc((v.includes || []).join('\n')) + '</textarea></label>' +
        '</details>';
    }).join('');
  }

  function readTranslations() {
    var out = {};
    Array.prototype.forEach.call(document.querySelectorAll('#sheetBody [data-tr]'), function (el) {
      var parts = el.dataset.tr.split('.');
      var lang = parts[0], field = parts[1];
      var val = el.value.trim();
      if (!val) return;
      if (!out[lang]) out[lang] = {};
      out[lang][field] = field === 'includes'
        ? val.split('\n').map(function (x) { return x.trim(); }).filter(Boolean)
        : val;
    });
    return out;
  }

  function openTourEditor(id) {
    var t = id ? tourById(id) : null;
    var isNew = !t;
    if (!t) t = normaliseTour({ name: '', category: 'Experiences', days: [0, 1, 2, 3, 4, 5, 6] });

    var body = '' +
      '<div class="field-row">' +
        '<label class="field" style="max-width:96px"><span>Icon</span><input type="text" id="fEmoji" maxlength="4" value="' + esc(t.emoji) + '" /></label>' +
        '<label class="field"><span>Name</span><input type="text" id="fName" value="' + esc(t.name) + '" placeholder="Sunset Vineyard Dinner" /></label>' +
      '</div>' +
      '<label class="field"><span>Category</span><input type="text" id="fCat" value="' + esc(t.category) + '" placeholder="Culinary" /></label>' +
      '<label class="field"><span>Short line (menu card)</span><input type="text" id="fBlurb" value="' + esc(t.blurb) + '" placeholder="One sentence that sells it" /></label>' +
      '<label class="field"><span>Full description</span><textarea id="fDetails" rows="4" placeholder="What the day feels like">' + esc(t.details) + '</textarea></label>' +
      '<div class="field-row">' +
        '<label class="field"><span>Duration (min)</span><input type="number" id="fDur" min="15" step="15" inputmode="numeric" value="' + t.durationMin + '" /></label>' +
        '<label class="field"><span>Price</span><input type="number" id="fPrice" min="0" step="1" inputmode="numeric" value="' + t.price + '" /></label>' +
      '</div>' +
      '<label class="field"><span>Priced per</span><select id="fUnit">' +
        '<option value="person"' + (t.priceUnit === 'person' ? ' selected' : '') + '>Guest</option>' +
        '<option value="group"' + (t.priceUnit === 'group' ? ' selected' : '') + '>Group</option>' +
      '</select></label>' +
      '<div class="field-row">' +
        '<label class="field"><span>Min guests</span><input type="number" id="fMin" min="1" inputmode="numeric" value="' + t.minGuests + '" /></label>' +
        '<label class="field"><span>Max guests</span><input type="number" id="fMax" min="1" inputmode="numeric" value="' + t.maxGuests + '" /></label>' +
      '</div>' +
      '<div class="field"><span>Days offered</span><div class="daypick" id="fDays">' +
        dayShort().map(function (d, i) {
          return '<button type="button" data-day="' + i + '" class="' + (t.days.indexOf(i) > -1 ? 'is-on' : '') + '">' + d + '</button>';
        }).join('') +
      '</div></div>' +
      '<label class="field"><span>Departure times (blank = flexible)</span><input type="text" id="fTimes" value="' + esc(t.startTimes.join(', ')) + '" placeholder="09:00, 14:00" /></label>' +
      '<label class="field"><span>Meeting point</span><input type="text" id="fMeet" value="' + esc(t.meetingPoint) + '" placeholder="Hotel lobby pickup" /></label>' +
      '<label class="field"><span>Included (one per line)</span><textarea id="fInc" rows="3" placeholder="Private guide&#10;Transfers">' + esc(t.includes.join('\n')) + '</textarea></label>' +
      '<label class="field"><span>Visible on the menu</span><select id="fActive">' +
        '<option value="1"' + (t.active ? ' selected' : '') + '>Shown to guests</option>' +
        '<option value="0"' + (t.active ? '' : ' selected') + '>Hidden</option>' +
      '</select></label>' +
      translationBlock(t);

    var foot = '<div class="btn-row">' +
      (isNew ? '' : '<button class="btn" id="dupTour">Duplicate</button>' +
                    '<button class="btn danger" id="delTour">Delete</button>') +
      '<button class="btn primary" id="saveTour">Save</button></div>';

    openSheet(isNew ? 'New tour' : 'Edit tour', body, foot);

    $('fDays').addEventListener('click', function (e) {
      var b = e.target.closest('[data-day]');
      if (b) b.classList.toggle('is-on');
    });

    $('saveTour').addEventListener('click', function () {
      var name = $('fName').value.trim();
      if (!name) { toast('Give the tour a name'); $('fName').focus(); return; }

      var days = Array.prototype.slice.call($('fDays').querySelectorAll('.is-on'))
        .map(function (b) { return Number(b.dataset.day); });
      if (!days.length) { toast('Pick at least one day'); return; }

      var times = $('fTimes').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var bad = times.filter(function (s) { return toMin(s) === null; });
      if (bad.length) { toast('Times must look like 09:00 — check "' + bad[0] + '"'); return; }

      var min = Math.max(1, Number($('fMin').value) || 1);
      var max = Math.max(min, Number($('fMax').value) || min);

      var next = normaliseTour({
        id: id || slug(name) + '-' + uid().slice(-4),
        name: name,
        blurb: $('fBlurb').value.trim(),
        details: $('fDetails').value.trim(),
        category: $('fCat').value.trim() || 'Experiences',
        emoji: $('fEmoji').value.trim() || '🧭',
        durationMin: Number($('fDur').value),
        price: Number($('fPrice').value),
        priceUnit: $('fUnit').value,
        minGuests: min,
        maxGuests: max,
        days: days,
        startTimes: times.map(function (s) { return toHHMM(toMin(s)); }).sort(),
        meetingPoint: $('fMeet').value.trim(),
        includes: $('fInc').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
        i18n: readTranslations(),
        active: $('fActive').value === '1'
      });

      if (id) {
        for (var i = 0; i < state.tours.length; i++) {
          if (state.tours[i].id === id) { state.tours[i] = next; break; }
        }
      } else {
        state.tours.push(next);
      }
      closeSheet();
      publish(id ? 'Saved' : 'Tour added');
    });

    if (!isNew) {
      $('dupTour').addEventListener('click', function () {
        var copy = normaliseTour(Object.assign({}, tourById(id), {
          id: slug(t.name) + '-' + uid().slice(-4),
          name: t.name + ' (copy)'
        }));
        state.tours.push(copy);
        closeSheet();
        publish('Duplicated');
      });

      $('delTour').addEventListener('click', function () {
        if (!confirm('Delete "' + t.name + '"? This also removes it from any itinerary in progress.')) return;
        state.tours = state.tours.filter(function (x) { return x.id !== id; });
        state.plan.items = state.plan.items.filter(function (it) { return it.tourId !== id; });
        closeSheet();
        publish('Deleted');
      });
    }
  }

  /* ── brand & contact ─────────────────────── */

  function openBrandEditor() {
    var s = state.settings;
    openSheet('Brand & contact',
      '<label class="field"><span>Company name</span><input type="text" id="sName" value="' + esc(s.operator) + '" /></label>' +
      '<label class="field"><span>Tagline</span><input type="text" id="sTag" value="' + esc(s.tagline) + '" /></label>' +
      '<label class="field"><span>Currency symbol</span><input type="text" id="sCur" maxlength="3" value="' + esc(s.currencySymbol) + '" /></label>' +
      '<label class="field"><span>Booking email</span><input type="email" id="sEmail" value="' + esc(s.contactEmail) + '" placeholder="reservations@example.com" /></label>' +
      '<label class="field"><span>WhatsApp number (digits only)</span><input type="text" id="sWa" value="' + esc(s.whatsapp) + '" placeholder="15551234567" inputmode="numeric" /></label>' +
      '<div class="field-row">' +
        '<label class="field"><span>Default day start</span><input type="time" id="sStart" value="' + esc(s.dayStart) + '" /></label>' +
        '<label class="field"><span>Buffer between stops (min)</span><input type="number" id="sBuf" min="0" step="5" inputmode="numeric" value="' + s.bufferMin + '" /></label>' +
      '</div>' +
      '<label class="field"><span>Operator PIN (blank = no lock)</span><input type="text" id="sPin" value="' + esc(s.adminPin) + '" inputmode="numeric" /></label>' +
      '<p class="fineprint">The PIN keeps the ⚙ menu out of a guest\'s way on a shared phone. It is not security — anyone can read this page\'s source. Keep nothing sensitive here.</p>',
      '<button class="btn primary wide" id="saveBrand">Save</button>');

    $('saveBrand').addEventListener('click', function () {
      var s2 = state.settings;
      s2.operator = $('sName').value.trim() || 'Rutas Antiguas';
      s2.tagline = $('sTag').value.trim();
      s2.currencySymbol = $('sCur').value.trim() || '$';
      s2.contactEmail = $('sEmail').value.trim();
      s2.whatsapp = $('sWa').value.replace(/[^\d]/g, '');
      s2.bufferMin = Math.max(0, Number($('sBuf').value) || 0);
      if (toMin($('sStart').value) !== null) s2.dayStart = $('sStart').value;
      s2.adminPin = $('sPin').value.trim();
      closeSheet();
      publish('Saved');
    });
  }

  function openPinPrompt() {
    openSheet('Operator access',
      '<label class="field"><span>PIN</span><input type="password" id="pinIn" inputmode="numeric" autocomplete="off" /></label>',
      '<button class="btn primary wide" id="pinGo">Unlock</button>');
    setTimeout(function () { $('pinIn').focus(); }, 60);
    var go = function () {
      if ($('pinIn').value.trim() === state.settings.adminPin) {
        adminUnlocked = true; closeSheet(); view = 'admin'; render();
      } else {
        toast('Incorrect PIN');
      }
    };
    $('pinGo').addEventListener('click', go);
    $('pinIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  /* ══════════════════════════ itinerary text ══════════════════════════ */

  function planText() {
    var plan = state.plan, sched = buildSchedule();
    var lines = [];
    lines.push(L('txt.requestHeading', { operator: state.settings.operator }));
    lines.push('');
    lines.push(L('txt.date') + ': ' + dateLabel(plan.date));
    lines.push(L('txt.guests') + ': ' + plan.guests);
    lines.push('');
    lines.push(L('txt.itinerary'));
    sched.legs.forEach(function (l) {
      lines.push('  ' + clockLabel(l.start) + '–' + clockLabel(l.end) + '  ' + tf(l.tour, 'name') +
                 '  (' + durLabel(l.tour.durationMin) + ')');
      if (tf(l.tour, 'meetingPoint')) lines.push('      ' + L('txt.meets') + ': ' + tf(l.tour, 'meetingPoint'));
      l.notes.forEach(function (n) { lines.push('      · ' + n); });
      l.warnings.forEach(function (w) { lines.push('      ! ' + w); });
    });
    lines.push('');
    lines.push(L('txt.timeOnTour') + ': ' + durLabel(sched.duration));
    lines.push(L('txt.estTotal') + ': ' + money(sched.total) +
               ' (' + plan.guests + ' × ' + L('unit.guest') + ')');
    lines.push('');
    lines.push(L('txt.estimateOnly'));
    return lines.join('\n');
  }

  function contactText(v) {
    return [
      L('txt.enquiryHeading', { operator: state.settings.operator }),
      '',
      L('txt.name') + ': ' + v.name,
      L('txt.phone') + ': ' + v.phone,
      L('txt.email') + ': ' + v.email,
      '',
      v.message
    ].join('\n');
  }

  function bookingText(v) {
    return [
      planText(),
      '',
      L('txt.from'),
      L('txt.name') + ': ' + v.name,
      L('txt.phone') + ': ' + v.phone,
      L('txt.email') + ': ' + v.email,
      '',
      v.message,
      '',
      DISCLAIMER
    ].join('\n');
  }

  function itinerarySnapshot() {
    var sched = buildSchedule();
    return {
      date: state.plan.date,
      guests: state.plan.guests,
      start: state.plan.start,
      estimatedTotal: sched.total,
      currency: state.settings.currencySymbol,
      legs: sched.legs.map(function (l) {
        return {
          tourId: l.tour.id,
          name: l.tour.name,
          start: toHHMM(l.start % 1440),
          end: toHHMM(l.end % 1440),
          durationMin: l.tour.durationMin,
          price: l.tour.price,
          priceUnit: l.tour.priceUnit,
          warnings: l.warnings
        };
      })
    };
  }

  function openHandoff(channel, text, subject) {
    if (channel === 'whatsapp') {
      window.open('https://wa.me/' + state.settings.whatsapp + '?text=' + encodeURIComponent(text),
                  '_blank', 'noopener');
    } else if (channel === 'email') {
      window.location.href = 'mailto:' + encodeURIComponent(state.settings.contactEmail) +
        '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    } else {
      copyText(text, L('toast.copiedFree'));
    }
  }

  /* Save first, hand off second — but both are started inside the same click.
   * Waiting for the network before opening WhatsApp or mail would lose the user
   * gesture and get the handoff blocked as a popup on mobile Safari. Starting
   * the save first still means an abandoned handoff leaves a record behind. */
  function submitEnquiry(kind, prefix, channel, hintId) {
    var v = readForm(prefix);
    var errs = formErrors(v);
    markErrors(prefix, errs);
    if (errs.length) { toast(errs[0].msg); return; }

    if (kind === 'booking') state.plan.form = v; else state.contact = v;
    save();

    var isBooking = kind === 'booking';
    var text = isBooking ? bookingText(v) : contactText(v);
    var subject = isBooking
      ? L('txt.subjectBooking', { date: dateLabel(state.plan.date), name: v.name })
      : L('txt.subjectEnquiry', { name: v.name });

    var hint = $(hintId);
    var pending = null;

    if (CLOUD.configured()) {
      var row = {
        kind: kind, name: v.name, phone: v.phone, email: v.email,
        message: v.message, handoff: channel
      };
      if (isBooking) row.itinerary = itinerarySnapshot();
      pending = CLOUD.saveEnquiry(row);
    }

    openHandoff(channel, text, subject);

    if (!pending) {
      if (hint) hint.textContent = L('send.noBackend');
      toast(L('toast.handedOff'));
      return;
    }

    if (hint) hint.textContent = L('send.saving');
    pending.then(function () {
      if (hint) {
        hint.textContent = isBooking
          ? L('send.bookingReceived') + ' ' + L('disclaimer')
          : L('send.received');
        hint.className = 'fineprint ok';
      }
      toast(isBooking ? L('toast.requestSent') : L('toast.messageSent'));
    }, function (err) {
      if (hint) {
        hint.textContent = L('send.failed', { err: err.message });
        hint.className = 'fineprint bad';
      }
      toast(L('toast.notRecorded'));
    });
  }

  function sendButtons(prefix, hintId, kind) {
    var out = [];
    if (state.settings.whatsapp) {
      out.push('<button class="btn brass" data-send="whatsapp|' + prefix + '|' + hintId + '|' + kind + '">' + L('send.whatsapp') + '</button>');
    }
    if (state.settings.contactEmail) {
      out.push('<button class="btn primary" data-send="email|' + prefix + '|' + hintId + '|' + kind + '">' + L('send.email') + '</button>');
    }
    out.push('<button class="btn" data-send="copy|' + prefix + '|' + hintId + '|' + kind + '">' + L('send.copy') + '</button>');
    return out.join('');
  }

  function renderContact() {
    var s = state.settings;
    $('contactFormHost').innerHTML = formHTML('ct', state.contact,
      L('form.message'), L('form.messagePhContact'));
    $('contactRow').innerHTML = sendButtons('ct', 'contactHint', 'question');

    var hint = $('contactHint');
    if (hint && !hint.textContent) {
      hint.className = 'fineprint';
      hint.textContent = CLOUD.configured() ? L('send.saveNote') : '';
    }

    var direct = [];
    if (s.whatsapp) direct.push('<a class="btn wide" href="https://wa.me/' + esc(s.whatsapp) + '" target="_blank" rel="noopener">' + L('contact.whatsapp') + '</a>');
    if (s.contactEmail) direct.push('<a class="btn wide" href="mailto:' + esc(s.contactEmail) + '">' + esc(s.contactEmail) + '</a>');
    $('contactDirect').innerHTML = direct.length
      ? '<h2>' + L('contact.direct') + '</h2><div class="btn-row stack">' + direct.join('') + '</div>'
      : '';
    $('contactDirect').hidden = !direct.length;
  }

  function copyText(text, okMsg) {
    var done = function () { toast(okMsg); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { toast(L('toast.copyFailed')); }
      document.body.removeChild(ta);
    }
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ══════════════════════════ events ══════════════════════════ */

  function addTour(id) {
    if (!tourById(id)) return;
    state.plan.items.push({ uid: uid(), tourId: id });
    save(); render();
    toast(L('toast.added'));
  }

  function removeLastOf(id) {
    for (var i = state.plan.items.length - 1; i >= 0; i--) {
      if (state.plan.items[i].tourId === id) { state.plan.items.splice(i, 1); break; }
    }
    save(); render();
  }

  function moveItem(from, to) {
    var items = state.plan.items;
    if (to < 0 || to >= items.length) return;
    var moved = items.splice(from, 1)[0];
    items.splice(to, 0, moved);
    save(); render();
  }

  function moveTour(from, to) {
    if (to < 0 || to >= state.tours.length) return;
    var moved = state.tours.splice(from, 1)[0];
    state.tours.splice(to, 0, moved);
    publish('Reordered');
  }

  function wire() {
    document.body.addEventListener('click', function (e) {
      var el;

      if ((el = e.target.closest('[data-cat]'))) { filter = el.dataset.cat; render(); return; }
      if ((el = e.target.closest('[data-add]'))) { addTour(el.dataset.add); closeSheet(); return; }
      if ((el = e.target.closest('[data-dec]'))) { removeLastOf(el.dataset.dec); return; }
      if ((el = e.target.closest('[data-detail]'))) { openTourDetail(el.dataset.detail); return; }
      if ((el = e.target.closest('[data-drop]'))) {
        state.plan.items = state.plan.items.filter(function (it) { return it.uid !== el.dataset.drop; });
        save(); render(); return;
      }
      if ((el = e.target.closest('[data-up]'))) { moveItem(+el.dataset.up, +el.dataset.up - 1); return; }
      if ((el = e.target.closest('[data-down]'))) { moveItem(+el.dataset.down, +el.dataset.down + 1); return; }
      if ((el = e.target.closest('[data-edit]'))) { openTourEditor(el.dataset.edit); return; }
      if ((el = e.target.closest('[data-mv-up]'))) { moveTour(+el.dataset.mvUp, +el.dataset.mvUp - 1); return; }
      if ((el = e.target.closest('[data-mv-down]'))) { moveTour(+el.dataset.mvDown, +el.dataset.mvDown + 1); return; }

      if ((el = e.target.closest('[data-send]'))) {
        var parts = el.dataset.send.split('|');   // channel|prefix|hintId|kind
        submitEnquiry(parts[3], parts[1], parts[0], parts[2]);
        return;
      }

      if ((el = e.target.closest('.tab'))) { view = el.dataset.view; render(); window.scrollTo(0, 0); return; }

      switch (e.target.id) {
        case 'langBtn': {
          var order = I18N.available;
          var next = order[(order.indexOf(I18N.get()) + 1) % order.length];
          I18N.set(next);
          // The forms are built once and left alone while typing, so they need
          // an explicit rebuild to pick up the new language.
          $('bookingFormHost').innerHTML = '';
          filter = L('filter.all');
          render();
          return;
        }
        case 'installGo': {
          if (!deferredPrompt) return;
          var dp = deferredPrompt;
          deferredPrompt = null;
          dp.prompt();
          dp.userChoice.then(function (choice) {
            if (choice && choice.outcome === 'accepted') toast(L('install.done'));
            renderInstall();
          }, function () { renderInstall(); });
          return;
        }
        case 'installDismiss':
          try { localStorage.setItem(INSTALL_KEY, 'dismissed'); } catch (err) {}
          $('installCard').hidden = true;
          return;
        case 'adminEntry':
          // With a backend, the Supabase account is the gate. Without one, fall
          // back to the local PIN, which only hides the menu from a guest.
          if (CLOUD.configured() && !CLOUD.user()) { openSignIn(); return; }
          if (adminUnlocked || !state.settings.adminPin) { adminUnlocked = true; view = 'admin'; render(); }
          else openPinPrompt();
          return;
        case 'signInBtn':
          openSignIn(); return;
        case 'signOutBtn':
          CLOUD.signOut().then(function () {
            adminUnlocked = false;
            view = 'menu';
            render();
            toast('Signed out');
          });
          return;
        case 'sheetClose':
        case 'scrim':
          closeSheet(); return;
        case 'newTourBtn':  openTourEditor(null); return;
        case 'brandBtn':    openBrandEditor(); return;
        case 'copyPlanBtn': copyText(planText(), L('toast.copiedPlan')); return;
        case 'copyJsonBtn': copyText(JSON.stringify(menuPayload(), null, 2), 'Menu JSON copied'); return;
        case 'exportBtn':   download('tours.json', JSON.stringify(menuPayload(), null, 2)); toast('Exported tours.json'); return;
        case 'importBtn':   $('importFile').click(); return;
        case 'resetBtn':    doReset(); return;
        case 'emailPlanBtn': {
          var subj = 'Private tour request — ' + dateLabel(state.plan.date);
          window.location.href = 'mailto:' + encodeURIComponent(state.settings.contactEmail) +
            '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(planText());
          return;
        }
        case 'waPlanBtn':
          window.open('https://wa.me/' + state.settings.whatsapp + '?text=' +
                      encodeURIComponent(planText()), '_blank', 'noopener');
          return;
      }
    });

    /* Blur fires `change` a second time with an unchanged value. Re-rendering there
     * would tear out the itinerary list between mousedown and mouseup and swallow
     * the tap that caused the blur — so only redraw when the value really moved. */
    var bindPlan = function (id, key, coerce) {
      var el = $(id);
      var apply = function () {
        var next = coerce ? coerce(el.value) : el.value;
        if (state.plan[key] === next) return;
        state.plan[key] = next;
        save();
        renderPlan();
      };
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    };
    bindPlan('planDate', 'date');
    bindPlan('planStart', 'start');
    bindPlan('planGuests', 'guests', function (v) { return Math.max(1, Math.min(40, Number(v) || 1)); });

    // Keep whatever is half-typed across a reload or a tab switch.
    document.body.addEventListener('input', function (e) {
      var id = e.target && e.target.id;
      if (!id) return;
      if (id.indexOf('bk') === 0) { state.plan.form = readForm('bk'); save(); }
      else if (id.indexOf('ct') === 0) { state.contact = readForm('ct'); save(); }
    });

    $('importFile').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(String(reader.result));
          if (!Array.isArray(parsed.tours)) throw new Error('no tours array');
          var next = normalise(parsed);
          state.settings = next.settings;
          state.tours = next.tours;
          state.plan.items = state.plan.items.filter(function (it) { return !!tourById(it.tourId); });
          publish('Imported ' + state.tours.length + ' tours');
        } catch (err) {
          toast('That file is not a valid tours.json');
        }
      };
      reader.readAsText(file);
      this.value = '';
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();          // keep Chrome's own banner out of the way
      deferredPrompt = e;
      if (view === 'menu') renderInstall();
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      var card = $('installCard');
      if (card) card.hidden = true;
    });

    /* Registered only over https or on localhost — a service worker is refused
     * anywhere else, and the rejection is noisy in the console. */
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  function doReset() {
    if (!published) { toast('No published menu available offline'); return; }
    if (!confirm('Replace your menu with the published tours.json? Your unsaved edits are lost.')) return;
    var next = normalise(published);
    state.settings = next.settings;
    state.tours = next.tours;
    state.plan = blankPlan();
    publish('Reset to published menu');
  }

  /* ══════════════════════════ boot ══════════════════════════ */

  /* The published menu wins when it comes from the backend — that is the whole
   * point of it being live. The locally cached menu is only a fallback for a
   * first load with no network, and the guest's own plan always survives. */
  function boot(menu, stored, fromCloud) {
    var base = normalise(fromCloud ? menu : (stored || menu));
    state = { settings: base.settings, tours: base.tours, plan: blankPlan(), contact: blankForm() };
    if (stored && stored.contact) state.contact = Object.assign(blankForm(), stored.contact);

    if (stored && stored.plan) {
      var p = Object.assign(blankPlan(), stored.plan);
      p.form = Object.assign(blankForm(), p.form || {});
      p.items = (Array.isArray(p.items) ? p.items : [])
        .filter(function (it) { return it && it.tourId; })
        .map(function (it) { return { uid: it.uid || uid(), tourId: it.tourId }; });
      state.plan = p;
    }
    // Drop anything pointing at a tour that no longer exists.
    state.plan.items = state.plan.items.filter(function (it) { return !!tourById(it.tourId); });
    if (!state.plan.start) state.plan.start = state.settings.dayStart;

    wire();
    render();

    if (CLOUD.configured()) {
      // A guest who leaves the page open and comes back sees the current menu.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') refreshFromCloud(false);
      });
      window.addEventListener('online', function () { refreshFromCloud(false); });
    }
  }

  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { stored = null; }

  /* tours.json is still fetched even with a backend: it is the seed for an empty
   * database and the target of "Reset to published". */
  var seedPromise = fetch('./tours.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });

  seedPromise.then(function (seed) {
    published = seed;

    if (!CLOUD.configured()) { boot(seed || FALLBACK, stored); return; }

    CLOUD.fetchMenu().then(function (remote) {
      // An empty menu row means the backend is set up but nothing published yet —
      // fall back to the committed file rather than showing a guest nothing.
      if (remote && Array.isArray(remote.tours) && remote.tours.length) {
        liveMenu = true;
        lastSeenAt = remote.updated_at || null;
        boot(remote, stored, true);
        save();
      } else {
        boot(seed || FALLBACK, stored);
      }
    }, function () {
      boot(stored || seed || FALLBACK, stored); // offline: last known menu
    });
  });
})();
