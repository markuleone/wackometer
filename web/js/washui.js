// AI Wash UI. Detection lives in wash.js.
import { words } from "./score.js";
import { $, esc, S, A, api, charSVG, track, sfx } from "./core.js";
import { washScan, washVerdict, WASH_EXAMPLE } from "./wash.js";

/* ---------- AI Wash ---------- */
let washLast = null;
function runWash() {
  const t = $("washIn").value;
  if (words(t).length < 8) { $("washVerdict").textContent = "Give it at least a couple of lines."; return; }
  const r = washScan(t); washLast = r;
  const [vt, ti] = washVerdict(r.score);
  $("washScore").textContent = r.score + "% bot"; $("washVerdict").textContent = vt; $("washBar").style.left = `calc(${r.score}% - 3px)`;
  $("washChar").innerHTML = charSVG(r.score >= 60 ? 4 : r.score >= 35 ? 2 : 1);
  $("washMap").innerHTML = r.lines.map((line, li) => {
    const hs = r.hits.filter((h) => h.li === li).sort((a, b) => a.s - b.s); let out = "", pos = 0;
    hs.forEach((h) => { if (h.s < pos) return; out += esc(line.slice(pos, h.s)) + `<mark class="ai-t" title="${esc(h.t[1])}">${esc(line.slice(h.s, h.e))}</mark>`; pos = h.e; });
    return `<div class="wln">${out + esc(line.slice(pos)) || "&nbsp;"}</div>`;
  }).join("");
  $("washMapBox").hidden = false;
  const seen = new Set(); const tells = [];
  r.hits.forEach((h) => { if (!seen.has(h.t[0])) { seen.add(h.t[0]); tells.push([`"${h.t[0]}"`, h.t[1], h.t[2]]); } });
  const all = [...r.shape, ...tells];
  $("washTells").innerHTML = all.length ? `<h3>What gave it away (${all.length})</h3>` + all.map((x) => `<div class="tell"><b>${esc(x[0])}</b><p>${esc(x[1])}</p><p class="fix">✍️ ${esc(x[2])}</p></div>`).join("") : `<div class="tell" style="border-left-color:var(--t1)"><b>No robot tells found</b><p>This reads like a person wrote it. Weigh it next to check for clichés.</p></div>`;
  sfx(r.score >= 60 ? "gag" : "pop"); track("wash");
}
$("washBtn").onclick = runWash;
$("washEx").onclick = () => { $("washIn").value = WASH_EXAMPLE; runWash(); };
$("washWipe").onclick = () => { $("washIn").value = ""; $("washMapBox").hidden = true; $("washTells").innerHTML = ""; $("washAIBox").hidden = true; $("washScore").textContent = "–"; $("washVerdict").textContent = "Paste something and hit Wash it."; $("washBar").style.left = "0"; $("washIn").focus(); };
$("washToWeigh").onclick = () => { $("lyrics").value = $("washIn").value; A.notExample(); A.show("weigh"); A.renderReading(); };
$("washIn").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runWash(); });
$("washHuman").onclick = async () => {
  const t = $("washIn").value; if (words(t).length < 8) { $("washVerdict").textContent = "Give Wingman at least a couple of lines."; return; }
  if (!washLast) runWash();
  const b = $("washHuman"); b.disabled = true; $("washAIBox").hidden = false; $("washAI").textContent = "Wingman is putting a person back in…";
  try {
    const tells = washLast ? [...washLast.shape.map((x) => x[0]), ...new Set(washLast.hits.map((h) => h.t[0]))].join(", ") : "";
    const r = await api("/api/wingman", { body: { mode: "humanize", pad: t, message: tells } });
    $("washAI").textContent = r.text; if (r.me) { S.ME = r.me; A.renderQuota(); } track("humanize");
  } catch (e) { $("washAI").textContent = e.message; if (e.status === 402) A.addProLink($("washAI")); }
  b.disabled = false;
};
$("washUse").onclick = () => { const txt = $("washAI").textContent; const lyr = txt.split(/\n\s*\n/)[0]; $("washIn").value = lyr.trim(); runWash(); };
