// Wackometer API — Cloudflare Worker.
// Everything under /api/* lands here; Cloudflare serves the front end from /public.
import { SCHEMA, MIGRATIONS } from "./schema.js";
import { handleSocial, profileMeta } from "./social.js";
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
  if (!schemaReady) schemaReady = (async () => {
    await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
    for (const m of MIGRATIONS) { try { await env.DB.prepare(m).run(); } catch (e) { /* already applied */ } }
  })().catch((e) => { schemaReady = null; throw e; });
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
  return { user, setCookie: await cookieFor(req, env, id) };
}
async function cookieFor(req, env, id) {
  const secret = env.SESSION_SECRET || "dev-only-secret-change-me";
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `wk=${id}.${await hmac(secret, id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=63072000${secure}`;
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
function liveStreak(u) {
  if (!u.last_daily) return 0;
  const today = dailyKey(), [y, m, d] = today.split("-").map(Number);
  const yday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return u.last_daily === today || u.last_daily === yday ? u.streak || 0 : 0;
}
const adminEmails = (env) => String(env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const isAdmin = (u, env) => !!(u.email && adminEmails(env).includes(u.email.toLowerCase()));
function me(u, used, env) {
  return { id: u.id, email: u.email || null, username: u.username || null, admin: isAdmin(u, env), canEmail: !!env.SENDGRID_API_KEY, pro: !!isPro(u), proUntil: u.pro_until || null, credits: u.credits, usedToday: used,
    freeDaily: +env.FREE_DAILY || 5, handle: u.handle || null, streak: liveStreak(u), lastDaily: u.last_daily || null,
    billing: !!u.stripe_customer, checkout: !!env.STRIPE_SECRET_KEY };
}
const REACTIONS = ["🔥", "😭", "💀", "🤢"];
const PEN_MAX = 16;
const EVENT_TYPES = ["share_card", "save_card", "save_video", "copy_caption", "copy_daily", "copy_roast", "pen_share", "pen_start", "swap_used", "emoji_starter", "best_line"];
const cleanLine = (s) => { const t = String(s || "").replace(/\s+/g, " ").trim().slice(0, 140); return words(t).length >= 2 ? t : ""; };
const cleanHandle = (h) => String(h || "").replace(/[^A-Za-z0-9_.\- ]/g, "").trim().slice(0, 20);

/* ---------------- Wingman (Claude API) ---------------- */
const WINGMAN_SYSTEM = `You are Wingman, the songwriting assistant inside Wackometer, an app that grades how wack lyrics are: Wicked 0-19, Well put 20-39, Whatever 40-59, Weird 60-79, Wack 80-100. Wack means clichés, lazy rhymes (fire/desire), abstract filler words, padding syllables and needless repetition.
Voice: a confident studio friend. Short, direct, warm, a little playful. Lean into words starting with W when it's natural, never forced.
Rules: write only original lyrics. Never reproduce or closely imitate lines from existing copyrighted songs, even if asked. Favor concrete, sensory, specific images over abstractions. When rewriting, keep the writer's meaning and voice. Plain text only, no markdown. Keep replies under 220 words unless asked for a full song.`;
const EMOJI_SYSTEM = `You are Wingman from Wackometer. The writer gives you three emojis. Turn them into a fresh, original two-line starter for a song: concrete images, a natural rhyme or near-rhyme, nothing cliché (no "fire/desire", no "end of time", no "set me free"). Then on a new line, one short sentence suggesting where the song could go next. Plain text, no markdown, no emojis in the lyric lines. Never imitate an existing song.`;
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
    if (path.startsWith("/u/")) return profilePage(req, env, decodeURIComponent(path.slice(3)).toLowerCase());
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (method !== "GET" && req.headers.get("origin") && new URL(req.headers.get("origin")).host !== url.host) return bad("Wrong origin", 403);

    let s;
    try { await ensureSchema(env); s = await session(req, env); } catch (e) { return bad("Database isn't set up yet. Run the schema (see README).", 500); }
    const u = s.user;
    const body = method === "POST" ? await req.json().catch(() => ({})) : {};
    let res;
    try { res = await route(path, method, url, body, u, env); }
    catch (e) { console.error(e); res = bad("Something broke on our side. Try again in a moment.", 500); }
    if (s.setCookie && !res.headers.has("set-cookie")) res.headers.append("set-cookie", s.setCookie);
    return res;
  },
};

async function route(path, method, url, body, u, env) {
  const DB = env.DB;

  if (path === "/api/login/verify" && method === "GET") {
    const t = url.searchParams.get("t") || "";
    const row = await DB.prepare("SELECT * FROM login_tokens WHERE token=?").bind(t).first();
    const go = (q) => new Response(null, { status: 302, headers: { location: `/?${q}#weigh` } });
    if (!row || row.expires_at < now()) return go("signin=expired");
    await DB.prepare("DELETE FROM login_tokens WHERE token=?").bind(t).run();
    const existing = await DB.prepare("SELECT id FROM users WHERE lower(email)=?").bind(row.email).first();
    let target = row.user_id;
    if (existing) {
      target = existing.id;
      if (existing.id !== row.user_id) {
        // Bring this device's posts, songs and Daily W into the account they signed in to.
        await DB.batch([
          DB.prepare("UPDATE readings SET user_id=? WHERE user_id=?").bind(target, row.user_id),
          DB.prepare("UPDATE pens SET created_by=? WHERE created_by=?").bind(target, row.user_id),
          DB.prepare("UPDATE pen_lines SET user_id=? WHERE user_id=?").bind(target, row.user_id),
          DB.prepare("UPDATE OR IGNORE daily_entries SET user_id=? WHERE user_id=?").bind(target, row.user_id),
        ]);
      }
    } else {
      await DB.prepare("UPDATE users SET email=? WHERE id=?").bind(row.email, row.user_id).run();
    }
    const res = go("signin=ok");
    res.headers.append("set-cookie", await cookieFor(new Request(url), env, target));
    return res;
  }

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
    const reacts = {}, myReacts = {};
    if (ids.length) {
      const ph = ids.map(() => "?").join(",");
      const { results: rs } = await DB.prepare(`SELECT reading_id, emoji, COUNT(*) c, SUM(CASE WHEN user_id=? THEN 1 ELSE 0 END) mine FROM reactions WHERE reading_id IN (${ph}) GROUP BY reading_id, emoji`).bind(u.id, ...ids).all();
      rs.forEach((r) => { (reacts[r.reading_id] ||= {})[r.emoji] = r.c; if (r.mine) (myReacts[r.reading_id] ||= []).push(r.emoji); });
    }
    const agg = await DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN v.tier=r.tier THEN 1 ELSE 0 END) agree FROM votes v JOIN readings r ON r.id=v.reading_id WHERE r.hidden=0`).first();
    const tune = await crowdTune(env);
    return json({
      feed,
      readings: rows.map((r) => ({ id: r.id, title: r.title, excerpt: r.excerpt, score: r.score, tier: r.tier, createdAt: r.created_at,
        votes: counts[r.id] || [0, 0, 0, 0, 0], myVote: mine[r.id] ?? null, mine: r.user_id === u.id,
        reacts: reacts[r.id] || {}, myReacts: myReacts[r.id] || [] })),
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
    const mode = ["roast", "emoji"].includes(body.mode) ? body.mode : "chat";
    const pad = String(body.pad || "").slice(0, 4000);
    const msg = String(body.message || "").slice(0, 1500);
    if (mode === "chat" && !msg.trim()) return bad("Ask Wingman something.");
    if (mode === "roast" && words(pad).length < 8) return bad("Give Wretch at least eight words to roast.");
    const emojis = [...String(body.emojis || "")].filter((c) => /\p{Extended_Pictographic}/u.test(c)).slice(0, 3).join("");
    if (mode === "emoji" && [...emojis].length < 1) return bad("Pick up to three emojis first.");
    const a = pad.trim() ? analyze(pad) : null;
    const reading = a ? `Wackometer reading: ${Math.round(a.raw)}/100 (${TIERS[tierOf(a.raw)].n}). ` + METRICS.map((mm) => `${mm.n} ${Math.round(a.vals[mm.k])}`).join(", ") + `. Clichés found: ${a.found.map((f) => f[0]).join(", ") || "none"}.` : "No lyrics in the pad.";
    let text;
    if (mode === "emoji") {
      text = await callClaude(env, EMOJI_SYSTEM, [{ role: "user", content: `Emojis: ${emojis}` }], 250);
    } else if (mode === "roast") {
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
    return json({ key, number: p.number, prompt: p.prompt, emoji: p.emoji, entries: total.c,
      mine: mineRow ? { lines: mineRow.lines, score: mineRow.score, tier: mineRow.tier, rank } : null,
      crew: crew.map(pub), crowd: crowd.map(pub), liked: myLikes.map((l) => l.entry_user), streak: liveStreak(u), handle: u.handle || null });
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

  /* ----- Emoji reactions ----- */
  if (path === "/api/react" && method === "POST") {
    const emoji = String(body.emoji || "");
    if (!REACTIONS.includes(emoji)) return bad("Pick one of the reactions.");
    const r = await DB.prepare("SELECT id FROM readings WHERE id=? AND hidden=0").bind(String(body.id || "")).first();
    if (!r) return bad("That post is gone.", 404);
    if (body.off) await DB.prepare("DELETE FROM reactions WHERE reading_id=? AND user_id=? AND emoji=?").bind(r.id, u.id, emoji).run();
    else await DB.prepare("INSERT OR IGNORE INTO reactions (reading_id,user_id,emoji) VALUES (?,?,?)").bind(r.id, u.id, emoji).run();
    return json({ ok: true });
  }

  /* ----- Pass the Pen ----- */
  if (path === "/api/pen" && method === "POST") {
    const line = cleanLine(body.line), title = String(body.title || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!line) return bad("Write a first line with at least two words.");
    const recent = await DB.prepare("SELECT COUNT(*) c FROM pens WHERE created_by=? AND created_at>?").bind(u.id, now() - 86400000).first();
    if (recent.c >= 15) return bad("That's a lot of songs for one day. Finish one first.", 429);
    if (body.handle) await DB.prepare("UPDATE users SET handle=? WHERE id=?").bind(cleanHandle(body.handle) || null, u.id).run();
    const id = rid().slice(0, 10), t = now(), handle = cleanHandle(body.handle) || u.handle || null;
    await DB.batch([
      DB.prepare("INSERT INTO pens (id,title,created_by,line_count,created_at,updated_at) VALUES (?,?,?,1,?,?)").bind(id, title || null, u.id, t, t),
      DB.prepare("INSERT INTO pen_lines (pen_id,idx,user_id,handle,text,created_at) VALUES (?,0,?,?,?,?)").bind(id, u.id, handle, line, t),
    ]);
    return json({ id });
  }
  if (path === "/api/pens" && method === "GET") {
    const { results } = await DB.prepare(
      `SELECT p.id, p.title, p.line_count, p.closed, p.updated_at, p.created_by=? AS mine,
              (SELECT text FROM pen_lines WHERE pen_id=p.id AND idx=0) first
       FROM pens p WHERE p.created_by=? OR p.id IN (SELECT pen_id FROM pen_lines WHERE user_id=?)
       ORDER BY p.updated_at DESC LIMIT 30`).bind(u.id, u.id, u.id).all();
    return json({ pens: results.map((p) => ({ id: p.id, title: p.title, lines: p.line_count, closed: !!p.closed, updatedAt: p.updated_at, mine: !!p.mine, first: p.first })) });
  }
  if ((m = path.match(/^\/api\/pen\/([a-z0-9]+)$/)) && method === "GET") {
    const p = await DB.prepare("SELECT * FROM pens WHERE id=?").bind(m[1]).first();
    if (!p) return bad("That song doesn't exist or was deleted.", 404);
    const { results: lines } = await DB.prepare("SELECT idx, user_id, handle, text FROM pen_lines WHERE pen_id=? ORDER BY idx").bind(p.id).all();
    const lastBy = lines.length ? lines[lines.length - 1].user_id : null;
    const writers = [...new Set(lines.map((l) => l.user_id))];
    return json({ id: p.id, title: p.title, closed: !!p.closed, mine: p.created_by === u.id, max: PEN_MAX,
      canAdd: !p.closed && lines.length < PEN_MAX && lastBy !== u.id, yourTurnBlocked: lastBy === u.id,
      writers: writers.length,
      lines: lines.map((l) => ({ idx: l.idx, text: l.text, who: l.user_id === u.id ? "you" : l.handle || "Anonymous writer", writer: writers.indexOf(l.user_id), mine: l.user_id === u.id })) });
  }
  if ((m = path.match(/^\/api\/pen\/([a-z0-9]+)\/line$/)) && method === "POST") {
    const p = await DB.prepare("SELECT * FROM pens WHERE id=?").bind(m[1]).first();
    if (!p) return bad("That song doesn't exist.", 404);
    if (p.closed) return bad("This song is finished. Start a new one.", 409);
    if (p.line_count >= PEN_MAX) return bad(`This song hit ${PEN_MAX} lines. It's done!`, 409);
    const lastLine = await DB.prepare("SELECT user_id FROM pen_lines WHERE pen_id=? ORDER BY idx DESC LIMIT 1").bind(p.id).first();
    if (lastLine && lastLine.user_id === u.id) return bad("Pass the pen first. Someone else writes the next line.", 409);
    const line = cleanLine(body.line);
    if (!line) return bad("Write a line with at least two words.");
    if (body.handle) await DB.prepare("UPDATE users SET handle=? WHERE id=?").bind(cleanHandle(body.handle) || null, u.id).run();
    const handle = cleanHandle(body.handle) || u.handle || null;
    try {
      await DB.batch([
        DB.prepare("INSERT INTO pen_lines (pen_id,idx,user_id,handle,text,created_at) VALUES (?,?,?,?,?,?)").bind(p.id, p.line_count, u.id, handle, line, now()),
        DB.prepare("UPDATE pens SET line_count=line_count+1, updated_at=? WHERE id=?").bind(now(), p.id),
      ]);
    } catch (e) { return bad("Someone added a line at the same moment. Refresh and try again.", 409); }
    return json({ ok: true });
  }
  if ((m = path.match(/^\/api\/pen\/([a-z0-9]+)\/close$/)) && method === "POST") {
    const r = await DB.prepare("UPDATE pens SET closed=1, updated_at=? WHERE id=? AND created_by=?").bind(now(), m[1], u.id).run();
    if (!r.meta.changes) return bad("Only the person who started this song can finish it.", 403);
    return json({ ok: true });
  }

  /* ----- Sign in by email ----- */
  if (path === "/api/login" && method === "POST") {
    if (!env.SENDGRID_API_KEY) return bad("Email sign-in isn't set up yet.", 503);
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return bad("That doesn't look like an email address.");
    const sent = await DB.prepare("SELECT COUNT(*) c FROM login_tokens WHERE (email=? OR user_id=?) AND expires_at>?").bind(email, u.id, now()).first();
    if (sent.c >= 5) return bad("We've sent a few links already. Check your inbox and spam folder.", 429);
    const token = crypto.randomUUID().replace(/-/g, "") + rid();
    await DB.prepare("INSERT INTO login_tokens (token,email,user_id,expires_at) VALUES (?,?,?,?)").bind(token, email, u.id, now() + 20 * 60000).run();
    const link = `${env.APP_URL || url.origin}/api/login/verify?t=${token}`;
    const fromRaw = env.EMAIL_FROM || "Wackometer <hello@wackometer.com>";
    const fm = fromRaw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/), from = fm ? { name: fm[1] || "Wackometer", email: fm[2] } : { email: fromRaw.trim() };
    const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#1F2340"><p>Tap to sign in to Wackometer. The link works for 20 minutes.</p><p><a href="${link}" style="display:inline-block;background:#A8C42E;color:#1F2340;padding:12px 20px;border-radius:999px;font-weight:bold;text-decoration:none">Sign in to Wackometer</a></p><p style="color:#646A8C;font-size:13px">Didn't ask for this? Ignore it and nothing happens.</p></div>`;
    let res;
    try { res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST", headers: { authorization: `Bearer ${env.SENDGRID_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }], from, subject: "Your Wackometer sign-in link",
        content: [{ type: "text/plain", value: `Sign in to Wackometer (link works for 20 minutes): ${link}` }, { type: "text/html", value: html }],
        tracking_settings: { click_tracking: { enable: false, enable_text: false } },
      }),
    }); } catch (e) { console.error("sendgrid fetch", e); return bad("The email didn't send. Try again in a minute.", 502); }
    if (!res.ok) { console.error("sendgrid", res.status, await res.text()); return bad("The email didn't send. Try again in a minute.", 502); }
    return json({ ok: true });
  }
  if (path === "/api/logout" && method === "POST") {
    const res = json({ ok: true });
    res.headers.append("set-cookie", "wk=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    return res;
  }

  /* ----- Analytics ----- */
  if (path === "/api/event" && method === "POST") {
    const type = String(body.type || "");
    if (!EVENT_TYPES.includes(type)) return bad("Unknown event.");
    await DB.prepare("INSERT INTO events (day,type,count) VALUES (?,?,1) ON CONFLICT(day,type) DO UPDATE SET count=count+1").bind(dailyKey(), type).run();
    return json({ ok: true });
  }

  /* ----- Admin ----- */
  if (path.startsWith("/api/admin/")) {
    if (!isAdmin(u, env)) return bad("Admins only. Sign in with an admin email.", 403);
    if (path === "/api/admin/overview" && method === "GET") {
      const c = async (q, ...b) => (await DB.prepare(q).bind(...b).first()).c;
      const day = dailyKey(), weekAgo = now() - 7 * 86400000;
      const stats = {
        users: await c("SELECT COUNT(*) c FROM users"), signedIn: await c("SELECT COUNT(*) c FROM users WHERE email IS NOT NULL"),
        pro: await c("SELECT COUNT(*) c FROM users WHERE pro_until>?", now()), posts: await c("SELECT COUNT(*) c FROM readings"),
        postsWeek: await c("SELECT COUNT(*) c FROM readings WHERE created_at>?", weekAgo), votes: await c("SELECT COUNT(*) c FROM votes"),
        dailyToday: await c("SELECT COUNT(*) c FROM daily_entries WHERE day=?", day), pens: await c("SELECT COUNT(*) c FROM pens"),
        penLines: await c("SELECT COUNT(*) c FROM pen_lines"), wingmanToday: (await DB.prepare("SELECT COALESCE(SUM(wingman),0) c FROM usage WHERE day=?").bind(day).first()).c,
      };
      const { results: events } = await DB.prepare("SELECT day, type, count FROM events ORDER BY day DESC LIMIT 200").all();
      const { results: flagged } = await DB.prepare("SELECT id, title, excerpt, score, tier, reports, hidden, created_at FROM readings WHERE reports>0 OR hidden=1 ORDER BY hidden DESC, reports DESC, created_at DESC LIMIT 100").all();
      return json({ stats, events, flagged });
    }
    if (path === "/api/admin/post" && method === "POST") {
      const id = String(body.id || ""), action = body.action;
      if (action === "hide") await DB.prepare("UPDATE readings SET hidden=1 WHERE id=?").bind(id).run();
      else if (action === "unhide") await DB.prepare("UPDATE readings SET hidden=0, reports=0 WHERE id=?").bind(id).run();
      else if (action === "delete") await DB.batch([DB.prepare("DELETE FROM readings WHERE id=?").bind(id), DB.prepare("DELETE FROM votes WHERE reading_id=?").bind(id), DB.prepare("DELETE FROM reactions WHERE reading_id=?").bind(id), DB.prepare("DELETE FROM reports WHERE reading_id=?").bind(id)]);
      else return bad("Unknown action.");
      return json({ ok: true });
    }
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

  const social = await handleSocial(path, method, url, body, u, env);
  if (social) return social;

  return bad("Not found", 404);
}

// Profile links get their own title and description in link previews (iMessage, Instagram, X).
async function profilePage(req, env, username) {
  const page = await env.ASSETS.fetch(new Request(new URL("/", req.url), req));
  let meta = null;
  try { await ensureSchema(env); meta = await profileMeta(env, username.replace(/[^a-z0-9_.]/g, "")); } catch (e) {}
  if (!meta) return page;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return new HTMLRewriter()
    .on("title", { element(e) { e.setInnerContent(meta.title); } })
    .on('meta[property="og:title"]', { element(e) { e.setAttribute("content", meta.title); } })
    .on('meta[property="og:description"]', { element(e) { e.setAttribute("content", meta.description); } })
    .on('meta[name="description"]', { element(e) { e.setAttribute("content", meta.description); } })
    .transform(page);
  void esc;
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
