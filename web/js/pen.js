// Pass the Pen: songs written one line at a time. Loaded when the tab opens.
import { TIERS, tierOf, words, analyze } from "./score.js";
import { $, ls, S, A, api, charSVG, track, sfx, goProfile } from "./core.js";

/* ---------- Pass the Pen ---------- */
let pen = null;
const PEN_COLORS = ["#3D8BFF", "#22C29B", "#A9A2DA", "#FF8A3D", "#A8C42E", "#FF8FC0", "#FFD84D"];
function penIdFromPath() { const m = location.pathname.match(/^\/pen\/([a-z0-9]+)/); return m ? m[1] : null; }
export async function loadPenView() {
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
    li.querySelector(".ptext").textContent = l.text;
    const pw = li.querySelector(".pwho");
    if (l.username && !l.mine) { const a2 = document.createElement("a"); a2.href = "/u/" + l.username; a2.textContent = "@" + l.username; a2.onclick = (ev) => { ev.preventDefault(); goProfile(l.username); }; pw.appendChild(a2); }
    else pw.textContent = l.who;
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
  if (S.ME && S.ME.handle) { if (!$("penLineHandle").value) $("penLineHandle").value = S.ME.handle; }
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
$("penWeigh").onclick = () => { if (!pen) return; $("lyrics").value = pen.lines.map((l) => l.text).join("\n"); ls("wk-draft", $("lyrics").value); A.show("weigh"); A.renderReading(); };
$("penClose").onclick = async () => { try { await api(`/api/pen/${pen.id}/close`, { body: {} }); await loadPen(pen.id); loadPenList(); } catch (e) { $("penShareNote").textContent = e.message; } };
$("penNewBtn").onclick = () => { history.pushState(null, "", "/#pen"); pen = null; $("penNew").hidden = false; $("penSong").hidden = true; $("penFirst").focus(); };
