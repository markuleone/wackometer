// Email notifications (SendGrid) and the weekly squad digest.
import { dailyKey, dailyPrompt, TIERS } from "../web/js/score.js";

const enc = new TextEncoder();
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function unsubscribeUrl(env, secret, uid) {
  return `${env.APP_URL || "https://wackometer.com"}/api/unsubscribe?u=${uid}&s=${(await hmac(secret, "unsub:" + uid)).slice(0, 32)}`;
}
export async function checkUnsubscribe(secret, uid, sig) {
  return !!uid && !!sig && (await hmac(secret, "unsub:" + uid)).slice(0, 32) === sig;
}

export async function sendEmail(env, { to, subject, heading, body, cta, ctaUrl, unsub }) {
  if (!env.SENDGRID_API_KEY || !to) return false;
  const fromRaw = env.EMAIL_FROM || "Wackometer <hello@wackometer.com>";
  const fm = fromRaw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/), from = fm ? { name: fm[1] || "Wackometer", email: fm[2] } : { email: fromRaw.trim() };
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1F2340;max-width:520px">
    <p style="font-size:22px;font-weight:bold;margin:0 0 8px">${esc(heading)}</p>
    ${body.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("")}
    ${cta ? `<p style="margin:18px 0"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#A8C42E;color:#1F2340;padding:12px 20px;border-radius:999px;font-weight:bold;text-decoration:none">${esc(cta)}</a></p>` : ""}
    <p style="color:#646A8C;font-size:12px;margin-top:24px">You're getting this because you have a Wackometer account.${unsub ? ` <a href="${esc(unsub)}" style="color:#646A8C">Turn off these emails</a>.` : ""}</p></div>`;
  const text = `${heading}\n\n${body.map((p) => p.replace(/<[^>]+>/g, "")).join("\n\n")}${cta ? `\n\n${cta}: ${ctaUrl}` : ""}${unsub ? `\n\nTurn off these emails: ${unsub}` : ""}`;
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST", headers: { authorization: `Bearer ${env.SENDGRID_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }], from, subject, content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }],
        tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
        headers: unsub ? { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
      }),
    });
    if (!res.ok) console.error("sendgrid notify", res.status, await res.text());
    return res.ok;
  } catch (e) { console.error("sendgrid notify fetch", e); return false; }
}

const nameOf = (u) => (u ? u.display_name || (u.username ? "@" + u.username : "Someone") : "Someone");
const TEMPLATES = {
  friend_request: (d) => ({ subject: `${d.from} wants to join your squad`, heading: "New friend request 👋", body: [`<b>${esc(d.from)}</b> sent you a friend request on Wackometer.`], cta: "See request", path: "/#squad" }),
  friend_accept: (d) => ({ subject: `${d.from} accepted your friend request`, heading: "You're in each other's squad 🎉", body: [`<b>${esc(d.from)}</b> accepted. Challenge them to a battle?`], cta: "Open your squad", path: "/#squad" }),
  battle_challenge: (d) => ({ subject: `⚔️ ${d.from} challenged you`, heading: `${esc(d.from)} wants to battle`, body: [`Prompt: ${esc(d.emoji)} <b>${esc(d.prompt)}</b>`, "You both write blind. Lowest wack score takes the W."], cta: "Write your verse", path: "/#squad" }),
  battle_done: (d) => ({ subject: d.result === "win" ? `🏆 You beat ${d.other}` : d.result === "loss" ? `${d.other} took this one` : `Dead heat with ${d.other}`, heading: d.result === "win" ? "You took the W! 🏆" : d.result === "loss" ? "They took this one 😤" : "Dead heat 🤝", body: [`${esc(d.emoji)} ${esc(d.prompt)}`, `You: <b>${d.you}</b> · ${esc(d.other)}: <b>${d.them}</b>`], cta: "See both verses", path: "/#squad" }),
  pen_line: (d) => ({ subject: `New line in "${d.title}"`, heading: "Someone passed you the pen ✍️", body: [`<b>${esc(d.from)}</b> added a line to <b>${esc(d.title)}</b>:`, `<i>“${esc(d.line)}”</i>`], cta: "Keep the song going", path: `/pen/${d.penId}` }),
};

// Sends one notification if the person has email on and hasn't had this same kind of email recently.
export async function notifyUser(env, secret, uid, kind, data, throttleKey, windowMs = 30 * 60000) {
  try {
    const u = await env.DB.prepare("SELECT id, email, notify FROM users WHERE id=?").bind(uid).first();
    if (!u || !u.email || u.notify === 0) return;
    const key = `${kind}:${uid}:${throttleKey || ""}`, now = Date.now();
    const last = await env.DB.prepare("SELECT at FROM notify_log WHERE k=?").bind(key).first();
    if (last && now - last.at < windowMs) return;
    await env.DB.prepare("INSERT INTO notify_log (k, at) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET at=excluded.at").bind(key, now).run();
    const t = TEMPLATES[kind](data);
    await sendEmail(env, { to: u.email, subject: t.subject, heading: t.heading, body: t.body, cta: t.cta, ctaUrl: (env.APP_URL || "https://wackometer.com") + t.path, unsub: await unsubscribeUrl(env, secret, uid) });
  } catch (e) { console.error("notify", kind, e); }
}
export { nameOf };

// Monday digest: your week's W Points, where you rank in your squad, and this week's first prompt.
export async function weeklyDigest(env, secret) {
  const DB = env.DB, [y, m, d] = dailyKey().split("-").map(Number);
  const weekFrom = new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10), msFrom = Date.now() - 7 * 86400000;
  const { results: people } = await DB.prepare("SELECT id, email, username, display_name FROM users WHERE email IS NOT NULL AND notify<>0 LIMIT 2000").all();
  const prompt = dailyPrompt(dailyKey());
  let sent = 0;
  for (const p of people) {
    const key = `digest:${p.id}:${dailyKey()}`;
    if (await DB.prepare("SELECT 1 FROM notify_log WHERE k=?").bind(key).first()) continue;
    const { results: squad } = await DB.prepare("SELECT CASE WHEN a=? THEN b ELSE a END f FROM friends WHERE (a=? OR b=?) AND status='accepted'").bind(p.id, p.id, p.id).all();
    const ids = [p.id, ...squad.map((r) => r.f)];
    const ph = ids.map(() => "?").join(",");
    const { results: pts } = await DB.prepare(`WITH pts AS (
        SELECT user_id uid, SUM(CASE tier WHEN 0 THEN 100 WHEN 1 THEN 60 WHEN 2 THEN 30 WHEN 3 THEN 15 ELSE 5 END) p FROM daily_entries WHERE day>=? GROUP BY user_id
        UNION ALL SELECT entry_user, COUNT(*)*5 FROM daily_likes WHERE day>=? GROUP BY entry_user
        UNION ALL SELECT user_id, COUNT(*)*10 FROM pen_lines WHERE created_at>=? GROUP BY user_id
        UNION ALL SELECT user_id, COUNT(*)*25 FROM readings WHERE tier=0 AND hidden=0 AND created_at>=? GROUP BY user_id
        UNION ALL SELECT CASE WHEN c_score<o_score THEN challenger ELSE opponent END, COUNT(*)*50 FROM battles WHERE status='done' AND c_score<>o_score AND done_at>=? GROUP BY 1)
      SELECT u.id, u.username, u.display_name, SUM(pts.p) points FROM pts JOIN users u ON u.id=pts.uid WHERE u.id IN (${ph}) GROUP BY u.id ORDER BY points DESC`).bind(weekFrom, weekFrom, msFrom, msFrom, msFrom, ...ids).all();
    const mine = pts.find((r) => r.id === p.id);
    if (!mine && squad.length === 0) continue; // nothing to tell them
    const rank = mine ? pts.indexOf(mine) + 1 : null, top = pts[0];
    const body = [
      mine ? `You scored <b>${mine.points} W Points</b> last week.` : "You didn't score any W Points last week. This week's a fresh start.",
      squad.length ? (rank ? `You finished <b>#${rank} of ${ids.length}</b> in your squad.` : "") + (top && top.id !== p.id ? ` Top of the squad: <b>${esc(nameOf(top))}</b> with ${top.points}.` : rank === 1 ? " You topped your squad. 👑" : "") : "Add friends to start a squad leaderboard.",
      `Today's Daily W: ${esc(prompt.emoji)} <b>${esc(prompt.prompt)}</b>`,
    ].filter(Boolean);
    const ok = await sendEmail(env, { to: p.email, subject: mine ? `Your week: ${mine.points} W Points${rank ? ` · #${rank} in your squad` : ""}` : "New week, new Daily W", heading: "Your Wackometer week 📊", body, cta: "Take today's Daily W", ctaUrl: (env.APP_URL || "https://wackometer.com") + "/#daily", unsub: await unsubscribeUrl(env, secret, p.id) });
    if (ok) { sent++; await DB.prepare("INSERT OR REPLACE INTO notify_log (k, at) VALUES (?, ?)").bind(key, Date.now()).run(); }
  }
  console.log("weekly digest sent", sent);
  return sent;
}
void TIERS;
