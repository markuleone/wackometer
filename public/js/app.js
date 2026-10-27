// Wackometer front end
import { TIERS, MID, METRICS, CLICHES, FILLER, WEIGHTLESS, DAILY_EMOJI, SWAPS, tierOf, clamp, words, analyze, bestLine, lineSyllables } from "./score.js";

const CONTACT_EMAIL = "hello@wackometer.com";
const SITE = /\./.test(location.hostname) && !/^\d/.test(location.hostname) ? location.hostname.replace(/^www\./, "") : "the Wackometer";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
let last = null, crowdTune = 0, tuneN = 0;
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

/* ---------- gauge ---------- */
const cx=160,cy=166,R=128;
function pt(a,r){const t=Math.PI*(1-a/100);return [cx+r*Math.cos(t),cy-r*Math.sin(t)]}
(function drawGauge(){
  let s="";const gap=1.1;
  TIERS.forEach((t,i)=>{const a0=i*20+(i?gap:0),a1=(i+1)*20-(i<4?gap:0);const [x0,y0]=pt(a0,R),[x1,y1]=pt(a1,R);
    s+=`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="var(--t${i})" stroke-width="22" stroke-linecap="butt"/>`;});
  document.getElementById("arcs").innerHTML=s;
  let k="";for(let v=0;v<=100;v+=10){const [a,b]=pt(v,R-18),[c,d]=pt(v,R-(v%20?22:28));k+=`<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" stroke="var(--muted)" stroke-width="${v%20?1:1.6}"/>`;
    if(v%20===0){const [tx,ty]=pt(v,R-40);k+=`<text x="${tx.toFixed(1)}" y="${(ty+4).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="Work Sans,sans-serif">${v}</text>`}}
  document.getElementById("ticks").innerHTML=k;
})();
function setNeedle(v){document.getElementById("needle").style.transform=`rotate(${(v/100*180-90).toFixed(1)}deg)`}
setNeedle(50);


const EXAMPLES=[
`Baby you set me free
You're my everything, it's meant to be
I feel the fire inside, the burning desire
Every night you take me higher
Oh oh oh yeah
You break my heart, we fall apart
Tears fall like rain, I feel the pain
Until the end of time
Until the end of time
Oh oh oh yeah`,
`Dashboard glow is the only lamp still on
your hoodie smells like the 7-Eleven
we split a cherry slush at the light on Hillsboro
and you counted red cars out loud like a prayer
I keep the receipt in the cupholder
like proof we were ever that easy`];


/* ---------- API ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, { method: opts.method || (opts.body ? "POST" : "GET"), headers: opts.body ? { "content-type": "application/json" } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: "same-origin" });
  let data = {}; try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error(data.message || data.error || "Something went wrong. Try again."); err.status = res.status; err.code = data.error; throw err; }
  return data;
}
let ME = null;
const isPro = () => !!(ME && ME.pro);
async function loadMe() { try { ME = await api("/api/me"); } catch (e) { ME = null; } renderQuota(); renderPro(); renderAccount(); applyUnlocks(); }

/* ---------- Weigh ---------- */
function renderReading() {
  const t = $("lyrics").value;
  if (words(t).length < 8) { $("blurb").textContent = "Give it at least a couple of lines. Eight words minimum."; return; }
  last = analyze(t);
  const score = Math.round(clamp(last.raw + crowdTune)); last.score = score; last.tier = tierOf(score); last.text = t;
  setNeedle(score);
  $("score").textContent = score;
  const v = $("verdict"); v.textContent = TIERS[last.tier].n; v.className = `verdict bg-t${last.tier} t${last.tier}`;
  $("blurb").textContent = TIERS[last.tier].blurb;
  $("tune").textContent = tuneN ? `Crowd-tuned ${crowdTune >= 0 ? "+" : ""}${crowdTune} from ${tuneN} Wall posts. Raw meter: ${Math.round(last.raw)}.` : "Raw meter score. The crowd tune kicks in once the Wall has enough votes.";
  const m = $("meter"); m.classList.remove("wack-now", "wicked-now"); void m.offsetWidth;
  if (last.tier === 4) { m.classList.add("wack-now"); sfx("gag"); } else if (last.tier === 0) { m.classList.add("wicked-now"); confetti(); sfx("sparkle"); } else sfx("pop");
  last.best = bestLine(t);
  if (last.best) { $("bestPick").hidden = false; $("bestChar").innerHTML = charSVG(0); $("bestText").textContent = "“" + last.best.line + "”"; }
  else $("bestPick").hidden = true;
  $("mchar").innerHTML = charSVG(last.tier);
  const qs = QUIPS[last.tier]; $("quip").textContent = `${CREW[last.tier].name}: ${qs[(Math.random() * qs.length) | 0]}`;
  renderCrew(last.tier);
  $("metrics").innerHTML = METRICS.map((mm) => { const val = Math.round(last.vals[mm.k]); const ti = tierOf(val);
    return `<div class="m"><div class="top"><b>${mm.n}</b><span class="v">${val}</span></div><div class="bar"><i class="bg-t${ti}" style="width:${Math.max(val, 2)}%"></i></div><small>${esc(last.notes[mm.k])}</small></div>`; }).join("");
  renderMap();
  $("post").hidden = false; $("postNote").textContent = ""; $("postBtn").disabled = false;
  $("roast").hidden = true;
  updateWingCtx();
  cardLinesTouched = false; drawCard();
}
function wipe() {
  $("lyrics").value = ""; try { localStorage.removeItem("wk-draft"); } catch (e) {}
  $("map").hidden = true; $("post").hidden = true; $("roast").hidden = true; $("bestPick").hidden = true; $("metrics").innerHTML = ""; $("score").textContent = "–";
  const v = $("verdict"); v.textContent = "Waiting"; v.className = "verdict bg-t2 t2"; $("blurb").textContent = "Paste some lines and hit Weigh it."; $("tune").textContent = "";
  setNeedle(50); last = null; $("share").hidden = true; renderCrew(null); $("mchar").innerHTML = charSVG(5); $("quip").textContent = "The crew is ready. Paste something."; updateWingCtx(); $("lyrics").focus();
}

/* ---------- tabs ---------- */
const VIEWS = ["weigh", "daily", "pen", "wall", "wingman", "why", "pro", "lost"];
function show(v) {
  document.querySelectorAll("#mainNav button").forEach((b) => b.setAttribute("aria-selected", b.dataset.v === v));
  VIEWS.forEach((x) => ($("v-" + x).hidden = x !== v)); window.scrollTo(0, 0);
  if (v === "pen") { if (!location.pathname.startsWith("/pen/")) history.replaceState(null, "", "/#pen"); }
  else if (v !== "lost" && (location.pathname !== "/" || location.hash !== "#" + v)) history.replaceState(null, "", "/#" + v);
  if (v === "wall") loadWall();
  if (v === "daily") loadDaily();
  if (v === "pro") loadMe();
  if (v === "pen") loadPenView();
}

/* ---------- Wall ---------- */
let feed = "fresh"; const FEAT = 5; let wall = { readings: [], stats: {} }, wallTimer = null;
async function loadTune() { try { const t = await api("/api/tune"); crowdTune = t.tune; tuneN = t.n; } catch (e) {} }
async function loadWall() {
  clearTimeout(wallTimer);
  try { wall = await api("/api/wall?feed=" + feed); crowdTune = wall.stats.tune; tuneN = wall.stats.tuneN; renderWall(); }
  catch (e) { $("cards").innerHTML = `<div class="empty"><div class="ch">${charSVG(3)}</div>The Wall didn't load. ${esc(e.message)}</div>`; }
  if (!$("v-wall").hidden) wallTimer = setTimeout(loadWall, 20000);
}
function renderWall() {
  const st = wall.stats || {};
  $("sWave").textContent = st.wavelength == null ? "–" : st.wavelength + "%";
  $("sTune").textContent = (st.tune > 0 ? "+" : "") + (st.tune || 0);
  $("sVotes").textContent = st.votes || 0;
  const el = $("cards"), list = wall.readings || [];
  if (!list.length) {
    el.innerHTML = feed === "fresh"
      ? `<div class="empty"><div class="ch">${charSVG(2)}</div>The Wall is empty. Weigh your lyrics and post them to be the first one the crowd votes on.</div>`
      : `<div class="empty"><div class="ch">${charSVG(2)}</div>Nothing Featured yet. Vote on Fresh posts. Once one hits ${FEAT} votes, it shows up here.</div>`;
    return;
  }
  el.innerHTML = "";
  list.forEach((r) => {
    const c = r.votes, n = c.reduce((a, b) => a + b, 0);
    const crowdTier = n ? tierOf(c.reduce((a, b, i) => a + b * MID[i], 0) / n) : null;
    const card = document.createElement("article"); card.className = "card";
    card.innerHTML = `<div class="ch"><span class="ttl"></span>${n >= FEAT ? '<span class="pill" style="background:var(--ink);color:var(--bg)">Featured</span>' : ""}<span class="pill bg-t${r.tier} t${r.tier}"><span class="mini">${charSVG(r.tier)}</span>Crew: ${TIERS[r.tier].n} ${r.score}</span></div>
      <pre></pre>
      <div class="crowd" title="Crowd votes">${n ? c.map((v, i) => (v ? `<i class="bg-t${i}" style="width:${(v / n) * 100}%"></i>` : "")).join("") : ""}</div>
      <div class="cmeta"><span>${n ? `Crowd says ${TIERS[crowdTier].n} · ${n} vote${n > 1 ? "s" : ""}` : "No votes yet. Be first."}</span><span>${new Date(r.createdAt).toLocaleDateString()}</span></div>
      <div class="votes">${TIERS.map((t, i) => `<button data-i="${i}" class="t${i} ${r.myVote === i ? "mine bg-t" + i : ""}" aria-pressed="${r.myVote === i}">${t.n}</button>`).join("")}</div>
      <div class="cfoot"><div class="reacts">${REACTS.map((e) => `<button class="react${(r.myReacts || []).includes(e) ? " on" : ""}" data-e="${e}" aria-pressed="${(r.myReacts || []).includes(e)}">${e} <span>${(r.reacts || {})[e] || ""}</span></button>`).join("")}</div></div>`;
    card.querySelector(".ttl").textContent = r.title || "Untitled";
    card.querySelector("pre").textContent = r.excerpt;
    card.querySelectorAll(".votes button").forEach((b) => (b.onclick = () => castVote(r, +b.dataset.i, b)));
    const foot = card.querySelector(".cfoot");
    card.querySelectorAll(".react").forEach((b) => (b.onclick = async () => {
      const on = b.classList.contains("on"); b.disabled = true; sfx("pop");
      try { await api("/api/react", { body: { id: r.id, emoji: b.dataset.e, off: on } }); await loadWall(); } catch (e) { b.disabled = false; }
    }));
    const act = document.createElement("button"); act.className = "del";
    if (r.mine) {
      act.textContent = "Take mine down";
      act.onclick = async () => { if (!act.dataset.sure) { act.dataset.sure = 1; act.textContent = "Tap again to remove"; return; }
        act.disabled = true; try { await api("/api/wall/" + r.id, { method: "DELETE" }); loadWall(); } catch (e) { act.textContent = e.message; act.disabled = false; } };
    } else {
      act.textContent = "Report";
      act.onclick = async () => { if (!act.dataset.sure) { act.dataset.sure = 1; act.textContent = "Not their own lyrics, or not OK? Tap to report"; return; }
        act.disabled = true; try { await api("/api/report", { body: { id: r.id } }); act.textContent = "Reported. Thanks."; } catch (e) { act.textContent = e.message; act.disabled = false; } };
    }
    foot.appendChild(act);
    el.appendChild(card);
  });
}
async function castVote(r, i, btn) {
  btn.disabled = true;
  try { await api("/api/vote", { body: { id: r.id, tier: i } }); await loadWall(); }
  catch (e) { btn.textContent = "Didn't save"; btn.disabled = false; }
}
document.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => {
  feed = b.dataset.f; document.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-selected", x === b));
  $("feedHint").textContent = feed === "fresh" ? "Everything new, newest first. Posts with 5+ votes get Featured." : "Crowd-promoted: 5+ votes, ranked by how many people weighed in.";
  loadWall();
}));
$("postBtn").onclick = async () => {
  if (!last) return; const b = $("postBtn");
  if (!$("postAttest").checked) { $("postNote").textContent = "Tick the box to confirm these are your own lyrics."; return; }
  b.disabled = true; $("postNote").textContent = "Posting…";
  try { await api("/api/wall", { body: { text: last.text, title: $("postTitle").value.trim(), attest: true } });
    $("postNote").innerHTML = 'Posted. <a href="#wall">See it on the Wall</a>'; $("postTitle").value = ""; }
  catch (e) { $("postNote").textContent = e.message; b.disabled = false; }
};

/* ---------- Roast ---------- */
const REACTS = ["🔥", "😭", "💀", "🤢"];
$("roastBtn").onclick = async () => {
  if (words($("lyrics").value).length < 8) { $("blurb").textContent = "Give Wretch at least eight words to roast."; return; }
  if (!last) renderReading();
  const box = $("roast"); box.hidden = false; $("roastText").textContent = "Wretch is reading… 🤢";
  $("roastChar").innerHTML = charSVG(4); box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  sfx("gag");
  try { const r = await api("/api/wingman", { body: { mode: "roast", pad: $("lyrics").value } }); $("roastText").textContent = r.text; ME = r.me; renderQuota(); }
  catch (e) { $("roastText").textContent = e.status === 402 ? e.message : e.message || "Wretch couldn't keep it down. Try again."; if (e.status === 402) addProLink($("roastText")); }
};
$("copyRoast").onclick = () => track("copy_roast") || copyText($("roastText").textContent + "\n\nRoasted by Wretch on the Wackometer", $("copyRoast"), "Copy roast");

/* ---------- Wingman ---------- */
const history_ = []; let busy = false;
function updateWingCtx() { $("wingCtx").textContent = last ? `Wingman sees your pad: ${TIERS[last.tier].n} (${last.score}).` : words($("lyrics").value).length ? "Wingman sees your pad (not weighed yet)." : "Your Weigh pad is empty, so Wingman starts fresh."; }
function bubble(cls, text) {
  const d = document.createElement("div"); d.className = "msg " + cls;
  if (cls === "wm") { d.innerHTML = '<span class="who">' + charSVG(5) + "WINGMAN</span>"; const s = document.createElement("span"); s.textContent = text; d.appendChild(s); d._t = s; }
  else d.textContent = text;
  $("log").appendChild(d); $("log").scrollTop = $("log").scrollHeight; return d;
}
function addProLink(el) { const b = document.createElement("button"); b.className = "btn bile"; b.style.marginTop = "8px"; b.style.display = "block"; b.textContent = "See Wingman Pro"; b.onclick = () => show("pro"); el.after ? el.parentNode.appendChild(b) : el.appendChild(b); }
async function ask(q) {
  q = q.trim(); if (!q || busy) return; busy = true; $("sendBtn").disabled = true;
  bubble("me", q); const out = bubble("wm", "Thinking…");
  try {
    const r = await api("/api/wingman", { body: { mode: "chat", message: q, pad: $("lyrics").value.trim(), history: history_.slice(-10) } });
    out._t.textContent = r.text; history_.push({ role: "user", content: q }, { role: "assistant", content: r.text }); ME = r.me; renderQuota();
  } catch (e) { out._t.textContent = e.message; if (e.status === 402) addProLink(out._t); }
  busy = false; $("sendBtn").disabled = false; $("log").scrollTop = $("log").scrollHeight;
}
$("compose").addEventListener("submit", (e) => { e.preventDefault(); const q = $("ask").value; $("ask").value = ""; ask(q); });
$("ask").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("compose").requestSubmit(); } });
$("chips").querySelectorAll("button").forEach((b) => (b.onclick = () => ask(b.textContent)));
function renderQuota() {
  const q = $("quota"); if (!q) return;
  if (!ME) { q.textContent = ""; return; }
  if (ME.pro) q.innerHTML = 'Wingman Pro is on. Unlimited messages. <a href="#pro">Manage</a>';
  else { const left = Math.max(0, ME.freeDaily - ME.usedToday); q.innerHTML = `${left} of ${ME.freeDaily} free messages left today${ME.credits ? ` · ${ME.credits} credits` : ""}. <a href="#pro">Go unlimited</a>`; }
}

/* ---------- Pro ---------- */
let yearly = false;
function setBill(y) { yearly = y; $("billM").setAttribute("aria-pressed", !y); $("billY").setAttribute("aria-pressed", y); $("proPrice").innerHTML = y ? '$59 <small>/ year</small>' : '$7.99 <small>/ month</small>'; }
$("billM").onclick = () => setBill(false); $("billY").onclick = () => setBill(true);
function renderPro() {
  const fb = document.querySelector('[data-plan="free"]'), pb = document.querySelector('[data-plan="pro"]');
  if (ME && ME.pro) { fb.textContent = "Manage billing"; fb.disabled = false; pb.textContent = "You're on Pro"; pb.disabled = true;
    $("demoNote").textContent = ME.proUntil ? `Pro is active through ${new Date(ME.proUntil).toLocaleDateString()}.` : "Pro is active."; }
  else { fb.textContent = ME && ME.billing ? "Manage billing" : "You're on Free"; fb.disabled = !(ME && ME.billing); pb.textContent = "Start Wingman Pro"; pb.disabled = false;
    $("demoNote").textContent = "Payments run through Stripe. Cancel anytime from Manage billing."; }
}
async function checkout(plan, btn) {
  const was = btn.textContent; btn.disabled = true; btn.textContent = "Opening checkout…";
  try { const r = await api("/api/checkout", { body: { plan } }); location.href = r.url; }
  catch (e) { $("demoNote").textContent = e.message; btn.textContent = was; btn.disabled = false; }
}
document.querySelector('[data-plan="pro"]').onclick = (e) => checkout(yearly ? "yearly" : "monthly", e.currentTarget);
document.querySelector('[data-plan="credits"]').onclick = (e) => checkout("credits", e.currentTarget);
document.querySelector('[data-plan="free"]').onclick = async (e) => {
  const b = e.currentTarget; b.disabled = true;
  try { const r = await api("/api/portal", { body: {} }); location.href = r.url; } catch (err) { $("demoNote").textContent = err.message; b.disabled = false; }
};
document.querySelector('[data-plan="class"]').onclick = (e) => { $("demoNote").textContent = `Email ${CONTACT_EMAIL} and we'll set up your class.`; };

/* ---------- Daily W ---------- */
let daily = null, board = "crew";
async function loadDaily() {
  try { daily = await api("/api/daily"); renderDaily(); }
  catch (e) { $("dPrompt").textContent = "Today's prompt didn't load."; $("dNote").textContent = e.message; }
}
function renderDaily() {
  $("dNum").textContent = `Daily W #${daily.number}`;
  $("dPrompt").textContent = daily.prompt;
  $("dEmoji").textContent = daily.emoji || "";
  renderUnlocks(daily.streak || 0);
  $("dStreak").textContent = daily.streak || 0;
  $("dCount").textContent = `${daily.entries} ${daily.entries === 1 ? "writer has" : "writers have"} taken today's W.`;
  if (daily.handle && !$("dHandle").value) $("dHandle").value = daily.handle;
  if (daily.mine) {
    $("dCompose").hidden = true; $("dResult").hidden = false;
    showDailyResult({ score: daily.mine.score, tier: daily.mine.tier, rank: daily.mine.rank, total: daily.entries, streak: daily.streak, lines: daily.mine.lines });
  } else { $("dCompose").hidden = false; $("dResult").hidden = true; }
  renderBoard();
}
function shareGrid(lines) {
  const a = analyze(lines);
  return METRICS.map((m) => DAILY_EMOJI[tierOf(a.vals[m.k])]).join("");
}
function showDailyResult(r) {
  $("dChar").innerHTML = charSVG(r.tier);
  $("dScore").textContent = r.score;
  const v = $("dVerdict"); v.textContent = TIERS[r.tier].n; v.className = `verdict bg-t${r.tier} t${r.tier}`;
  $("dRank").textContent = `#${r.rank} of ${r.total} today`;
  $("dMine").textContent = r.lines;
  const grid = shareGrid(r.lines);
  $("dShare").textContent = `Daily W #${daily.number} ${daily.emoji || ""} · ${TIERS[r.tier].n} ${r.score}\n${grid}\nRank ${r.rank}/${r.total}${r.streak > 1 ? ` · 🔥 ${r.streak}-day streak` : ""}\n${location.host}`;
}
function renderBoard() {
  const list = board === "crew" ? daily.crew : daily.crowd, el = $("dBoard");
  document.querySelectorAll("[data-b]").forEach((x) => x.setAttribute("aria-selected", x.dataset.b === board));
  if (!list.length) { el.innerHTML = `<div class="empty"><div class="ch">${charSVG(board === "crew" ? 0 : 1)}</div>${board === "crew" ? "No entries yet today. Be the first name on the board." : "No 🔥 yet. Fire the lines you'd steal."}</div>`; return; }
  el.innerHTML = "";
  list.forEach((e, i) => {
    const row = document.createElement("div"); row.className = "entry" + (e.mine ? " you" : "");
    const lit = daily.liked.includes(e.entry);
    row.innerHTML = `<span class="rank">${i + 1}</span><span class="mini">${charSVG(e.tier)}</span><div class="ebody"><div class="ewho"></div><pre></pre></div><div class="eside"><span class="pill bg-t${e.tier}">${e.score}</span><button class="fire${lit ? " lit" : ""}" ${e.mine ? "disabled" : ""} aria-pressed="${lit}" title="Fire it">🔥 <span>${e.fires}</span></button></div>`;
    row.querySelector(".ewho").textContent = e.who;
    row.querySelector("pre").textContent = e.lines;
    const f = row.querySelector(".fire");
    f.onclick = async () => { f.disabled = true; try { await api("/api/daily/fire", { body: { entry: e.entry, off: lit } }); await loadDaily(); } catch (err) { f.disabled = false; } };
    el.appendChild(row);
  });
}
document.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => { board = b.dataset.b; if (daily) renderBoard(); }));
$("dLines").addEventListener("input", () => {
  const t = $("dLines").value, n = words(t).length;
  if (n < 4) { $("dLive").textContent = "Live meter: start writing"; return; }
  const a = analyze(t), s = Math.round(a.raw); $("dLive").textContent = `Live meter: ${TIERS[tierOf(s)].n} ${s} · ${n} words`;
});
$("dSubmit").onclick = async () => {
  const b = $("dSubmit"), note = $("dNote");
  if (!$("dAttest").checked) { note.textContent = "Tick the box to confirm these are your own lines."; return; }
  b.disabled = true; note.textContent = "Weighing…";
  try {
    const lines = $("dLines").value;
    const r = await api("/api/daily", { body: { lines, attest: true, handle: $("dHandle").value.trim() } });
    note.textContent = ""; await loadDaily();
    if (r.tier === 0) { /* party */ }
  } catch (e) { note.textContent = e.message; b.disabled = false; }
};
$("dCopy").onclick = () => { copyText($("dShare").textContent, $("dCopy"), "Copy my result"); track("copy_daily"); };

/* ---------- helpers ---------- */
async function copyText(t, btn, label) {
  try { await navigator.clipboard.writeText(t); btn.textContent = "Copied"; }
  catch (e) { btn.textContent = "Select and copy it"; }
  setTimeout(() => (btn.textContent = label), 1800);
}

function renderMap(){
  const syl = last.real.map(lineSyllables), sorted = [...syl].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 0;
  let ri=-1;const out=last.lines.map((l, li)=>{
    if(!l.trim())return `<div class="ln blank"></div>`;ri++;
    let h=esc(l);
    const spans=[];CLICHES.forEach(c=>{let re=new RegExp("\\b"+c.replace(/'/g,"(?:'|&#39;)")+"\\b","gi"),m;while((m=re.exec(h)))spans.push([m.index,m.index+m[0].length,"wk-c",c])});
    h.replace(/\b[a-z']+\b/gi,(w,i)=>{const lw=w.toLowerCase();if(FILLER.has(lw))spans.push([i,i+w.length,"wk-f"]);else if(WEIGHTLESS.has(lw))spans.push([i,i+w.length,"wk-a"]);return w});
    spans.sort((a,b)=>a[0]-b[0]||(b[1]-b[0])-(a[1]-a[0]));
    let res="",pos=0;for(const [st,e,c,cl] of spans){if(st<pos)continue;
      res+=h.slice(pos,st)+(cl?`<button type="button" class="${c}" data-c="${esc(cl)}" data-line="${li}" title="Tap for a fresh swap">${h.slice(st,e)}</button>`:`<span class="${c}">${h.slice(st,e)}</span>`);pos=e}
    res+=h.slice(pos);
    const n = syl[ri], off = last.real.length >= 3 && med >= 4 && (n > med * 1.45 + 2 || n < med * 0.55 - 1);
    const chips = (last.best && last.best.i === ri ? '<span class="chip gold">⭐ Wiz pick</span>' : "")
      + (last.lazyLines.has(ri) ? '<span class="chip">wimpy rhyme</span>' : "")
      + `<span class="syl${off ? " off" : ""}" title="${off ? (n > med ? "Wobbles: this line runs long. It may rush when you sing it." : "Wobbles: this line is short next to the others.") : "Syllables"}">${off ? "🌀 " : ""}${n}</span>`;
    return `<div class="ln${last.best && last.best.i === ri ? " best" : ""}"><span class="t">${res}</span><span class="lchips">${chips}</span></div>`});
  $("mapLines").innerHTML=out.join("");$("map").hidden=false;
  $("mapLines").querySelectorAll(".wk-c").forEach((b) => (b.onclick = (e) => openSwap(b, b.dataset.c, +b.dataset.line)));
}

/* ---------- the crew ---------- */
const CREW=[{name:"Wiz",col:"#3D8BFF"},{name:"Wendy",col:"#22C29B"},{name:"Wally",col:"#A9A2DA"},{name:"Wobbles",col:"#FF8A3D"},{name:"Wretch",col:"#A8C42E"},{name:"Wingman",col:"#FFFFFF"}];
const SHOUT=["Wicked!","Well put!","Meh.","Uhh…","Bleh! 🤢"];
const QUIPS=[["That's wicked. I'm framing this.","Okay, poet. That line hit.","Fresh. Nobody's said it like that."],["Well put. I'd nod to this.","Clean. A couple of safe picks, but clean.","Solid. Push one image harder."],["Whatever. It's… words.","Heard it. Already forgot it.","It's fine. Fine is the problem."],["Weird. Something smells borrowed.","Did you just rhyme fire with desire?","Half of this I've heard on the radio."],["Wack. Somebody hold my bucket.","I'm gonna be sick. In a fun way.","This belongs inside a greeting card."]];
const INK="#1F2340";
function eye(cx,cy,r,dx=1,dy=1){return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="${cx+dx*r*.25}" cy="${cy+dy*r*.15}" r="${r*.52}" fill="${INK}"/><circle cx="${cx+dx*r*.25-r*.2}" cy="${cy+dy*r*.15-r*.22}" r="${r*.18}" fill="#fff"/>`}
function charSVG(i,size){
  const c=CREW[i].col,S=`stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`;
  const shadow=`<ellipse cx="60" cy="112" rx="30" ry="5" fill="${INK}" opacity=".13"/>`;
  const shine=`<ellipse cx="42" cy="44" rx="11" ry="6" fill="#fff" opacity=".45" transform="rotate(-30 42 44)"/>`;
  let back="",body="",face="",extra="";
  if(i===0){body=`<path d="M60 22C86 22 102 42 102 68C102 94 84 106 60 106C36 106 18 94 18 68C18 42 34 22 60 22Z" fill="${c}" ${S}/>`;
    face=`<g class="eyes"><rect x="31" y="52" width="25" height="15" rx="7" fill="${INK}"/><rect x="64" y="52" width="25" height="15" rx="7" fill="${INK}"/><path d="M56 57h8" stroke="${INK}" stroke-width="3.5"/><path d="M36 56l6 0M69 56l6 0" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/></g><path d="M48 80Q62 90 76 78" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
    extra=`<g fill="#FFD84D" stroke="${INK}" stroke-width="2"><path class="spark" d="M100 14l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path class="spark" style="animation-delay:-.6s" d="M16 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path class="spark" style="animation-delay:-1.1s" d="M108 54l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></g>`}
  if(i===1){body=`<path d="M60 16C82 16 96 36 96 64C96 92 82 106 60 106C38 106 24 92 24 64C24 36 38 16 60 16Z" fill="${c}" ${S}/>`;
    face=`<g class="eyes">${eye(48,54,9)}${eye(72,54,9)}</g><ellipse cx="36" cy="72" rx="6" ry="4" fill="#FF8FC0" opacity=".9"/><ellipse cx="84" cy="72" rx="6" ry="4" fill="#FF8FC0" opacity=".9"/><path d="M47 72Q60 92 73 72Z" fill="${INK}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M53 80Q60 76 67 80Q63 86 57 85Z" fill="#FF8FC0"/>`;
    extra=`<g ${S}><path d="M94 66C102 62 108 56 106 48" fill="none" stroke-linecap="round"/><circle cx="106" cy="44" r="7" fill="${c}"/><path d="M106 37V31" stroke-linecap="round"/></g>`}
  if(i===2){body=`<path d="M60 40C88 40 106 54 106 76C106 98 88 106 60 106C32 106 14 98 14 76C14 54 32 40 60 40Z" fill="${c}" ${S}/>`;
    face=`<g class="eyes">${eye(46,70,8,0,1)}${eye(74,70,8,0,1)}<path d="M37 70A9 9 0 0 1 55 70Z M65 70A9 9 0 0 1 83 70Z" fill="${c}" stroke="${INK}" stroke-width="2.5"/></g><path d="M50 90H70" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
    extra=`<g ${S} fill="${c}"><path d="M14 80C8 76 6 70 9 64" fill="none" stroke-linecap="round"/><path d="M106 80C112 76 114 70 111 64" fill="none" stroke-linecap="round"/></g><text x="92" y="36" font-family="Fredoka,sans-serif" font-weight="700" font-size="15" fill="${INK}" opacity=".55">meh</text>`}
  if(i===3){body=`<path d="M58 20C76 16 98 32 100 54C103 72 96 78 99 90C101 103 82 107 60 106C38 107 18 102 20 86C22 74 15 66 19 52C24 32 42 23 58 20Z" fill="${c}" ${S}/>`;
    face=`<g class="eyes">${eye(45,56,11,-1,-1)}${eye(77,61,6,1,1)}</g><path d="M44 84L52 79L60 86L68 79L76 84" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    extra=`<text class="spark" x="94" y="22" font-family="Fredoka,sans-serif" font-weight="700" font-size="26" fill="${INK}">?</text>`}
  if(i===4){body=`<path d="M60 26C84 26 98 44 100 66C102 86 108 98 96 104C86 108 76 101 66 106C52 112 46 102 34 106C20 110 14 96 20 82C24 70 18 44 34 32C42 27 50 26 60 26Z" fill="${c}" ${S}/>`;
    face=`<g class="eyes"><path d="M37 52L50 59L37 66M83 52L70 59L83 66" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="35" cy="79" r="9" fill="#C9DE6A" stroke="${INK}" stroke-width="2.5"/><circle cx="85" cy="79" r="9" fill="#C9DE6A" stroke="${INK}" stroke-width="2.5"/><path d="M47 84Q53 79 59 84T71 84" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M58 86q3 9 1 15a4 4 0 1 0 6 0q-2-6 0-14z" fill="#86A01A" stroke="${INK}" stroke-width="2"/>`;
    extra=`<path d="M98 34q5 8 0 12a4 4 0 0 1-6-4q2-4 6-8z" fill="#9FD3FF" stroke="${INK}" stroke-width="2"/><g class="stink" fill="none" stroke="#86A01A" stroke-width="3" stroke-linecap="round"><path d="M34 18q-4-4 0-8t0-8"/><path d="M60 14q-4-4 0-8"/><path d="M86 18q-4-4 0-8t0-8"/></g>`}
  if(i===5){back=`<g fill="#A8C42E" stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path class="wing l" d="M26 66C8 60 2 44 6 34C16 40 22 44 30 50Z"/><path class="wing r" d="M94 66C112 60 118 44 114 34C104 40 98 44 90 50Z"/></g>`;
    body=`<path d="M60 26C84 26 98 44 98 68C98 92 82 106 60 106C38 106 22 92 22 68C22 44 36 26 60 26Z" fill="#fff" ${S}/>`;
    face=`<g class="eyes">${eye(48,64,7)}</g><path d="M66 64Q72 58 78 64" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M48 80Q60 90 72 80" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="38" cy="76" rx="5" ry="3.5" fill="#FF8FC0"/><ellipse cx="82" cy="76" rx="5" ry="3.5" fill="#FF8FC0"/>`;
    extra=`<path d="M28 54Q28 18 60 18T92 54" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><rect x="20" y="48" width="13" height="22" rx="6" fill="#A8C42E" stroke="${INK}" stroke-width="3"/><rect x="87" y="48" width="13" height="22" rx="6" fill="#A8C42E" stroke="${INK}" stroke-width="3"/>`}
  if (i === 0 && UNLOCK.chain) extra += `<g><path d="M40 98Q60 112 80 98" fill="none" stroke="#E8B400" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 6"/><circle cx="60" cy="106" r="6" fill="#FFD84D" stroke="${INK}" stroke-width="2"/><text x="60" y="109" text-anchor="middle" font-size="7" font-weight="700" fill="${INK}" font-family="Fredoka,sans-serif">W</text></g>`;
  if (i === 1 && UNLOCK.crown) extra += `<g stroke="${INK}" stroke-width="1.5">${[34,46,60,74,86].map((x,k)=>`<circle cx="${x}" cy="${k===2?14:k%2?17:22}" r="6" fill="${["#FF8FC0","#FFD84D","#FF8FC0","#FFD84D","#FF8FC0"][k]}"/><circle cx="${x}" cy="${k===2?14:k%2?17:22}" r="2" fill="#fff"/>`).join("")}</g>`;
  if (i === 4 && UNLOCK.hat) extra += `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M22 36Q60 22 98 36L92 44Q60 34 28 44Z" fill="#FF8A3D"/><path d="M36 34Q40 10 60 10T84 34Z" fill="#FF8A3D"/><path d="M38 28Q60 20 82 28" fill="none" stroke="#FFD84D" stroke-width="3"/></g>`;
  const sz=size?` width="${size}" height="${size}"`:"";
  return `<svg class="char" viewBox="0 0 120 120"${sz} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${shadow}<g class="body">${back}${body}${i!==5?shine:""}${face}${extra}</g></svg>`;
}
function renderCrew(active){
  const el=$("crew");
  el.innerHTML=CREW.slice(0,5).map((c,i)=>`<div class="member${i===active?" on":""}" title="${c.name}">${i===active?`<div class="say">${SHOUT[i]}</div>`:""}<div class="ch">${charSVG(i)}</div><div class="step bg-t${i}"><b>${TIERS[i].n}</b><span>${TIERS[i].lo}–${i<4?TIERS[i+1].lo-1:100}</span></div></div>`).join("");
  el.classList.toggle("picked",active!=null);
}
function confetti(){
  const cv=$("fx"),m=$("meter");if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const W=cv.width=m.clientWidth,H=cv.height=m.clientHeight,x=cv.getContext("2d");
  const cols=["#3D8BFF","#22C29B","#FFD84D","#FF8FC0","#FF8A3D"];
  const ps=Array.from({length:90},()=>({x:W/2,y:H*.45,vx:(Math.random()-.5)*9,vy:-Math.random()*9-3,s:4+Math.random()*5,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:cols[Math.random()*5|0]}));
  let t=0;(function f(){x.clearRect(0,0,W,H);ps.forEach(p=>{p.vy+=.28;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/3,p.s,p.s*.66);x.restore()});
    if(++t<110)requestAnimationFrame(f);else x.clearRect(0,0,W,H)})();
}

/* ---------- share card ---------- */
const CARD={w:1080,h:1920};
const TC=["#3D8BFF","#22C29B","#A9A2DA","#FF8A3D","#A8C42E"];
const TEXT_ON=["#FFFFFF","#1F2340","#1F2340","#1F2340","#1F2340"];
const CAPS=["Rated WICKED on the Wackometer. Your move.","Wackometer says WELL PUT. I'll take it.","Wackometer said WHATEVER. Rude, but fair?","Wackometer called this WEIRD. Is it?","My verse got rated WACK 🤢 Be honest, is it?"];
let cardBlob=null,cardLinesTouched=false,cardImg=null;
function defaultLines(){if(!last)return "";
  if(last.best)return last.best.line;
  const r=last.real.filter(l=>words(l).length>2&&!/^(oh|ooh|yeah|na|la)\b/i.test(l));return r.slice(0,2).join("\n")}
function wrap(ctx,text,maxW){const out=[];text.split("\n").forEach(par=>{let line="";par.split(/\s+/).forEach(w=>{const t=line?line+" "+w:w;if(ctx.measureText(t).width>maxW&&line){out.push(line);line=w}else line=t});if(line)out.push(line)});return out}
const ease=(t)=>1-Math.pow(1-t,3), back=(t)=>{const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
// p: animation progress 0..1 (1 = finished card). Needle sweeps, character pops, verdict stamps.
function paintCard(x,p){
  const t=last.tier,col=TC[t],D='"Fredoka","Work Sans",sans-serif',B='"Work Sans",sans-serif';
  const pn=Math.min(1,p/0.55), pc=Math.max(0,Math.min(1,(p-0.45)/0.3)), pv=Math.max(0,Math.min(1,(p-0.62)/0.25)), pl=Math.max(0,Math.min(1,(p-0.8)/0.2));
  x.save();x.textAlign="left";x.fillStyle="#FBFCFF";x.fillRect(0,0,CARD.w,CARD.h);
  x.fillStyle=t>=3?"#EAF3C4":"#E8F1FF";x.fillRect(0,0,CARD.w,560);
  if(t>=3){for(let i=0;i<9;i++){const dx=60+i*120+(i%2)*30,len=(60+((i*53)%140))*ease(pv);x.beginPath();x.moveTo(dx-26,560);x.lineTo(dx+26,560);x.lineTo(dx+14,560+len);x.arc(dx,560+len,14,0,Math.PI);x.closePath();x.fill()}}
  x.fillStyle="#1F2340";x.font=`700 88px ${D}`;x.textBaseline="alphabetic";
  const wW=x.measureText("W").width,rest="ackometer",rW=x.measureText(rest).width,sx=(CARD.w-wW-rW)/2;
  x.save();x.translate(sx+wW/2,200);x.rotate(-.14);x.fillStyle="#86A01A";x.fillText("W",-wW/2,0);x.restore();x.fillText(rest,sx+wW,200);
  x.font=`600 40px ${B}`;x.fillStyle="#646A8C";x.textAlign="center";x.fillText(($("postTitle").value.trim()?`"${$("postTitle").value.trim()}" `:"My lyrics ")+"got weighed",CARD.w/2,330);
  const gx=CARD.w/2,gy=1020,gr=390;
  for(let i=0;i<5;i++){x.beginPath();x.strokeStyle=TC[i];x.lineWidth=70;const a0=Math.PI+(i*20+(i?1:0))/100*Math.PI,a1=Math.PI+((i+1)*20-(i<4?1:0))/100*Math.PI;x.arc(gx,gy,gr,a0,a1);x.stroke()}
  x.font=`600 30px ${B}`;x.fillStyle="#646A8C";["Wicked","Well put","Whatever","Weird","Wack"].forEach((n,i)=>{const a=Math.PI+(i*20+10)/100*Math.PI;x.fillText(n,gx+(gr+80)*Math.cos(a),gy+(gr+80)*Math.sin(a)+10)});
  const shown=last.score*back(pn);const na=Math.PI+Math.max(0,Math.min(104,shown))/100*Math.PI;
  x.strokeStyle="#1F2340";x.lineWidth=14;x.lineCap="round";x.beginPath();x.moveTo(gx,gy);x.lineTo(gx+(gr-60)*Math.cos(na),gy+(gr-60)*Math.sin(na));x.stroke();
  x.fillStyle="#1F2340";x.beginPath();x.arc(gx,gy,34,0,7);x.fill();x.fillStyle="#FBFCFF";x.beginPath();x.arc(gx,gy,12,0,7);x.fill();
  if(cardImg&&pc>0){const s=250*back(pc);x.save();x.translate(221,gy+310);x.drawImage(cardImg,-s/2,-s,s,s);x.restore()}
  x.fillStyle="#1F2340";x.font=`700 230px ${D}`;x.fillText(String(Math.round(Math.min(last.score,Math.max(0,shown)))),gx+60,gy+250);
  if(pv>0){x.save();x.globalAlpha=Math.min(1,pv*2);const sc=1+(1-back(pv))*0.6;x.translate(gx,gy+365);x.scale(sc,sc);
    x.font=`700 96px ${D}`;const vt=TIERS[t].n.toUpperCase(),vw=x.measureText(vt).width+90;x.rotate(-0.04);
    x.fillStyle=col;x.beginPath();x.roundRect(-vw/2,-65,vw,130,65);x.fill();x.fillStyle=TEXT_ON[t];x.fillText(vt,0,33);x.restore()}
  const lines=$("cardLines").value.trim();
  if(lines&&pl>0){x.save();x.globalAlpha=pl;x.font=`italic 400 46px ${B}`;const ws=wrap(x,lines,CARD.w-200).slice(0,5);const top=1560-((ws.length-1)*64)/2+20;
    x.fillStyle=last.best&&lines===last.best.line?"#FFD84D":"#A8C42E";x.fillRect(90,top-50,8,ws.length*64);x.fillStyle="#1F2340";x.textAlign="left";ws.forEach((l,i)=>x.fillText(l,130,top+i*64));
    if(last.best&&lines===last.best.line){x.font=`700 30px ${D}`;x.fillStyle="#B98A00";x.fillText("⭐ Wiz's pick",130,top-70)}
    x.restore();x.textAlign="center"}
  x.font=`600 38px ${B}`;x.fillStyle="#646A8C";x.fillText("Is yours wack? Weigh it at "+SITE,gx,1840);
  if(!isPro()){x.save();x.globalAlpha=.5;x.font=`600 26px ${B}`;x.fillText("free plan",gx,1885);x.restore()}
  x.restore();
}
async function loadCardAssets(){
  try{await document.fonts.load('700 100px "Fredoka"');await document.fonts.load('italic 400 40px "Work Sans"');await document.fonts.load('600 40px "Work Sans"')}catch(e){}
  cardImg=await new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(charSVG(last.tier,400))});
}
async function drawCard(){
  if(!last){$("share").hidden=true;return}
  $("share").hidden=false;
  if(!cardLinesTouched)$("cardLines").value=defaultLines();
  await loadCardAssets();
  const c=document.createElement("canvas");c.width=CARD.w;c.height=CARD.h;paintCard(c.getContext("2d"),1);
  $("cardImg").src=c.toDataURL("image/png");
  cardBlob=await new Promise(r=>c.toBlob(r,"image/png"));
  $("cap").textContent=CAPS[last.tier]+" #wackometer #songwriting #lyrics";
}
$("cardLines").addEventListener("input",()=>{cardLinesTouched=true;clearTimeout(drawCard._t);drawCard._t=setTimeout(drawCard,250)});
$("postTitle").addEventListener("input",()=>{clearTimeout(drawCard._t);drawCard._t=setTimeout(drawCard,250)});

async function cardFile() { return new File([cardBlob], `wackometer-${TIERS[last.tier].n.toLowerCase().replace(/\s/g, "-")}-${last.score}.png`, { type: "image/png" }); }
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
$("saveCard").onclick = async () => { if (!cardBlob) return; const f = await cardFile(); download(f, f.name); $("cardNote").textContent = "Saved to your downloads."; track("save_card"); };
$("shareCard").onclick = async () => {
  if (!cardBlob) return; const f = await cardFile(), text = $("cap").textContent; track("share_card");
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text }); } catch (e) {} }
  else { $("cardNote").textContent = "Sharing straight to apps works on phones. Save the image and post it from there."; }
};
// 6-second vertical clip: needle swings, character pops, verdict stamps, then holds.
$("saveVideo").onclick = async () => {
  const btn = $("saveVideo"), note = $("cardNote");
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const type = window.MediaRecorder && types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) { note.textContent = "This browser can't record video. Try Chrome or Safari, or save the image."; return; }
  btn.disabled = true; btn.textContent = "🎬 Recording…"; await loadCardAssets();
  const c = document.createElement("canvas"); c.width = 720; c.height = 1280; const x = c.getContext("2d");
  const stream = c.captureStream(30), rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 }), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start(250); const t0 = performance.now(), dur = 6000;
  await new Promise((resolve) => { (function frame() {
    const el = performance.now() - t0, p = Math.min(1, el / 3200);
    x.setTransform(720 / CARD.w, 0, 0, 1280 / CARD.h, 0, 0); paintCard(x, p);
    if (el < dur) requestAnimationFrame(frame); else resolve();
  })(); });
  rec.stop(); await done;
  const ext = type.includes("mp4") ? "mp4" : "webm", blob = new Blob(chunks, { type: type.split(";")[0] });
  const name = `wackometer-${TIERS[last.tier].n.toLowerCase().replace(/\s/g, "-")}-${last.score}.${ext}`;
  const f = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text: $("cap").textContent }); } catch (e) { download(f, name); } }
  else download(f, name);
  note.textContent = ext === "mp4" ? "Video saved. Post it to TikTok, Reels or Stories." : "Video saved as .webm. TikTok and Instagram take it on desktop; on iPhone, use Safari for .mp4.";
  btn.disabled = false; btn.textContent = "🎬 Save video"; track("save_video");
};
$("copyCap").onclick=async()=>{track("copy_caption");const t=$("cap").textContent;try{await navigator.clipboard.writeText(t);$("copyCap").textContent="Copied"}catch(e){const r=document.createRange();r.selectNodeContents($("cap"));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);$("copyCap").textContent="Selected, copy it"}setTimeout(()=>$("copyCap").textContent="Copy caption",1800)};

/* ---------- analytics ---------- */
function track(type) { try { fetch("/api/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type }), keepalive: true }); } catch (e) {} }

/* ---------- sound ---------- */
let soundOn = ls("wk-sound") === "1", actx = null;
function renderSound() { const b = $("soundBtn"); b.textContent = soundOn ? "🔊 Sound on" : "🔈 Sound off"; b.setAttribute("aria-pressed", soundOn); }
$("soundBtn").onclick = () => { soundOn = !soundOn; ls("wk-sound", soundOn ? "1" : "0"); renderSound(); if (soundOn) sfx("sparkle"); };
renderSound();
function tone(f0, f1, dur, type = "sine", vol = 0.12, delay = 0) {
  const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
}
function sfx(name) {
  if (!soundOn) return;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) { return; }
  if (name === "pop") tone(520, 880, 0.12, "sine", 0.14);
  if (name === "sparkle") [0, 0.08, 0.16, 0.24].forEach((d, i) => tone(880 + i * 220, 1400 + i * 260, 0.18, "triangle", 0.08, d));
  if (name === "gag") { tone(200, 90, 0.35, "sawtooth", 0.07); tone(140, 60, 0.4, "square", 0.04, 0.12); }
  if (name === "swap") { tone(660, 990, 0.1, "triangle", 0.1); tone(990, 1320, 0.12, "triangle", 0.08, 0.08); }
}

/* ---------- live buddy: the crew reacts while you type ---------- */
let buddyT = null, lastFound = new Set();
const HYPE = ["Keep going, this is cooking.", "Ooh, I'm listening.", "Don't stop now.", "Say more. Be specific.", "What does it smell like? Put that in."];
$("lyrics").addEventListener("input", () => {
  clearTimeout(buddyT);
  buddyT = setTimeout(() => {
    const t = $("lyrics").value, n = words(t).length, b = $("buddy");
    if (n < 6) { b.hidden = true; return; }
    const a = analyze(t), found = new Set(a.found.map((f) => f[0])), fresh = [...found].filter((c) => !lastFound.has(c)); lastFound = found;
    let who = 1, msg = HYPE[n % HYPE.length];
    if (fresh.length) { who = 4; msg = `“${fresh[0]}”? Really? Weigh it and tap it for a swap. 🤢`; }
    else { const bl = bestLine(t); if (bl && n % 3 === 0) { who = 0; msg = `“${bl.line.length > 48 ? bl.line.slice(0, 46) + "…" : bl.line}” is a good line. Keep that one.`; } }
    $("buddyChar").innerHTML = charSVG(who); $("buddyText").textContent = msg; b.hidden = false;
  }, 900);
});

/* ---------- tap-to-swap clichés ---------- */
let swapCtx = null;
function openSwap(el, cliche, lineIdx) {
  swapCtx = { cliche, lineIdx };
  $("swapFrom").textContent = `Swap “${cliche}” for…`;
  $("swapOpts").innerHTML = "";
  (SWAPS[cliche] || []).forEach((alt) => { const b = document.createElement("button"); b.className = "swapopt"; b.textContent = alt; b.onclick = () => doSwap(alt); $("swapOpts").appendChild(b); });
  const pop = $("swapPop"), r = el.getBoundingClientRect();
  pop.hidden = false;
  const w = Math.min(320, window.innerWidth - 24);
  pop.style.width = w + "px";
  pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + window.scrollX - 10)) + "px";
  pop.style.top = r.bottom + window.scrollY + 8 + "px";
  sfx("pop"); pop.querySelector(".swapopt")?.focus();
}
function closeSwap() { $("swapPop").hidden = true; swapCtx = null; }
function doSwap(alt) {
  if (!swapCtx) return;
  const lines = $("lyrics").value.split(/\r?\n/), i = swapCtx.lineIdx;
  const re = new RegExp("\\b" + swapCtx.cliche.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
  if (lines[i] !== undefined && re.test(lines[i])) lines[i] = lines[i].replace(re, (m, off, str) => {
    let rep = alt;
    // avoid "the a pilot light": drop the swap's own article when the line already has one right before
    if (/\b(the|a|an|my|your|our|his|her|their)\s+$/i.test(str.slice(0, off))) rep = rep.replace(/^(a|an|the)\s+/i, "");
    return m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? rep[0].toUpperCase() + rep.slice(1) : rep;
  });
  $("lyrics").value = lines.join("\n"); ls("wk-draft", $("lyrics").value);
  closeSwap(); sfx("swap"); track("swap_used"); renderReading();
}
$("swapX").onclick = closeSwap;
$("swapMore").onclick = () => { const c = swapCtx && swapCtx.cliche; closeSwap(); if (c) { show("wingman"); ask(`Give me 5 fresh, specific replacements for the cliché "${c}" that fit my lyrics.`); } };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSwap(); closeLogin(); } });
document.addEventListener("click", (e) => { if (!$("swapPop").hidden && !e.target.closest("#swapPop") && !e.target.closest(".wk-c")) closeSwap(); });

/* ---------- unlockables ---------- */
const UNLOCK = { chain: false, crown: false, hat: false };
const UNLOCKS = [{ k: "crown", d: 3, who: 1, name: "Wendy's flower crown" }, { k: "chain", d: 7, who: 0, name: "Wiz's gold chain" }, { k: "hat", d: 30, who: 4, name: "Wretch's bucket hat" }];
function applyUnlocks() {
  const st = (ME && ME.streak) || 0, before = JSON.stringify(UNLOCK);
  UNLOCKS.forEach((u) => (UNLOCK[u.k] = st >= u.d));
  if (JSON.stringify(UNLOCK) !== before) { renderCrew(last ? last.tier : null); if (last) $("mchar").innerHTML = charSVG(last.tier); }
}
function renderUnlocks(st) {
  $("unlocks").innerHTML = UNLOCKS.map((u) => { const got = st >= u.d; return `<div class="unl${got ? " got" : ""}" title="${u.name}"><span class="um">${charSVG(u.who)}</span><span>${got ? "Unlocked" : u.d + "-day streak"}<br><b>${u.name}</b></span></div>`; }).join("");
}

/* ---------- emoji starter ---------- */
const EMOJI_BANK = ["🌧️", "🚗", "🌙", "🍕", "📱", "💔", "🔥", "🌊", "🎢", "🕯️", "🏙️", "🌵", "🎈", "🧊", "🪐", "🐍", "🎧", "🌻", "🛹", "🍒", "⛈️", "🗝️", "🪞", "🦋"];
let picked = [];
function renderEmojiPick() {
  $("epick").innerHTML = EMOJI_BANK.map((e) => `<button class="eb${picked.includes(e) ? " on" : ""}" data-e="${e}" aria-pressed="${picked.includes(e)}">${e}</button>`).join("");
  $("epick").querySelectorAll(".eb").forEach((b) => (b.onclick = () => { const e = b.dataset.e; picked = picked.includes(e) ? picked.filter((x) => x !== e) : picked.length < 3 ? [...picked, e] : picked; sfx("pop"); renderEmojiPick(); }));
  $("echosen").textContent = picked.length ? picked.join(" ") : "_ _ _"; $("eGo").disabled = !picked.length;
}
renderEmojiPick();
$("eGo").onclick = async () => {
  if (busy) return; busy = true; $("eGo").disabled = true;
  bubble("me", "Emoji starter: " + picked.join(" ")); const out = bubble("wm", "Cooking up a starter…");
  try { const r = await api("/api/wingman", { body: { mode: "emoji", emojis: picked.join("") } }); out._t.textContent = r.text; ME = r.me; renderQuota(); track("emoji_starter");
    const use = document.createElement("button"); use.className = "btn"; use.style.marginTop = "8px"; use.style.display = "block"; use.textContent = "Put it in my Weigh pad";
    use.onclick = () => { const lyric = r.text.split("\n").filter((l) => l.trim()).slice(0, 2).join("\n"); $("lyrics").value = lyric; ls("wk-draft", lyric); show("weigh"); $("lyrics").focus(); }; out.appendChild(use);
  } catch (e) { out._t.textContent = e.message; if (e.status === 402) addProLink(out._t); }
  busy = false; $("eGo").disabled = !picked.length;
};

/* ---------- Pass the Pen ---------- */
let pen = null;
const PEN_COLORS = ["#3D8BFF", "#22C29B", "#A9A2DA", "#FF8A3D", "#A8C42E", "#FF8FC0", "#FFD84D"];
function penIdFromPath() { const m = location.pathname.match(/^\/pen\/([a-z0-9]+)/); return m ? m[1] : null; }
async function loadPenView() {
  $("penChars").innerHTML = [5, 1, 3].map((i) => `<span>${charSVG(i)}</span>`).join("");
  const id = penIdFromPath();
  if (id) await loadPen(id); else { pen = null; $("penNew").hidden = false; $("penSong").hidden = true; }
  loadPenList();
}
async function loadPen(id) {
  try { pen = await api("/api/pen/" + id); renderPen(); }
  catch (e) { $("penNew").hidden = false; $("penSong").hidden = true; $("penNote").textContent = e.message; }
}
function renderPen() {
  $("penNew").hidden = true; $("penSong").hidden = false;
  $("penSongTitle").textContent = pen.title || "Untitled song";
  const text = pen.lines.map((l) => l.text).join("\n"), n = words(text).length;
  const tp = $("penTier");
  if (n >= 8) { const s = Math.round(analyze(text).raw), t = tierOf(s); tp.className = `pill bg-t${t}`; tp.textContent = `${TIERS[t].n} ${s}`; tp.hidden = false; } else tp.hidden = true;
  $("penLines").innerHTML = "";
  pen.lines.forEach((l) => {
    const li = document.createElement("li"); li.className = l.mine ? "mine" : "";
    li.innerHTML = `<span class="dot" style="background:${PEN_COLORS[l.writer % PEN_COLORS.length]}"></span><span class="ptext"></span><span class="pwho"></span>`;
    li.querySelector(".ptext").textContent = l.text; li.querySelector(".pwho").textContent = l.who;
    $("penLines").appendChild(li);
  });
  const full = pen.lines.length >= pen.max;
  $("penAdd").hidden = !pen.canAdd;
  const w = $("penWait");
  if (pen.closed || full) { w.hidden = false; w.textContent = pen.closed ? "🎤 This song is finished. Weigh it, or start another." : `🎤 ${pen.max} lines. This song is done!`; }
  else if (pen.yourTurnBlocked) { w.hidden = false; w.textContent = "✍️ You wrote the last line. Pass the pen to a friend for the next one."; }
  else w.hidden = true;
  $("penClose").hidden = !(pen.mine && !pen.closed);
  $("penLine").placeholder = pen.lines.length ? `Line ${pen.lines.length + 1}: follow “${pen.lines[pen.lines.length - 1].text.slice(0, 40)}”` : "Write the next line…";
  if (ME && ME.handle) { if (!$("penLineHandle").value) $("penLineHandle").value = ME.handle; }
}
async function loadPenList() {
  try {
    const r = await api("/api/pens"), el = $("penList");
    if (!r.pens.length) { el.innerHTML = `<div class="empty"><div class="ch">${charSVG(5)}</div>No songs yet. Start one and pass the pen.</div>`; return; }
    el.innerHTML = "";
    r.pens.forEach((p) => {
      const a = document.createElement("a"); a.className = "entry penitem"; a.href = "/pen/" + p.id;
      a.innerHTML = `<span class="rank">${p.lines}</span><div class="ebody"><div class="ewho"></div><pre></pre></div><span class="pill${p.closed ? "" : " bg-t1"}">${p.closed ? "Done" : "Open"}</span>`;
      a.querySelector(".ewho").textContent = (p.title || "Untitled song") + (p.mine ? " · started by you" : "");
      a.querySelector("pre").textContent = p.first || "";
      a.onclick = (e) => { e.preventDefault(); history.pushState(null, "", "/pen/" + p.id); loadPen(p.id); window.scrollTo(0, 0); };
      el.appendChild(a);
    });
  } catch (e) {}
}
$("penStart").onclick = async () => {
  const b = $("penStart"); b.disabled = true; $("penNote").textContent = "";
  try { const r = await api("/api/pen", { body: { title: $("penTitle").value, line: $("penFirst").value, handle: $("penHandle").value } });
    track("pen_start"); sfx("sparkle"); history.pushState(null, "", "/pen/" + r.id); $("penTitle").value = ""; $("penFirst").value = ""; await loadPen(r.id); loadPenList(); sharePen(); }
  catch (e) { $("penNote").textContent = e.message; }
  b.disabled = false;
};
$("penAddBtn").onclick = async () => {
  const b = $("penAddBtn"); b.disabled = true; $("penAddNote").textContent = "";
  try { await api(`/api/pen/${pen.id}/line`, { body: { line: $("penLine").value, handle: $("penLineHandle").value } }); $("penLine").value = ""; sfx("pop"); await loadPen(pen.id); loadPenList(); }
  catch (e) { $("penAddNote").textContent = e.message; }
  b.disabled = false;
};
$("penLine").addEventListener("keydown", (e) => { if (e.key === "Enter") $("penAddBtn").click(); });
async function sharePen() {
  if (!pen) return; track("pen_share");
  const url = `${location.origin}/pen/${pen.id}`, text = `I started a song on Wackometer. Write the next line 👉`;
  if (navigator.share) { try { await navigator.share({ title: "Pass the Pen", text, url }); return; } catch (e) {} }
  try { await navigator.clipboard.writeText(`${text} ${url}`); $("penShareNote").textContent = "Link copied. Paste it in the group chat."; }
  catch (e) { $("penShareNote").textContent = "Copy this link: " + url; }
}
$("penShare").onclick = sharePen;
$("penWeigh").onclick = () => { if (!pen) return; $("lyrics").value = pen.lines.map((l) => l.text).join("\n"); ls("wk-draft", $("lyrics").value); show("weigh"); renderReading(); };
$("penClose").onclick = async () => { try { await api(`/api/pen/${pen.id}/close`, { body: {} }); await loadPen(pen.id); loadPenList(); } catch (e) { $("penShareNote").textContent = e.message; } };
$("penNewBtn").onclick = () => { history.pushState(null, "", "/#pen"); pen = null; $("penNew").hidden = false; $("penSong").hidden = true; $("penFirst").focus(); };
window.addEventListener("popstate", () => { if (penIdFromPath()) { show("pen"); } });

/* ---------- account ---------- */
function renderAccount() {
  const b = $("acctBtn");
  b.textContent = ME && ME.email ? "👤 " + ME.email.split("@")[0] : "Sign in";
}
function openLogin() {
  $("loginModal").hidden = false; $("loginChar").innerHTML = charSVG(1); $("loginNote").textContent = "";
  const inn = !!(ME && ME.email);
  $("loginForm").hidden = inn; $("loginOut").hidden = !inn; $("adminLink").hidden = !(ME && ME.admin);
  $("loginH").textContent = inn ? "You're signed in" : "Save your streak and songs";
  $("loginSub").textContent = inn ? `Signed in as ${ME.email}. Your streak, Pro and songs follow you to any device.` : "Sign in with your email and we'll send you a link. No password. Your streak, Pro and songs follow you to any device.";
  if (!inn) setTimeout(() => $("loginEmail").focus(), 50);
}
function closeLogin() { $("loginModal").hidden = true; }
$("acctBtn").onclick = openLogin; $("loginX").onclick = closeLogin; $("loginX2").onclick = closeLogin;
$("loginModal").addEventListener("click", (e) => { if (e.target.id === "loginModal") closeLogin(); });
$("loginGo").onclick = async () => {
  const b = $("loginGo"); b.disabled = true; $("loginNote").textContent = "Sending…";
  try { await api("/api/login", { body: { email: $("loginEmail").value } }); $("loginNote").textContent = "Check your email for the sign-in link. It works for 20 minutes."; }
  catch (e) { $("loginNote").textContent = e.message; }
  b.disabled = false;
};
$("loginEmail").addEventListener("keydown", (e) => { if (e.key === "Enter") $("loginGo").click(); });
$("logoutBtn").onclick = async () => { await api("/api/logout", { body: {} }).catch(() => {}); location.href = "/"; };

/* ---------- wiring ---------- */
$("weighBtn").onclick = renderReading;
$("wipeBtn").onclick = wipe;
document.querySelectorAll("[data-ex]").forEach((b) => (b.onclick = () => { $("lyrics").value = EXAMPLES[+b.dataset.ex]; renderReading(); }));
$("lyrics").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") renderReading(); });
$("lyrics").addEventListener("input", () => ls("wk-draft", $("lyrics").value));
document.querySelectorAll("#mainNav button").forEach((b) => (b.onclick = () => show(b.dataset.v)));
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (VIEWS.includes(h)) show(h); });
$("toWing").onclick = () => { show("wingman"); if (words($("lyrics").value).length >= 8) { if (!last) renderReading(); ask("Make my lyrics less wack"); } };
$("whyList").innerHTML = METRICS.map((m) => `<dt>${m.n} <span class="hint">(${Math.round(m.w * 100)}%)</span></dt><dd>${m.d}</dd>`).join("");
$("heroGo").onclick = () => { const t = $("lyrics"); t.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => { t.focus(); t.select(); }, 350); };
$("heroDare").onclick = () => { $("lyrics").value = EXAMPLES[0]; renderReading(); $("meter").scrollIntoView({ behavior: "smooth", block: "center" }); };
document.querySelectorAll("[data-wing],[data-wingbig]").forEach((e) => (e.innerHTML = charSVG(5)));
$("mchar").innerHTML = charSVG(5); renderCrew(null);
if (ls("wk-seen") !== "1") { document.body.classList.add("first"); ls("wk-seen", "1"); }

/* ---------- boot ---------- */
$("lyrics").value = ls("wk-draft") || EXAMPLES[0];
renderReading();
loadTune().then(() => { if (last && tuneN) renderReading(); });
loadMe();
{
  const h = location.hash.slice(1), path = location.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/pen/")) show("pen");
  else if (path !== "/" && path !== "/index.html") { show("lost"); $("lostChar").innerHTML = charSVG(3); }
  else if (VIEWS.includes(h) && h !== "weigh" && h !== "lost") show(h);
  const si = new URLSearchParams(location.search).get("signin");
  if (si) { history.replaceState(null, "", "/#weigh"); if (si === "ok") { setTimeout(() => { $("quip").textContent = "Wendy: You're signed in! Your streak and songs are safe now."; $("mchar").innerHTML = charSVG(1); }, 300); } else { openLogin(); $("loginNote").textContent = "That link expired. Send a new one."; } }
  const paid = new URLSearchParams(location.search).get("paid");
  if (paid) { show("pro"); setTimeout(() => ($("demoNote").textContent = paid === "credits" ? "Payment received. 25 credits are on their way to your account." : "Welcome to Wingman Pro. It can take a few seconds to switch on."), 600); history.replaceState(null, "", "/#pro"); }
}
