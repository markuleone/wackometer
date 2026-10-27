// Shared helpers and state for every part of the app. Loaded up front; everything else loads on demand.
import { TIERS } from "./score.js";
export const CONTACT_EMAIL = "hello@wackometer.com";
export const SITE = /\./.test(location.hostname) && !/^\d/.test(location.hostname) ? location.hostname.replace(/^www\./, "") : "the Wackometer";
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (id) => document.getElementById(id);
export function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
// Shared mutable state (account, current reading, crowd tune) and hooks the main script fills in.
export const S = { ME: null, last: null, crowdTune: 0, tuneN: 0 };
export const A = {};
export const isPro = () => !!(S.ME && S.ME.pro);
// Load a module once, on first use.
export const lazy = (f) => { let p; return () => (p ||= f()); };

/* ---------- API ---------- */
export async function api(path, opts = {}, retried = false) {
  const res = await fetch(path, { method: opts.method || (opts.body ? "POST" : "GET"), headers: opts.body ? { "content-type": "application/json" } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: "same-origin" });
  let data = {}; try { data = await res.json(); } catch (e) {}
  if (res.status === 428 && data.error === "challenge" && !retried) { await ensureHuman(data.siteKey); return api(path, opts, true); }
  if (!res.ok) { const err = new Error(data.message || data.error || "Something went wrong. Try again."); err.status = res.status; err.code = data.error; throw err; }
  return data;
}
// Cloudflare Turnstile: loads only when the server asks for a human check.
let humanP = null;
export function ensureHuman(siteKey) {
  if (humanP) return humanP;
  humanP = new Promise((resolve, reject) => {
    const modal = $("humanModal"); modal.hidden = false; $("humanChar").innerHTML = charSVG(3); $("humanNote").textContent = "";
    const go = () => window.turnstile.render("#turnstileBox", { sitekey: siteKey, theme: "auto", callback: async (token) => {
      try { await fetch("/api/human", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).then((r) => { if (!r.ok) throw 0; }); modal.hidden = true; $("turnstileBox").innerHTML = ""; resolve(); }
      catch (e) { $("humanNote").textContent = "That didn't go through. Refresh the page and try again."; reject(new Error("Human check failed. Refresh and try again.")); }
      humanP = null;
    }, "error-callback": () => { $("humanNote").textContent = "The check couldn't load. Refresh the page and try again."; humanP = null; reject(new Error("Human check failed.")); } });
    if (window.turnstile) go();
    else { const sc = document.createElement("script"); sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; sc.async = true; sc.onload = go; sc.onerror = () => { humanP = null; reject(new Error("The human check couldn't load.")); }; document.head.appendChild(sc); }
  });
  return humanP;
}

/* ---------- helpers ---------- */
export async function copyText(t, btn, label) {
  try { await navigator.clipboard.writeText(t); btn.textContent = "Copied"; }
  catch (e) { btn.textContent = "Select and copy it"; }
  setTimeout(() => (btn.textContent = label), 1800);
}

/* ---------- the crew ---------- */
export const CREW=[{name:"Wiz",col:"#3D8BFF"},{name:"Wendy",col:"#22C29B"},{name:"Wally",col:"#A9A2DA"},{name:"Wobbles",col:"#FF8A3D"},{name:"Wretch",col:"#A8C42E"},{name:"Wingman",col:"#FFFFFF"}];
export const SHOUT=["Wicked!","Well put!","Meh.","Uhh…","Bleh! 🤢"];
export const QUIPS=[["That's wicked. I'm framing this.","Okay, poet. That line hit.","Fresh. Nobody's said it like that."],["Well put. I'd nod to this.","Clean. A couple of safe picks, but clean.","Solid. Push one image harder."],["Whatever. It's… words.","Heard it. Already forgot it.","It's fine. Fine is the problem."],["Weird. Something smells borrowed.","Did you just rhyme fire with desire?","Half of this I've heard on the radio."],["Wack. Somebody hold my bucket.","I'm gonna be sick. In a fun way.","This belongs inside a greeting card."]];
export const INK="#1F2340";
function eye(cx,cy,r,dx=1,dy=1){return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="${cx+dx*r*.25}" cy="${cy+dy*r*.15}" r="${r*.52}" fill="${INK}"/><circle cx="${cx+dx*r*.25-r*.2}" cy="${cy+dy*r*.15-r*.22}" r="${r*.18}" fill="#fff"/>`}
export function charSVG(i,size,acc){
  const UL = acc || UNLOCK;
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
  if (i === 0 && UL.chain) extra += `<g><path d="M40 98Q60 112 80 98" fill="none" stroke="#E8B400" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 6"/><circle cx="60" cy="106" r="6" fill="#FFD84D" stroke="${INK}" stroke-width="2"/><text x="60" y="109" text-anchor="middle" font-size="7" font-weight="700" fill="${INK}" font-family="Fredoka,sans-serif">W</text></g>`;
  if (i === 1 && UL.crown) extra += `<g stroke="${INK}" stroke-width="1.5">${[34,46,60,74,86].map((x,k)=>`<circle cx="${x}" cy="${k===2?14:k%2?17:22}" r="6" fill="${["#FF8FC0","#FFD84D","#FF8FC0","#FFD84D","#FF8FC0"][k]}"/><circle cx="${x}" cy="${k===2?14:k%2?17:22}" r="2" fill="#fff"/>`).join("")}</g>`;
  if (i === 4 && UL.hat) extra += `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M22 36Q60 22 98 36L92 44Q60 34 28 44Z" fill="#FF8A3D"/><path d="M36 34Q40 10 60 10T84 34Z" fill="#FF8A3D"/><path d="M38 28Q60 20 82 28" fill="none" stroke="#FFD84D" stroke-width="3"/></g>`;
  const sz=size?` width="${size}" height="${size}"`:"";
  return `<svg class="char" viewBox="0 0 120 120"${sz} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${shadow}<g class="body">${back}${body}${i!==5?shine:""}${face}${extra}</g></svg>`;
}
export function renderCrew(active){
  const el=$("crew");
  el.innerHTML=CREW.slice(0,5).map((c,i)=>`<div class="member${i===active?" on":""}" title="${c.name}">${i===active?`<div class="say">${SHOUT[i]}</div>`:""}<div class="ch">${charSVG(i)}</div><div class="step bg-t${i}"><b>${TIERS[i].n}</b><span>${TIERS[i].lo}–${i<4?TIERS[i+1].lo-1:100}</span></div></div>`).join("");
  el.classList.toggle("picked",active!=null);
}
export function confetti(){
  const cv=$("fx"),m=$("meter");if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const W=cv.width=m.clientWidth,H=cv.height=m.clientHeight,x=cv.getContext("2d");
  const cols=["#3D8BFF","#22C29B","#FFD84D","#FF8FC0","#FF8A3D"];
  const ps=Array.from({length:90},()=>({x:W/2,y:H*.45,vx:(Math.random()-.5)*9,vy:-Math.random()*9-3,s:4+Math.random()*5,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:cols[Math.random()*5|0]}));
  let t=0;(function f(){x.clearRect(0,0,W,H);ps.forEach(p=>{p.vy+=.28;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/3,p.s,p.s*.66);x.restore()});
    if(++t<110)requestAnimationFrame(f);else x.clearRect(0,0,W,H)})();
}

/* ---------- analytics ---------- */
export function track(type) { try { fetch("/api/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type }), keepalive: true }); } catch (e) {} }

/* ---------- sound ---------- */
let soundOn = ls("wk-sound") === "1", actx = null;
function renderSound() { const b = $("soundBtn"); b.textContent = soundOn ? "🔊" : "🔈"; b.setAttribute("aria-pressed", soundOn); b.title = soundOn ? "Sound on" : "Sound off"; }
$("soundBtn").onclick = () => { soundOn = !soundOn; ls("wk-sound", soundOn ? "1" : "0"); renderSound(); if (soundOn) sfx("sparkle"); };
renderSound();
function tone(f0, f1, dur, type = "sine", vol = 0.12, delay = 0) {
  const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
}
export function sfx(name) {
  if (!soundOn) return;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) { return; }
  if (name === "pop") tone(520, 880, 0.12, "sine", 0.14);
  if (name === "sparkle") [0, 0.08, 0.16, 0.24].forEach((d, i) => tone(880 + i * 220, 1400 + i * 260, 0.18, "triangle", 0.08, d));
  if (name === "gag") { tone(200, 90, 0.35, "sawtooth", 0.07); tone(140, 60, 0.4, "square", 0.04, 0.12); }
  if (name === "swap") { tone(660, 990, 0.1, "triangle", 0.1); tone(990, 1320, 0.12, "triangle", 0.08, 0.08); }
}

export const UNLOCK = { chain: false, crown: false, hat: false };
export const UNLOCKS = [{ k: "crown", d: 3, who: 1, name: "Wendy's flower crown" }, { k: "chain", d: 7, who: 0, name: "Wiz's gold chain" }, { k: "hat", d: 30, who: 4, name: "Wretch's bucket hat" }];

/* ---------- avatars ---------- */
export const accFor = (streak) => ({ crown: streak >= 3, chain: streak >= 7, hat: streak >= 30 });
export function avatarHTML(p, size = 44) {
  return `<span class="av" style="--avc:${p.color || "#3D8BFF"};width:${size}px;height:${size}px">${charSVG(p.avatar ?? 5, null, accFor(p.streak || 0))}</span>`;
}
export function personRow(p, extra = "") {
  const d = document.createElement("div"); d.className = "frow";
  d.innerHTML = `${avatarHTML(p)}<a class="fname" ${p.username ? `href="/u/${p.username}"` : ""}><b></b><span></span></a><span class="fextra">${extra}</span>`;
  d.querySelector(".fname b").textContent = p.name; d.querySelector(".fname span").textContent = p.username ? "@" + p.username + (p.streak ? ` · 🔥${p.streak}` : "") : "";
  const a = d.querySelector(".fname"); if (p.username) a.onclick = (e) => { e.preventDefault(); goProfile(p.username); };
  return d;
}
export function goProfile(username) { history.pushState(null, "", "/u/" + username); A.show("profile"); }

export async function shareLink(url, text, noteEl) {
  if (navigator.share) { try { await navigator.share({ text, url }); return; } catch (e) {} }
  try { await navigator.clipboard.writeText(`${text} ${url}`); noteEl.textContent = "Link copied. Paste it anywhere."; }
  catch (e) { noteEl.textContent = url; }
}

export function getHist() { try { return JSON.parse(ls("wk-hist") || "[]"); } catch (e) { return []; } }