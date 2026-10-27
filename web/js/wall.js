// The Wall: crowd votes and reactions. Loaded when the Wall tab opens.
import { TIERS, MID, tierOf } from "./score.js";
import { $, esc, S, api, charSVG, sfx, goProfile } from "./core.js";

const REACTS = ["🔥", "😭", "💀", "🤢"];

/* ---------- Wall ---------- */
let feed = "fresh"; const FEAT = 5; let wall = { readings: [], stats: {} }, wallTimer = null;
export async function loadWall() {
  clearTimeout(wallTimer);
  try { wall = await api("/api/wall?feed=" + feed); S.crowdTune = wall.stats.tune; S.tuneN = wall.stats.tuneN; renderWall(); }
  catch (e) { $("cards").innerHTML = `<div class="empty"><div class="ch">${charSVG(3)}</div>The Wall didn't load. ${esc(e.message)}</div>`; }
  if (!$("v-wall").hidden) wallTimer = setTimeout(loadWall, 20000);
}
function renderWall() {
  const st = wall.stats || {};
  $("sWave").textContent = st.wavelength == null ? "–" : st.wavelength + "%";
  $("sTune").textContent = (st.tune > 0 ? "+" : "") + (st.tune || 0);
  $("sVotes").textContent = st.votes || 0;
  const el = $("cards"), list = wall.readings || [];
  if (!list.length) {
    el.innerHTML = feed === "fresh"
      ? `<div class="empty"><div class="ch">${charSVG(2)}</div>The Wall is empty. Weigh your lyrics and post them to be the first one the crowd votes on.</div>`
      : `<div class="empty"><div class="ch">${charSVG(2)}</div>Nothing Featured yet. Vote on Fresh posts. Once one hits ${FEAT} votes, it shows up here.</div>`;
    return;
  }
  el.innerHTML = "";
  list.forEach((r) => {
    const c = r.votes, n = c.reduce((a, b) => a + b, 0);
    const crowdTier = n ? tierOf(c.reduce((a, b, i) => a + b * MID[i], 0) / n) : null;
    const card = document.createElement("article"); card.className = "card";
    card.innerHTML = `<div class="ch"><span class="ttl"></span>${n >= FEAT ? '<span class="pill" style="background:var(--ink);color:var(--bg)">Featured</span>' : ""}<span class="pill bg-t${r.tier} t${r.tier}"><span class="mini">${charSVG(r.tier)}</span>Crew: ${TIERS[r.tier].n} ${r.score}</span></div>
      <pre></pre>
      <div class="crowd" title="Crowd votes">${n ? c.map((v, i) => (v ? `<i class="bg-t${i}" style="width:${(v / n) * 100}%"></i>` : "")).join("") : ""}</div>
      <div class="cmeta"><span>${n ? `Crowd says ${TIERS[crowdTier].n} · ${n} vote${n > 1 ? "s" : ""}` : "No votes yet. Be first."}</span><span>${new Date(r.createdAt).toLocaleDateString()}</span></div>
      <div class="votes">${TIERS.map((t, i) => `<button data-i="${i}" class="t${i} ${r.myVote === i ? "mine bg-t" + i : ""}" aria-pressed="${r.myVote === i}">${t.n}</button>`).join("")}</div>
      <div class="cfoot"><div class="reacts">${REACTS.map((e) => `<button class="react${(r.myReacts || []).includes(e) ? " on" : ""}" data-e="${e}" aria-pressed="${(r.myReacts || []).includes(e)}">${e} <span>${(r.reacts || {})[e] || ""}</span></button>`).join("")}</div></div>`;
    card.querySelector(".ttl").textContent = r.title || "Untitled";
    if (r.by) { const by = document.createElement("a"); by.className = "by"; by.href = "/u/" + r.by; by.textContent = "by @" + r.by; by.onclick = (ev) => { ev.preventDefault(); goProfile(r.by); }; card.querySelector(".ch").after(by); }
    card.querySelector("pre").textContent = r.excerpt;
    card.querySelectorAll(".votes button").forEach((b) => (b.onclick = () => castVote(r, +b.dataset.i, b)));
    const foot = card.querySelector(".cfoot");
    card.querySelectorAll(".react").forEach((b) => (b.onclick = async () => {
      const on = b.classList.contains("on"); b.disabled = true; sfx("pop");
      try { await api("/api/react", { body: { id: r.id, emoji: b.dataset.e, off: on } }); await loadWall(); } catch (e) { b.disabled = false; }
    }));
    const act = document.createElement("button"); act.className = "del";
    if (r.mine) {
      act.textContent = "Take mine down";
      act.onclick = async () => { if (!act.dataset.sure) { act.dataset.sure = 1; act.textContent = "Tap again to remove"; return; }
        act.disabled = true; try { await api("/api/wall/" + r.id, { method: "DELETE" }); loadWall(); } catch (e) { act.textContent = e.message; act.disabled = false; } };
    } else {
      act.textContent = "Report";
      act.onclick = async () => { if (!act.dataset.sure) { act.dataset.sure = 1; act.textContent = "Not their own lyrics, or not OK? Tap to report"; return; }
        act.disabled = true; try { await api("/api/report", { body: { id: r.id } }); act.textContent = "Reported. Thanks."; } catch (e) { act.textContent = e.message; act.disabled = false; } };
    }
    foot.appendChild(act);
    el.appendChild(card);
  });
}
async function castVote(r, i, btn) {
  btn.disabled = true;
  try { await api("/api/vote", { body: { id: r.id, tier: i } }); await loadWall(); }
  catch (e) { btn.textContent = "Didn't save"; btn.disabled = false; }
}
document.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => {
  feed = b.dataset.f; document.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  $("feedHint").textContent = feed === "fresh" ? "Everything new, newest first. Posts with 5+ votes get Featured." : "Crowd-promoted: 5+ votes, ranked by how many people weighed in.";
  loadWall();
}));
