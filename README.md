# Palácio Doce

Multilingual storefront for a pastry shop in Braga, Portugal. Built with
Next.js 16 (App Router), next-intl, Prisma 7 on SQLite, and Tailwind CSS 4.

The site serves three languages from one codebase: **Portuguese** (default,
unprefixed URLs), **English** and **Arabic** (right-to-left). Every URL
segment is translated too — `/loja`, `/en/shop`, `/ar/shop` — and each
language is independently indexable with its own canonical URL.

## Getting started

```bash
cp .env.example .env      # then fill in AUTH_SECRET
npm install
npm run db:migrate        # create the SQLite schema
npm run db:seed           # categories, products, legal pages, admin user
npm run dev
```

The storefront runs at http://localhost:3000 and the admin area at
http://localhost:3000/admin.

`AUTH_SECRET` signs the admin session and order-access cookies. Generate one
with `openssl rand -base64 48`. It is **required in production** — the app
refuses to start without it rather than falling back to a known key.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run check` | Message parity, route coverage, TypeScript, ESLint |
| `npm run smoke` | End-to-end HTTP test against a running server |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed catalogue, pages and admin user |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Browse the database |

`npm run smoke` needs a server already running (`npm run build && npm start`).
It checks all 42 public routes across the three languages, the SEO endpoints,
RTL markup, structured data, 404 handling, that the admin area and private
pages are locked down, and that the order, contact and consent APIs accept
valid input and reject invalid input.

## How the multilingual model works

One product, three translations — never three products. `Product` holds the
shared facts (SKU, price in cents, stock, images) and `ProductTranslation`
holds everything language-specific (name, slug, description, ingredients,
allergens, SEO copy). Categories and informational pages follow the same
shape. Adding a fourth language means adding it to `src/i18n/routing.ts` and
inserting translation rows; no restructuring.

Three consequences worth knowing:

- **The cart is locale-independent.** It stores only `productId` and
  `quantity`. Names and prices are re-resolved for the active language on
  every render (`/api/cart`), so switching language mid-shop never leaves
  stale, wrong-language text on screen.
- **Orders snapshot their language.** `OrderItem` stores the product name and
  slug *as the customer saw them*, so a historical order stays accurate even
  after the catalogue is edited, and confirmations can be sent in the
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
    api/             cart · orders · contact · consent
    sitemap.ts       All indexable URLs with hreflang alternates
    robots.ts        Localised disallow rules
  components/        UI, grouped by feature
  i18n/              routing · navigation · request config
  lib/
    data/            Database access, one module per aggregate
    order-pricing.ts Single source of truth for money maths
messages/            pt.json · en.json · ar.json (must stay in sync)
prisma/              schema · migrations · seed
scripts/             check-messages · check-routes · smoke-test
```

Two root layouts exist because `/admin` sits outside the locale routing: it
is excluded from the proxy matcher in `src/proxy.ts` and is Portuguese-only.
There is deliberately no `src/app/layout.tsx`.

## Notes on security

- Order totals are always recomputed server-side from database prices. The
  order API accepts product ids and quantities, never amounts.
- Stock is decremented with a guarded update, so two simultaneous checkouts
  cannot oversell the last item. Cancelling an order returns its stock.
- Order references (`PD-20260916-0001`) are sequential and therefore
  guessable, so the confirmation page reveals customer details only to a
  browser holding a signed, short-lived access token. Later access goes
  through `/track-order`, which requires the email the order was placed with.
- Admin authorisation is enforced inside every protected page and every
  mutating server action, not in middleware alone.
- Public write endpoints are rate limited per client. The limiter is
  in-memory, so behind multiple instances the limit applies per instance;
  move it to a shared store before scaling horizontally.
- Informational page content is Markdown rendered to React elements through a
  restricted parser — no `dangerouslySetInnerHTML`, and `javascript:` /
  `data:` URLs are stripped.

## Deployment checklist

- Set `AUTH_SECRET` (32+ characters) and a real `DATABASE_URL`.
- Change `ADMIN_PASSWORD` before seeding anything internet-facing.
- Update `BUSINESS.siteUrl` in `src/lib/business.ts` if the domain changes;
  canonicals, hreflang, the sitemap and robots.txt all derive from it.
- SQLite suits a single instance. For multiple instances, switch the Prisma
  datasource to Postgres and move the rate limiter to a shared store.
