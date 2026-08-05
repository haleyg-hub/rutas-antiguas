# Rutas Antiguas — Build Your Own Tour

A mobile-first scheduler for a luxury private tour operator.

Guests browse a menu of experiences, add **any combination in any number**, and get
a single timed itinerary with an estimated total. The operator edits that menu from
a phone and the changes go live for guests immediately.

Static site: plain HTML, CSS and JavaScript. No build step, no framework, no
dependencies. Supabase stores the live menu; without it the app still runs entirely
on the device.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The app shell — menu, itinerary and operator views |
| `assets/app.css` | All styling. Light and dark, safe-area aware |
| `assets/app.js` | All behaviour — menu, scheduling, editor, import/export |
| `assets/cloud.js` | Supabase transport — auth and menu read/write over plain HTTP |
| `assets/config.js` | **Your Supabase URL and anon key.** Blank = no backend |
| `tours.json` | Fallback menu, used before the backend has anything published |
| `supabase-setup.sql` | One-time database setup, run once in the SQL Editor |
| `.nojekyll` | Stops GitHub Pages from processing the site |

## Two modes

The app runs either way, and the difference is only where the menu lives.

| | **Live** (backend configured) | **Local** (`config.js` blank) |
| --- | --- | --- |
| Menu is stored in | Your Supabase project | This browser only |
| Phone edits reach guests | Immediately | Only after you export and commit |
| Unlocking ⚙ | Supabase email + password | Optional local PIN |

## Running it

Open `index.html` in any browser. To serve locally:

```sh
python3 -m http.server 8000     # then visit http://localhost:8000
```

Opening the file directly (`file://`) also works, but the browser blocks loading
`tours.json`, so you start with an empty menu and build it in the operator view.

## For the operator

Tap **⚙** in the top right.

- **New tour** — icon, name, category, description, duration, price (per guest or
  per group), guest minimum and maximum, days offered, fixed departure times,
  meeting point, and what's included.
- **Edit / Duplicate / Delete** any tour; reorder with ↑ ↓; hide one from the menu
  without deleting it by setting it to *Hidden*.
- **Brand & contact** — company name, tagline, currency symbol, booking email,
  WhatsApp number, default day start, and the travel buffer between stops.

### How edits reach guests

**In live mode, they just do.** Every save publishes to Supabase, and the next
guest to open the link — or any guest who returns to an already-open tab — gets
the new menu. There is no deploy, no commit and no export step.

If a publish fails (no signal, for instance) the app says so and keeps your edit
on the phone. It does not pretend the change went out.

**In local mode**, edits stay on your phone until you Export `tours.json` and
commit it.

## Setting up the backend

One-time, about ten minutes. This must be Rutas Antiguas' **own** Supabase
project — it shares nothing with any other app.

1. Create a new project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste `supabase-setup.sql` → **Run**. That creates the menu
   table and its access rules.
3. **Authentication → Users → Add user** → your email and a password, with
   *Auto Confirm User* ticked. That is your operator login.
4. **Authentication → Sign In / Providers** → turn **off** "Allow new users to
   sign up", so nobody can register themselves into write access.
5. **Project Settings → Data API** for the URL, and **API Keys** for the anon key.
   Paste both into `assets/config.js` and commit.

Open the site, tap ⚙, sign in. The panel should read **● Live**.

### About the anon key in `config.js`

It is meant to be public — it ships in the browser on every Supabase site, and it
is not a password. What protects the menu is the row-level security policy: anyone
may **read** it, only your signed-in operator account may **write** it.

Never put the `service_role` key in this file. That one bypasses every policy.

> The local PIN is a different thing entirely: it only hides ⚙ from a guest on a
> shared phone, and anyone can read this page's source. Once the backend is
> configured, the Supabase account replaces it as the real gate.

## For the guest

1. **Tours** — browse, filter by category, tap a card for the full description.
2. **Add** as many experiences as you like, including the same one twice.
3. **Itinerary** — pick the date, guest count and start time. Times are laid out
   back to back with the travel buffer between stops; reorder with ↑ ↓.
4. Send it by **email**, **WhatsApp**, or **Copy itinerary** — whichever the
   operator has configured.

The scheduler flags, rather than silently fixes, anything that doesn't line up:

- a tour not offered on the chosen weekday
- a guest count outside the tour's minimum or maximum
- a fixed-departure tour with no departure left after the preceding stop
- a wait between a stop ending and the next fixed departure

Totals are estimates for the selections shown, not a confirmed booking.

## Deploying

GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.
Any static host works — there is nothing to build.
