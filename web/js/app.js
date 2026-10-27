// Wackometer front end: Weigh, Wingman and the app shell. Other tools load on demand.
import { TIERS, METRICS, CLICHES, FILLER, WEIGHTLESS, tierOf, clamp, words, analyze, bestLine, lineSyllables } from "./score.js";
import { $, esc, ls, CONTACT_EMAIL, S, A, api, isPro, copyText, CREW, QUIPS, charSVG, renderCrew, confetti, track, sfx, UNLOCK, UNLOCKS, getHist } from "./core.js";
import { lazy } from "./core.js";

// Tools load the first time they're opened, so the first visit only downloads Weigh.
const wallM = lazy(() => import("./wall.js"));
const dailyM = lazy(() => import("./daily.js"));
const penM = lazy(() => import("./pen.js"));
const squadM = lazy(() => import("./squad.js"));
const shareM = lazy(() => import("./share.js"));
const shopM = lazy(() => import("./shop.js"));
const washM = lazy(() => import("./washui.js"));
const lessonsM = lazy(() => import("./workshop.js"));
const swapsM = lazy(() => import("./swaps.js"));
const stormM = lazy(() => import("./storm.js").then((m) => m.initStorm({ ls, track, copyText })));
let stormOn = false;

/* ---------- gauge ---------- */
const cx=160,cy=166,R=128;
function pt(a,r){const t=Math.PI*(1-a/100);return [cx+r*Math.cos(t),cy-r*Math.sin(t)]}
(function drawGauge(){
  let s="";const gap=1.1;
  TIERS.forEach((t,i)=>{const a0=i*20+(i?gap:0),a1=(i+1)*20-(i<4?gap:0);const [x0,y0]=pt(a0,R),[x1,y1]=pt(a1,R);
    s+=`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="var(--t${i})" stroke-width="22" stroke-linecap="butt"/>`;});
  document.getElementById("arcs").innerHTML=s;
  let k="";for(let v=0;v<=100;v+=10){const [a,b]=pt(v,R-18),[c,d]=pt(v,R-(v%20?22:28));k+=`<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" stroke="var(--muted)" stroke-width="${v%20?1:1.6}"/>`;
    if(v%20===0){const [tx,ty]=pt(v,R-40);k+=`<text x="${tx.toFixed(1)}" y="${(ty+4).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="system-ui,sans-serif">${v}</text>`}}
  document.getElementById("ticks").innerHTML=k;
})();
function setNeedle(v){document.getElementById("needle").style.transform=`rotate(${(v/100*180-90).toFixed(1)}deg)`}
setNeedle(50);


// Example verses: original lines written for the Wackometer. "Show me a wack one" cycles through them.
const WACK_EX = [
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
`Girl you light the way
Every night and day
Shine bright tonight, my love, my life
Hold me tight, my heart, my soul
Dancing in the rain
I feel alive again, no more pain
Oh baby baby yeah
Oh baby baby yeah
Never let you go
Never let you go`,
`Oh baby I rise above the pain and the love
Spread my wings and fly away, oh yeah
Chasing dreams into the night
On top of the world, I feel so right
Living the dream, I'm young and free
No regrets, my soul, my love, my destiny
Yeah yeah yeah, oh oh oh
Yeah yeah yeah, oh oh oh
Fly away, fly away, fly away
Fly away, fly away, fly away`,
`You took my breath away
You're my heart and soul
Lost without you every day
Hold me tight, don't let go
Love is blind, love is true
Love will find a way to you
Forever and always, me and you
Ooh ooh yeah, baby it's true`,
`Cold as ice, you break my heart
Since the start we fell apart
Tears falling in the dark
Broken wings, a broken heart
Hey hey hey, yeah yeah yeah
Save me, save me, baby
Save me, save me, baby
One more time, you're on my mind`,
`Through the storm and after the rain
We rise from the ashes again, again
Oh yeah, against all odds the stars align
Your heart of gold, my love, my soul, forever mine
Oh baby reach for the stars, touch the sky
Into the night, baby we fly so high, yeah
Made for each other, meant to be
Ooh baby baby, you complete me
Ooh baby baby, you complete me
Ooh baby baby, you complete me
Ooh baby baby, you complete me`];
const WICKED_EX = [
`Dashboard glow is the only lamp still on
your hoodie smells like the 7-Eleven
we split a cherry slush at the light on Hillsboro
and you counted red cars out loud like a prayer
I keep the receipt in the cupholder
like proof we were ever that easy`,
`My grandma salts the cantaloupe
and swears it makes it sweeter
she calls the TV by its brand name
and hangs up on the weather
I've got her laugh and half her stubborn
and none of her patience with butter`,
`Payday Friday, the bank app loads like dial-up
I split a Lyft with a stranger named Theo
he's got a guitar case with no guitar in it
says that's where he keeps the songs he hasn't written
I tip him two bucks and a lighter
he says I'll be on the album`,
`Our group chat's named after a dog that died in 2014
nobody's changed it, nobody's said why
Kayla posts a sunset every Sunday at 6:40
like she's clocking in
I heart it from the break room
that's the whole way we say we're still here`];
const exIdx = { wack: -1, wicked: -1 };
function nextExample(kind) { const list = kind === "wicked" ? WICKED_EX : WACK_EX; exIdx[kind] = (exIdx[kind] + 1) % list.length; return list[exIdx[kind]]; }
let padIsExample = false;
function loadExample(kind, scroll) {
  $("lyrics").value = nextExample(kind); padIsExample = true; renderReading();
  if (scroll) $("meter").scrollIntoView({ behavior: "smooth", block: "center" });
}


async function loadMe() { try { S.ME = await api("/api/me"); } catch (e) { S.ME = null; } if (S.ME && S.ME.email && !$("dawEmail").value) $("dawEmail").value = S.ME.email; renderQuota(); renderPro(); renderAccount(); applyUnlocks(); }
/* ---------- Weigh ---------- */
function renderReading() {
  const t = $("lyrics").value;
  if (words(t).length < 8) { $("blurb").textContent = "Give it at least a couple of lines. Eight words minimum."; return; }
  S.last = analyze(t);
  const score = Math.round(clamp(S.last.raw + S.crowdTune)); S.last.score = score; S.last.tier = tierOf(score); S.last.text = t;
  setNeedle(score);
  $("score").textContent = score;
  const v = $("verdict"); v.textContent = TIERS[S.last.tier].n; v.className = `verdict bg-t${S.last.tier} t${S.last.tier}`;
  $("blurb").textContent = TIERS[S.last.tier].blurb;
  $("tune").textContent = S.tuneN ? `Crowd-tuned ${S.crowdTune >= 0 ? "+" : ""}${S.crowdTune} from ${S.tuneN} Wall posts. Raw meter: ${Math.round(S.last.raw)}.` : "Raw meter score. The crowd tune kicks in once the Wall has enough votes.";
  const m = $("meter"); m.classList.remove("wack-now", "wicked-now"); void m.offsetWidth; m.style.setProperty("--tint", `var(--t${S.last.tier})`);
  if (S.last.tier === 4) { m.classList.add("wack-now"); sfx("gag"); } else if (S.last.tier === 0) { m.classList.add("wicked-now"); confetti(); sfx("sparkle"); } else sfx("pop");
  S.last.best = bestLine(t);
  if (S.last.best) { $("bestPick").hidden = false; $("bestChar").innerHTML = charSVG(0); $("bestText").textContent = "“" + S.last.best.line + "”"; }
  else $("bestPick").hidden = true;
  $("mchar").innerHTML = charSVG(S.last.tier);
  const qs = QUIPS[S.last.tier]; $("quip").textContent = `${CREW[S.last.tier].name}: ${qs[(Math.random() * qs.length) | 0]}`;
  renderCrew(S.last.tier);
  $("metrics").innerHTML = METRICS.map((mm) => { const val = Math.round(S.last.vals[mm.k]); const ti = tierOf(val);
    return `<div class="m"><div class="top"><b>${mm.n}</b><span class="v">${val}</span></div><div class="bar"><i class="bg-t${ti}" style="width:${Math.max(val, 2)}%"></i></div><small>${esc(S.last.notes[mm.k])}</small></div>`; }).join("");
  renderMap();
  if (S.last.found.length && !swapsCache) swapsM().then((m) => (swapsCache = m.SWAPS)); // ready before the first tap
  renderCoach();
  if (!padIsExample) saveHistory();
  $("post").hidden = false; $("postNote").textContent = ""; $("postBtn").disabled = false;
  $("roast").hidden = true;
  updateWingCtx();
  shareM().then((m) => m.freshCard());
}
function wipe() {
  $("lyrics").value = ""; try { localStorage.removeItem("wk-draft"); } catch (e) {}
  $("map").hidden = true; $("post").hidden = true; $("roast").hidden = true; $("bestPick").hidden = true; $("metrics").innerHTML = ""; $("score").textContent = "–";
  const v = $("verdict"); v.textContent = "Waiting"; v.className = "verdict bg-t2 t2"; $("blurb").textContent = "Paste some lines and hit Weigh it."; $("tune").textContent = "";
  setNeedle(50); S.last = null; $("share").hidden = true; $("coach").hidden = true; padIsExample = false; renderCrew(null); $("mchar").innerHTML = charSVG(5); $("quip").textContent = "The crew is ready. Paste something."; updateWingCtx(); $("lyrics").focus();
}

/* ---------- tabs ---------- */
// Write / Train / Play: each tool belongs to one group. Pass the Pen and profiles live under Squad.
const GROUP = { weigh: "write", wash: "write", wingman: "write", workshop: "train", storm: "train", daily: "play", wall: "play", squad: "play", pen: "play", profile: "play" };
const TITLES = { wash: "AI Wash", wingman: "Wingman", workshop: "Workshop", storm: "Wordstorm", daily: "Daily W", wall: "The Wall", squad: "Squad", pen: "Pass the Pen", why: "Why it's wack", pro: "Wingman Pro", lost: "Page not found" };
const GROUP_FIRST = { write: "weigh", train: "workshop", play: "daily" };
const VIEWS = ["weigh", "wash", "storm", "workshop", "daily", "pen", "squad", "wall", "wingman", "why", "pro", "lost", "profile"];
function show(v) {
  const g = GROUP[v], tab = v === "pen" || v === "profile" ? "squad" : v;
  if (g) { $("mainNav").dataset.group = g; ls("wk-g-" + g, v === "profile" ? "squad" : v); }
  document.querySelectorAll("#groupNav button").forEach((b) => (b.dataset.g === g ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
  document.querySelectorAll("#mainNav button,#proBtn").forEach((b) => (b.dataset.v === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  document.querySelectorAll(".squadsw button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v));
  if (v !== "storm" && stormOn) stormM().then((st) => st.onHide());
  VIEWS.forEach((x) => ($("v-" + x).hidden = x !== v)); window.scrollTo(0, 0);
  if (v !== "profile") document.title = v === "weigh" ? "Wackometer · How wack are your lyrics?" : `${TITLES[v] || "Wackometer"} · Wackometer`;
  if (v === "storm") { stormOn = true; stormM().then((st) => st.onShow()); }
  if (v === "workshop") shopM().then((m) => m.renderWorkshop());
  if (v === "wash") washM();
  if (v === "pen") { if (!location.pathname.startsWith("/pen/")) history.replaceState(null, "", "/#pen"); }
  else if (v === "profile") { /* path is /u/<name> */ }
  else if (v !== "lost" && (location.pathname !== "/" || location.hash !== "#" + v)) history.replaceState(null, "", "/#" + v);
  if (v === "wall") wallM().then((m) => m.loadWall());
  if (v === "daily") dailyM().then((m) => m.loadDaily());
  if (v === "pro") loadMe();
  if (v === "pen") penM().then((m) => m.loadPenView());
  if (v === "squad") squadM().then((m) => m.loadSquad());
  if (v === "profile") squadM().then((m) => m.loadProfile(location.pathname.slice(3)));
}
async function loadTune() { try { const t = await api("/api/tune"); S.crowdTune = t.tune; S.tuneN = t.n; } catch (e) {} }
$("postBtn").onclick = async () => {
  if (!S.last) return; const b = $("postBtn");
  if (!$("postAttest").checked) { $("postNote").textContent = "Tick the box to confirm these are your own lyrics."; return; }
  b.disabled = true; $("postNote").textContent = "Posting…";
  try { await api("/api/wall", { body: { text: S.last.text, title: $("postTitle").value.trim(), attest: true } });
    $("postNote").innerHTML = 'Posted. <a href="#wall">See it on the Wall</a>'; $("postTitle").value = ""; }
  catch (e) { $("postNote").textContent = e.message; b.disabled = false; }
};

/* ---------- Roast ---------- */
$("roastBtn").onclick = async () => {
  if (words($("lyrics").value).length < 8) { $("blurb").textContent = "Give Wretch at least eight words to roast."; return; }
  if (!S.last) renderReading();
  const box = $("roast"); box.hidden = false; $("roastText").textContent = "Wretch is reading… 🤢";
  $("roastChar").innerHTML = charSVG(4); box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  sfx("gag");
  try { const r = await api("/api/wingman", { body: { mode: "roast", pad: $("lyrics").value } }); $("roastText").textContent = r.text; S.ME = r.me; renderQuota(); }
  catch (e) { $("roastText").textContent = e.status === 402 ? e.message : e.message || "Wretch couldn't keep it down. Try again."; if (e.status === 402) addProLink($("roastText")); }
};
$("copyRoast").onclick = () => track("copy_roast") || copyText($("roastText").textContent + "\n\nRoasted by Wretch on the Wackometer", $("copyRoast"), "Copy roast");

/* ---------- Wingman ---------- */
const history_ = []; let busy = false;
function updateWingCtx() { $("wingCtx").textContent = S.last ? `Wingman sees your pad: ${TIERS[S.last.tier].n} (${S.last.score}).` : words($("lyrics").value).length ? "Wingman sees your pad (not weighed yet)." : "Your Weigh pad is empty, so Wingman starts fresh."; }
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
    out._t.textContent = r.text; history_.push({ role: "user", content: q }, { role: "assistant", content: r.text }); S.ME = r.me; renderQuota();
  } catch (e) { out._t.textContent = e.message; if (e.status === 402) addProLink(out._t); }
  busy = false; $("sendBtn").disabled = false; $("log").scrollTop = $("log").scrollHeight;
}
$("compose").addEventListener("submit", (e) => { e.preventDefault(); const q = $("ask").value; $("ask").value = ""; ask(q); });
$("ask").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("compose").requestSubmit(); } });
$("chips").querySelectorAll("button").forEach((b) => (b.onclick = () => ask(b.textContent)));
function renderQuota() {
  const q = $("quota"); if (!q) return;
  if (!S.ME) { q.textContent = ""; return; }
  if (S.ME.pro) q.innerHTML = 'Wingman Pro is on. Unlimited messages. <a href="#pro">Manage</a>';
  else { const left = Math.max(0, S.ME.freeDaily - S.ME.usedToday); q.innerHTML = `${left} of ${S.ME.freeDaily} free messages left today${S.ME.credits ? ` · ${S.ME.credits} credits` : ""}. <a href="#pro">Go unlimited</a>`; }
}

/* ---------- Pro ---------- */
let yearly = false;
function setBill(y) { yearly = y; $("billM").setAttribute("aria-pressed", !y); $("billY").setAttribute("aria-pressed", y); $("proPrice").innerHTML = y ? '$59 <small>/ year</small>' : '$7.99 <small>/ month</small>'; }
$("billM").onclick = () => setBill(false); $("billY").onclick = () => setBill(true);
function renderPro() {
  const fb = document.querySelector('[data-plan="free"]'), pb = document.querySelector('[data-plan="pro"]');
  if (S.ME && S.ME.pro) { fb.textContent = "Manage billing"; fb.disabled = false; pb.textContent = "You're on Pro"; pb.disabled = true;
    $("demoNote").textContent = S.ME.proUntil ? `Pro is active through ${new Date(S.ME.proUntil).toLocaleDateString()}.` : "Pro is active."; }
  else { fb.textContent = S.ME && S.ME.billing ? "Manage billing" : "You're on Free"; fb.disabled = !(S.ME && S.ME.billing); pb.textContent = "Start Wingman Pro"; pb.disabled = false;
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
$("dawForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const b = e.submitter || $("dawForm").querySelector("button"); b.disabled = true;
  try { const r = await api("/api/waitlist", { body: { email: $("dawEmail").value, daw: $("dawPick").value } }); $("dawNote").textContent = `You're on the list (#${r.position}). We'll email you when the plugin is ready.`; sfx("sparkle"); track("waitlist"); }
  catch (err) { $("dawNote").textContent = err.message; b.disabled = false; }
});

function renderMap(){
  const syl = S.last.real.map(lineSyllables), sorted = [...syl].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 0;
  let ri=-1;const out=S.last.lines.map((l, li)=>{
    if(!l.trim())return `<div class="ln blank"></div>`;ri++;
    let h=esc(l);
    const spans=[];CLICHES.forEach(c=>{let re=new RegExp("\\b"+c.replace(/'/g,"(?:'|&#39;)")+"\\b","gi"),m;while((m=re.exec(h)))spans.push([m.index,m.index+m[0].length,"wk-c",c])});
    h.replace(/\b[a-z']+\b/gi,(w,i)=>{const lw=w.toLowerCase();if(FILLER.has(lw))spans.push([i,i+w.length,"wk-f"]);else if(WEIGHTLESS.has(lw))spans.push([i,i+w.length,"wk-a"]);return w});
    spans.sort((a,b)=>a[0]-b[0]||(b[1]-b[0])-(a[1]-a[0]));
    let res="",pos=0;for(const [st,e,c,cl] of spans){if(st<pos)continue;
      res+=h.slice(pos,st)+(cl?`<button type="button" class="${c}" data-c="${esc(cl)}" data-line="${li}" title="Tap for a fresh swap">${h.slice(st,e)}</button>`:`<span class="${c}">${h.slice(st,e)}</span>`);pos=e}
    res+=h.slice(pos);
    const n = syl[ri], off = S.last.real.length >= 3 && med >= 4 && (n > med * 1.45 + 2 || n < med * 0.55 - 1);
    const chips = (S.last.best && S.last.best.i === ri ? '<span class="chip gold">⭐ Wiz pick</span>' : "")
      + (S.last.lazyLines.has(ri) ? '<span class="chip">wimpy rhyme</span>' : "")
      + `<span class="syl${off ? " off" : ""}" title="${off ? (n > med ? "Wobbles: this line runs long. It may rush when you sing it." : "Wobbles: this line is short next to the others.") : "Syllables"}">${off ? "🌀 " : ""}${n}</span>`;
    return `<div class="ln${S.last.best && S.last.best.i === ri ? " best" : ""}"><span class="t">${res}</span><span class="lchips">${chips}</span></div>`});
  $("mapLines").innerHTML=out.join("");$("map").hidden=false;
  $("mapLines").querySelectorAll(".wk-c").forEach((b) => (b.onclick = (e) => openSwap(b, b.dataset.c, +b.dataset.line)));
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
let swapCtx = null, swapsCache = null;
function openSwap(el, cliche, lineIdx) {
  swapCtx = { cliche, lineIdx };
  $("swapFrom").textContent = `Swap “${cliche}” for…`;
  $("swapOpts").innerHTML = "";
  const SWAPS = swapsCache || {}; if (!swapsCache) swapsM().then((m) => { swapsCache = m.SWAPS; if (swapCtx && swapCtx.cliche === cliche) openSwap(el, cliche, lineIdx); });
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
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSwap(); closeLogin(); if (!$("tour").hidden) { tourI = TOUR.length; tourStep(); } } });
document.addEventListener("click", (e) => { if (!$("swapPop").hidden && !e.target.closest("#swapPop") && !e.target.closest(".wk-c")) closeSwap(); });

/* ---------- unlockables ---------- */
function applyUnlocks() {
  const st = (S.ME && S.ME.streak) || 0, before = JSON.stringify(UNLOCK);
  UNLOCKS.forEach((u) => (UNLOCK[u.k] = st >= u.d));
  if (JSON.stringify(UNLOCK) !== before) { renderCrew(S.last ? S.last.tier : null); if (S.last) $("mchar").innerHTML = charSVG(S.last.tier); }
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
  try { const r = await api("/api/wingman", { body: { mode: "emoji", emojis: picked.join("") } }); out._t.textContent = r.text; S.ME = r.me; renderQuota(); track("emoji_starter");
    const use = document.createElement("button"); use.className = "btn"; use.style.marginTop = "8px"; use.style.display = "block"; use.textContent = "Put it in my Weigh pad";
    use.onclick = () => { const lyric = r.text.split("\n").filter((l) => l.trim()).slice(0, 2).join("\n"); $("lyrics").value = lyric; ls("wk-draft", lyric); show("weigh"); $("lyrics").focus(); }; out.appendChild(use);
  } catch (e) { out._t.textContent = e.message; if (e.status === 402) addProLink(out._t); }
  busy = false; $("eGo").disabled = !picked.length;
};
window.addEventListener("popstate", () => { if (/^\/pen\/[a-z0-9]+/.test(location.pathname)) show("pen"); else if (location.pathname.startsWith("/u/")) show("profile"); });


/* ---------- theme ---------- */
const THEMES = ["auto", "light", "dark"];
let theme = ls("wk-theme") || "auto";
function applyTheme() {
  const r = document.documentElement;
  if (theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", theme);
  $("themeBtn").textContent = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🖥️"; $("themeBtn").setAttribute("aria-label", "Theme: " + theme);
  const dark = theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#13152A" : "#FBFCFF");
}
$("themeBtn").onclick = () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; ls("wk-theme", theme); applyTheme(); sfx("pop"); };
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
applyTheme();

/* ---------- rotating hero word ---------- */
const HERO_WORDS = ["wicked", "well put", "whatever", "weird", "wack"];
let heroI = 4;
function heroTick() {
  if (document.hidden) return;
  heroI = (heroI + 1) % 5;
  const el = $("heroWord");
  el.classList.add("out");
  setTimeout(() => {
    el.textContent = HERO_WORDS[heroI]; el.className = "hw in tw" + heroI;
    document.querySelectorAll("#crew .member").forEach((m, i) => m.classList.toggle("cue", i === heroI));
    setTimeout(() => el.classList.remove("in"), 30);
  }, 260);
}
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(heroTick, 2400);

/* ---------- meet the crew ---------- */
const CREW_JOBS = [
  ["Wiz", "The originality coach. Stars the line only you would write.", 0],
  ["Wendy", "Your hype friend. Cheers you on while you type.", 1],
  ["Wally", "The filler police. Spots the yeahs, oohs and babys.", 2],
  ["Wobbles", "The rhythm checker. Flags lines that rush or drag.", 3],
  ["Wretch", "The roaster. Gags at clichés so you don't have to.", 4],
  ["Wingman", "Your co-writer. Rewrites, rhymes and emoji starters.", 5],
];
$("crewGrid").innerHTML = CREW_JOBS.map(([n, d, i]) => `<div class="crewcard" style="--cc:${CREW[i].col === "#FFFFFF" ? "#A8C42E" : CREW[i].col}"><div class="cch">${charSVG(i)}</div><b>${n}</b><p>${d}</p></div>`).join("");
document.querySelectorAll("[data-ch]").forEach((e) => (e.innerHTML = charSVG(+e.dataset.ch)));
/* ---------- account ---------- */
function renderAccount() {
  const b = $("acctBtn");
  b.textContent = S.ME && S.ME.username ? "👤 @" + S.ME.username : S.ME && S.ME.email ? "👤 " + S.ME.email.split("@")[0] : "Sign in";
}
function openLogin() {
  $("loginModal").hidden = false; $("loginChar").innerHTML = charSVG(1); $("loginNote").textContent = "";
  const inn = !!(S.ME && S.ME.email);
  $("loginForm").hidden = inn; $("loginOut").hidden = !inn; $("loginAge").parentElement.hidden = !!(S.ME && S.ME.ageOk); $("adminLink").hidden = !(S.ME && S.ME.admin);
  const mp = $("myProfileLink"); mp.hidden = !(S.ME && S.ME.username); if (S.ME && S.ME.username) mp.href = "/u/" + S.ME.username;
  $("loginH").textContent = inn ? "You're signed in" : "Save your streak and songs";
  $("loginSub").textContent = inn ? `Signed in as ${S.ME.email}. Your streak, Pro and songs follow you to any device.` : "Sign in with your email and we'll send you a link. No password. Your streak, Pro and songs follow you to any device.";
  if (!inn) setTimeout(() => $("loginEmail").focus(), 50);
}
function closeLogin() { $("loginModal").hidden = true; }
$("acctBtn").onclick = openLogin; $("loginX").onclick = closeLogin; $("loginX2").onclick = closeLogin;
$("loginModal").addEventListener("click", (e) => { if (e.target.id === "loginModal") closeLogin(); });
$("loginGo").onclick = async () => {
  const b = $("loginGo"); b.disabled = true; $("loginNote").textContent = "Sending…";
  try { await api("/api/login", { body: { email: $("loginEmail").value, age13: $("loginAge").checked } }); $("loginNote").textContent = "Check your email for the sign-in link. It works for 20 minutes."; }
  catch (e) { $("loginNote").textContent = e.message; }
  b.disabled = false;
};
$("loginEmail").addEventListener("keydown", (e) => { if (e.key === "Enter") $("loginGo").click(); });
$("logoutBtn").onclick = async () => { await api("/api/logout", { body: {} }).catch(() => {}); location.href = "/"; };

/* ---------- wiring ---------- */
$("weighBtn").onclick = renderReading;
$("wipeBtn").onclick = wipe;
document.querySelectorAll("[data-ex]").forEach((b) => (b.onclick = () => loadExample(b.dataset.ex)));
$("lyrics").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") renderReading(); });
$("lyrics").addEventListener("input", () => { padIsExample = false; ls("wk-draft", $("lyrics").value); $("draftBack").hidden = true; });
document.querySelectorAll("#mainNav button,#proBtn,.squadsw button").forEach((b) => (b.onclick = () => show(b.dataset.v)));
document.querySelectorAll("#groupNav button").forEach((b) => (b.onclick = () => { const last = ls("wk-g-" + b.dataset.g); show(VIEWS.includes(last) && GROUP[last] === b.dataset.g ? last : GROUP_FIRST[b.dataset.g]); }));
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (VIEWS.includes(h)) show(h); });
$("toWing").onclick = () => { show("wingman"); if (words($("lyrics").value).length >= 8) { if (!S.last) renderReading(); ask("Make my lyrics less wack"); } };
$("whyList").innerHTML = METRICS.map((m) => `<dt>${m.n} <span class="hint">(${Math.round(m.w * 100)}%)</span></dt><dd>${m.d}</dd>`).join("");
$("heroGo").onclick = () => { const t = $("lyrics"); t.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => { t.focus(); t.select(); }, 350); };
$("heroDare").onclick = () => loadExample("wack", true);
document.querySelectorAll("[data-wing],[data-wingbig]").forEach((e) => (e.innerHTML = charSVG(5)));
$("mchar").innerHTML = charSVG(5); renderCrew(null);
if (ls("wk-seen") !== "1") { document.body.classList.add("first"); ls("wk-seen", "1"); }


/* ---------- Coach + progress ---------- */
const COACH_TIPS = {
  worn: (r) => `Your biggest habit here is borrowed phrases${r.found.length ? `, like "${r.found[0][0]}"` : ""}. Listeners finish a cliché before you do. Tap a highlighted phrase for swaps, then train it so you stop reaching for them.`,
  wimpy: () => "Your rhymes are the first ones anyone would grab. Try slant rhymes (window / pillow) or rhyme two syllables at once.",
  weightless: () => "Too many big feeling-words (love, soul, pain) doing the work. Swap one for an object you could photograph.",
  variety: () => "You're circling the same words. Verses should keep moving. Hooks can repeat; verses shouldn't.",
  wasted: () => "Filler words are holding lines together. If a line needs a 'yeah' to fit, the line isn't finished yet.",
  wallpaper: () => "Whole lines repeat more than a hook needs. Keep the hook line, change what surrounds it each time.",
};
async function renderCoach() {
  if (!S.last) return;
  const { LESSONS } = await lessonsM(); const wsDone = () => { try { return JSON.parse(ls("wk-ws") || "{}"); } catch (e) { return {}; } };
  const worst = METRICS.map((m) => [m.k, S.last.vals[m.k]]).sort((a, b) => b[1] - a[1])[0];
  if (worst[1] < 25) {
    const extra = LESSONS.find((l) => !l.metric && !wsDone()[l.id]);
    if (!extra) { $("coach").hidden = true; return; }
    $("coachText").textContent = `Clean on all six metrics. Next level: ${extra.why.split(". ")[0]}.`;
    $("coachGo").textContent = `Train: ${extra.title}`; $("coachGo").onclick = () => openLesson(extra.id);
  } else {
    const l = LESSONS.find((x) => x.metric === worst[0]);
    $("coachText").textContent = COACH_TIPS[worst[0]](S.last);
    $("coachGo").textContent = `Train: ${l.title} (+${l.xp} XP)`; $("coachGo").onclick = () => openLesson(l.id);
  }
  $("coachChar").innerHTML = charSVG(1); $("coach").hidden = false;
}
const openLesson = async (id) => (await shopM()).openLesson(id);
function saveHistory() {
  const h = getHist(); const key = S.last.text.slice(0, 80);
  if (h.length && h[h.length - 1].k === key) h.pop(); // re-weighing the same draft replaces it
  const worst = METRICS.map((m) => [m.k, S.last.vals[m.k]]).sort((a, b) => b[1] - a[1])[0][0];
  h.push({ t: Date.now(), s: S.last.score, w: worst, k: key }); ls("wk-hist", JSON.stringify(h.slice(-40)));
}
/* ---------- find friends (header button, Ctrl/Cmd K) ---------- */
$("findBtn").onclick = async () => (await squadM()).openFind();
document.addEventListener("keydown", async (e) => { if (e.key === "Escape") $("findModal").hidden = true; if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); (await squadM()).openFind(); } });

/* ---------- hooks the on-demand modules call back into ---------- */
Object.assign(A, { show, ask, renderReading, loadMe, openLogin, renderQuota, addProLink, openLesson, notExample: () => (padIsExample = false) });

/* ---------- first-visit tour ---------- */
const TOUR = [
  ["weighBtn", 1, "Weigh your words", "Paste lyrics and hit Weigh it. The meter scores them from Wicked to Wack and circles exactly what's wack."],
  ["groupNav", 3, "Write, Train, Play", "Write: weigh it, wash out the AI, get Wingman's help. Train: lessons and freestyle drills. Play: the Daily W, the Wall and battles with friends."],
  ["heroDare", 4, "Start with a wack one", "Not ready to share your own? Load a wack example and watch me gag. Each tap brings a new one."],
];
let tourI = 0;
function tourStep() {
  document.querySelectorAll(".spot").forEach((e) => e.classList.remove("spot"));
  if (tourI >= TOUR.length) { $("tour").hidden = true; ls("wk-tour", "1"); return; }
  const [id, ch, h, t] = TOUR[tourI]; const el = $(id); el.classList.add("spot"); el.scrollIntoView({ block: "center", behavior: "smooth" });
  $("tourChar").innerHTML = charSVG(ch); $("tourH").textContent = h; $("tourText").textContent = t; $("tourStep").textContent = `${tourI + 1} / ${TOUR.length}`;
  $("tourNext").textContent = tourI === TOUR.length - 1 ? "Let's write" : "Next"; $("tour").hidden = false; $("tourNext").focus();
}
$("tourNext").onclick = () => { tourI++; tourStep(); };
$("tourSkip").onclick = () => { tourI = TOUR.length; tourStep(); };

/* ---------- installable app ---------- */
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $("installBtn").hidden = true; track("install"); };
// iPhone/iPad Safari has no install prompt: show the same button with Add to Home Screen steps instead.
const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (iOS && !standalone && ls("wk-ios-hint") !== "1") {
  $("installBtn").hidden = false;
  $("installBtn").onclick = () => {
    $("quip").textContent = "Wendy: Tap the Share button (□↑) in Safari, then “Add to Home Screen”. Wackometer opens like an app.";
    $("mchar").innerHTML = charSVG(1); show("weigh"); $("meter").scrollIntoView({ behavior: "smooth", block: "center" });
    ls("wk-ios-hint", "1"); $("installBtn").hidden = true; track("install");
  };
}
if ("serviceWorker" in navigator && location.hostname !== "localhost") window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));

/* ---------- boot ---------- */
// Start with a clean pad. A saved draft is one tap away instead of preloaded.
{ const d = ls("wk-draft"); if (d && d.trim()) { $("draftBack").hidden = false; $("draftBtn").onclick = () => { $("lyrics").value = d; $("draftBack").hidden = true; renderReading(); }; } }
loadTune();
loadMe();
{
  const h = location.hash.slice(1), path = location.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/pen/")) show("pen");
  else if (path.startsWith("/u/")) show("profile");
  else if (path !== "/" && path !== "/index.html") { show("lost"); $("lostChar").innerHTML = charSVG(3); }
  else if (VIEWS.includes(h) && h !== "weigh" && h !== "lost") show(h);
  const qs0 = new URLSearchParams(location.search);
  if (qs0.get("unsubscribed")) { history.replaceState(null, "", "/#weigh"); setTimeout(() => { $("quip").textContent = "Wally: Done. No more emails from us. You can turn them back on in Squad → Account settings."; $("mchar").innerHTML = charSVG(2); }, 300); }
  if (qs0.get("deleted")) { history.replaceState(null, "", "/#weigh"); setTimeout(() => { $("quip").textContent = "Wendy: Your account is gone. Sad to see you go. The door's always open."; $("mchar").innerHTML = charSVG(1); }, 300); }
  const si = new URLSearchParams(location.search).get("signin");
  if (si) { history.replaceState(null, "", "/#weigh"); if (si === "ok") { setTimeout(() => { $("quip").textContent = "Wendy: You're signed in! Your streak and songs are safe now."; $("mchar").innerHTML = charSVG(1); }, 300); } else { openLogin(); $("loginNote").textContent = "That link expired. Send a new one."; } }
  if (ls("wk-tour") !== "1" && path === "/" && (!h || h === "weigh") && !qs0.toString()) setTimeout(tourStep, 1200);
  const paid = new URLSearchParams(location.search).get("paid");
  if (paid) { show("pro"); setTimeout(() => ($("demoNote").textContent = paid === "credits" ? "Payment received. 25 credits are on their way to your account." : "Welcome to Wingman Pro. It can take a few seconds to switch on."), 600); history.replaceState(null, "", "/#pro"); }
}
