// Review pages (/reviews and /reviews/<slug>): crowd vote, share link, story card, badge code, artist submissions.
// The page itself is rendered by the worker; this only adds the interactive bits.
import { $, api, charSVG, track, sourceOf, copyText, IS_BOT } from "./core.js";
import { TIERS } from "./score.js";

const TC = ["#3D8BFF", "#22C29B", "#A9A2DA", "#FF8A3D", "#A8C42E"];
const TEXT_ON = ["#1F2340", "#1F2340", "#1F2340", "#1F2340", "#1F2340"];
let R = {};
try { R = JSON.parse(document.body.dataset.review || "{}"); } catch (e) {}

// First-party counters: one view, which kind of page, where they came from.
if (!IS_BOT && !sessionStorage.getItem("wk-v")) {
  try { sessionStorage.setItem("wk-v", "1"); } catch (e) {}
  const src = sourceOf();
  track("view"); track(R.front ? "land:home" : R.index ? "land:reviews" : R.artist ? "land:artist" : "land:review"); if (src) track("src:" + src);
  if (src) try { fetch("/api/landing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: location.pathname, src }), keepalive: true }); } catch (e) {}
}
// Per-review counters for the back office (no account, nothing personal).
function rstat(t) {
  if (IS_BOT || !R.slug || R.index || R.front) return;
  try { fetch("/api/rstat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: R.slug, t }), keepalive: true }); } catch (e) {}
}
try { if (R.slug && !sessionStorage.getItem("wk-rv-" + R.slug)) { sessionStorage.setItem("wk-rv-" + R.slug, "1"); rstat("view"); } } catch (e) { rstat("view"); }
document.querySelectorAll(".rv-links a").forEach((a) => a.addEventListener("click", () => rstat("listen")));
// A tap into the Spotify or YouTube player counts as a listen (the page loses focus to the player's frame).
let listened = false;
window.addEventListener("blur", () => { if (!listened && document.activeElement && document.activeElement.tagName === "IFRAME" && document.activeElement.closest(".rv-listen")) { listened = true; rstat("listen"); } });

// The crew member for this tier, next to the score.
document.querySelectorAll(".rv-char,.fp-char,.cm").forEach((el) => (el.innerHTML = charSVG(Number(el.dataset.tier) || 0)));
// Header account button: show the signed-in name (the link opens the account box on /write).
const acct = $("acctLink");
if (acct && !IS_BOT) api("/api/me").then((me) => {
  const label = me && me.username ? "@" + me.username : me && me.email ? me.email.split("@")[0] : "";
  try { if (label) localStorage.setItem("wk-acct", label); else localStorage.removeItem("wk-acct"); } catch (e) {}
  const show = label || "Sign in", el = acct.querySelector(".albl");
  if (el.textContent.trim() !== show) { el.textContent = " " + show; acct.setAttribute("aria-label", label ? "Account: " + label : "Sign in"); }
  acct.href = label ? "/me" : "/write?account=1";
}).catch(() => {});
// Header buttons and front-page cards that lead to the writing tools or the plugin.
document.querySelectorAll("[data-hub]").forEach((el) => el.addEventListener("click", () => track("hub_" + el.dataset.hub)));

/* ---------- lyrics: show-all toggle and the "Is this your song?" claim form ---------- */
{
  const lb = $("lyrBody"), more = $("lyrMore");
  if (lb && more && lb.scrollHeight > 640) { lb.classList.add("clip"); more.hidden = false; more.onclick = () => { lb.classList.remove("clip"); more.hidden = true; }; }
  document.querySelectorAll(".claim-f").forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f)), note = f.querySelector("[role=status]"), btn = f.querySelector("button");
    btn.disabled = true; note.textContent = "Sending…";
    try { await api("/api/reviews/lyrics-claim", { body: { ...d, slug: f.dataset.slug } }); f.innerHTML = '<p class="claim-done"><b>Got it, thank you. 🎧</b> We check every request, then the lyrics go up on this page with the meter\'s take.</p>'; track("lyrics_claim"); }
    catch (err) { note.textContent = err.message; btn.disabled = false; }
  }));
}

/* ---------- play buttons on cards: a mini player that opens right on the page ---------- */
const PH = { yt: 0, sp: 152, sc: 166, am: 175 };
function openPlayer(p) {
  let box = $("miniPlayer");
  if (!box) { box = document.createElement("aside"); box.id = "miniPlayer"; box.className = "mini"; box.setAttribute("aria-label", "Now playing"); document.body.appendChild(box); }
  const e = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  box.className = "mini" + (p.k === "yt" ? " vid" : "");
  box.innerHTML = `<div class="mini-top"><span class="mini-t"><b>${e(p.t)}</b><span>${e(p.a)}</span></span><a class="mini-go" href="/reviews/${e(p.s)}">Read the review →</a><button type="button" class="mini-x" aria-label="Close the player">×</button></div>
<div class="mini-frame"><iframe title="Play ${e(p.t)}" src="${e(p.src)}" ${p.k === "yt" ? "" : `height="${PH[p.k] || 152}"`} allow="autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture" ${p.k === "am" ? 'sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"' : ""}></iframe></div>`;
  box.querySelector(".mini-x").onclick = () => box.remove();
  document.querySelectorAll(".pplay.on").forEach((b) => b.classList.remove("on"));
}
document.addEventListener("click", (ev) => {
  const b = ev.target.closest && ev.target.closest(".pplay"); if (!b) return;
  ev.preventDefault(); ev.stopPropagation();
  try { openPlayer(JSON.parse(b.dataset.play)); b.classList.add("on"); track("play_card"); } catch (e) {}
});

/* ---------- front page: featured carousel ---------- */
const slides = $("fSlides");
if (slides && slides.children.length > 1) {
  const dots = [...document.querySelectorAll(".fdots button")];
  let cur = 0, paused = false;
  const go = (i) => { cur = (i + slides.children.length) % slides.children.length; slides.scrollTo({ left: slides.clientWidth * cur, behavior: "smooth" }); };
  dots.forEach((d) => (d.onclick = () => { go(Number(d.dataset.i)); paused = true; }));
  slides.addEventListener("scroll", () => {
    const i = Math.round(slides.scrollLeft / slides.clientWidth); if (i === cur && dots[i].hasAttribute("aria-current")) return; cur = i;
    dots.forEach((d, k) => (k === i ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
  }, { passive: true });
  ["pointerenter", "focusin", "touchstart"].forEach((ev) => slides.addEventListener(ev, () => (paused = true), { passive: true }));
  slides.addEventListener("pointerleave", () => (paused = false));
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(() => { if (!paused && !document.hidden) go(cur + 1); }, 7000);
}

/* ---------- crowd vote ---------- */
function renderCrowd(c) {
  const box = $("crowdTier"); if (!box) return;
  box.innerHTML = c.n ? `<span class="rv-pill" style="--tc:${TC[c.tier]};--to:${TEXT_ON[c.tier]}">${TIERS[c.tier].n} · ${c.avg}</span>` : `<span class="hint">No votes yet</span>`;
  $("crowdN").textContent = c.n ? `${c.n} vote${c.n === 1 ? "" : "s"}` : "Be the first";
  $("crowdDist").querySelectorAll("i").forEach((i, k) => i.style.setProperty("--h", (c.n ? Math.round((c.dist[k] / c.n) * 100) : 0) + "%"));
  document.querySelectorAll(".rv-t").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.t) === c.mine)));
}
if (R.slug) {
  api(`/api/reviews/${R.slug}/crowd`).then(renderCrowd).catch(() => {});
  document.querySelectorAll(".rv-t").forEach((b) => (b.onclick = async () => {
    const note = $("voteNote"), t = Number(b.dataset.t);
    document.querySelectorAll(".rv-t").forEach((x) => (x.disabled = true));
    try {
      const c = await api(`/api/reviews/${R.slug}/vote`, { body: { tier: t } });
      renderCrowd(c); track("review_vote"); rstat("vote");
      const agree = t === R.tier ? "Same call as us." : Math.abs(t - R.tier) === 1 ? "Close to our call." : "Bold. You and the meter disagree.";
      note.textContent = `You said ${TIERS[t].n}. ${agree}`;
    } catch (e) { note.textContent = e.message; }
    document.querySelectorAll(".rv-t").forEach((x) => (x.disabled = false));
  }));
}

/* ---------- share ---------- */
const tierLabel = () => (R.cert ? "Certified Wicked" : TIERS[R.tier].n);
const shareText = () => {
  const who = R.ig ? `@${R.ig}` : R.artist;
  return R.cert ? `${who}'s “${R.title}” is Certified Wicked on @wackometer ✨` : `“${R.title}” by ${who} got weighed on @wackometer: ${tierLabel()} (${R.score}/100). Do you agree?`;
};
if ($("rvShare")) $("rvShare").onclick = async () => {
  const url = location.origin + location.pathname, note = $("shareNote");
  track("review_share"); rstat("share");
  if (navigator.share) { try { await navigator.share({ title: document.title, text: shareText(), url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(`${shareText()} ${url}`); note.textContent = "Link copied. Paste it anywhere."; } catch (e) { note.textContent = url; }
};
if ($("badgeCopy")) $("badgeCopy").onclick = () => { copyText($("badgeCode").value, $("badgeCopy"), "Copy the code"); track("review_badge"); rstat("badge"); };

/* ---------- story card (1080x1920, for Instagram and TikTok stories) ---------- */
const W = 1080, H = 1920, D = '"Fredoka",system-ui,sans-serif', B = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
function wrap(x, text, maxW, max) {
  const out = []; let line = "";
  for (const w of String(text).split(/\s+/)) { const t = line ? line + " " + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, "") + "…"; }
  return out;
}
let ASSETS = null;
async function storyAssets() {
  if (ASSETS) return ASSETS;
  try { await document.fonts.load(`700 100px "Fredoka"`); } catch (e) {}
  const [cover, ch, wmark] = await Promise.all([loadImg(`/api/reviews/${R.slug}/cover`), loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(charSVG(R.tier, 400))), loadImg("/brand/wacky-w.svg")]);
  return (ASSETS = { cover, ch, wmark });
}
const clamp01 = (v) => Math.max(0, Math.min(1, v)), easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
async function storyCard() {
  const a = await storyAssets();
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  drawStory(c.getContext("2d"), a, 1);
  return new Promise((r) => c.toBlob(r, "image/png"));
}
// The story card at animation progress p (0..1). p = 1 is the finished still.
function drawStory(x, { cover, ch, wmark }, p) {
  const t = R.tier, col = TC[t];
  const kCover = easeOut(p / 0.25), kText = easeOut((p - 0.18) / 0.2), kScore = easeOut((p - 0.32) / 0.38), kStamp = clamp01((p - 0.7) / 0.1), kVerdict = easeOut((p - 0.8) / 0.2);
  x.globalAlpha = 1; x.textAlign = "left";
  x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, W, H);
  x.fillStyle = ["#E7F0FF", "#E2F7F0", "#EFEDFA", "#FFF0E5", "#EAF3C4"][t]; x.fillRect(0, 0, W, 990);
  // logo
  x.textBaseline = "alphabetic"; x.fillStyle = "#1F2340"; x.font = `700 84px ${D}`;
  const wW = x.measureText("W").width, rest = "ackometer", rW = x.measureText(rest).width, sx = (W - wW - rW) / 2;
  if (wmark) x.drawImage(wmark, sx - 4, 100, wW + 14, (wW + 14) * 1.1); else { x.save(); x.translate(sx + wW / 2, 170); x.rotate(-0.14); x.fillStyle = "#86A01A"; x.fillText("W", -wW / 2, 0); x.restore(); }
  x.fillText(rest, sx + wW + 6, 170);
  x.textAlign = "center"; x.font = `700 34px ${D}`; x.fillStyle = "#646A8C"; x.fillText("SONG REVIEW", W / 2, 240);
  // cover (scales up into place)
  x.save(); x.globalAlpha = kCover; const sc = 0.82 + 0.18 * kCover; x.translate(W / 2, 620); x.scale(sc, sc); x.translate(-W / 2, -620 + (1 - kCover) * 60);
  const cs = 640, cx = (W - cs) / 2, cy = 300;
  x.save(); x.shadowColor = "rgba(31,35,64,.25)"; x.shadowBlur = 40; x.shadowOffsetY = 16; x.fillStyle = "#1F2340"; x.beginPath(); x.roundRect(cx, cy, cs, cs, 36); x.fill(); x.restore();
  x.save(); x.beginPath(); x.roundRect(cx, cy, cs, cs, 36); x.clip();
  if (cover) x.drawImage(cover, cx, cy, cs, cs); else { x.fillStyle = col; x.fillRect(cx, cy, cs, cs); x.fillStyle = TEXT_ON[t]; x.font = `700 260px ${D}`; x.fillText("♪", W / 2, cy + cs / 2 + 90); }
  x.restore();
  if (R.cert) {
    x.save(); x.translate(cx + cs - 40, cy + 40); x.rotate(0.22); x.font = `700 44px ${D}`;
    const s = "CERTIFIED WICKED", sw = x.measureText(s).width + 70;
    x.fillStyle = "#1F2340"; x.beginPath(); x.roundRect(-sw / 2, -46, sw, 92, 46); x.fill(); x.fillStyle = "#BCD83C"; x.fillText(s, 0, 16); x.restore();
  }
  x.restore();
  x.globalAlpha = kText;
  // title + artist
  x.fillStyle = "#1F2340"; x.font = `700 76px ${D}`;
  const tl = wrap(x, R.title, W - 160, 2); tl.forEach((l, i) => x.fillText(l, W / 2, 1060 + i * 84));
  let y = 1060 + tl.length * 84;
  x.font = `600 44px ${B}`; x.fillStyle = "#646A8C"; x.fillText(`by ${R.artist}`, W / 2, y + 6); y += 110;
  // verdict pill + score + character
  const vt = tierLabel().toUpperCase(); let fs = 84; x.font = `700 ${fs}px ${D}`;
  while (x.measureText(vt).width > W - 420 && fs > 48) { fs -= 4; x.font = `700 ${fs}px ${D}`; }
  const vw = x.measureText(vt).width + 90, chS = 170, px = W / 2 + (chS + 20) / 2;
  x.globalAlpha = kStamp; const st = 1 + 0.6 * (1 - easeOut(kStamp));
  x.save(); x.translate(px, y + 40); x.rotate(-0.03); x.scale(st, st); x.fillStyle = col; x.beginPath(); x.roundRect(-vw / 2, -62, vw, 124, 62); x.fill(); x.fillStyle = TEXT_ON[t]; x.fillText(vt, 0, fs * 0.36); x.restore();
  if (ch) { const pop = easeOut(kStamp); x.save(); x.translate(px - vw / 2 - chS / 2 - 20, y + 30); x.scale(pop, pop); x.drawImage(ch, -chS / 2, -chS / 2, chS, chS); x.restore(); }
  x.globalAlpha = kText; x.font = `600 38px ${B}`; x.fillStyle = "#646A8C"; x.fillText(`${Math.round(R.score * kScore)}/100 on the Wackometer`, W / 2, y + 160); y += 260;
  x.globalAlpha = kVerdict;
  // verdict
  x.font = `italic 400 44px ${B}`; x.fillStyle = "#1F2340";
  wrap(x, `“${R.verdict}”`, W - 200, 3).forEach((l, i) => x.fillText(l, W / 2, y + i * 60));
  x.globalAlpha = 1; x.font = `700 40px ${D}`; x.fillStyle = "#5A6E0C"; x.fillText("wackometer.com/reviews", W / 2, 1830);
  x.font = `600 30px ${B}`; x.fillStyle = "#646A8C"; x.fillText("Do you agree? Vote at the link · @wackometer", W / 2, 1878);
}
// 7-second vertical video of the card building itself, for TikTok, Reels and Shorts.
if ($("rvVideo")) $("rvVideo").onclick = async () => {
  const b = $("rvVideo"), note = $("shareNote");
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const type = window.MediaRecorder && types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) { note.textContent = "This browser can't record video. Try Chrome or Safari, or save the story card."; return; }
  b.disabled = true; b.textContent = "🎬 Recording… (7s)";
  try {
    const a = await storyAssets();
    const c = document.createElement("canvas"); c.width = 720; c.height = 1280; const x = c.getContext("2d");
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: type, videoBitsPerSecond: 5_000_000 }), chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((r) => (rec.onstop = r));
    rec.start(250); const t0 = performance.now(), dur = 7000;
    await new Promise((resolve) => { (function frame() {
      const el = performance.now() - t0;
      x.setTransform(720 / W, 0, 0, 1280 / H, 0, 0); drawStory(x, a, Math.min(1, el / 4200));
      if (el < dur) requestAnimationFrame(frame); else resolve();
    })(); });
    rec.stop(); await stopped;
    const ext = type.includes("mp4") ? "mp4" : "webm", blob = new Blob(chunks, { type: type.split(";")[0] }), name = `wackometer-${R.slug}.${ext}`;
    const file = new File([blob], name, { type: blob.type }); track("review_video"); rstat("video");
    let shared = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: shareText() }); shared = true; } catch (e) { if (e.name === "AbortError") shared = true; } }
    if (!shared) { const l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 4000); }
    note.textContent = ext === "mp4" ? `Video saved. Post it to TikTok, Reels or Shorts${R.ig ? ` and tag @${R.ig}` : ""}.` : "Video saved as .webm. TikTok and Instagram take it on desktop; on iPhone use Safari for .mp4.";
  } catch (e) { note.textContent = "Couldn't record the video on this browser."; }
  b.disabled = false; b.textContent = "🎬 Save video";
};
if ($("rvCard")) $("rvCard").onclick = async () => {
  const b = $("rvCard"), note = $("shareNote"); b.disabled = true; note.textContent = "Drawing your card…";
  try {
    const blob = await storyCard(); track("review_card"); rstat("card");
    const name = `wackometer-${R.slug}.png`, file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: shareText() }); note.textContent = ""; b.disabled = false; return; } catch (e) { if (e.name === "AbortError") { note.textContent = ""; b.disabled = false; return; } } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    note.textContent = R.ig ? `Saved. Post it to your story and tag @${R.ig}.` : "Saved. Post it to your story.";
  } catch (e) { note.textContent = "Couldn't draw the card on this browser."; }
  b.disabled = false;
};

/* ---------- artist submissions ---------- */
// Paid submissions: Stripe's card form (Payment Element) is mounted in the page, so paying is one click, no checkout page.
// Stripe.js has to load from js.stripe.com. It only loads once the form scrolls into view.
const form = $("subForm");
if (form) {
  let stripe = null, elements = null, loading = null, pending = null;
  const note = $("subNote"), payBtn = $("payBtn"), NOTE0 = note.textContent;
  const loadStripe = () => new Promise((res, rej) => { if (window.Stripe) return res(); const s = document.createElement("script"); s.src = "https://js.stripe.com/v3/"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const setup = () => loading || (loading = (async () => {
    const cfg = await api("/api/reviews/pay-config");
    // Wingman Pro members pay less: show their price on the card and the button.
    const dollars = (c) => "$" + (c % 100 ? (c / 100).toFixed(2) : c / 100);
    if (cfg.pro && cfg.cents < cfg.full) {
      $("priceNum").textContent = String(cfg.cents % 100 ? (cfg.cents / 100).toFixed(2) : cfg.cents / 100); $("payH").setAttribute("aria-label", `${dollars(cfg.cents)}, your Pro price`);
      $("priceWas").hidden = false; $("priceWas").textContent = dollars(cfg.full); $("priceTag").textContent = "your Pro price · one song or album";
      payBtn.innerHTML = `Pay ${dollars(cfg.cents)} &amp; send it`; if ($("proDeal")) $("proDeal").hidden = true;
    }
    if (!cfg.pk) { $("payEl").innerHTML = '<span class="hint">Card payments switch on very soon.</span>'; payBtn.disabled = true; return; }
    await loadStripe();
    stripe = window.Stripe(cfg.pk);
    elements = stripe.elements({ mode: "payment", amount: cfg.cents, currency: "usd", paymentMethodTypes: ["card", "link", "cashapp"],
      appearance: { theme: "stripe", variables: { colorPrimary: "#1F2340", colorBackground: "#FFFFFF", colorText: "#1F2340", colorTextSecondary: "#646A8C", colorDanger: "#C0392B", borderRadius: "12px", fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', spacingUnit: "4px" },
        rules: { ".Input": { border: "2px solid #3A4070", boxShadow: "none" }, ".Input:focus": { border: "2px solid #BCD83C", boxShadow: "none" }, ".Tab": { border: "2px solid #3A4070" }, ".Tab--selected": { border: "2px solid #BCD83C" } } } });
    const pe = elements.create("payment", { layout: { type: "tabs" }, wallets: { applePay: "auto", googlePay: "auto" } });
    $("payEl").innerHTML = ""; pe.mount("#payEl");
  })().catch(() => { loading = null; $("payEl").innerHTML = '<span class="hint">The card form didn\'t load. Refresh to try again.</span>'; }));
  if ("IntersectionObserver" in window) new IntersectionObserver((es, ob) => { if (es.some((x) => x.isIntersecting)) { setup(); ob.disconnect(); } }, { rootMargin: "400px" }).observe(form);
  else setup();
  form.addEventListener("focusin", setup, { once: true });
  const done = () => { form.hidden = true; $("subDone").hidden = false; $("subDone").focus(); track("submit_paid"); };
  // Free submissions: only shown while the switch is on and spots are left.
  const freeBox = $("freeBox");
  if (freeBox) {
    api("/api/reviews/free").then((f) => {
      if (!f.open) return;
      freeBox.hidden = false; $("freeLeft").textContent = f.left === null ? "" : ` · ${f.left} spot${f.left === 1 ? "" : "s"} left`; track("free_seen");
    }).catch(() => {});
    $("freeBtn").onclick = async () => {
      if (!form.reportValidity()) return;
      const b = $("freeBtn"); b.disabled = true; note.textContent = "Sending…";
      try {
        await api("/api/reviews/submit", { body: { ...Object.fromEntries(new FormData(form)), free: 1 } });
        $("subDoneP").textContent = "Your song is in the free pile. We listen when we can, often live on stream, and email you if it gets a review. Want a guaranteed review in 7 days? Send it again with the paid option.";
        form.hidden = true; $("subDone").hidden = false; $("subDone").focus(); track("submit_free");
      } catch (err) { note.textContent = err.message; }
      b.disabled = false;
    };
  }
  const DONE0 = $("subDoneP") ? $("subDoneP").textContent : "";
  $("subAgain").onclick = () => { if ($("subDoneP")) $("subDoneP").textContent = DONE0; form.reset(); pending = null; form.hidden = false; $("subDone").hidden = true; note.textContent = NOTE0; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    await setup(); if (!stripe) return;
    const d = Object.fromEntries(new FormData(form)), key = JSON.stringify(d);
    payBtn.disabled = true; note.textContent = "Checking your card…";
    try {
      const { error: invalid } = await elements.submit();
      if (invalid) throw new Error(invalid.message);
      if (!pending || pending.key !== key) pending = { key, ...(await api("/api/reviews/submit", { body: d })) };
      track("submit_checkout"); note.textContent = "Paying…";
      const { error, paymentIntent } = await stripe.confirmPayment({ elements, clientSecret: pending.clientSecret, redirect: "if_required",
        confirmParams: { return_url: location.origin + location.pathname + "?submitted=1#submit", receipt_email: d.email } });
      if (error) throw new Error(error.message);
      if (paymentIntent && paymentIntent.status === "succeeded") { await api("/api/reviews/submit/confirm", { body: { pi: paymentIntent.id } }).catch(() => {}); pending = null; done(); return; }
      note.textContent = "Payment is processing. We'll email you as soon as it clears.";
    } catch (err) { note.textContent = err.message; }
    payBtn.disabled = false;
  };
}

// Back from Stripe checkout.
{
  const qs = new URLSearchParams(location.search), note = $("subNote");
  if (note && qs.get("submitted")) {
    const pi = qs.get("payment_intent"); history.replaceState(null, "", location.pathname + "#submit");
    if (qs.get("redirect_status") === "failed") note.textContent = "That payment didn't go through. Nothing was charged. Try another card.";
    else { if (pi) api("/api/reviews/submit/confirm", { body: { pi } }).catch(() => {}); form.hidden = true; $("subDone").hidden = false; track("submit_paid"); }
  }
  else if (note && qs.get("submit") === "cancelled") { note.textContent = "Checkout cancelled. Nothing was charged."; history.replaceState(null, "", location.pathname + "#submit"); }
}

// Get reviewed page: "Get reviewed by …" buttons pick that critic in the form without reloading.
document.querySelectorAll("[data-critic]").forEach((a) => a.addEventListener("click", (e) => {
  const sel = $("subCritic"); if (!sel) return;
  e.preventDefault(); sel.value = a.dataset.critic;
  $("submit").scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => sel.focus({ preventScroll: true }), 400);
}));

// "Review for Wackometer" applications.
const applyForm = $("applyForm");
if (applyForm) applyForm.onsubmit = async (e) => {
  e.preventDefault();
  const note = $("applyNote"), btn = applyForm.querySelector("button"); btn.disabled = true; note.textContent = "Sending…";
  try { await api("/api/critics/apply", { body: Object.fromEntries(new FormData(applyForm)) }); applyForm.reset(); note.textContent = "Got it. We read every application and reply by email."; track("critic_apply"); }
  catch (err) { note.textContent = err.message; }
  btn.disabled = false;
};

/* ---------- "Wicked of the week" email list ---------- */
const wf = $("wotwForm");
if (wf) wf.onsubmit = async (e) => {
  e.preventDefault();
  const note = $("wotwNote"), btn = wf.querySelector("button");
  btn.disabled = true; note.textContent = "";
  try { await api("/api/subscribe", { body: Object.fromEntries(new FormData(wf)) }); wf.querySelector("input[type=email]").value = ""; note.textContent = "You're in. Watch your inbox for the next one."; track("subscribe"); }
  catch (err) { note.textContent = err.message; }
  btn.disabled = false;
};

/* ---------- reactions + comments (review pages) ---------- */
const rxBox = document.querySelector(".rx");
function renderSocial(s) {
  document.querySelectorAll(".rx-b").forEach((b) => { const k = b.dataset.rx; $("rx-" + k).textContent = s.counts[k] || ""; b.setAttribute("aria-pressed", s.mine.includes(k) ? "true" : "false"); });
  const list = $("cmList"); if (!list) return;
  const fmt = (ts) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  list.replaceChildren(...s.comments.map((c) => { const li = document.createElement("li"); li.className = "cm-item"; const b = document.createElement("b"); b.textContent = c.name; const h = document.createElement("span"); h.className = "hint"; h.textContent = " " + fmt(c.at) + (c.me ? " · you" : ""); const p = document.createElement("p"); p.textContent = c.body; li.append(b, h, p); return li; }));
  if ($("cmEmpty")) $("cmEmpty").hidden = s.comments.length > 0;
}
if (rxBox && R.slug) {
  api(`/api/reviews/${R.slug}/social`).then(renderSocial).catch(() => {});
  document.querySelectorAll(".rx-b").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { renderSocial(await api(`/api/reviews/${R.slug}/react`, { body: { emoji: b.dataset.rx } })); track("review_react"); rstat("react"); } catch (e) {}
    b.disabled = false;
  }));
  const cf = $("cmForm");
  if (cf) cf.onsubmit = async (e) => {
    e.preventDefault(); const btn = cf.querySelector("button"), note = $("cmNote"); btn.disabled = true; note.textContent = "";
    try { renderSocial(await api(`/api/reviews/${R.slug}/comment`, { body: { body: $("cmBody").value, name: $("cmName").value } })); $("cmBody").value = ""; rstat("comment"); note.textContent = "Posted."; track("review_comment"); try { localStorage.setItem("wk-cmname", $("cmName").value); } catch (e2) {} }
    catch (err) { note.textContent = err.message; }
    btn.disabled = false;
  };
  try { const n = localStorage.getItem("wk-cmname"); if (n && $("cmName")) $("cmName").value = n; } catch (e) {}
}

/* ---------- artist pages: claim form + badge code ---------- */
const claim = $("claimForm");
if (claim) claim.onsubmit = async (e) => {
  e.preventDefault(); const btn = claim.querySelector("button"), note = $("claimNote"); btn.disabled = true; note.textContent = "";
  try { await api("/api/artists/claim", { body: Object.fromEntries(new FormData(claim)) }); claim.innerHTML = "<b>Claim sent.</b><p>We check every claim by hand and email you within a few days. Once it's approved, your links show up on this page.</p>"; track("artist_claim"); }
  catch (err) { note.textContent = err.message; btn.disabled = false; }
};
if ($("arBadgeCopy")) $("arBadgeCopy").onclick = () => { copyText($("arBadgeCode").value, $("arBadgeCopy"), "Copy the code"); track("artist_badge"); };

/* ---------- Wicked list pages: share ---------- */
if ($("wlShare")) $("wlShare").onclick = async () => {
  const text = $("wlShare").dataset.text, url = location.href.split("#")[0]; track("list_share");
  if (navigator.share) { try { await navigator.share({ title: document.title, text, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(`${text} ${url}`); $("wlNote").textContent = "Link copied. Paste it anywhere."; } catch (e) { $("wlNote").textContent = url; }
};
