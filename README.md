# Palácio Doce

Multilingual storefront for a pastry shop in Braga, Portugal. Built with
Next.js 16 (App Router), next-intl, Firebase (Firestore + Auth), and
Tailwind CSS 4.

The site serves three languages from one codebase: **Portuguese** (default,
unprefixed URLs), **English** and **Arabic** (right-to-left). Every URL
segment is translated too — `/loja`, `/en/shop`, `/ar/shop` — and each
language is independently indexable with its own canonical URL.

## Getting started

No Firebase project or credentials are needed to run locally. The emulator
suite stands in for both, so development can never touch production data.

```bash
cp .env.example .env      # then fill in AUTH_SECRET
npm install

npm run emulators                   # terminal 1 — Firestore + Auth on 8080 / 9099
npm run db:seed                     # terminal 2 — catalogue and legal pages
npm run admin:grant -- --generate   # create an administrator
npm run dev
```

The storefront runs at http://localhost:3000 and the admin area at
http://localhost:3000/admin.

The emulator needs a JDK (21 or later) on `PATH`, or `JAVA_HOME` pointing at
one — `npm run emulators` sets it to `~/.local/jdk` by default.

Emulator data is held in memory and disappears when it stops, so seeding is
part of starting work, not a one-off.

`data/catalogue.json` is the seed: products, categories and the privacy, terms
and cookie policies. It is tracked in git so a clean checkout produces a
working shop, and so changes to legal copy show up in a diff. It holds no
personal data — orders and contact messages live only in a backup.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run check` | Message parity, route coverage, TypeScript, ESLint |
| `npm run emulators` | Firestore + Auth emulators, with a UI on :4000 |
| `npm run smoke` | End-to-end HTTP test against a running server |
| `npm run test:rules` | Security-rules tests for `firestore.rules` |
| `npm run test:data` | Data-layer tests, including the stock-race guard |
| `npm run test:auth` | Admin sign-in tests over real HTTP |
| `npm run admin:grant` | Create an administrator, or reset their password |
| `npm run admin:revoke` | Remove admin access immediately |
| `npm run admin:list` | Who has access, and whether both checks agree |
| `npm run rules:deploy` | Publish `firestore.rules` and the indexes |
| `npm run db:seed` | Load `data/catalogue.json` — catalogue and legal pages |
| `npm run db:export` | Back up every Firestore collection to JSON |
| `npm run db:restore` | Restore a `db:export` backup |
| `npm run db:import` | One-time import of the pre-Firestore relational export |
| `npm run prod:*` | The same commands, against the real project |

### Running a command against production

Every `db:*` and `admin:*` command reads `.env`, which points at the emulator.
The `prod:` variants read `.env.production` instead, which is where the real
service-account credentials live (gitignored, like every `.env*`).

```bash
npm run prod:list                      # who can sign in to the live admin area
npm run prod:export                    # back up live data
npm run prod:grant -- --generate       # add an administrator
```

Two separate script names rather than a flag, on purpose: which database you are
about to write to should be visible in the command you type, not buried in an
environment variable you set twenty minutes ago. Each script also prints its
target — `local emulator` or `PROJECT <id>` — before doing anything.

`npm run smoke` needs a server already running (`npm run build && npm start`).
It checks all 42 public routes across the three languages, the SEO endpoints,
RTL markup, structured data, 404 handling, that the admin area and private
pages are locked down, and that the order, contact and consent APIs accept
valid input and reject invalid input.

`test:rules`, `test:data` and `test:auth` all need `npm run emulators`
running; `test:auth` needs `npm run dev` as well.

## How the multilingual model works

One product, three translations — never three products. A product document
holds the shared facts (SKU, price in cents, stock, images) plus a
`translations` map keyed by locale, carrying everything language-specific
(name, slug, description, ingredients, allergens, SEO copy). Categories and
informational pages follow the same shape. Adding a fourth language means
adding it to `src/i18n/routing.ts` and filling in the map; no restructuring.

Three consequences worth knowing:

- **The cart is locale-independent.** It stores only `productId` and
  `quantity`. Names and prices are re-resolved for the active language on
  every render (`/api/cart`), so switching language mid-shop never leaves
  stale, wrong-language text on screen.
- **Orders snapshot their language.** Each order item stores the product name
  and slug *as the customer saw them*, so a historical order stays accurate
  even after the catalogue is edited, and confirmations can be sent in the
  language the order was placed in.
- **Search spans all languages.** A query in Arabic finds a product matched
  by its Portuguese name, and results come back in the language being
  browsed.

## Layout

```
src/
  app/
    [locale]/        Storefront (pt / en / ar), own root layout
    admin/           Admin dashboard, Portuguese-only, own root layout
    api/             cart · orders · contact · consent · admin/session
    sitemap.ts       All indexable URLs with hreflang alternates
    robots.ts        Localised disallow rules
  components/        UI, grouped by feature
  i18n/              routing · navigation · request config
  lib/
    firebase/        Admin SDK · client SDK · collection names · mappers
    data/            Firestore access, one module per aggregate
    order-pricing.ts Single source of truth for money maths
messages/            pt.json · en.json · ar.json (must stay in sync)
firestore.rules      Security rules — deny by default, no client writes
firestore.indexes.json  Composite indexes the admin queries need
scripts/             checks · tests · backup · admin access
```

Two root layouts exist because `/admin` sits outside the locale routing: it
is excluded from the proxy matcher in `src/proxy.ts` and is Portuguese-only.
There is deliberately no `src/app/layout.tsx`.

## Notes on security

- **Firestore is never written from a browser.** `firestore.rules` denies
  every client write and every read of personal data, and ends in a catch-all
  deny. All writes go through server code that validates with zod. The Admin
  SDK bypasses rules by design, so the ruleset is the blast door for a leaked
  web API key, not the application's access path.
- Order totals are always recomputed server-side from stored prices. The order
  API accepts product ids and quantities, never amounts.
- Stock is decremented inside a Firestore transaction, so two simultaneous
  checkouts cannot oversell the last item. Cancelling an order returns its
  stock. `npm run test:data` asserts this with concurrent requests.
- Order references (`PD-20260916-0001`) are sequential and therefore
  guessable, so the confirmation page reveals customer details only to a
  browser holding a signed, short-lived access token. Later access goes
  through `/track-order`, which requires the email the order was placed with.
- **Admin access is two independent checks**: the `admin` custom claim in the
  session cookie, and an `adminUsers/{uid}` document read on every request.
  The claim is fast but survives in a token for up to an hour, so the document
  is what makes `admin:revoke` take effect immediately.
- Passwords are held by Firebase Auth and never reach this application. The
  login form signs in from the browser and trades the resulting ID token at
  `/api/admin/session` for an httpOnly session cookie.
- Admin authorisation is enforced inside every protected page and every
  mutating server action, not in middleware alone.
- Public write endpoints are rate limited per client. The limiter is
  in-memory, so behind multiple instances the limit applies per instance;
  move it to a shared store before scaling horizontally.
- Informational page content is Markdown rendered to React elements through a
  restricted parser — no `dangerouslySetInnerHTML`, and `javascript:` /
  `data:` URLs are stripped.

## Provisioning a real Firebase project

```bash
# Save the service account key somewhere outside the repo.
mkdir -p ~/.config/palaciodoce
mv ~/Downloads/<project>-firebase-adminsdk-*.json ~/.config/palaciodoce/service-account.json
chmod 600 ~/.config/palaciodoce/service-account.json

npm run setup:production
```

`setup:production` does everything a service account is allowed to do: checks
the database exists and is in the EU, finds or creates the web app and reads its
SDK config, writes `.env.production` with a generated `AUTH_SECRET`, enables
Email/Password sign-in, publishes the rules and indexes, seeds the catalogue,
and creates the first administrator. It is idempotent — re-run it as often as
needed.

To bring historical orders across too, add
`-- --orders backups/<relational export>.json`. That also seeds the order-number
counters, so the next order continues the sequence instead of colliding with a
migrated one.

Two things the default `firebase-adminsdk` service account cannot do, because
provisioning permissions are deliberately kept out of that role. The script
stops at each with the exact console URL:

- **Creating the Firestore database.** Pick `europe-west1`. The location is
  fixed at creation, and the privacy policy states in all three languages that
  customer data is held in the EU — `setup:production` refuses to continue
  against a non-EU region rather than let the policy become untrue.
- **Initialising Firebase Authentication.** One click on "Get started"; the
  script enables the Email/Password provider itself after that.

Granting the service account `roles/serviceusage.serviceUsageAdmin` lets
`npm run setup:apis` turn the APIs on instead, which removes the first of those
two steps. Whether that is worth handing a key broader permissions is a
judgement call.

### Also before going live

- Have a lawyer review the privacy policy in `data/catalogue.json`. It names
  Google as a processor and commits to EU hosting; both statements need to
  match what you actually set up.
- Update `BUSINESS.siteUrl` in `src/lib/business.ts` if the domain changes;
  canonicals, hreflang, the sitemap and robots.txt all derive from it.
- Copy `.env.production` into the host's environment settings rather than
  uploading the file.
- Move the rate limiter to a shared store before running more than one
  instance.
- Consider upgrading to Identity Platform if you want MFA on the admin
  account. It is the main security gain Firebase Auth offers here.

### The `uuid` override

`package.json` forces `uuid` to `^11.1.1`. It arrives four levels down —
`firebase-admin` → `@google-cloud/storage` → `gaxios` → `uuid@9` — and the
pinned version carries a moderate advisory
([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)).

The advisory is not reachable here: it needs a `buf` argument passed to `v3`,
`v5` or `v6`, and gaxios' only use of the library is a bare `v4()` for a
multipart boundary. The override is there so `npm audit` stays at zero, because
a permanent known finding is how real ones get missed.

Remove it once `firebase-admin` ships a `gaxios` 7, which uses
`crypto.randomUUID` and drops the dependency. Before removing, check that
nothing else in the tree has started using `uuid`.

### Worth knowing about Firestore

- **The emulator does not enforce index requirements.** A query combining a
  filter and a sort on different fields works locally and then fails in
  production. Catalogue reads deliberately sort in memory to avoid this; the
  admin listings use real `orderBy` and have declared indexes.
- **There is no `UNIQUE` constraint.** Uniqueness comes from document ids —
  `orders/{orderNumber}`, `pages/{pageKey}`, `productSlugs/{locale}_{slug}` —
  so a duplicate fails as a collision instead of quietly becoming a second
  row. See `src/lib/firebase/collections.ts`.
- **Transactions must do all reads before any writes.** The order pipeline is
  arranged around this.
