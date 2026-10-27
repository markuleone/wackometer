// Daily W: one prompt a day, boards and streak unlocks. Loaded when the tab opens.
import { TIERS, METRICS, DAILY_EMOJI, tierOf, words, analyze } from "./score.js";
import { $, api, copyText, charSVG, track, UNLOCKS, goProfile } from "./core.js";

/* ---------- Daily W ---------- */
let daily = null, board = "crew";
export async function loadDaily() {
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
  document.querySelectorAll("[data-b]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.b === board));
  if (!list.length) { el.innerHTML = `<div class="empty"><div class="ch">${charSVG(board === "crew" ? 0 : 1)}</div>${board === "crew" ? "No entries yet today. Be the first name on the board." : "No 🔥 yet. Fire the lines you'd steal."}</div>`; return; }
  el.innerHTML = "";
  list.forEach((e, i) => {
    const row = document.createElement("div"); row.className = "entry" + (e.mine ? " you" : "");
    const lit = daily.liked.includes(e.entry);
    row.innerHTML = `<span class="rank">${i + 1}</span><span class="mini">${charSVG(e.tier)}</span><div class="ebody"><div class="ewho"></div><pre></pre></div><div class="eside"><span class="pill bg-t${e.tier}">${e.score}</span><button class="fire${lit ? " lit" : ""}" ${e.mine ? "disabled" : ""} aria-pressed="${lit}" title="Fire it">🔥 <span>${e.fires}</span></button></div>`;
    const ew = row.querySelector(".ewho");
    if (e.username && !e.mine) { const l = document.createElement("a"); l.href = "/u/" + e.username; l.textContent = e.who; l.onclick = (ev) => { ev.preventDefault(); goProfile(e.username); }; ew.appendChild(l); }
    else ew.textContent = e.who;
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

function renderUnlocks(st) {
  $("unlocks").innerHTML = UNLOCKS.map((u) => { const got = st >= u.d; return `<div class="unl${got ? " got" : ""}" title="${u.name}"><span class="um">${charSVG(u.who)}</span><span>${got ? "Unlocked" : u.d + "-day streak"}<br><b>${u.name}</b></span></div>`; }).join("");
}
