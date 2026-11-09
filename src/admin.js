// Who may open the back office, the gate shown to everyone else, and the dashboard's data.
//
// Two kinds of staff:
//   owner  - emails in the ADMIN_EMAILS variable (wrangler.toml). Can do everything, including adding and removing admins.
//   admin  - emails an owner added from the Team section. Everything except managing the team.
// Critics (critics.email) can open /admin-reviews in critic mode, but never /admin.

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const bad = (m, s = 400) => json({ error: m }, s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const ownerEmails = (env) => String(env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

export async function roleOf(u, env) {
  const email = (u && u.email || "").toLowerCase();
  if (!email) return null;
  if (ownerEmails(env).includes(email)) return "owner";
  const row = await env.DB.prepare("SELECT email FROM admins WHERE email=?").bind(email).first().catch(() => null);
  return row ? "admin" : null;
}

export async function isCriticEmail(u, env) {
  const email = (u && u.email || "").toLowerCase();
  if (!email) return false;
  return !!(await env.DB.prepare("SELECT slug FROM critics WHERE lower(email)=? AND active=1").bind(email).first().catch(() => null));
}

// Shown instead of /admin or /admin-reviews to anyone who isn't allowed in. Lets staff sign in right here.
export function gatePage(u, which) {
  const signedIn = !!(u && u.email);
  const title = which === "reviews" ? "Review desk" : "Back office";
  const msg = signedIn
    ? `You're signed in as <b>${esc(u.email)}</b>, which doesn't have access. Sign in with a staff email, or ask the owner to add yours.`
    : "This page is for Wackometer staff. Sign in with your staff email and we'll send you a 6-digit code.";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Wackometer</title><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{color-scheme:light;--ink:#1F2340;--muted:#646A8C;--line:#E4E7F4;--bile:#A8C42E;--bile-ink:#5A6E0C}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px 16px}
.box{width:100%;max-width:400px;display:flex;flex-direction:column;gap:14px;border:2px solid var(--line);border-radius:20px;padding:28px}
img{width:64px;height:auto}h1{margin:0;font-size:26px}p{margin:0;color:var(--muted)}p b{color:var(--ink)}
label{font-size:14px;font-weight:600;display:flex;flex-direction:column;gap:6px}
input[type=email],input[type=text]{font:inherit;padding:11px 14px;border:2px solid var(--line);border-radius:12px;width:100%}
input:focus-visible,button:focus-visible{outline:2px solid #86A01A;outline-offset:2px}
.chk{flex-direction:row;align-items:center;font-weight:400;color:var(--muted)}
button{font:inherit;font-weight:700;padding:11px 18px;border-radius:999px;border:0;background:var(--bile);color:#1D2013;cursor:pointer}
button[disabled]{opacity:.6;cursor:wait}#note{min-height:1.5em;font-size:14px}a{color:var(--bile-ink)}
</style></head><body><main class="box">
<img src="/brand/wacko.svg" alt="" width="64" height="74">
<h1>${title}</h1><p>${msg}</p>
<form id="f1"><label>Staff email<input type="email" id="em" autocomplete="email" required></label>
<label class="chk"><input type="checkbox" id="age" required> I'm 13 or older</label>
<button id="b1">Send my code</button></form>
<form id="f2" hidden><label>6-digit code<input type="text" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label><button id="b2">Sign in</button></form>
<p id="note" role="status"></p><p><a href="/">← Back to Wackometer</a></p></main>
<script>
const $=(i)=>document.getElementById(i),note=(t)=>$("note").textContent=t;
async function post(p,b){const r=await fetch(p,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)});return [r.ok,await r.json().catch(()=>({}))]}
function human(key){return new Promise((res)=>{const go=()=>{const box=document.createElement("div");$("f1").append(box);turnstile.render(box,{sitekey:key,callback:async(t)=>{await post("/api/human",{token:t});box.remove();res()}})};
 if(window.turnstile)return go();const s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js";s.onload=go;document.head.append(s)})}
$("f1").onsubmit=async(e)=>{e.preventDefault();$("b1").disabled=true;let [ok,d]=await post("/api/login",{email:$("em").value,age13:$("age").checked});
 if(!ok&&d.error==="challenge"){note("Quick check that you're human…");await human(d.siteKey);[ok,d]=await post("/api/login",{email:$("em").value,age13:$("age").checked})}
 $("b1").disabled=false;
 if(!ok){note(d.error||"That didn't work.");return}
 $("f1").hidden=true;$("f2").hidden=false;$("code").focus();note("Code sent. Check your inbox (and spam).")};
$("f2").onsubmit=async(e)=>{e.preventDefault();$("b2").disabled=true;const [ok,d]=await post("/api/login/code",{email:$("em").value,code:$("code").value});$("b2").disabled=false;
 if(!ok){note(d.error||"That code didn't work.");return}note("Signed in. Opening…");location.reload()};
</script></body></html>`;
  return new Response(html, { status: 403, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}

const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);
import { SETTING_DEFS, CFG, refreshSettings, cleanSetting } from "./settings.js";
import { tierOf } from "../web/js/score.js";
import { GENRES, GENRE_KEYS, GENRE_INFO, TOP10_PLAYLIST, genresOf } from "./hub.js";

/* ---------- public counters (no account needed) ---------- */
const RSTAT_T = ["view", "share", "card", "video", "badge", "listen", "vote", "react", "comment"];
const SRC = /^(google|bing|duckduckgo|yahoo|instagram|tiktok|facebook|x|reddit|youtube|discord|linkedin|pinterest|snapchat|threads|whatsapp|chatgpt|perplexity|email|direct|other)$/;
const LAND_PATH = /^\/(?:|reviews(?:\/[a-z0-9-]{1,80})?|genres|lists(?:\/\d{4}-\d{2}(?:\/[a-z-]{1,30})?)?|artists(?:\/[a-z0-9-]{1,80})?|critics(?:\/[a-z0-9-]{1,80})?|get-reviewed|rhymes\/(?:[a-z'-]{1,40})?|cliches\/(?:[a-z0-9-]{1,60})?|syllable-counter|write)$/;
export async function publicCounter(path, body, env) {
  const DB = env.DB, day = dayStr(Date.now());
  if (path === "/api/rstat") {
    const slug = String(body.slug || ""), t = String(body.t || "");
    if (!/^[a-z0-9-]{1,80}$/.test(slug) || !RSTAT_T.includes(t)) return bad("Bad counter.");
    const r = await DB.prepare("SELECT 1 FROM reviews WHERE slug=? AND status='live'").bind(slug).first();
    if (!r) return bad("No such review.", 404);
    await DB.prepare("INSERT INTO review_stats (slug,day,t,count) VALUES (?,?,?,1) ON CONFLICT(slug,day,t) DO UPDATE SET count=count+1").bind(slug, day, t).run();
    return json({ ok: true });
  }
  if (path === "/api/landing") {
    const p = String(body.path || "").toLowerCase().replace(/\/+$/, "") || "/", src = String(body.src || "");
    if (!(p === "/" || LAND_PATH.test(p)) || !SRC.test(src)) return bad("Bad counter.");
    await DB.prepare("INSERT INTO landing (day,path,src,count) VALUES (?,?,?,1) ON CONFLICT(day,path,src) DO UPDATE SET count=count+1").bind(day, p, src).run();
    return json({ ok: true });
  }
  return bad("Not found", 404);
}

/* ---------- activity log ---------- */
const LOG_KEYS = ["action", "slug", "id", "email", "username", "status", "title", "artist", "name", "key", "plan", "days", "n", "test", "again"];
export async function logAction(env, u, path, body) {
  try {
    const d = {}; for (const k of LOG_KEYS) if (body && body[k] !== undefined && body[k] !== "" && typeof body[k] !== "object") d[k] = String(body[k]).slice(0, 80);
    if (body && body.settings && typeof body.settings === "object") d.settings = Object.keys(body.settings).join(", ").slice(0, 160);
    await env.DB.prepare("INSERT INTO admin_log (at,email,path,detail) VALUES (?,?,?,?)").bind(Date.now(), u.email || null, path.slice(0, 80), JSON.stringify(d).slice(0, 400)).run();
  } catch (e) {}
}

/* ---------- Stripe (read only) ---------- */
async function sget(env, path, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) (Array.isArray(v) ? v : [v]).forEach((x) => q.append(k, String(x)));
  const r = await fetch(`https://api.stripe.com/v1/${path}?${q}`, { headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || "Stripe error"); return d;
}
async function sall(env, path, params, max = 10) {
  let out = [], after = null;
  for (let i = 0; i < max; i++) { const d = await sget(env, path, { ...params, limit: 100, ...(after ? { starting_after: after } : {}) }); out = out.concat(d.data); if (!d.has_more) break; after = d.data[d.data.length - 1].id; }
  return out;
}
const monthOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 7);
// The Stripe account is shared with other products, so only Wackometer's own prices and payments count here.
async function revenue(env) {
  const DB = env.DB, out = { months: {}, recent: [], subs: { monthly: 0, yearly: 0 }, mrr: 0, cancels: {}, refunds: { n: 0, cents: 0, byMonth: {} }, stripe: !!env.STRIPE_SECRET_KEY, note: "" };
  const since = Math.floor((Date.now() - 365 * 86400000) / 1000);
  const add = (m, k, c) => { (out.months[m] ||= { pro: 0, reviews: 0 })[k] += c; };
  // paid reviews come from our own records
  const { results: paid } = await DB.prepare("SELECT artist, title, amount, created_at FROM review_requests WHERE paid=1 AND created_at>=? ORDER BY created_at DESC").bind(since * 1000).all();
  for (const r of paid) { add(new Date(r.created_at).toISOString().slice(0, 7), "reviews", r.amount || 0); }
  paid.slice(0, 15).forEach((r) => out.recent.push({ at: r.created_at, kind: "Song review", who: r.artist + (r.title ? " · " + r.title : ""), cents: r.amount || 0 }));
  if (!env.STRIPE_SECRET_KEY) { out.note = "Stripe isn't connected, so only paid reviews are counted."; return out; }
  const prices = [env.PRO_PRICE_MONTHLY, env.PRO_PRICE_YEARLY].filter(Boolean);
  try {
    // Pro: every subscription on the two Pro prices, then their paid invoices
    const subs = [];
    for (const price of prices) subs.push(...(await sall(env, "subscriptions", { price, status: "all" }, 5)).map((x) => ({ ...x, _price: price })));
    const subIds = new Set(subs.map((x) => x.id));
    for (const x of subs) {
      if (["active", "trialing", "past_due"].includes(x.status)) { if (x._price === env.PRO_PRICE_YEARLY) out.subs.yearly++; else out.subs.monthly++; }
      if (x.canceled_at && x.canceled_at >= since) { const m = monthOf(x.canceled_at); out.cancels[m] = (out.cancels[m] || 0) + 1; }
    }
    out.mrr = Math.round(out.subs.monthly * 799 + out.subs.yearly * 5900 / 12);
    const invs = await sall(env, "invoices", { status: "paid", "created[gte]": since }, 10);
    const proInv = invs.filter((i) => subIds.has(typeof i.subscription === "string" ? i.subscription : i.subscription?.id) || (i.lines?.data || []).some((l) => prices.includes(l.price?.id || l.pricing?.price_details?.price)));
    const proCharges = new Set();
    for (const i of proInv) { add(monthOf(i.status_transitions?.paid_at || i.created), "pro", i.amount_paid || 0); if (i.charge) proCharges.add(typeof i.charge === "string" ? i.charge : i.charge.id); out.recent.push({ at: (i.status_transitions?.paid_at || i.created) * 1000, kind: "Wingman Pro", who: i.customer_email || "", cents: i.amount_paid || 0 }); }
    // refunds on Wackometer charges only
    const refunds = await sall(env, "refunds", { "created[gte]": since, "expand[]": "data.charge" }, 5);
    for (const r of refunds) {
      const ch = r.charge && typeof r.charge === "object" ? r.charge : null;
      const ours = ch && (proCharges.has(ch.id) || ch.metadata?.kind === "review_submission" || /wackometer/i.test(ch.description || "") || /WACKOMETER/.test(ch.calculated_statement_descriptor || ""));
      if (!ours || r.status === "failed" || r.status === "canceled") continue;
      out.refunds.n++; out.refunds.cents += r.amount; const m = monthOf(r.created); out.refunds.byMonth[m] = (out.refunds.byMonth[m] || 0) + r.amount;
    }
  } catch (e) { out.note = "Couldn't read Stripe just now (" + e.message + "). Showing paid reviews only."; }
  out.recent.sort((a, b) => b.at - a.at); out.recent = out.recent.slice(0, 20);
  return out;
}

/* ---------- SendGrid (read only) ---------- */
async function sendgridStats(env, days) {
  if (!env.SENDGRID_API_KEY) return { error: "SendGrid isn't connected." };
  const start = dayStr(Date.now() - days * 86400000);
  const get = async (u) => { const r = await fetch("https://api.sendgrid.com/v3/" + u, { headers: { authorization: `Bearer ${env.SENDGRID_API_KEY}` } }); const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error((d.errors && d.errors[0] && d.errors[0].message) || "SendGrid error " + r.status), { status: r.status }); return d; };
  try {
    const all = await get(`stats?start_date=${start}&aggregated_by=week`);
    let list = []; try { list = await get(`categories/stats?start_date=${start}&aggregated_by=week&categories=wicked-of-the-week`); } catch (e) {}
    const flat = (rows) => rows.map((w) => ({ date: w.date, ...(w.stats || []).reduce((a, s) => { for (const [k, v] of Object.entries(s.metrics || {})) a[k] = (a[k] || 0) + v; return a; }, {}) }));
    return { all: flat(all), list: flat(list) };
  } catch (e) { return { error: e.status === 403 ? "The SendGrid key can send email but can't read stats. In SendGrid → Settings → API Keys, give the key “Stats: Read Access” (or make a second key with it), then this fills in." : e.message }; }
}

// Dashboard endpoints. Caller has already checked that `role` is owner or admin.
export async function adminDashApi(path, method, url, body, u, env, role) {
  const DB = env.DB;

  // Every daily counter in a date range: the activity chart filters these in the browser.
  if (path === "/api/admin/series" && method === "GET") {
    const days = Math.max(1, Math.min(800, parseInt(url.searchParams.get("days") || "120", 10) || 120));
    const since = dayStr(Date.now() - days * 86400000);
    const { results } = await DB.prepare("SELECT day, type, count FROM events WHERE day >= ? ORDER BY day").bind(since).all();
    // New sign-ins and new wall posts per day come straight from the tables, so they're right even before tracking existed.
    const sinceMs = Date.now() - days * 86400000;
    const { results: users } = await DB.prepare("SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') day, COUNT(*) c FROM users WHERE email IS NOT NULL AND created_at>=? GROUP BY day").bind(sinceMs).all();
    const { results: subs } = await DB.prepare("SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') day, COUNT(*) c FROM subscribers WHERE created_at>=? GROUP BY day").bind(sinceMs).all().catch(() => ({ results: [] }));
    const { results: paid } = await DB.prepare("SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') day, COUNT(*) c, COALESCE(SUM(amount),0) cents FROM review_requests WHERE paid=1 AND created_at>=? GROUP BY day").bind(sinceMs).all().catch(() => ({ results: [] }));
    const rows = results.slice();
    users.forEach((r) => rows.push({ day: r.day, type: "db:accounts", count: r.c }));
    subs.forEach((r) => rows.push({ day: r.day, type: "db:subscribers", count: r.c }));
    paid.forEach((r) => { rows.push({ day: r.day, type: "db:paid_reviews", count: r.c }); rows.push({ day: r.day, type: "db:revenue", count: Math.round(r.cents / 100) }); });
    return json({ since, today: dayStr(Date.now()), rows });
  }

  // Reviews, money, community: counts for the cards.
  if (path === "/api/admin/business" && method === "GET") {
    const one = async (q, ...b) => { try { return (await DB.prepare(q).bind(...b).first()) || {}; } catch (e) { return {}; } };
    const all = async (q, ...b) => { try { return (await DB.prepare(q).bind(...b).all()).results; } catch (e) { return []; } };
    const month = Date.now() - 30 * 86400000;
    return json({
      reviews: await all("SELECT status, COUNT(*) c FROM reviews GROUP BY status"),
      assist: (await one("SELECT COUNT(*) c FROM reviews WHERE assist=1 AND status!='live'")).c || 0,
      requests: await all("SELECT status, paid, COUNT(*) c FROM review_requests GROUP BY status, paid"),
      revenue: {
        all: (await one("SELECT COALESCE(SUM(amount),0) c, COUNT(*) n FROM review_requests WHERE paid=1")),
        month: (await one("SELECT COALESCE(SUM(amount),0) c, COUNT(*) n FROM review_requests WHERE paid=1 AND created_at>=?", month)),
      },
      pro: (await one("SELECT COUNT(*) c FROM users WHERE pro_until>?", Date.now())).c || 0,
      subscribers: (await one("SELECT COUNT(*) c FROM subscribers WHERE unsubscribed=0")).c || 0,
      critics: (await one("SELECT COUNT(*) c FROM critics WHERE active=1")).c || 0,
      applications: (await one("SELECT COUNT(*) c FROM critic_applications WHERE status='new'")).c || 0,
      claims: (await one("SELECT COUNT(*) c FROM artist_claims WHERE status='new'")).c || 0,
      comments: (await one("SELECT COUNT(*) c FROM review_comments WHERE created_at>=?", month)).c || 0,
      hiddenComments: (await one("SELECT COUNT(*) c FROM review_comments WHERE hidden=1")).c || 0,
      recentPaid: await all("SELECT artist, title, amount, status, created_at FROM review_requests WHERE paid=1 ORDER BY created_at DESC LIMIT 8"),
      toReview: await all("SELECT artist, title, paid, created_at FROM review_requests WHERE status IN ('new','pending') ORDER BY paid DESC, created_at ASC LIMIT 8"),
    });
  }

  // Find a person by email or username.
  if (path === "/api/admin/people" && method === "GET") {
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 80);
    const base = `SELECT u.id, u.email, u.username, u.display_name, u.pro_until, u.credits, u.created_at, u.stripe_customer IS NOT NULL paying,
      (SELECT COUNT(*) FROM readings r WHERE r.user_id=u.id) posts FROM users u`;
    const { results } = q
      ? await DB.prepare(`${base} WHERE lower(u.email) LIKE ? OR lower(u.username) LIKE ? ORDER BY u.created_at DESC LIMIT 40`).bind(`%${q}%`, `%${q}%`).all()
      : await DB.prepare(`${base} WHERE u.email IS NOT NULL ORDER BY u.created_at DESC LIMIT 40`).all();
    return json({ people: results });
  }
  if (path === "/api/admin/people" && method === "POST") {
    const id = String(body.id || "");
    const p = await DB.prepare("SELECT id, pro_until FROM users WHERE id=?").bind(id).first();
    if (!p) return bad("No one with that id.", 404);
    if (body.action === "gift_pro") {
      const days = Math.max(1, Math.min(365, parseInt(body.days, 10) || 30));
      const from = Math.max(Date.now(), p.pro_until || 0);
      await DB.prepare("UPDATE users SET pro_until=? WHERE id=?").bind(from + days * 86400000, id).run();
    } else if (body.action === "credits") {
      const n = Math.max(1, Math.min(500, parseInt(body.n, 10) || 10));
      await DB.prepare("UPDATE users SET credits=credits+? WHERE id=?").bind(n, id).run();
    } else return bad("Unknown action.");
    return json({ ok: true });
  }

  /* ----- money ----- */
  if (path === "/api/admin/revenue" && method === "GET") {
    const fresh = url.searchParams.get("fresh") === "1";
    const c = await DB.prepare("SELECT v FROM settings WHERE k='cache:revenue'").first().catch(() => null);
    if (c && !fresh) { const d = JSON.parse(c.v); if (Date.now() - d._at < 15 * 60000) return json(d); }
    const d = { ...(await revenue(env)), _at: Date.now() };
    await DB.prepare("INSERT INTO settings (k,v) VALUES ('cache:revenue',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(d)).run();
    return json(d);
  }

  /* ----- review performance ----- */
  if (path === "/api/admin/review-stats" && method === "GET") {
    const D = /^\d{4}-\d{2}-\d{2}$/, since = D.test(url.searchParams.get("from") || "") ? url.searchParams.get("from") : dayStr(Date.now() - 29 * 86400000), until = D.test(url.searchParams.get("to") || "") ? url.searchParams.get("to") : "9999-12-31";
    const { results: reviews } = await DB.prepare("SELECT slug, artist, title, score, genre, reviewer, cover_url, published_at, featured FROM reviews WHERE status='live' ORDER BY published_at DESC").all();
    const st = {}; (await DB.prepare("SELECT slug, t, SUM(count) c FROM review_stats WHERE day>=? AND day<=? GROUP BY slug, t").bind(since, until).all()).results.forEach((r) => ((st[r.slug] ||= {})[r.t] = r.c));
    const all = {}; (await DB.prepare("SELECT slug, t, SUM(count) c FROM review_stats GROUP BY slug, t").all()).results.forEach((r) => ((all[r.slug] ||= {})[r.t] = r.c));
    const votes = {}; (await DB.prepare("SELECT slug, COUNT(*) n, AVG(tier) avg FROM review_votes GROUP BY slug").all()).results.forEach((r) => (votes[r.slug] = r));
    const rx = {}; (await DB.prepare("SELECT slug, COUNT(*) n FROM review_reactions GROUP BY slug").all().catch(() => ({ results: [] }))).results.forEach((r) => (rx[r.slug] = r.n));
    const cm = {}; (await DB.prepare("SELECT slug, COUNT(*) n FROM review_comments WHERE hidden=0 GROUP BY slug").all().catch(() => ({ results: [] }))).results.forEach((r) => (cm[r.slug] = r.n));
    const { results: daily } = await DB.prepare("SELECT day, t, SUM(count) c FROM review_stats WHERE day>=? AND day<=? GROUP BY day, t ORDER BY day").bind(since, until).all();
    return json({ since, daily, reviews: reviews.map((r) => ({ ...r, tier: tierOf(r.score), range: st[r.slug] || {}, total: all[r.slug] || {}, votes: votes[r.slug]?.n || 0, crowd: votes[r.slug] ? Math.round(votes[r.slug].avg * 10) / 10 : null, reactions: rx[r.slug] || 0, comments: cm[r.slug] || 0 })) });
  }

  /* ----- email ----- */
  if (path === "/api/admin/email" && method === "GET") {
    const days = 120, since = Date.now() - days * 86400000;
    const subs = await DB.prepare("SELECT COUNT(*) total, SUM(CASE WHEN unsubscribed=0 THEN 1 ELSE 0 END) active, SUM(unsubscribed) gone FROM subscribers").first().catch(() => ({}));
    const { results: growth } = await DB.prepare("SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') day, COUNT(*) c FROM subscribers WHERE created_at>=? GROUP BY day ORDER BY day").bind(since).all().catch(() => ({ results: [] }));
    const { results: sources } = await DB.prepare("SELECT COALESCE(source,'unknown') source, COUNT(*) c FROM subscribers WHERE unsubscribed=0 GROUP BY source ORDER BY c DESC").all().catch(() => ({ results: [] }));
    const { results: sends } = await DB.prepare("SELECT at, kind, subject, recipients, by_email FROM email_log ORDER BY at DESC LIMIT 20").all().catch(() => ({ results: [] }));
    const last = await DB.prepare("SELECT v FROM settings WHERE k='wotw_last'").first().catch(() => null);
    return json({ subs, growth, sources, sends, lastSent: last ? Number(last.v) : null, sendgrid: await sendgridStats(env, days) });
  }

  /* ----- SEO ----- */
  if (path === "/api/admin/seo" && method === "GET") {
    const D = /^\d{4}-\d{2}-\d{2}$/, since = D.test(url.searchParams.get("from") || "") ? url.searchParams.get("from") : dayStr(Date.now() - 29 * 86400000), until = D.test(url.searchParams.get("to") || "") ? url.searchParams.get("to") : "9999-12-31";
    const { results: pages } = await DB.prepare("SELECT path, src, SUM(count) c FROM landing WHERE day>=? AND day<=? GROUP BY path, src").bind(since, until).all();
    const { results: daily } = await DB.prepare("SELECT day, src, SUM(count) c FROM landing WHERE day>=? AND day<=? AND src IN ('google','bing','duckduckgo','yahoo','chatgpt','perplexity') GROUP BY day, src ORDER BY day").bind(since, until).all();
    return json({ since, pages, daily, gsc: env.GSC_CONNECTED ? true : false });
  }

  /* ----- critics ----- */
  if (path === "/api/admin/critics" && method === "GET") {
    const { results: critics } = await DB.prepare("SELECT slug, name, photo_url, active FROM critics ORDER BY sort, name").all().catch(() => ({ results: [] }));
    const { results: revs } = await DB.prepare("SELECT r.slug, r.reviewer, r.score, r.status, r.published_at, r.created_at, q.created_at asked, q.paid FROM reviews r LEFT JOIN review_requests q ON q.id=r.request_id").all();
    const votes = {}; (await DB.prepare("SELECT slug, COUNT(*) n, AVG(tier) avg FROM review_votes GROUP BY slug").all()).results.forEach((v) => (votes[v.slug] = v));
    const { results: queue } = await DB.prepare("SELECT critic, COUNT(*) c FROM review_requests WHERE status IN ('new','pending') AND paid=1 GROUP BY critic").all().catch(() => ({ results: [] }));
    const month = Date.now() - 30 * 86400000;
    const rows = critics.map((c) => {
      const mine = revs.filter((r) => (r.reviewer || "").trim().toLowerCase() === c.name.trim().toLowerCase());
      const live = mine.filter((r) => r.status === "live");
      const turn = live.filter((r) => r.asked && r.published_at).map((r) => (r.published_at - r.asked) / 86400000);
      const judged = live.filter((r) => votes[r.slug] && votes[r.slug].n >= 3);
      const agree = judged.filter((r) => Math.abs(votes[r.slug].avg - tierOf(r.score)) <= 0.75).length;
      return { slug: c.slug, name: c.name, photo: c.photo_url, active: !!c.active, live: live.length, drafts: mine.length - live.length, month: live.filter((r) => r.published_at >= month).length,
        avg: live.length ? Math.round(live.reduce((a, r) => a + r.score, 0) / live.length) : null, turnaround: turn.length ? Math.round(turn.reduce((a, b) => a + b, 0) / turn.length * 10) / 10 : null,
        paid: live.filter((r) => r.paid).length, judged: judged.length, agree: judged.length ? Math.round(agree / judged.length * 100) : null, queue: (queue.find((q) => q.critic === c.slug) || {}).c || 0 };
    });
    return json({ critics: rows });
  }

  /* ----- playlists ----- */
  if (path === "/api/admin/playlists" && method === "GET") {
    await refreshSettings(DB, true);
    const { results: live } = await DB.prepare("SELECT slug, artist, title, score, genre, spotify_url, cover_url, published_at FROM reviews WHERE status='live' ORDER BY score DESC, published_at DESC").all();
    const saved = {}; (await DB.prepare("SELECT k, v FROM settings WHERE k LIKE 'pl:%'").all()).results.forEach((r) => { try { saved[r.k.slice(3)] = JSON.parse(r.v); } catch (e) {} });
    const lists = [["top10", "Wackometer Top 10", CFG.top10_playlist || TOP10_PLAYLIST, 10, live]].concat(GENRES.map(([k, n]) => [k, n, CFG["playlist_" + k] || GENRE_INFO[k].playlist, 25, live.filter((r) => genresOf(r.genre).includes(k))]));
    return json({ lists: lists.map(([key, name, playlist, size, pool]) => ({ key, name, playlist, size, saved: saved[key] || null, pool: pool.slice(0, 60).map((r) => ({ slug: r.slug, artist: r.artist, title: r.title, score: r.score, cover: r.cover_url, spotify: r.spotify_url || "", track: /open\.spotify\.com\/(intl-[a-z]+\/)?(track|album)\/[A-Za-z0-9]{22}/.test(r.spotify_url || "") })) })) });
  }
  if (path === "/api/admin/playlists" && method === "POST") {
    const key = String(body.key || "");
    if (key !== "top10" && !GENRE_KEYS.includes(key)) return bad("Unknown playlist.");
    const slugs = (Array.isArray(body.slugs) ? body.slugs : []).map(String).filter((x) => /^[a-z0-9-]{1,80}$/.test(x)).slice(0, 50);
    await DB.prepare("INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind("pl:" + key, JSON.stringify({ slugs, at: Date.now(), by: u.email })).run();
    return json({ ok: true });
  }

  /* ----- activity log ----- */
  if (path === "/api/admin/log" && method === "GET") {
    const q = String(url.searchParams.get("q") || "").toLowerCase().slice(0, 60);
    const { results } = q
      ? await DB.prepare("SELECT at, email, path, detail FROM admin_log WHERE lower(email) LIKE ? OR lower(path) LIKE ? OR lower(detail) LIKE ? ORDER BY id DESC LIMIT 200").bind(`%${q}%`, `%${q}%`, `%${q}%`).all()
      : await DB.prepare("SELECT at, email, path, detail FROM admin_log ORDER BY id DESC LIMIT 200").all();
    return json({ log: results });
  }

  /* ----- settings ----- */
  if (path === "/api/admin/settings" && method === "GET") {
    await refreshSettings(DB, true);
    return json({ role, defs: SETTING_DEFS.map(([key, label, type, def, help]) => ({ key, label, type, def, help, value: CFG[key] })) });
  }
  if (path === "/api/admin/settings" && method === "POST") {
    if (role !== "owner") return bad("Only an owner can change site settings.", 403);
    const changes = body.settings && typeof body.settings === "object" ? body.settings : {};
    const stmts = [];
    for (const [k, v] of Object.entries(changes)) { const [ok, val] = cleanSetting(k, v); if (!ok) return bad(`${k}: ${val}`); stmts.push(DB.prepare("INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind("cfg:" + k, val)); }
    if (stmts.length) await DB.batch(stmts);
    await refreshSettings(DB, true);
    return json({ ok: true, saved: stmts.length });
  }

  // Who has access.
  if (path === "/api/admin/team" && method === "GET") {
    const { results: admins } = await DB.prepare("SELECT email, added_by, created_at FROM admins ORDER BY created_at").all();
    const { results: critics } = await DB.prepare("SELECT name, email, active FROM critics WHERE email IS NOT NULL AND email!='' ORDER BY name").all().catch(() => ({ results: [] }));
    return json({ me: u.email, role, owners: ownerEmails(env), admins, critics });
  }
  if (path === "/api/admin/team" && method === "POST") {
    if (role !== "owner") return bad("Only an owner can change who has access.", 403);
    const email = String(body.email || "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 200) return bad("That doesn't look like an email address.");
    if (body.action === "add") {
      if (ownerEmails(env).includes(email)) return bad("That email is already an owner.");
      await DB.prepare("INSERT OR IGNORE INTO admins (email, added_by, created_at) VALUES (?,?,?)").bind(email, u.email, Date.now()).run();
    } else if (body.action === "remove") {
      await DB.prepare("DELETE FROM admins WHERE email=?").bind(email).run();
    } else return bad("Unknown action.");
    return json({ ok: true });
  }
  return null;
}
