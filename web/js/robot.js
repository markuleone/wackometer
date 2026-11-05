// Robot check: runs under every reading and flags lines that read machine-written.
// Detection is free and runs in the browser (wash.js). The Humanize rewrite is a Pro (AI) feature.
import { $, esc, S, A, api, charSVG, track, canAI } from "./core.js";
import { washScan, washVerdict } from "./wash.js";

let lastScan = null;
export function renderRobot(text) {
  const r = washScan(text); lastScan = r;
  const [vt] = washVerdict(r.score);
  $("robot").hidden = false;
  $("robotScore").textContent = r.score + "% bot"; $("robotVerdict").textContent = vt;
  $("robotBar").style.left = `calc(${r.score}% - 3px)`;
  $("robotChar").innerHTML = charSVG(r.score >= 60 ? 4 : r.score >= 35 ? 2 : 1);
  const seen = new Set(), tells = [];
  r.hits.forEach((h) => { if (!seen.has(h.t[0])) { seen.add(h.t[0]); tells.push([`"${h.t[0]}"`, h.t[1], h.t[2]]); } });
  const all = [...r.shape, ...tells];
  // Keep it short: three tells open, the rest one tap away.
  const card = (x) => `<div class="tell"><b>${esc(x[0])}</b><p>${esc(x[1])}</p><p class="fix">✍️ ${esc(x[2])}</p></div>`;
  $("robotTells").innerHTML = !all.length ? `<p class="hint">No robot tells. This reads like a person wrote it.</p>`
    : all.slice(0, 3).map(card).join("") + (all.length > 3 ? `<details><summary>${all.length - 3} more</summary>${all.slice(3).map(card).join("")}</details>` : "");
  $("humanizeBtn").hidden = r.score < 15;
  $("humanBox").hidden = true;
}
export function hideRobot() { $("robot").hidden = true; $("humanBox").hidden = true; lastScan = null; }

$("humanizeBtn").onclick = async () => {
  if (!canAI()) { track("ai_locked"); A.show("pro"); return; }
  const t = $("lyrics").value, b = $("humanizeBtn");
  b.disabled = true; $("humanBox").hidden = false; $("humanText").textContent = "Wingman is putting a person back in…";
  try {
    const tells = lastScan ? [...lastScan.shape.map((x) => x[0]), ...new Set(lastScan.hits.map((h) => h.t[0]))].join(", ") : "";
    const r = await api("/api/wingman", { body: { mode: "humanize", pad: t, message: tells } });
    $("humanText").textContent = r.text; if (r.me) { S.ME = r.me; A.renderQuota(); } track("humanize");
  } catch (e) { $("humanText").textContent = e.message; if (e.status === 402) A.addProLink($("humanText")); }
  b.disabled = false;
};
$("humanUse").onclick = () => {
  const lyr = $("humanText").textContent.split(/\n\s*\n/)[0].trim();
  if (!lyr) return;
  $("lyrics").value = lyr; A.notExample(); A.renderReading();
  $("lyrics").scrollIntoView({ behavior: "smooth", block: "center" });
};
