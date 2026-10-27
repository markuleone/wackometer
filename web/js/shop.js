// Workshop UI. Lessons live in workshop.js.
import { METRICS, tierOf } from "./score.js";
import { $, esc, ls, A, confetti, track, sfx, getHist } from "./core.js";
import { LESSONS, rankOf } from "./workshop.js";

/* ---------- Workshop ---------- */
function wsDone() { try { return JSON.parse(ls("wk-ws") || "{}"); } catch (e) { return {}; } }
let wsCur = null;
export function renderWorkshop() {
  const done = wsDone(); const xp = LESSONS.reduce((a, l) => a + (done[l.id] ? l.xp : 0), 0); const r = rankOf(xp);
  const pct = r.next ? Math.round(((xp - r.at) / (r.next[0] - r.at)) * 100) : 100;
  $("wsRank").innerHTML = `<b>${esc(r.name)}</b><div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progress to next rank"><i style="width:${pct}%"></i></div><span class="hint">${xp} XP${r.next ? ` · ${r.next[0] - xp} to ${r.next[1]}` : " · top rank"}</span>`;
  $("wsList").innerHTML = LESSONS.map((l) => `<button class="lcard${done[l.id] ? " done" : ""}" data-l="${l.id}" aria-pressed="${l.id === wsCur}"><b>${done[l.id] ? "✅ " : ""}${esc(l.title)}</b><small>${esc(l.sub)} · ${l.xp} XP</small></button>`).join("");
  $("wsList").querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => { wsCur = b.dataset.l; renderWorkshop(); if (innerWidth < 820) $("wsLesson").scrollIntoView({ behavior: "smooth" }); }));
  if (!wsCur) wsCur = (LESSONS.find((l) => !done[l.id]) || LESSONS[0]).id;
  const l = LESSONS.find((x) => x.id === wsCur);
  $("wsLesson").innerHTML = `<h3>${esc(l.title)}</h3><p>${esc(l.why)}</p>
    <div class="ba"><div class="bef"><small>🤢 Wack</small>${esc(l.before)}</div><div class="aft"><small>✨ Better</small>${esc(l.after)}</div></div>
    <div class="drill"><b>🏋️ Drill${done[l.id] ? " (passed, practice anytime)" : ` · +${l.xp} XP`}</b><span>${esc(l.drill)}</span>
    <label class="hint" for="wsIn">Your drill</label><textarea id="wsIn" spellcheck="false" placeholder="Write it here…"></textarea>
    <div class="row"><button class="btn bile" id="wsCheck">Check my drill</button><button class="btn" id="wsAsk">Ask Wingman for an example</button></div>
    <p id="wsOut" aria-live="polite" class="hint"></p></div>`;
  $("wsIn").value = ls("wk-ws-" + l.id) || "";
  $("wsIn").addEventListener("input", () => ls("wk-ws-" + l.id, $("wsIn").value));
  $("wsCheck").onclick = () => {
    const res = l.check($("wsIn").value);
    if (res === true) {
      const d = wsDone(); const first = !d[l.id]; d[l.id] = Date.now(); ls("wk-ws", JSON.stringify(d));
      $("wsOut").innerHTML = `<span class="pass">Passed!${first ? ` +${l.xp} XP` : ""}</span> ${first ? "Habit unlocked." : "Still got it."}`;
      sfx("sparkle"); if (first) { confetti(); track("lesson_pass"); setTimeout(renderWorkshop, 1400); }
    } else { $("wsOut").innerHTML = `<span class="fail">Not yet.</span> ${esc(res)}`; sfx("pop"); }
  };
  $("wsAsk").onclick = () => { A.show("wingman"); A.ask(`Teach me "${l.title}". Give me two short original examples, then a tip for the drill: ${l.drill}`); };
  renderProgress();
}
export function openLesson(id) { wsCur = id; A.show("workshop"); }
function renderProgress() {
  const h = getHist();
  if (h.length < 2) { $("wsHist").innerHTML = `<p class="hint">Weigh your own lyrics a couple of times and your trend shows up here.</p>`; return; }
  const W = 600, H = 70, pts = h.map((x, i) => [(i / (h.length - 1)) * (W - 20) + 10, 10 + (x.s / 100) * (H - 20)]);
  const counts = {}; h.slice(-10).forEach((x) => (counts[x.w] = (counts[x.w] || 0) + 1));
  const habit = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]; const hm = METRICS.find((m) => m.k === habit);
  const first = h.slice(0, Math.ceil(h.length / 2)), second = h.slice(Math.ceil(h.length / 2));
  const avg = (a) => Math.round(a.reduce((s, x) => s + x.s, 0) / a.length); const d = avg(first) - avg(second);
  $("wsHist").innerHTML = `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Your last ${h.length} wack scores, lower is better"><polyline fill="none" stroke="var(--t0)" stroke-width="3" stroke-linejoin="round" points="${pts.map((p) => p.join(",")).join(" ")}"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--t${tierOf(h[i].s)})"/>`).join("")}</svg>
    <p>${h.length} weighs · lower line = less wack. ${d > 2 ? `You're <b>${d} points less wack</b> than when you started.` : d < -2 ? `Scores crept up ${-d} points. Time for a drill.` : "Holding steady."} Your most common habit lately: <b>${esc(hm.n.toLowerCase())}</b>.</p>`;
}
