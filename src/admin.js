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
