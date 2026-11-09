// Public profiles: your page at /u/<username>, editing it, and reporting someone else's.
import { dailyKey } from "../web/js/score.js";
import { cleanIdentity, cleanLyrics } from "./moderation.js";
const BLOCKED_MSG = "That includes language we don't allow on Wackometer. Try different words.";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const now = () => Date.now();

export const COLORS = ["#3D8BFF", "#22C29B", "#A9A2DA", "#FF8A3D", "#A8C42E", "#FF8FC0", "#FFD84D", "#1D1D22"];
export const GENRES = ["Pop", "Hip-hop", "R&B", "Rock", "Indie", "Alternative", "Country", "Latin", "Electronic", "Folk", "Jazz", "Gospel", "Metal", "Punk", "K-pop", "Poetry", "Other"];
const RESERVED = new Set(["admin", "api", "wackometer", "wingman", "wiz", "wendy", "wally", "wobbles", "wretch", "support", "help", "root", "mod", "moderator", "staff", "official", "null", "undefined", "me", "you", "anonymous", "donebyverde", "terms", "privacy", "pen", "u"]);
const LINK_RULES = {
  instagram: { handle: true, url: (h) => `https://instagram.com/${h}` },
  tiktok: { handle: true, url: (h) => `https://tiktok.com/@${h}` },
  spotify: { hosts: ["open.spotify.com", "spotify.link"] },
  soundcloud: { hosts: ["soundcloud.com", "on.soundcloud.com"] },
  youtube: { hosts: ["youtube.com", "www.youtube.com", "youtu.be", "music.youtube.com"] },
};

export function liveStreak(u) {
  if (!u || !u.last_daily) return 0;
  const today = dailyKey(), [y, m, d] = today.split("-").map(Number);
  const yday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return u.last_daily === today || u.last_daily === yday ? u.streak || 0 : 0;
}
const cleanText = (s, n) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
function parseLinks(raw) { try { const o = JSON.parse(raw || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
function publicLinks(raw) {
  const o = parseLinks(raw), out = {};
  for (const [k, rule] of Object.entries(LINK_RULES)) if (o[k]) out[k] = rule.handle ? rule.url(o[k]) : o[k];
  return out;
}
export function summary(u, viewerId) {
  return { username: u.username || null, name: u.display_name || u.username || u.handle || "Anonymous writer", avatar: u.avatar ?? 5, color: u.color || COLORS[0], streak: liveStreak(u), you: u.id === viewerId };
}

async function userByName(DB, name) {
  return DB.prepare("SELECT * FROM users WHERE username=?").bind(String(name || "").toLowerCase().replace(/^@/, "")).first();
}

export async function profileMeta(env, username) {
  try {
    const u = await userByName(env.DB, username);
    if (!u) return null;
    const name = u.display_name || "@" + u.username;
    return { title: `${name} (@${u.username}) on Wackometer`, description: u.bio || `${name} writes lyrics on Wackometer. Come weigh yours.` };
  } catch (e) { return null; }
}

export async function handleSocial(path, method, url, body, u, env) {
  const DB = env.DB;
  let m;

  /* ----- my profile ----- */
  if (path === "/api/profile" && method === "GET") {
    return json({ ageOk: !!u.age_ok, email: u.email || null, username: u.username || "", name: u.display_name || "", bio: u.bio || "", avatar: u.avatar ?? 5, color: u.color || COLORS[0], genre: u.genre || "", links: parseLinks(u.links), pinned: u.pinned || "", signedIn: !!u.email, colors: COLORS, genres: GENRES });
  }
  if (path === "/api/profile" && method === "POST") {
    const username = String(body.username || "").trim().toLowerCase().replace(/^@/, "");
    if (username) {
      if (!/^[a-z0-9_][a-z0-9_.]{2,19}$/.test(username)) return bad("Usernames are 3–20 letters, numbers, dots or underscores.");
      if (RESERVED.has(username)) return bad("That username is taken. Try another.");
      const taken = await DB.prepare("SELECT id FROM users WHERE username=? AND id<>?").bind(username, u.id).first();
      if (taken) return bad("That username is taken. Try another.");
    }
    const links = {}, rawLinks = body.links && typeof body.links === "object" ? body.links : {};
    for (const [k, rule] of Object.entries(LINK_RULES)) {
      let v = cleanText(rawLinks[k], 200);
      if (!v) continue;
      if (rule.handle) {
        v = v.replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/i, "").replace(/^@/, "").replace(/\/.*$/, "");
        if (!/^[A-Za-z0-9_.]{1,30}$/.test(v)) return bad(`That ${k} handle doesn't look right.`);
        links[k] = v;
      } else {
        try { const lu = new URL(v.startsWith("http") ? v : "https://" + v); if (lu.protocol !== "https:" || !rule.hosts.includes(lu.hostname)) throw 0; links[k] = lu.toString(); }
        catch (e) { return bad(`Paste a full ${k[0].toUpperCase() + k.slice(1)} link.`); }
      }
    }
    const avatar = Math.max(0, Math.min(5, Number.isInteger(+body.avatar) ? +body.avatar : 5));
    const color = COLORS.includes(body.color) ? body.color : COLORS[0];
    const genre = GENRES.includes(body.genre) ? body.genre : null;
    const name = cleanText(body.name, 30), bio = cleanText(body.bio, 160), pinned = cleanText(body.pinned, 140);
    if (!cleanIdentity(username, name, bio) || !cleanLyrics(pinned)) return bad(BLOCKED_MSG);
    if (username && !u.age_ok && !body.age13) return bad("Please confirm you're 13 or older to claim a username.", 409);
    if (body.age13 && !u.age_ok) await DB.prepare("UPDATE users SET age_ok=1 WHERE id=?").bind(u.id).run();
    try {
      await DB.prepare("UPDATE users SET username=?, display_name=?, bio=?, avatar=?, color=?, genre=?, links=?, pinned=?, handle=COALESCE(?, handle) WHERE id=?")
        .bind(username || null, name || null, bio || null, avatar, color, genre, JSON.stringify(links), pinned || null, name || username || null, u.id).run();
    } catch (e) { return bad("That username is taken. Try another."); }
    return json({ ok: true, username: username || null });
  }

  /* ----- public profile ----- */
  if ((m = path.match(/^\/api\/u\/([a-z0-9_.]+)$/)) && method === "GET") {
    const p = await userByName(DB, m[1]);
    if (!p) return bad("No writer with that username.", 404);
    const c = async (q, ...b) => (await DB.prepare(q).bind(...b).first()).c;
    const [dailies, wicked, posts] = await Promise.all([
      c("SELECT COUNT(*) c FROM daily_entries WHERE user_id=?", p.id),
      c("SELECT (SELECT COUNT(*) FROM daily_entries WHERE user_id=? AND tier=0) + (SELECT COUNT(*) FROM readings WHERE user_id=? AND tier=0 AND hidden=0) c", p.id, p.id),
      c("SELECT COUNT(*) c FROM readings WHERE user_id=? AND hidden=0", p.id),
    ]);
    const { results: recent } = await DB.prepare("SELECT id, title, excerpt, score, tier, created_at FROM readings WHERE user_id=? AND hidden=0 ORDER BY created_at DESC LIMIT 6").bind(p.id).all();
    const { results: lastDaily } = await DB.prepare("SELECT day, lines, score, tier FROM daily_entries WHERE user_id=? ORDER BY day DESC LIMIT 1").bind(p.id).all();
    return json({
      ...summary(p, u.id), bio: p.bio || "", genre: p.genre || "", pinned: p.pinned || "", links: publicLinks(p.links),
      streakRaw: liveStreak(p),
      stats: { dailies, wicked, posts },
      recent: recent.map((r) => ({ id: r.id, title: r.title, excerpt: r.excerpt, score: r.score, tier: r.tier, createdAt: r.created_at })),
      lastDaily: lastDaily[0] || null,
    });
  }
  if ((m = path.match(/^\/api\/u\/([a-z0-9_.]+)\/report$/)) && method === "POST") {
    const p = await userByName(DB, m[1]);
    if (!p) return bad("No writer with that username.", 404);
    if (p.id === u.id) return bad("That's you.");
    await DB.prepare("INSERT OR IGNORE INTO profile_reports (target, reporter, reason, created_at) VALUES (?,?,?,?)").bind(p.id, u.id, cleanText(body.reason, 80) || null, now()).run();
    return json({ ok: true });
  }

  /* ----- admin: reset a profile ----- */
  if (path === "/api/admin/user" && method === "POST") {
    const admins = String(env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim());
    if (!(u.email && admins.includes(u.email.toLowerCase()))) return bad("Admins only.", 403);
    const p = await userByName(DB, body.username);
    if (!p) return bad("No writer with that username.", 404);
    await DB.prepare("UPDATE users SET username=NULL, display_name=NULL, bio=NULL, pinned=NULL, links=NULL WHERE id=?").bind(p.id).run();
    return json({ ok: true });
  }
  return null;
}
