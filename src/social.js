// Profiles, friends, leaderboards and battles.
import { analyze, tierOf, words, dailyKey, DAILY_PROMPTS, TIERS } from "../public/js/score.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const now = () => Date.now();
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export const COLORS = ["#3D8BFF", "#22C29B", "#A9A2DA", "#FF8A3D", "#A8C42E", "#FF8FC0", "#FFD84D", "#1F2340"];
export const GENRES = ["Pop", "Hip-hop", "R&B", "Rock", "Indie", "Alternative", "Country", "Latin", "Electronic", "Folk", "Jazz", "Gospel", "Metal", "Punk", "K-pop", "Poetry", "Other"];
const RESERVED = new Set(["admin", "api", "wackometer", "wingman", "wiz", "wendy", "wally", "wobbles", "wretch", "support", "help", "root", "mod", "moderator", "staff", "official", "null", "undefined", "me", "you", "anonymous", "donebyverde", "terms", "privacy", "pen", "u"]);
const LINK_RULES = {
  instagram: { handle: true, url: (h) => `https://instagram.com/${h}` },
  tiktok: { handle: true, url: (h) => `https://tiktok.com/@${h}` },
  spotify: { hosts: ["open.spotify.com", "spotify.link"] },
  soundcloud: { hosts: ["soundcloud.com", "on.soundcloud.com"] },
  youtube: { hosts: ["youtube.com", "www.youtube.com", "youtu.be", "music.youtube.com"] },
};
export const TIER_POINTS = [100, 60, 30, 15, 5];

export function liveStreak(u) {
  if (!u || !u.last_daily) return 0;
  const today = dailyKey(), [y, m, d] = today.split("-").map(Number);
  const yday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return u.last_daily === today || u.last_daily === yday ? u.streak || 0 : 0;
}
function weekStartKey() {
  const [y, m, d] = dailyKey().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 6)).toISOString().slice(0, 10);
}
const pair = (x, y) => (x < y ? [x, y] : [y, x]);
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

async function friendIds(DB, uid) {
  const { results } = await DB.prepare("SELECT CASE WHEN a=? THEN b ELSE a END f FROM friends WHERE (a=? OR b=?) AND status='accepted'").bind(uid, uid, uid).all();
  return results.map((r) => r.f);
}
async function relation(DB, me, other) {
  if (me === other) return "self";
  const [a, b] = pair(me, other);
  const r = await DB.prepare("SELECT status, requested_by FROM friends WHERE a=? AND b=?").bind(a, b).first();
  if (!r) return "none";
  if (r.status === "accepted") return "friends";
  return r.requested_by === me ? "requested" : "incoming";
}
async function userByName(DB, name) {
  return DB.prepare("SELECT * FROM users WHERE username=?").bind(String(name || "").toLowerCase().replace(/^@/, "")).first();
}

async function pointsBoard(DB, { ids = null, period = "week", limit = 50 }) {
  const dayFrom = period === "today" ? dailyKey() : weekStartKey();
  const msFrom = period === "today" ? now() - 86400000 : now() - 7 * 86400000;
  const scope = ids ? `u.id IN (${ids.map(() => "?").join(",")})` : "u.username IS NOT NULL";
  const q = `WITH pts AS (
      SELECT user_id uid, SUM(CASE tier WHEN 0 THEN 100 WHEN 1 THEN 60 WHEN 2 THEN 30 WHEN 3 THEN 15 ELSE 5 END) p FROM daily_entries WHERE day>=? GROUP BY user_id
      UNION ALL SELECT entry_user, COUNT(*)*5 FROM daily_likes WHERE day>=? GROUP BY entry_user
      UNION ALL SELECT user_id, COUNT(*)*10 FROM pen_lines WHERE created_at>=? GROUP BY user_id
      UNION ALL SELECT user_id, COUNT(*)*25 FROM readings WHERE tier=0 AND hidden=0 AND created_at>=? GROUP BY user_id
      UNION ALL SELECT CASE WHEN c_score<o_score THEN challenger ELSE opponent END, COUNT(*)*50 FROM battles WHERE status='done' AND c_score<>o_score AND done_at>=? GROUP BY 1
    )
    SELECT u.*, SUM(pts.p) points FROM pts JOIN users u ON u.id=pts.uid WHERE ${scope} GROUP BY u.id ORDER BY points DESC, u.created_at ASC LIMIT ${limit}`;
  const { results } = await DB.prepare(q).bind(dayFrom, dayFrom, msFrom, msFrom, msFrom, ...(ids || [])).all();
  return results;
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
    return json({ username: u.username || "", name: u.display_name || "", bio: u.bio || "", avatar: u.avatar ?? 5, color: u.color || COLORS[0], genre: u.genre || "", links: parseLinks(u.links), pinned: u.pinned || "", signedIn: !!u.email, colors: COLORS, genres: GENRES });
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
    const [dailies, wicked, posts, penLines, wins, losses, friends] = await Promise.all([
      c("SELECT COUNT(*) c FROM daily_entries WHERE user_id=?", p.id),
      c("SELECT (SELECT COUNT(*) FROM daily_entries WHERE user_id=? AND tier=0) + (SELECT COUNT(*) FROM readings WHERE user_id=? AND tier=0 AND hidden=0) c", p.id, p.id),
      c("SELECT COUNT(*) c FROM readings WHERE user_id=? AND hidden=0", p.id),
      c("SELECT COUNT(*) c FROM pen_lines WHERE user_id=?", p.id),
      c("SELECT COUNT(*) c FROM battles WHERE status='done' AND ((challenger=? AND c_score<o_score) OR (opponent=? AND o_score<c_score))", p.id, p.id),
      c("SELECT COUNT(*) c FROM battles WHERE status='done' AND ((challenger=? AND c_score>o_score) OR (opponent=? AND o_score>c_score))", p.id, p.id),
      c("SELECT COUNT(*) c FROM friends WHERE (a=? OR b=?) AND status='accepted'", p.id, p.id),
    ]);
    const week = await pointsBoard(DB, { ids: [p.id] });
    const { results: recent } = await DB.prepare("SELECT id, title, excerpt, score, tier, created_at FROM readings WHERE user_id=? AND hidden=0 ORDER BY created_at DESC LIMIT 6").bind(p.id).all();
    const { results: lastDaily } = await DB.prepare("SELECT day, lines, score, tier FROM daily_entries WHERE user_id=? ORDER BY day DESC LIMIT 1").bind(p.id).all();
    return json({
      ...summary(p, u.id), bio: p.bio || "", genre: p.genre || "", pinned: p.pinned || "", links: publicLinks(p.links),
      relation: await relation(DB, u.id, p.id), streakRaw: liveStreak(p),
      stats: { dailies, wicked, posts, penLines, wins, losses, friends, weekPoints: week[0]?.points || 0 },
      recent: recent.map((r) => ({ id: r.id, title: r.title, excerpt: r.excerpt, score: r.score, tier: r.tier, createdAt: r.created_at })),
      lastDaily: lastDaily[0] || null,
    });
  }
  if (path === "/api/users/search" && method === "GET") {
    const q = String(url.searchParams.get("q") || "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "");
    if (q.length < 2) return json({ users: [] });
    const { results } = await DB.prepare("SELECT * FROM users WHERE username LIKE ? AND id<>? ORDER BY length(username) LIMIT 8").bind(q + "%", u.id).all();
    return json({ users: results.map((r) => summary(r, u.id)) });
  }

  /* ----- friends ----- */
  if (path === "/api/friends" && method === "GET") {
    const { results } = await DB.prepare(
      `SELECT f.status, f.requested_by, us.* FROM friends f JOIN users us ON us.id = CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE f.a=? OR f.b=? ORDER BY f.created_at DESC`).bind(u.id, u.id, u.id).all();
    const today = dailyKey();
    const ids = results.filter((r) => r.status === "accepted").map((r) => r.id);
    const todays = {};
    if (ids.length) {
      const { results: d } = await DB.prepare(`SELECT user_id, score, tier FROM daily_entries WHERE day=? AND user_id IN (${ids.map(() => "?").join(",")})`).bind(today, ...ids).all();
      d.forEach((r) => (todays[r.user_id] = { score: r.score, tier: r.tier }));
    }
    const shape = (r) => ({ ...summary(r, u.id), today: todays[r.id] || null });
    return json({
      me: { ...summary(u, u.id), hasUsername: !!u.username },
      friends: results.filter((r) => r.status === "accepted").map(shape),
      incoming: results.filter((r) => r.status === "pending" && r.requested_by !== u.id).map(shape),
      outgoing: results.filter((r) => r.status === "pending" && r.requested_by === u.id).map(shape),
    });
  }
  if (path === "/api/friends/request" && method === "POST") {
    if (!u.username) return bad("Pick a username on your profile first, so friends can find you.", 409);
    const other = await userByName(DB, body.username);
    if (!other) return bad("No writer with that username.", 404);
    if (other.id === u.id) return bad("You can't friend yourself. Nice try.");
    const [a, b] = pair(u.id, other.id);
    const row = await DB.prepare("SELECT * FROM friends WHERE a=? AND b=?").bind(a, b).first();
    if (row && row.status === "accepted") return json({ status: "friends" });
    if (row && row.requested_by !== u.id) { await DB.prepare("UPDATE friends SET status='accepted' WHERE a=? AND b=?").bind(a, b).run(); return json({ status: "friends" }); }
    if (row) return json({ status: "requested" });
    const pending = await DB.prepare("SELECT COUNT(*) c FROM friends WHERE requested_by=? AND status='pending' AND created_at>?").bind(u.id, now() - 86400000).first();
    if (pending.c >= 40) return bad("That's a lot of requests today. Give people time to accept.", 429);
    await DB.prepare("INSERT INTO friends (a,b,requested_by,status,created_at) VALUES (?,?,?,'pending',?)").bind(a, b, u.id, now()).run();
    return json({ status: "requested" });
  }
  if (path === "/api/friends/respond" && method === "POST") {
    const other = await userByName(DB, body.username);
    if (!other) return bad("No writer with that username.", 404);
    const [a, b] = pair(u.id, other.id);
    if (body.accept) await DB.prepare("UPDATE friends SET status='accepted' WHERE a=? AND b=? AND requested_by<>?").bind(a, b, u.id).run();
    else await DB.prepare("DELETE FROM friends WHERE a=? AND b=?").bind(a, b).run();
    return json({ ok: true });
  }
  if (path === "/api/friends/remove" && method === "POST") {
    const other = await userByName(DB, body.username);
    if (other) { const [a, b] = pair(u.id, other.id); await DB.prepare("DELETE FROM friends WHERE a=? AND b=?").bind(a, b).run(); }
    return json({ ok: true });
  }

  /* ----- leaderboards ----- */
  if (path === "/api/leaderboard" && method === "GET") {
    const scope = url.searchParams.get("scope") === "global" ? "global" : "friends";
    const period = url.searchParams.get("period") === "today" ? "today" : "week";
    const ids = scope === "friends" ? [u.id, ...(await friendIds(DB, u.id))] : null;
    const rows = await pointsBoard(DB, { ids, period });
    let mine = null;
    if (scope === "global" && !rows.some((r) => r.id === u.id)) { const r = await pointsBoard(DB, { ids: [u.id], period }); if (r[0]) mine = { ...summary(r[0], u.id), points: r[0].points }; }
    return json({ scope, period, rows: rows.map((r, i) => ({ rank: i + 1, ...summary(r, u.id), points: r.points })), mine, hasUsername: !!u.username,
      rules: [["Daily W", "Wicked 100 · Well put 60 · Whatever 30 · Weird 15 · Wack 5"], ["🔥 on your Daily W", "+5 each"], ["Pass the Pen line", "+10"], ["Wicked Wall post", "+25"], ["Battle win", "+50"]] });
  }

  /* ----- battles ----- */
  if (path === "/api/battles" && method === "GET") {
    const { results } = await DB.prepare(
      `SELECT b.*, c.username c_un, c.display_name c_dn, c.avatar c_av, c.color c_co, o.username o_un, o.display_name o_dn, o.avatar o_av, o.color o_co
       FROM battles b JOIN users c ON c.id=b.challenger JOIN users o ON o.id=b.opponent
       WHERE (b.challenger=? OR b.opponent=?) AND b.status<>'declined' ORDER BY COALESCE(b.done_at, b.created_at) DESC LIMIT 30`).bind(u.id, u.id).all();
    return json({ battles: results.map((b) => shapeBattle(b, u.id)) });
  }
  if (path === "/api/battles" && method === "POST") {
    if (!u.username) return bad("Pick a username on your profile first.", 409);
    const other = await userByName(DB, body.username);
    if (!other) return bad("No writer with that username.", 404);
    if ((await relation(DB, u.id, other.id)) !== "friends") return bad("You can only battle friends. Send a friend request first.", 403);
    const open = await DB.prepare("SELECT COUNT(*) c FROM battles WHERE status='open' AND ((challenger=? AND opponent=?) OR (challenger=? AND opponent=?))").bind(u.id, other.id, other.id, u.id).first();
    if (open.c >= 3) return bad("You already have 3 open battles with them. Finish one first.", 409);
    const pr = DAILY_PROMPTS[Math.floor(Math.random() * DAILY_PROMPTS.length)];
    const id = rid();
    await DB.prepare("INSERT INTO battles (id,emoji,prompt,challenger,opponent,status,created_at) VALUES (?,?,?,?,?,'open',?)").bind(id, pr.e, pr.p, u.id, other.id, now()).run();
    return json({ id });
  }
  if ((m = path.match(/^\/api\/battles\/([a-z0-9]+)\/(submit|decline)$/)) && method === "POST") {
    const b = await DB.prepare("SELECT * FROM battles WHERE id=?").bind(m[1]).first();
    if (!b || (b.challenger !== u.id && b.opponent !== u.id)) return bad("That battle isn't yours.", 404);
    if (b.status !== "open") return bad("This battle is already over.", 409);
    if (m[2] === "decline") {
      if (b.opponent !== u.id) return bad("Only the person challenged can decline.", 403);
      await DB.prepare("UPDATE battles SET status='declined' WHERE id=?").bind(b.id).run();
      return json({ ok: true });
    }
    const mine = b.challenger === u.id ? "c" : "o";
    if (b[mine + "_lines"]) return bad("You already submitted. Waiting on them.", 409);
    const lines = String(body.lines || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8).join("\n").slice(0, 600);
    const n = words(lines).length;
    if (n < 12) return bad("Give it at least 12 words.");
    if (words(lines).filter((w) => w.length > 1).length / n < 0.8) return bad("That doesn't read like lyrics. Try real lines.");
    const score = Math.round(analyze(lines).raw);
    await DB.prepare(`UPDATE battles SET ${mine}_lines=?, ${mine}_score=? WHERE id=?`).bind(lines, score, b.id).run();
    const fresh = await DB.prepare("SELECT * FROM battles WHERE id=?").bind(b.id).first();
    if (fresh.c_lines && fresh.o_lines) await DB.prepare("UPDATE battles SET status='done', done_at=? WHERE id=?").bind(now(), b.id).run();
    return json({ ok: true, score, tier: tierOf(score) });
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

function shapeBattle(b, me) {
  const iAmC = b.challenger === me, done = b.status === "done";
  const side = (k) => ({ username: b[k + "_un"], name: b[k + "_dn"] || b[k + "_un"], avatar: b[k + "_av"] ?? 5, color: b[k + "_co"] || COLORS[0] });
  const you = side(iAmC ? "c" : "o"), them = side(iAmC ? "o" : "c");
  const yourLines = iAmC ? b.c_lines : b.o_lines, theirLines = iAmC ? b.o_lines : b.c_lines;
  const yourScore = iAmC ? b.c_score : b.o_score, theirScore = iAmC ? b.o_score : b.c_score;
  let result = null;
  if (done) result = yourScore === theirScore ? "tie" : yourScore < theirScore ? "win" : "loss";
  return {
    id: b.id, emoji: b.emoji, prompt: b.prompt, status: b.status, challengedByYou: iAmC, createdAt: b.created_at,
    you: { ...you, submitted: !!yourLines, lines: yourLines || null, score: yourScore ?? null, tier: yourScore == null ? null : tierOf(yourScore) },
    them: { ...them, submitted: !!theirLines, lines: done ? theirLines : null, score: done ? theirScore : null, tier: done ? tierOf(theirScore) : null },
    result, yourTurn: b.status === "open" && !yourLines,
  };
}
void TIERS;
