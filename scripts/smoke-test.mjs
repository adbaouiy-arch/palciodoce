/**
 * End-to-end smoke test against a running Palácio Doce server.
 *
 *   npm run build && npm run start     # terminal 1
 *   npm run smoke                      # terminal 2
 *
 * Covers every public route in all three languages, the SEO endpoints,
 * RTL markup, structured data, 404s, that the admin area and private
 * pages are locked down, and that the order/consent APIs behave.
 *
 * Override the target with BASE_URL=https://... npm run smoke
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures = [];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function ok(message) {
  passed++;
  console.log(`  ${green("✓")} ${message}`);
}

function bad(message) {
  failed++;
  failures.push(message);
  console.log(`  ${red("✗")} ${message}`);
}

function section(title) {
  console.log(`\n${bold(title)}`);
}

/** Fetches without following redirects, so we can assert on 3xx. */
async function get(path) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const body = response.status < 300 ? await response.text() : "";
  return { status: response.status, body, headers: response.headers };
}

async function expectStatus(want, path, label = "") {
  const { status } = await get(path);
  const suffix = label ? ` ${label}` : "";
  if (status === want) ok(`${status} ${path}${suffix}`);
  else bad(`${path}${suffix} — expected ${want}, got ${status}`);
}

async function expectContains(path, needle, shouldContain = true) {
  const { body } = await get(path);
  const present = body.includes(needle);
  if (present === shouldContain) {
    ok(`${path} ${shouldContain ? "contains" : "omits"} ${JSON.stringify(needle)}`);
  } else {
    bad(
      `${path} ${present ? "unexpectedly contains" : "is missing"} ${JSON.stringify(needle)}`,
    );
  }
}

async function postJson(path, payload) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Non-JSON responses are reported as raw text.
  }
  return { status: response.status, json, text, headers: response.headers };
}

/**
 * Finds an orderable product id.
 *
 * Prefers ids present in the shop page payload, so the test exercises
 * only what the running server exposes. Falls back to the SQLite file so
 * the suite still works if the markup changes shape.
 */
async function discoverProductId() {
  const shop = await get("/loja");
  const fromMarkup = shop.body.match(/\b([a-z0-9]{25})\b/g) ?? [];

  for (const candidate of fromMarkup) {
    const probe = await postJson("/api/cart", {
      locale: "pt",
      items: [{ productId: candidate, quantity: 1 }],
    });
    if (probe.status === 200 && probe.json?.lines?.length === 1) return candidate;
  }

  try {
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync(
      "sqlite3",
      [
        "prisma/dev.db",
        "select id from products where isActive=1 order by position limit 1;",
      ],
      { encoding: "utf8" },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

async function main() {
  section("Storefront — Portuguese (default locale, unprefixed)");
  for (const path of [
    "/",
    "/loja",
    "/carrinho",
    "/finalizar-compra",
    "/pesquisa",
    "/sobre-nos",
    "/contactos",
    "/entrega-e-recolha",
    "/privacidade",
    "/termos",
    "/politica-de-cookies",
    "/rastrear-pedido",
    "/categoria/bolos",
    "/produto/cheesecake-frutos-vermelhos",
  ]) {
    await expectStatus(200, path);
  }

  section("Storefront — English");
  for (const path of [
    "/en",
    "/en/shop",
    "/en/cart",
    "/en/checkout",
    "/en/search",
    "/en/about",
    "/en/contact",
    "/en/delivery-pickup",
    "/en/privacy",
    "/en/terms",
    "/en/cookies",
    "/en/track-order",
    "/en/category/cakes",
    "/en/product/red-berry-cheesecake",
  ]) {
    await expectStatus(200, path);
  }

  section("Storefront — Arabic");
  for (const path of [
    "/ar",
    "/ar/shop",
    "/ar/cart",
    "/ar/checkout",
    "/ar/search",
    "/ar/about",
    "/ar/contact",
    "/ar/delivery-pickup",
    "/ar/privacy",
    "/ar/terms",
    "/ar/cookies",
    "/ar/track-order",
    "/ar/category/cakes",
    "/ar/product/red-berry-cheesecake",
  ]) {
    await expectStatus(200, path);
  }

  section("Search works in every language");
  await expectStatus(200, "/pesquisa?q=cheesecake");
  await expectStatus(200, "/en/search?q=almond");
  await expectStatus(200, `/ar/search?q=${encodeURIComponent("تشيز")}`);
  // A query typed in Arabic must still find products (cross-locale search).
  await expectContains(
    `/pesquisa?q=${encodeURIComponent("تشيز")}`,
    "Cheesecake",
    true,
  );

  section("SEO endpoints");
  await expectStatus(200, "/robots.txt");
  await expectStatus(200, "/sitemap.xml");
  await expectContains("/robots.txt", "Disallow: /admin", true);
  await expectContains("/robots.txt", "Sitemap:", true);
  await expectContains("/sitemap.xml", "hreflang", true);
  await expectContains("/sitemap.xml", "/admin", false);
  await expectContains("/sitemap.xml", "finalizar-compra", false);

  section("Per-page SEO metadata");
  await expectContains("/produto/cheesecake-frutos-vermelhos", 'hrefLang="ar"', true);
  await expectContains(
    "/produto/cheesecake-frutos-vermelhos",
    "/en/product/red-berry-cheesecake",
    true,
  );
  await expectContains("/produto/cheesecake-frutos-vermelhos", '"@type":"Product"', true);
  await expectContains("/", '"@type":"Bakery"', true);
  await expectContains("/", 'rel="canonical"', true);

  section("Direction and language markup");
  await expectContains("/ar", 'dir="rtl"', true);
  await expectContains("/ar", 'lang="ar"', true);
  await expectContains("/", 'dir="ltr"', true);
  await expectContains("/", 'lang="pt-PT"', true);
  await expectContains("/en", 'lang="en"', true);

  section("404 handling");
  for (const path of [
    "/nao-existe",
    "/en/nope",
    "/ar/nope",
    "/produto/inexistente",
    "/en/category/nope",
    "/admin/nope",
    "/missing.txt",
  ]) {
    await expectStatus(404, path);
  }

  section("Admin area is locked down");
  for (const path of [
    "/admin",
    "/admin/orders",
    "/admin/products",
    "/admin/messages",
    "/admin/orders/PD-20260916-0001",
  ]) {
    await expectStatus(307, path, "(redirects to login)");
  }
  await expectStatus(200, "/admin/login");
  await expectContains("/admin/login", "noindex", true);
  // An unauthenticated admin request must not render order data.
  await expectContains("/admin/orders", "PD-2026", false);

  section("Private pages are noindex");
  await expectContains("/carrinho", "noindex", true);
  await expectContains("/finalizar-compra", "noindex", true);
  await expectContains("/rastrear-pedido", "noindex", true);

  section("Order confirmation does not leak PII without a token");
  const leaked = await get("/confirmacao/PD-20260916-0001");
  if (leaked.status === 200 && !/Ana Silva|ana@example\.pt/.test(leaked.body)) {
    ok("/confirmacao/<order> renders without customer details");
  } else if (leaked.status === 404) {
    ok("/confirmacao/<order> 404 (order absent from this database)");
  } else {
    bad("/confirmacao/<order> leaked customer details to an unauthenticated visitor");
  }

  section("Order API");
  const productsResponse = await postJson("/api/cart", { locale: "pt", items: [] });
  if (productsResponse.status === 200) ok("/api/cart accepts an empty cart");
  else bad(`/api/cart returned ${productsResponse.status}`);

  /*
    To place a real order we need a real product id. Rather than scrape
    it out of the rendered markup (brittle, and the id is an internal
    detail the page has no reason to expose), ask /api/cart to resolve the
    ids embedded in the shop page's client payload — and if that finds
    nothing, fall back to reading the catalogue straight from the
    database.
  */
  const productId = await discoverProductId();

  if (!productId) {
    bad("could not discover a product id to place a test order");
  } else {
    const placed = await postJson("/api/orders", {
      locale: "pt",
      customerName: "Smoke Test",
      customerEmail: "smoke@example.pt",
      customerPhone: "+351911111111",
      fulfillmentMethod: "PICKUP",
      paymentMethod: "CASH_ON_PICKUP",
      items: [{ productId, quantity: 1 }],
    });

    if (placed.status === 201 && /^PD-\d{8}-\d{4}$/.test(placed.json?.orderNumber ?? "")) {
      ok(`201 order placed: ${placed.json.orderNumber}`);
    } else {
      bad(`order placement returned ${placed.status}: ${placed.text.slice(0, 120)}`);
    }

    // The confirmation cookie must be issued and signed.
    const cookie = placed.headers.get("set-cookie") ?? "";
    if (cookie.includes("PALACIODOCE_ORDER_ACCESS") && /HttpOnly/i.test(cookie)) {
      ok("order access cookie issued as HttpOnly");
    } else {
      bad("order access cookie missing or not HttpOnly");
    }

    // Payment method incompatible with pickup must be refused.
    const mismatch = await postJson("/api/orders", {
      locale: "pt",
      customerName: "Smoke Test",
      customerEmail: "smoke@example.pt",
      customerPhone: "+351911111111",
      fulfillmentMethod: "PICKUP",
      paymentMethod: "CASH_ON_DELIVERY",
      items: [{ productId, quantity: 1 }],
    });
    if (mismatch.status === 400 && mismatch.json?.error === "payment_not_allowed") {
      ok("cash-on-delivery refused for a pickup order");
    } else {
      bad(`payment/fulfilment mismatch returned ${mismatch.status}`);
    }

    // Delivery without an address must be refused.
    const noAddress = await postJson("/api/orders", {
      locale: "pt",
      customerName: "Smoke Test",
      customerEmail: "smoke@example.pt",
      customerPhone: "+351911111111",
      fulfillmentMethod: "DELIVERY",
      paymentMethod: "MBWAY",
      items: [{ productId, quantity: 1 }],
    });
    if (noAddress.status === 400) ok("delivery without an address refused");
    else bad(`delivery without address returned ${noAddress.status}`);
  }

  const emptyCart = await postJson("/api/orders", {
    locale: "pt",
    customerName: "Smoke Test",
    customerEmail: "smoke@example.pt",
    customerPhone: "+351911111111",
    fulfillmentMethod: "PICKUP",
    paymentMethod: "CASH_ON_PICKUP",
    items: [],
  });
  if (emptyCart.status === 400) ok("empty cart refused");
  else bad(`empty cart returned ${emptyCart.status}`);

  const badLocale = await postJson("/api/orders", {
    locale: "de",
    customerName: "Smoke Test",
    customerEmail: "smoke@example.pt",
    customerPhone: "+351911111111",
    fulfillmentMethod: "PICKUP",
    paymentMethod: "CASH_ON_PICKUP",
    items: [{ productId: "x", quantity: 1 }],
  });
  if (badLocale.status === 400) ok("unsupported locale refused");
  else bad(`unsupported locale returned ${badLocale.status}`);

  section("Contact and consent APIs");
  const contact = await postJson("/api/contact", {
    locale: "pt",
    name: "Smoke Test",
    email: "smoke@example.pt",
    message: "Esta é uma mensagem de teste automatizado.",
  });
  if (contact.status === 201) ok("201 contact message accepted");
  else bad(`contact returned ${contact.status}`);

  const consent = await postJson("/api/consent", {
    locale: "pt",
    necessary: true,
    analytics: false,
    marketing: false,
  });
  if (consent.status === 201) ok("201 consent recorded");
  else bad(`consent returned ${consent.status}`);

  const badConsent = await postJson("/api/consent", {
    locale: "pt",
    necessary: false,
    analytics: false,
    marketing: false,
  });
  if (badConsent.status === 400) ok("declining essential cookies refused");
  else bad(`necessary:false returned ${badConsent.status}`);

  console.log(`\n${"─".repeat(46)}`);
  console.log(`passed: ${green(passed)}   failed: ${failed ? red(failed) : failed}`);
  if (failures.length > 0) {
    console.log(`\n${bold("Failures")}`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    `\n${red("Smoke test could not run.")} Is the server up at ${BASE}?\n${error.message}`,
  );
  process.exit(1);
});
