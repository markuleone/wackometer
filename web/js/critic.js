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
