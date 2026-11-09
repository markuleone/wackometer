// Lyric check for critics, inside the review editor (/admin-reviews).
// Runs the exact same Wackometer as the public "Weigh my lyrics" tool, so a critic's Lyrics score and notes
// line up with what artists see when they weigh their own words. The pasted lyrics never leave the browser.
import { analyze, tierOf, clamp, METRICS, TIERS } from "./score.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TC = ["#3D8BFF", "#22C29B", "#A9A2DA", "#FF8A3D", "#A8C42E"];
let tune = 0, last = null;
fetch("/api/tune").then((r) => r.json()).then((t) => (tune = Number(t.tune) || 0)).catch(() => {});

function run() {
  const text = $("lcText").value.trim(), out = $("lcOut");
  if (text.split(/\s+/).length < 8) { out.innerHTML = '<p class="hint">Paste at least a verse or a hook.</p>'; return; }
  const a = analyze(text), score = Math.round(clamp(a.raw + tune)), t = tierOf(score);
  last = { a, score };
  const worst = [...METRICS].sort((x, y) => a.vals[y.k] - a.vals[x.k]);
  const lazy = [...a.lazyLines].sort((x, y) => x - y).slice(0, 6).map((i) => a.real[i]).filter(Boolean);
  out.innerHTML = `<div class="lc-score"><span class="lc-num">${score}</span><span class="rv-pill" style="--tc:${TC[t]};--to:#1F2340">${TIERS[t].n}</span><span class="hint">Lyrics score from the Wackometer</span></div>
<ul class="lc-metrics">${worst.map((m) => { const v = Math.round(a.vals[m.k]); return `<li><b>${esc(m.n)}</b><span class="bk-bar" aria-hidden="true"><i style="--w:${Math.max(4, 100 - v)}%;--tc:${TC[tierOf(v)]}"></i></span><span class="hint">${esc(a.notes[m.k])}</span></li>`; }).join("")}</ul>
${a.found.length ? `<p><b>Clichés spotted:</b> ${a.found.slice(0, 8).map(([c, n]) => `“${esc(c)}”${n > 1 ? ` ×${n}` : ""}`).join(", ")}</p>` : ""}
${lazy.length ? `<p><b>Lines with lazy end rhymes:</b></p><ul class="lc-lines">${lazy.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
<div class="row"><button class="btn bile" type="button" id="lcUse">Use ${score} as the Lyrics score</button><button class="btn" type="button" id="lcNotes">Add these notes to the review</button></div>
<p class="hint">The lyrics you pasted stay in this browser. Nothing here is saved or published unless you add the notes yourself.</p>`;
  $("lcUse").onclick = () => { $("fS_lyrics").value = score; $("fS_lyrics").dispatchEvent(new Event("input")); $("lcUse").textContent = "Added ✓"; };
  $("lcNotes").onclick = () => {
    const top = worst.filter((m) => a.vals[m.k] >= 35).slice(0, 3);
    const bits = [];
    if (a.found.length) bits.push(`leans on a few worn phrases (${a.found.slice(0, 3).map(([c]) => `“${c}”`).join(", ")})`);
    top.filter((m) => m.k !== "worn").forEach((m) => bits.push(`${m.n.toLowerCase()}: ${a.notes[m.k].replace(/\.$/, "").toLowerCase()}`));
    const line = bits.length ? `**Lyrics:** the writing ${bits.join("; ")}.` : "**Lyrics:** clean writing: no worn phrases, earned rhymes, no padding.";
    const body = $("fBody"); body.value = (body.value.trim() ? body.value.trim() + "\n\n" : "") + line; $("lcNotes").textContent = "Added ✓";
  };
}
if ($("lcRun")) $("lcRun").onclick = run;

/* ---------- link-preview image (1200x630) for a review ----------
   Drawn here in the browser after each save, then stored with the review, so links shared on
   iMessage, Instagram, X and Facebook show the cover, the score and the verdict. */
import { charSVG } from "./core.js";
const OG_W = 1200, OG_H = 630, FD = '"Fredoka",system-ui,sans-serif', FB = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', INK = "#1F2340";
const WASH = ["#E7F0FF", "#E2F7F0", "#EFEDFA", "#FFF0E5", "#EEF5D2"];
const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
function lines(x, text, maxW, max) {
  const out = []; let line = "";
  for (const w of String(text || "").split(/\s+/)) { const t = line ? line + " " + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, "") + "…"; }
  return out;
}
export async function drawOG(r) {
  try { await document.fonts.load(`700 60px "Fredoka"`); } catch (e) {}
  const t = tierOf(r.score), col = TC[t], cert = r.score < 20, label = cert ? "Certified Wicked" : TIERS[t].n;
  const [cover, ch] = await Promise.all([r.cover_url ? img(`/api/reviews/${encodeURIComponent(r.slug)}/cover`) : null, img("data:image/svg+xml;charset=utf-8," + encodeURIComponent(charSVG(t, 240)))]);
  const c = document.createElement("canvas"); c.width = OG_W; c.height = OG_H; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, OG_W, OG_H);
  x.fillStyle = WASH[t]; x.beginPath(); x.arc(OG_W - 40, 30, 380, 0, Math.PI * 2); x.fill();
  // cover with a chunky offset shadow
  const cx = 60, cy = 95, cs = 440;
  x.fillStyle = INK; x.beginPath(); x.roundRect(cx + 12, cy + 12, cs, cs, 30); x.fill();
  x.save(); x.beginPath(); x.roundRect(cx, cy, cs, cs, 30); x.clip();
  if (cover) x.drawImage(cover, cx, cy, cs, cs); else { x.fillStyle = WASH[t]; x.fillRect(cx, cy, cs, cs); if (ch) x.drawImage(ch, cx + 90, cy + 90, 260, 260); }
  x.restore(); x.lineWidth = 5; x.strokeStyle = INK; x.beginPath(); x.roundRect(cx, cy, cs, cs, 30); x.stroke();
  if (cert) { x.save(); x.translate(cx + cs - 70, cy + 34); x.rotate(0.2); x.font = `700 26px ${FD}`; const s = "CERTIFIED WICKED", w = x.measureText(s).width + 40; x.fillStyle = INK; x.beginPath(); x.roundRect(-w / 2, -26, w, 52, 26); x.fill(); x.fillStyle = "#BCD83C"; x.textAlign = "center"; x.fillText(s, 0, 9); x.restore(); }
  // text column
  const tx = 560, tw = OG_W - tx - 56;
  x.textAlign = "left"; x.textBaseline = "alphabetic";
  x.font = `700 30px ${FD}`; x.fillStyle = INK; const wW = x.measureText("W").width;
  const logoW = wW + x.measureText("ackometer").width;
  x.save(); x.translate(tx + wW / 2, 128); x.rotate(-0.14); x.fillStyle = "#86A01A"; x.fillText("W", -wW / 2, 0); x.restore(); x.fillText("ackometer", tx + wW, 128);
  x.font = `700 18px ${FD}`; x.fillStyle = "#646A8C"; x.fillText("·  " + (r.kind === "album" ? "ALBUM REVIEW" : "SONG REVIEW"), tx + logoW + 14, 125);
  let fs = 64; x.font = `700 ${fs}px ${FD}`; let tl = lines(x, r.title, tw, 2);
  while ((tl.length > 1 && x.measureText(tl.join(" ")).width > tw * 1.9) && fs > 46) { fs -= 4; x.font = `700 ${fs}px ${FD}`; tl = lines(x, r.title, tw, 2); }
  x.fillStyle = INK; let y = 205; tl.forEach((l) => { x.fillText(l, tx, y); y += fs * 1.02; });
  x.font = `500 30px ${FB}`; x.fillStyle = "#646A8C"; x.fillText(lines(x, `by ${r.artist}`, tw, 1)[0], tx, y + 4); y += 66;
  // score row: crew member, big number, tier pill
  if (ch) x.drawImage(ch, tx - 8, y - 18, 112, 112);
  x.font = `700 92px ${FD}`; x.fillStyle = INK; x.fillText(String(r.score), tx + 110, y + 70);
  const nW = x.measureText(String(r.score)).width;
  x.font = `700 28px ${FD}`; const pw = x.measureText(label).width + 40, px = tx + 110 + nW + 18;
  x.fillStyle = col; x.beginPath(); x.roundRect(px, y + 22, pw, 54, 27); x.fill(); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
  x.fillStyle = INK; x.fillText(label, px + 20, y + 59); y += 132;
  if (r.verdict) { x.font = `italic 400 28px ${FB}`; x.fillStyle = INK; lines(x, `“${r.verdict}”`, tw, 2).forEach((l) => { x.fillText(l, tx, y); y += 38; }); }
  x.font = `700 24px ${FD}`; x.fillStyle = "#5A6E0C"; x.fillText("wackometer.com/reviews", tx, 578);
  return c.toDataURL("image/jpeg", 0.88);
}
export async function saveOG(r) {
  const data = await drawOG(r);
  const res = await fetch("/api/reviews-admin/og", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: r.slug, data }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save the share image.");
  return data;
}
window.wkOG = { drawOG, saveOG };
