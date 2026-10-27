// Wackometer API — Cloudflare Worker.
// Everything under /api/* lands here; Cloudflare serves the front end from /public.
import { SCHEMA } from "./schema.js";
import { analyze, tierOf, clamp, MID, TIERS, METRICS, words, dailyKey, dailyPrompt } from "../public/js/score.js";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const now = () => Date.now();
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const enc = new TextEncoder();

/* ---------------- database setup ---------------- */
let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) schemaReady = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

/* ---------------- sessions: anonymous account in a signed cookie ---------------- */
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function session(req, env) {
  const secret = env.SESSION_SECRET || "dev-only-secret-change-me";
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)wk=([a-z0-9]+)\.([a-f0-9]{64})/);
  if (m && safeEqual(await hmac(secret, m[1]), m[2])) {
    const u = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(m[1]).first();
    if (u) return { user: u, setCookie: null };
  }
  const id = "u" + rid();
  await env.DB.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").bind(id, now()).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  const setCookie = `wk=${id}.${await hmac(secret, id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=63072000${secure}`;
  return { user, setCookie };
}
const isPro = (u) => u.pro_until && u.pro_until > now();

/* ---------------- crowd math ---------------- */
async function crowdTune(env) {
  // For every post with 3+ votes: crowd's average score minus the meter's raw score.
  const per = await env.DB.prepare(
    `SELECT r.id, r.raw, COUNT(*) n,
            SUM(CASE v.tier WHEN 0 THEN 10 WHEN 1 THEN 30 WHEN 2 THEN 50 WHEN 3 THEN 70 ELSE 90 END) sm
     FROM readings r JOIN votes v ON v.reading_id=r.id
     WHERE r.hidden=0 GROUP BY r.id HAVING n>=3 ORDER BY r.created_at DESC LIMIT 300`
  ).all();
  const diffs = per.results.map((r) => r.sm / r.n - r.raw);
  if (diffs.length < 3) return { tune: 0, n: 0 };
  return { tune: Math.round(clamp(diffs.reduce((a, b) => a + b, 0) / diffs.length, -15, 15)), n: diffs.length };
}
async function usedToday(env, uid) {
  const r = await env.DB.prepare("SELECT wingman FROM usage WHERE user_id=? AND day=?").bind(uid, dailyKey()).first();
  return r ? r.wingman : 0;
}
function me(u, used, env) {
  return { id: u.id, pro: !!isPro(u), proUntil: u.pro_until || null, credits: u.credits, usedToday: used,
    freeDaily: +env.FREE_DAILY || 5, handle: u.handle || null, streak: u.streak || 0, lastDaily: u.last_daily || null,
    billing: !!u.stripe_customer, checkout: !!env.STRIPE_SECRET_KEY };
}
const cleanHandle = (h) => String(h || "").replace(/[^A-Za-z0-9_.\- ]/g, "").trim().slice(0, 20);

/* ---------------- Wingman (Claude API) ---------------- */
const WINGMAN_SYSTEM = `You are Wingman, the songwriting assistant inside Wackometer, an app that grades how wack lyrics are: Wicked 0-19, Well put 20-39, Whatever 40-59, Weird 60-79, Wack 80-100. Wack means clichés, lazy rhymes (fire/desire), abstract filler words, padding syllables and needless repetition.
Voice: a confident studio friend. Short, direct, warm, a little playful. Lean into words starting with W when it's natural, never forced.
Rules: write only original lyrics. Never reproduce or closely imitate lines from existing copyrighted songs, even if asked. Favor concrete, sensory, specific images over abstractions. When rewriting, keep the writer's meaning and voice. Plain text only, no markdown. Keep replies under 220 words unless asked for a full song.`;
const ROAST_SYSTEM = `You are Wretch, the queasy green blob from Wackometer, an app that grades how wack lyrics are. You roast the writer's lyrics in character: you're nauseous from clichés, you gag at lazy rhymes, you dramatically ask for a bucket. Be funny and specific: quote the exact phrases that made you sick and say why. Roast the writing, never the person: no insults about looks, identity, intelligence or anything personal, nothing cruel, no profanity. End with one genuinely useful fix, introduced with "Okay, real talk:". Plain text, under 120 words. If the lyrics are actually good, act shocked and disappointed you have nothing to roast.`;

async function callClaude(env, system, messages, maxTokens = 700) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: env.WINGMAN_MODEL || "claude-sonnet-5-5", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error(`claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

/* ---------------- Stripe ---------------- */
async function stripe(env, path, params) {
  const body = new URLSearchParams();
  const add = (k, v) => { if (v === undefined || v === null) return; if (typeof v === "object") for (const [kk, vv] of Object.entries(v)) add(`${k}[${kk}]`, vv); else body.append(k, String(v)); };
  for (const [k, v] of Object.entries(params)) add(k, v);
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST", headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" }, body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "stripe error");
  return data;
}
async function verifyStripe(env, payload, header) {
  const parts = Object.fromEntries((header || "").split(",").map((p) => p.split("=")));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(now() / 1000 - Number(parts.t)) > 600) return false;
  return safeEqual(await hmac(env.STRIPE_WEBHOOK_SECRET, `${parts.t}.${payload}`), parts.v1);
}
const periodEnd = (sub) => (sub.current_period_end || sub.items?.data?.[0]?.current_period_end || 0) * 1000;

/* ---------------- router ---------------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = req.method;

    // Stripe calls this directly; no session cookie.
    if (path === "/api/stripe/webhook" && method === "POST") { await ensureSchema(env); return stripeWebhook(req, env); }
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (method !== "GET" && req.headers.get("origin") && new URL(req.headers.get("origin")).host !== url.host) return bad("Wrong origin", 403);

    let s;
    try { await ensureSchema(env); s = await session(req, env); } catch (e) { return bad("Database isn't set up yet. Run the schema (see README).", 500); }
    const u = s.user;
    const body = method === "POST" ? await req.json().catch(() => ({})) : {};
    let res;
    try { res = await route(path, method, url, body, u, env); }
    catch (e) { console.error(e); res = bad("Something broke on our side. Try again in a moment.", 500); }
    if (s.setCookie) res.headers.append("set-cookie", s.setCookie);
    return res;
  },
};

async function route(path, method, url, body, u, env) {
  const DB = env.DB;

  if (path === "/api/me" && method === "GET") return json(me(u, await usedToday(env, u.id), env));

  if (path === "/api/handle" && method === "POST") {
    const h = cleanHandle(body.handle);
    if (h.length < 2) return bad("Pick a name with at least 2 letters or numbers.");
    await DB.prepare("UPDATE users SET handle=? WHERE id=?").bind(h, u.id).run();
    return json({ handle: h });
  }

  /* ----- Wall ----- */
  if (path === "/api/wall" && method === "GET") {
    const feed = url.searchParams.get("feed") === "featured" ? "featured" : "fresh";
    const q = feed === "featured"
      ? "SELECT * FROM readings WHERE hidden=0 AND vote_count>=5 ORDER BY vote_count DESC, created_at DESC LIMIT 60"
      : "SELECT * FROM readings WHERE hidden=0 ORDER BY created_at DESC LIMIT 60";
    const { results: rows } = await DB.prepare(q).all();
    const ids = rows.map((r) => r.id);
    const counts = {}, mine = {};
    if (ids.length) {
      const ph = ids.map(() => "?").join(",");
      const { results: vs } = await DB.prepare(`SELECT reading_id, tier, COUNT(*) c FROM votes WHERE reading_id IN (${ph}) GROUP BY reading_id, tier`).bind(...ids).all();
      vs.forEach((v) => ((counts[v.reading_id] ||= [0, 0, 0, 0, 0])[v.tier] = v.c));
      const { results: my } = await DB.prepare(`SELECT reading_id, tier FROM votes WHERE user_id=? AND reading_id IN (${ph})`).bind(u.id, ...ids).all();
      my.forEach((v) => (mine[v.reading_id] = v.tier));
    }
    const agg = await DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN v.tier=r.tier THEN 1 ELSE 0 END) agree FROM votes v JOIN readings r ON r.id=v.reading_id WHERE r.hidden=0`).first();
    const tune = await crowdTune(env);
    return json({
      feed,
      readings: rows.map((r) => ({ id: r.id, title: r.title, excerpt: r.excerpt, score: r.score, tier: r.tier, createdAt: r.created_at,
        votes: counts[r.id] || [0, 0, 0, 0, 0], myVote: mine[r.id] ?? null, mine: r.user_id === u.id })),
      stats: { votes: agg.total || 0, wavelength: agg.total ? Math.round((agg.agree / agg.total) * 100) : null, tune: tune.tune, tuneN: tune.n },
    });
  }
  if (path === "/api/tune" && method === "GET") return json(await crowdTune(env));

  if (path === "/api/wall" && method === "POST") {
    const text = String(body.text || "").slice(0, 4000);
    if (!body.attest) return bad("Confirm these are your own lyrics before posting.");
    if (words(text).length < 8) return bad("Give it at least eight words.");
    const today = await DB.prepare("SELECT COUNT(*) c FROM readings WHERE user_id=? AND created_at>?").bind(u.id, now() - 86400000).first();
    if (today.c >= 10) return bad("That's 10 posts today. Come back tomorrow.", 429);
    const a = analyze(text);
    const { tune } = await crowdTune(env);
    const score = Math.round(clamp(a.raw + tune));
    const id = rid();
    await DB.prepare(`INSERT INTO readings (id,user_id,title,excerpt,raw,score,tier,metrics,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(id, u.id, String(body.title || "").slice(0, 60), text.trim().slice(0, 700), Math.round(a.raw), score, tierOf(score),
        JSON.stringify(Object.fromEntries(Object.entries(a.vals).map(([k, v]) => [k, Math.round(v)]))), now()).run();
    return json({ id, score, tier: tierOf(score) });
  }
  let m;
  if ((m = path.match(/^\/api\/wall\/([a-z0-9]+)$/)) && method === "DELETE") {
    const r = await DB.prepare("DELETE FROM readings WHERE id=? AND user_id=?").bind(m[1], u.id).run();
    if (!r.meta.changes) return bad("That post isn't yours or is already gone.", 404);
    await DB.prepare("DELETE FROM votes WHERE reading_id=?").bind(m[1]).run();
    return json({ ok: true });
  }
  if (path === "/api/vote" && method === "POST") {
    const tier = Number(body.tier);
    if (!(tier >= 0 && tier <= 4)) return bad("Pick one of the five tiers.");
    const r = await DB.prepare("SELECT id, user_id FROM readings WHERE id=? AND hidden=0").bind(String(body.id || "")).first();
    if (!r) return bad("That post is gone.", 404);
    await DB.prepare(`INSERT INTO votes (reading_id,user_id,tier,created_at) VALUES (?,?,?,?)
                      ON CONFLICT(reading_id,user_id) DO UPDATE SET tier=excluded.tier, created_at=excluded.created_at`).bind(r.id, u.id, tier, now()).run();
    await DB.prepare("UPDATE readings SET vote_count=(SELECT COUNT(*) FROM votes WHERE reading_id=?) WHERE id=?").bind(r.id, r.id).run();
    return json({ ok: true });
  }
  if (path === "/api/report" && method === "POST") {
    const id = String(body.id || "");
    const ins = await DB.prepare("INSERT OR IGNORE INTO reports (reading_id,user_id,reason,created_at) VALUES (?,?,?,?)").bind(id, u.id, String(body.reason || "").slice(0, 100), now()).run();
    if (ins.meta.changes) await DB.prepare("UPDATE readings SET reports=reports+1, hidden=CASE WHEN reports+1>=3 THEN 1 ELSE hidden END WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  /* ----- Wingman + Roast ----- */
  if (path === "/api/wingman" && method === "POST") {
    if (!env.ANTHROPIC_API_KEY) return bad("Wingman isn't connected yet. Add ANTHROPIC_API_KEY (see README).", 503);
    const free = +env.FREE_DAILY || 5, used = await usedToday(env, u.id), pro = isPro(u);
    let payWith = "free";
    if (!pro && used >= free) {
      if (u.credits > 0) payWith = "credit";
      else return json({ error: "limit", message: `That's your ${free} free Wingman messages for today. They reset at midnight, or go Pro for unlimited.` }, 402);
    }
    const mode = body.mode === "roast" ? "roast" : "chat";
    const pad = String(body.pad || "").slice(0, 4000);
    const msg = String(body.message || "").slice(0, 1500);
    if (mode === "chat" && !msg.trim()) return bad("Ask Wingman something.");
    if (mode === "roast" && words(pad).length < 8) return bad("Give Wretch at least eight words to roast.");
    const a = pad.trim() ? analyze(pad) : null;
    const reading = a ? `Wackometer reading: ${Math.round(a.raw)}/100 (${TIERS[tierOf(a.raw)].n}). ` + METRICS.map((mm) => `${mm.n} ${Math.round(a.vals[mm.k])}`).join(", ") + `. Clichés found: ${a.found.map((f) => f[0]).join(", ") || "none"}.` : "No lyrics in the pad.";
    let text;
    if (mode === "roast") {
      text = await callClaude(env, ROAST_SYSTEM, [{ role: "user", content: `Roast these lyrics.\n"""\n${pad}\n"""\n${reading}` }], 400);
    } else {
      const hist = (Array.isArray(body.history) ? body.history : []).slice(-10)
        .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
        .map((h) => ({ role: h.role, content: h.content.slice(0, 2000) }));
      while (hist.length && hist[0].role !== "user") hist.shift();
      const messages = [...hist, { role: "user", content: `My Weigh pad:\n"""\n${pad || "(empty)"}\n"""\n${reading}\n\n${msg}` }];
      // the API needs alternating roles
      const fixed = []; for (const x of messages) { if (fixed.length && fixed[fixed.length - 1].role === x.role) fixed[fixed.length - 1].content += "\n\n" + x.content; else fixed.push({ ...x }); }
      text = await callClaude(env, WINGMAN_SYSTEM, fixed);
    }
    if (payWith === "credit") await DB.prepare("UPDATE users SET credits=credits-1 WHERE id=? AND credits>0").bind(u.id).run();
    else await DB.prepare(`INSERT INTO usage (user_id,day,wingman) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET wingman=wingman+1`).bind(u.id, dailyKey()).run();
    const fresh = await DB.prepare("SELECT * FROM users WHERE id=?").bind(u.id).first();
    return json({ text, me: me(fresh, await usedToday(env, u.id), env) });
  }

  /* ----- Daily W ----- */
  if (path === "/api/daily" && method === "GET") {
    const key = dailyKey(), p = dailyPrompt(key);
    const mineRow = await DB.prepare("SELECT * FROM daily_entries WHERE day=? AND user_id=?").bind(key, u.id).first();
    const { results: crew } = await DB.prepare(
      `SELECT e.user_id, e.lines, e.score, e.tier, us.handle, (SELECT COUNT(*) FROM daily_likes l WHERE l.day=e.day AND l.entry_user=e.user_id) fires
       FROM daily_entries e JOIN users us ON us.id=e.user_id WHERE e.day=? ORDER BY e.score ASC, e.created_at ASC LIMIT 20`).bind(key).all();
    const { results: crowd } = await DB.prepare(
      `SELECT e.user_id, e.lines, e.score, e.tier, us.handle, COUNT(l.user_id) fires
       FROM daily_entries e JOIN users us ON us.id=e.user_id LEFT JOIN daily_likes l ON l.day=e.day AND l.entry_user=e.user_id
       WHERE e.day=? GROUP BY e.user_id HAVING fires>0 ORDER BY fires DESC, e.score ASC LIMIT 20`).bind(key).all();
    const { results: myLikes } = await DB.prepare("SELECT entry_user FROM daily_likes WHERE day=? AND user_id=?").bind(key, u.id).all();
    const total = await DB.prepare("SELECT COUNT(*) c FROM daily_entries WHERE day=?").bind(key).first();
    const pub = (r) => ({ who: r.user_id === u.id ? "you" : r.handle || "Anonymous writer", entry: r.user_id, lines: r.lines, score: r.score, tier: r.tier, fires: r.fires, mine: r.user_id === u.id });
    let rank = null;
    if (mineRow) rank = (await DB.prepare("SELECT COUNT(*) c FROM daily_entries WHERE day=? AND score<?").bind(key, mineRow.score).first()).c + 1;
    return json({ key, number: p.number, prompt: p.prompt, entries: total.c,
      mine: mineRow ? { lines: mineRow.lines, score: mineRow.score, tier: mineRow.tier, rank } : null,
      crew: crew.map(pub), crowd: crowd.map(pub), liked: myLikes.map((l) => l.entry_user), streak: u.streak || 0, handle: u.handle || null });
  }
  if (path === "/api/daily" && method === "POST") {
    const key = dailyKey();
    if (!body.attest) return bad("Confirm these are your own lines.");
    const lines = String(body.lines || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8).join("\n").slice(0, 600);
    const n = words(lines).length;
    if (n < 12) return bad("Give it at least 12 words.");
    // Nonsense guard: a "Wicked" made of random words isn't a win.
    const real = words(lines).filter((w) => w.length > 1);
    if (real.length / n < 0.8) return bad("That doesn't read like lyrics. Try real lines.");
    const exists = await DB.prepare("SELECT 1 FROM daily_entries WHERE day=? AND user_id=?").bind(key, u.id).first();
    if (exists) return bad("You've already taken today's Daily W. Come back tomorrow.", 409);
    const a = analyze(lines), score = Math.round(a.raw), tier = tierOf(score);
    if (body.handle) await DB.prepare("UPDATE users SET handle=? WHERE id=?").bind(cleanHandle(body.handle) || null, u.id).run();
    await DB.prepare("INSERT INTO daily_entries (day,user_id,lines,score,tier,created_at) VALUES (?,?,?,?,?,?)").bind(key, u.id, lines, score, tier, now()).run();
    const [y, mo, d] = key.split("-").map(Number);
    const yKey = new Date(Date.UTC(y, mo - 1, d - 1)).toISOString().slice(0, 10);
    const streak = u.last_daily === yKey ? (u.streak || 0) + 1 : 1;
    await DB.prepare("UPDATE users SET streak=?, last_daily=? WHERE id=?").bind(streak, key, u.id).run();
    const rank = (await DB.prepare("SELECT COUNT(*) c FROM daily_entries WHERE day=? AND score<?").bind(key, score).first()).c + 1;
    const total = (await DB.prepare("SELECT COUNT(*) c FROM daily_entries WHERE day=?").bind(key).first()).c;
    return json({ score, tier, rank, total, streak, vals: Object.fromEntries(Object.entries(a.vals).map(([k, v]) => [k, Math.round(v)])) });
  }
  if (path === "/api/daily/fire" && method === "POST") {
    const key = dailyKey(), entry = String(body.entry || "");
    if (entry === u.id) return bad("You can't fire your own lines.");
    const e = await DB.prepare("SELECT 1 FROM daily_entries WHERE day=? AND user_id=?").bind(key, entry).first();
    if (!e) return bad("That entry is gone.", 404);
    if (body.off) await DB.prepare("DELETE FROM daily_likes WHERE day=? AND entry_user=? AND user_id=?").bind(key, entry, u.id).run();
    else await DB.prepare("INSERT OR IGNORE INTO daily_likes (day,entry_user,user_id) VALUES (?,?,?)").bind(key, entry, u.id).run();
    return json({ ok: true });
  }

  /* ----- Payments ----- */
  if (path === "/api/checkout" && method === "POST") {
    if (!env.STRIPE_SECRET_KEY) return bad("Checkout isn't connected yet.", 503);
    const plan = ["monthly", "yearly", "credits"].includes(body.plan) ? body.plan : "monthly";
    const price = { monthly: env.PRO_PRICE_MONTHLY, yearly: env.PRO_PRICE_YEARLY, credits: env.CREDITS_PRICE }[plan];
    if (!price) return bad("That plan isn't set up in Stripe yet.", 503);
    const base = env.APP_URL || new URL(url).origin;
    const params = {
      mode: plan === "credits" ? "payment" : "subscription",
      "line_items[0][price]": price, "line_items[0][quantity]": 1,
      client_reference_id: u.id, metadata: { plan, user: u.id },
      success_url: `${base}/?paid=${plan}#pro`, cancel_url: `${base}/#pro`, allow_promotion_codes: "true",
    };
    if (u.stripe_customer) params.customer = u.stripe_customer;
    if (plan !== "credits") params["subscription_data[metadata][user]"] = u.id;
    const sess = await stripe(env, "checkout/sessions", params);
    return json({ url: sess.url });
  }
  if (path === "/api/portal" && method === "POST") {
    if (!env.STRIPE_SECRET_KEY || !u.stripe_customer) return bad("No billing account on this device yet.", 404);
    const p = await stripe(env, "billing_portal/sessions", { customer: u.stripe_customer, return_url: `${env.APP_URL || url.origin}/#pro` });
    return json({ url: p.url });
  }

  return bad("Not found", 404);
}

async function stripeWebhook(req, env) {
  const payload = await req.text();
  if (!env.STRIPE_WEBHOOK_SECRET || !(await verifyStripe(env, payload, req.headers.get("stripe-signature")))) return bad("Bad signature", 400);
  const ev = JSON.parse(payload), o = ev.data.object, DB = env.DB;
  if (ev.type === "checkout.session.completed") {
    const uid = o.client_reference_id || o.metadata?.user;
    if (!uid) return json({ ok: true });
    if (o.customer) await DB.prepare("UPDATE users SET stripe_customer=? WHERE id=?").bind(o.customer, uid).run();
    if (o.mode === "payment" && o.metadata?.plan === "credits") {
      await DB.prepare("UPDATE users SET credits=credits+25 WHERE id=?").bind(uid).run();
    } else if (o.mode === "subscription" && o.subscription) {
      // Grant a month now; the subscription events below set the exact end date.
      await DB.prepare("UPDATE users SET plan='pro', pro_until=MAX(COALESCE(pro_until,0), ?) WHERE id=?").bind(now() + 32 * 86400000, uid).run();
    }
  }
  if (ev.type === "customer.subscription.created" || ev.type === "customer.subscription.updated" || ev.type === "customer.subscription.deleted") {
    const uid = o.metadata?.user;
    const active = ["active", "trialing", "past_due"].includes(o.status) && ev.type !== "customer.subscription.deleted";
    const until = active ? periodEnd(o) : now();
    if (uid) await DB.prepare("UPDATE users SET plan=?, pro_until=?, stripe_customer=COALESCE(stripe_customer, ?) WHERE id=?").bind(active ? "pro" : "free", until, o.customer, uid).run();
    else await DB.prepare("UPDATE users SET plan=?, pro_until=? WHERE stripe_customer=?").bind(active ? "pro" : "free", until, o.customer).run();
  }
  return json({ ok: true });
}
