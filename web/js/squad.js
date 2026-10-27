// Squad, friends, search, leaderboard, battles and public profiles. Loaded when needed.
import { TIERS, DAILY_EMOJI, tierOf, words, analyze } from "./score.js";
import { $, esc, S, A, api, CREW, charSVG, track, sfx, UNLOCKS, accFor, avatarHTML, personRow, goProfile, shareLink } from "./core.js";

/* ---------- Squad ---------- */
let PROFILE = null, lbScope = "friends", lbPeriod = "week", battleOpen = null;
export async function loadSquad() {
  const [pr, fr] = await Promise.all([api("/api/profile").catch(() => null), api("/api/friends").catch(() => null)]);
  PROFILE = pr; renderMeCard(fr); renderFriends(fr); loadBoard(); loadBattles();
  loadSuggestions($("fSuggest"), $("fSuggestBox"), $("fNote"));
}
function renderMeCard(fr) {
  const el = $("meCard"), p = PROFILE || {};
  const me = { username: p.username, name: p.name || p.username || "You", avatar: p.avatar, color: p.color, streak: (S.ME && S.ME.streak) || 0 };
  el.style.setProperty("--pc", p.color || "#3D8BFF");
  el.innerHTML = `<div class="mcbanner"></div><div class="mcin">${avatarHTML(me, 72)}<div class="mcid"><b></b><span></span></div></div>
    <p class="mcbio"></p>
    <div class="row">${p.username ? `<a class="btn go" href="/u/${p.username}" id="mcView">View my profile</a>` : ""}<button class="btn ${p.username ? "" : "bile"}" id="mcEdit">${p.username ? "Edit profile" : "Claim your @username"}</button>${p.username ? '<button class="btn" id="mcShare">Share profile</button>' : ""}</div>
    ${!p.signedIn ? `<p class="hint">Tip: <a href="#" id="mcSignin">sign in with email</a> so your profile and squad follow you to any device.</p>` : ""}
    <details class="acct"><summary>Account settings</summary>
      ${p.email ? `<label class="attest"><input type="checkbox" id="mcNotify" ${p.notify ? "checked" : ""}> Email me about friend requests, battles, Pen lines and my weekly recap</label>` : `<p class="hint">Sign in with email to get notified when friends challenge you.</p>`}
      <div class="danger"><b>Delete my account</b><p class="hint">Removes your profile, posts, Daily Ws, votes, friends and battles. Lines you added to friends' Pass the Pen songs stay, without your name. This can't be undone.</p>
      <div class="row"><input type="text" id="mcDelConfirm" placeholder="Type DELETE" aria-label="Type DELETE to confirm" style="max-width:160px"><button class="btn" id="mcDel">Delete forever</button></div><span class="hint" id="mcDelNote"></span></div>
    </details>`;
  el.querySelector("b").textContent = me.name; el.querySelector(".mcid span").textContent = p.username ? "@" + p.username : "No username yet";
  el.querySelector(".mcbio").textContent = p.bio || (p.username ? "" : "Pick a username so friends can find you, battle you and see you on the leaderboard.");
  $("mcEdit").onclick = openEditor;
  if ($("mcNotify")) $("mcNotify").onchange = async (e) => { await api("/api/notify", { body: { on: e.target.checked } }).catch(() => {}); };
  $("mcDel").onclick = async () => {
    try { await api("/api/account/delete", { body: { confirm: $("mcDelConfirm").value } }); try { localStorage.clear(); } catch (e) {} location.href = "/?deleted=1"; }
    catch (err) { $("mcDelNote").textContent = err.message; }
  };
  if ($("mcView")) $("mcView").onclick = (e) => { e.preventDefault(); goProfile(p.username); };
  if ($("mcShare")) $("mcShare").onclick = () => shareLink(`${location.origin}/u/${p.username}`, "Come write with me on Wackometer 👉", $("fNote"));
  if ($("mcSignin")) $("mcSignin").onclick = (e) => { e.preventDefault(); A.openLogin(); };
  if (!p.username && fr && !fr.me.hasUsername && !$("pEdit").dataset.opened) { $("pEdit").dataset.opened = 1; }
}
let pfAvatar = 5, pfColor = "#3D8BFF";
export function openEditor() {
  const p = PROFILE || {}, f = $("pEdit"); f.hidden = false; $("pfNote").textContent = "";
  $("pfUser").value = p.username || ""; $("pfName").value = p.name || ""; $("pfBio").value = p.bio || ""; $("pfPinned").value = p.pinned || "";
  $("pfIg").value = p.links?.instagram || ""; $("pfTt").value = p.links?.tiktok || ""; $("pfSp").value = p.links?.spotify || ""; $("pfSc").value = p.links?.soundcloud || ""; $("pfYt").value = p.links?.youtube || "";
  pfAvatar = p.avatar ?? 5; pfColor = p.color || "#3D8BFF";
  $("pfGenre").innerHTML = `<option value="">Pick one</option>` + (p.genres || []).map((g) => `<option${g === p.genre ? " selected" : ""}>${g}</option>`).join("");
  const drawPick = () => {
    $("pfAvatars").innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<button type="button" class="avb${i === pfAvatar ? " on" : ""}" data-i="${i}" aria-pressed="${i === pfAvatar}" style="--avc:${pfColor}" title="${CREW[i].name}">${charSVG(i)}</button>`).join("");
    $("pfColors").innerHTML = (p.colors || []).map((c) => `<button type="button" class="colb${c === pfColor ? " on" : ""}" data-c="${c}" aria-label="Color ${c}" aria-pressed="${c === pfColor}" style="background:${c}"></button>`).join("");
    $("pfAvatars").querySelectorAll(".avb").forEach((b) => (b.onclick = () => { pfAvatar = +b.dataset.i; sfx("pop"); drawPick(); }));
    $("pfColors").querySelectorAll(".colb").forEach((b) => (b.onclick = () => { pfColor = b.dataset.c; sfx("pop"); drawPick(); }));
  };
  drawPick();
  $("pfAgeRow").hidden = !!p.ageOk;
  const best = S.last && S.last.best; $("pfUseBest").hidden = !best; $("pfUseBest").onclick = () => { $("pfPinned").value = best.line; };
  f.scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => $(p.username ? "pfName" : "pfUser").focus(), 300);
}
$("pfCancel").onclick = () => ($("pEdit").hidden = true);
$("pEdit").addEventListener("submit", async (e) => {
  e.preventDefault(); const b = $("pfSave"); b.disabled = true; $("pfNote").textContent = "Saving…";
  try {
    await api("/api/profile", { body: { age13: $("pfAge").checked, username: $("pfUser").value, name: $("pfName").value, bio: $("pfBio").value, avatar: pfAvatar, color: pfColor, genre: $("pfGenre").value, pinned: $("pfPinned").value,
      links: { instagram: $("pfIg").value, tiktok: $("pfTt").value, spotify: $("pfSp").value, soundcloud: $("pfSc").value, youtube: $("pfYt").value } } });
    $("pfNote").textContent = "Saved."; sfx("sparkle"); $("pEdit").hidden = true; await A.loadMe(); loadSquad();
  } catch (err) { $("pfNote").textContent = err.message; }
  b.disabled = false;
});
function renderFriends(fr) {
  if (!fr) return;
  $("fCount").textContent = fr.friends.length ? `(${fr.friends.length})` : "";
  const list = $("fList"); list.innerHTML = "";
  if (!fr.friends.length) list.innerHTML = `<div class="empty small"><div class="ch">${charSVG(1)}</div>No friends yet. Search a username or send an invite link.</div>`;
  fr.friends.forEach((p) => {
    const chip = p.today ? `<span class="pill bg-t${p.today.tier}" title="Today's Daily W">${DAILY_EMOJI[p.today.tier]} ${p.today.score}</span>` : `<span class="hint">no Daily W yet</span>`;
    const row = personRow(p, chip + `<button class="btn sm" data-b="${p.username}">⚔️ Battle</button>`);
    row.querySelector("[data-b]").onclick = () => startBattle(p.username);
    list.appendChild(row);
  });
  const inc = $("fIncoming"); inc.innerHTML = ""; $("fIncomingBox").hidden = !fr.incoming.length;
  fr.incoming.forEach((p) => {
    const row = personRow(p, `<button class="btn sm bile" data-a="1">Accept</button><button class="btn sm" data-a="0">Decline</button>`);
    row.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => { await api("/api/friends/respond", { body: { username: p.username, accept: b.dataset.a === "1" } }); if (b.dataset.a === "1") sfx("sparkle"); loadSquad(); }));
    inc.appendChild(row);
  });
  fr.outgoing.forEach((p) => list.appendChild(personRow(p, `<span class="hint">Request sent</span>`)));
}
// Search results and suggestions share one renderer with the right button for each relationship.
function friendButton(p, noteEl) {
  const b = document.createElement("button"); b.className = "btn sm";
  const set = (rel) => {
    p.relation = rel; b.disabled = false; b.className = "btn sm" + (rel === "none" || rel === "incoming" ? " bile" : "");
    b.textContent = rel === "friends" ? "Friends ✓" : rel === "requested" ? "Sent" : rel === "incoming" ? "Accept" : "➕ Add";
    b.disabled = rel === "requested" || rel === "friends";
  };
  set(p.relation || "none");
  b.onclick = async () => {
    b.disabled = true;
    try {
      if (p.relation === "incoming") { await api("/api/friends/respond", { body: { username: p.username, accept: true } }); set("friends"); sfx("sparkle"); }
      else { const r = await api("/api/friends/request", { body: { username: p.username } }); set(r.status === "friends" ? "friends" : "requested"); sfx("pop"); }
      if (!$("v-squad").hidden) loadSquad();
    } catch (err) {
      b.disabled = false; noteEl.textContent = err.message;
      if (err.status === 409) { $("findModal").hidden = true; A.show("squad"); setTimeout(openEditor, 400); }
    }
  };
  return b;
}
function renderPeople(list, box, noteEl, emptyMsg) {
  box.innerHTML = "";
  if (!list.length) { if (emptyMsg) box.innerHTML = `<p class="hint">${emptyMsg}</p>`; return; }
  list.forEach((p) => {
    const row = personRow(p, p.why ? `<span class="why">${esc(p.why)}</span>` : "");
    if (p.bio) { const s = document.createElement("span"); s.className = "fbio"; s.textContent = p.bio; row.querySelector(".fname").appendChild(s); }
    row.querySelector(".fextra").appendChild(friendButton(p, noteEl));
    box.appendChild(row);
  });
}
async function runSearch(q, box, noteEl) {
  if (q.replace(/^@/, "").length < 2) { box.innerHTML = ""; return; }
  const r = await api("/api/users/search?q=" + encodeURIComponent(q)).catch(() => ({ users: [] }));
  renderPeople(r.users, box, noteEl, `No one called “${esc(q)}” yet. Send them an invite link!`);
}
async function loadSuggestions(box, wrap, noteEl) {
  const r = await api("/api/users/suggest").catch(() => ({ users: [] }));
  wrap.hidden = !r.users.length; renderPeople(r.users, box, noteEl);
}
let searchT = null;
$("fSearch").addEventListener("input", () => { clearTimeout(searchT); searchT = setTimeout(() => runSearch($("fSearch").value.trim(), $("fResults"), $("fNote")), 250); });
let findT = null;
$("findQ").addEventListener("input", () => { clearTimeout(findT); findT = setTimeout(() => runSearch($("findQ").value.trim(), $("findResults"), $("findNote")), 250); });
export function openFind() {
  $("findModal").hidden = false; $("findNote").textContent = ""; setTimeout(() => $("findQ").focus(), 50);
  loadSuggestions($("findSuggest"), $("findSuggestBox"), $("findNote"));
}
$("findX").onclick = () => ($("findModal").hidden = true);
$("findModal").addEventListener("click", (e) => { if (e.target.id === "findModal") $("findModal").hidden = true; });
$("findInvite").onclick = () => shareLink(PROFILE && PROFILE.username ? `${location.origin}/u/${PROFILE.username}` : location.origin, "Write lyrics with me on Wackometer. Add me 👉", $("findNote"));
$("fInvite").onclick = () => shareLink(PROFILE && PROFILE.username ? `${location.origin}/u/${PROFILE.username}` : location.origin, "Write lyrics with me on Wackometer. Add me 👉", $("fNote"));

/* ---------- leaderboard ---------- */
document.querySelectorAll("#lbScope button").forEach((b) => (b.onclick = () => { lbScope = b.dataset.s; document.querySelectorAll("#lbScope button").forEach((x) => x.setAttribute("aria-pressed", x === b)); loadBoard(); }));
document.querySelectorAll("#lbPeriod button").forEach((b) => (b.onclick = () => { lbPeriod = b.dataset.p; document.querySelectorAll("#lbPeriod button").forEach((x) => x.setAttribute("aria-pressed", x === b)); loadBoard(); }));
async function loadBoard() {
  const el = $("lbRows");
  try {
    const r = await api(`/api/leaderboard?scope=${lbScope}&period=${lbPeriod}`);
    $("lbRules").innerHTML = r.rules.map(([a, b]) => `<li><b>${a}</b> ${b}</li>`).join("");
    el.innerHTML = "";
    if (!r.rows.length) { el.innerHTML = `<li class="empty small"><div class="ch">${charSVG(0)}</div>${lbScope === "friends" ? "No points yet in your squad. Take today's Daily W to get on the board." : "The board is wide open. Take the Daily W and grab the top spot."}</li>`; return; }
    const medal = ["🥇", "🥈", "🥉"];
    r.rows.forEach((p) => { const li = document.createElement("li"); li.className = "lbrow" + (p.you ? " you" : "") + (p.rank <= 3 ? " top" : "");
      li.appendChild(Object.assign(document.createElement("span"), { className: "lbrank", textContent: medal[p.rank - 1] || p.rank }));
      li.appendChild(personRow(p, `<b class="pts">${p.points}</b>`)); el.appendChild(li); });
    if (r.mine) { const li = document.createElement("li"); li.className = "lbrow you"; li.appendChild(Object.assign(document.createElement("span"), { className: "lbrank", textContent: "…" })); li.appendChild(personRow(r.mine, `<b class="pts">${r.mine.points}</b>`)); el.appendChild(li); }
    if (lbScope === "global" && !r.hasUsername) { const li = document.createElement("li"); li.className = "hint"; li.textContent = "Pick a username to show up on the global board."; el.appendChild(li); }
  } catch (e) { el.innerHTML = `<li class="hint">${esc(e.message)}</li>`; }
}

/* ---------- battles ---------- */
async function loadBattles() {
  const el = $("bList");
  try {
    const r = await api("/api/battles"); el.innerHTML = "";
    if (!r.battles.length) { el.innerHTML = `<div class="empty small"><div class="ch">${charSVG(3)}</div>No battles yet. Hit ⚔️ Battle next to a friend.</div>`; return; }
    r.battles.forEach((b) => {
      const tag = b.status === "done" ? (b.result === "win" ? `<span class="pill bg-t1">🏆 Won</span>` : b.result === "loss" ? `<span class="pill bg-t3">Lost</span>` : `<span class="pill bg-t2">Tie</span>`)
        : b.yourTurn ? `<span class="pill bg-t4">Your turn</span>` : `<span class="hint">Waiting on them</span>`;
      const row = personRow(b.them, `<span class="bp">${b.emoji}</span>${tag}`); row.classList.add("clickable");
      row.onclick = (e) => { if (e.target.closest("a")) return; openBattle(b); }; el.appendChild(row);
    });
    if (battleOpen) { const fresh = r.battles.find((x) => x.id === battleOpen); if (fresh) openBattle(fresh, true); }
  } catch (e) { el.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
}
export async function startBattle(username) {
  try { const r = await api("/api/battles", { body: { username } }); battleOpen = r.id; sfx("sparkle"); await loadBattles(); $("battleView").scrollIntoView({ behavior: "smooth", block: "center" }); }
  catch (e) { $("fNote").textContent = e.message; }
}
function openBattle(b, quiet) {
  battleOpen = b.id; const v = $("battleView"); v.hidden = false;
  const side = (s, label) => `<div class="bside" style="--avc:${s.color}">${avatarHTML(s, 56)}<b>${esc(label)}</b>${s.score != null ? `<span class="pill bg-t${s.tier}">${TIERS[s.tier].n} ${s.score}</span>` : `<span class="hint">${s.submitted ? "✍️ Submitted" : "⏳ Not yet"}</span>`}${s.lines ? `<pre></pre>` : ""}</div>`;
  const banner = b.status === "done" ? (b.result === "win" ? `<div class="bres win">${charSVG(0)}<b>You took the W! 🏆</b></div>` : b.result === "loss" ? `<div class="bres loss">${charSVG(4)}<b>They took this one. Run it back?</b></div>` : `<div class="bres tie">${charSVG(2)}<b>Dead heat. Respect.</b></div>`) : "";
  v.innerHTML = `<div class="bhead"><span class="bemoji">${b.emoji}</span><div><span class="eyebrow">vs @${esc(b.them.username || "")}</span><h4>${esc(b.prompt)}</h4></div><button class="x" id="bClose" aria-label="Close">×</button></div>
    ${banner}
    <div class="bsides">${side(b.you, "You")}${side(b.them, b.them.name || "Them")}</div>
    ${b.yourTurn ? `<textarea id="bLines" maxlength="600" placeholder="Write it blind. They can't see yours until you both submit."></textarea><div class="hint" id="bLive">Live meter: start writing</div><div class="row"><button class="btn bile" id="bSubmit">Lock it in</button>${!b.challengedByYou ? '<button class="btn" id="bDecline">Decline</button>' : ""}<span class="hint" id="bNote"></span></div>` : ""}
    ${b.status === "done" ? `<div class="row"><button class="btn go" id="bShare">Share result</button><button class="btn" id="bAgain">⚔️ Rematch</button><span class="hint" id="bNote"></span></div>` : ""}
    ${b.status === "open" && !b.yourTurn ? `<p class="penwait">⏳ Waiting on @${esc(b.them.username || "them")}. We'll show both verses the moment they lock in.</p>` : ""}`;
  const pres = v.querySelectorAll(".bside pre"); let k = 0;
  if (b.you.lines) pres[k++].textContent = b.you.lines; if (b.them.lines && pres[k]) pres[k].textContent = b.them.lines;
  $("bClose").onclick = () => { v.hidden = true; battleOpen = null; };
  if ($("bLines")) {
    $("bLines").addEventListener("input", () => { const t = $("bLines").value, n = words(t).length; if (n < 4) { $("bLive").textContent = "Live meter: start writing"; return; } const sc = Math.round(analyze(t).raw); $("bLive").textContent = `Live meter: ${TIERS[tierOf(sc)].n} ${sc} · ${n} words`; });
    $("bSubmit").onclick = async () => { const btn = $("bSubmit"); btn.disabled = true;
      try { await api(`/api/battles/${b.id}/submit`, { body: { lines: $("bLines").value } }); sfx("sparkle"); await loadBattles(); }
      catch (e) { $("bNote").textContent = e.message; btn.disabled = false; } };
    if ($("bDecline")) $("bDecline").onclick = async () => { await api(`/api/battles/${b.id}/decline`, { body: {} }).catch(() => {}); v.hidden = true; battleOpen = null; loadBattles(); };
  }
  if ($("bShare")) $("bShare").onclick = () => { track("share_card"); const verdict = b.result === "win" ? "I took the W 🏆" : b.result === "loss" ? "they took this one 😤" : "dead heat 🤝";
    shareLink(location.origin, `⚔️ Wackometer battle ${b.emoji}\nMe ${b.you.score} vs @${b.them.username} ${b.them.score}. ${verdict}\nThink you can out-write me?`, $("bNote")); };
  if ($("bAgain")) $("bAgain").onclick = () => startBattle(b.them.username);
  if (b.status === "done" && !quiet && b.result === "win") sfx("sparkle");
}

/* ---------- public profile ---------- */
export async function loadProfile(username) {
  username = decodeURIComponent(username || "").toLowerCase();
  try {
    const p = await api("/api/u/" + encodeURIComponent(username));
    document.title = `${p.name} (@${p.username}) · Wackometer`;
    $("pBanner").style.setProperty("--pc", p.color);
    $("pAvatar").innerHTML = charSVG(p.avatar, null, accFor(p.streak));
    $("pName").textContent = p.name; $("pUser").textContent = "@" + p.username + (p.streak ? `  ·  🔥 ${p.streak}-day streak` : "");
    $("pBio").textContent = p.bio || (p.you ? "Add a bio from Squad → Edit profile." : "");
    $("pTags").innerHTML = (p.genre ? `<span class="tag2">🎵 ${esc(p.genre)}</span>` : "") + `<span class="tag2">👥 ${p.stats.friends} friend${p.stats.friends === 1 ? "" : "s"}</span><span class="tag2">⭐ ${p.stats.weekPoints} W Points this week</span>`;
    $("pPin").hidden = !p.pinned; $("pPinText").textContent = "“" + p.pinned + "”";
    const st = [["Daily Ws", p.stats.dailies, 0], ["Wicked scores", p.stats.wicked, 1], ["Battles", `${p.stats.wins}–${p.stats.losses}`, 3], ["Pen lines", p.stats.penLines, 2], ["Wall posts", p.stats.posts, 4]];
    $("pStats").innerHTML = st.map(([l, n, t]) => `<div class="pst" style="--sc:var(--t${t})"><b>${n}</b><span>${l}</span></div>`).join("");
    $("pUnlocks").innerHTML = UNLOCKS.map((u) => { const got = p.streak >= u.d; return `<div class="unl${got ? " got" : ""}"><span class="um">${charSVG(u.who, null, accFor(got ? 99 : 0))}</span><span>${got ? "Unlocked" : u.d + "-day streak"}<br><b>${u.name}</b></span></div>`; }).join("");
    const L = { instagram: "📸 Instagram", tiktok: "🎬 TikTok", spotify: "🎧 Spotify", soundcloud: "☁️ SoundCloud", youtube: "▶️ YouTube" };
    const links = Object.entries(p.links || {}); $("pLinksBox").hidden = !links.length;
    $("pLinks").innerHTML = links.map(([k, u]) => `<a class="btn" href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${L[k]}</a>`).join("");
    const ld = $("pLastDaily"); ld.hidden = !p.lastDaily;
    if (p.lastDaily) { ld.innerHTML = `<h3>Latest Daily W</h3><span class="pill bg-t${p.lastDaily.tier}">${TIERS[p.lastDaily.tier].n} ${p.lastDaily.score}</span><pre class="dmine"></pre><span class="hint">${p.lastDaily.day}</span>`; ld.querySelector("pre").textContent = p.lastDaily.lines; }
    const rc = $("pRecent"); rc.innerHTML = "";
    if (!p.recent.length) rc.innerHTML = `<div class="empty small"><div class="ch">${charSVG(2)}</div>Nothing on the Wall yet.</div>`;
    p.recent.forEach((r) => { const c = document.createElement("article"); c.className = "card"; c.innerHTML = `<div class="ch"><span class="ttl"></span><span class="pill bg-t${r.tier}">${TIERS[r.tier].n} ${r.score}</span></div><pre></pre>`; c.querySelector(".ttl").textContent = r.title || "Untitled"; c.querySelector("pre").textContent = r.excerpt; rc.appendChild(c); });
    const act = $("pActions"); act.innerHTML = "";
    const btn = (label, cls, fn) => { const b = document.createElement("button"); b.className = "btn " + cls; b.textContent = label; b.onclick = fn; act.appendChild(b); return b; };
    if (p.you) btn("Edit profile", "bile", () => { A.show("squad"); setTimeout(openEditor, 400); });
    else if (p.relation === "friends") { btn("Friends ✓", "", () => {}); btn("⚔️ Battle", "bile", () => { A.show("squad"); setTimeout(() => startBattle(p.username), 400); }); }
    else if (p.relation === "requested") btn("Request sent", "", () => {}).disabled = true;
    else if (p.relation === "incoming") btn("Accept friend request", "bile", async () => { await api("/api/friends/respond", { body: { username: p.username, accept: true } }); sfx("sparkle"); loadProfile(p.username); });
    else btn("➕ Add friend", "bile", async (e) => { try { await api("/api/friends/request", { body: { username: p.username } }); sfx("pop"); loadProfile(p.username); } catch (err) { e.target.textContent = err.status === 409 ? "Pick your username first" : err.message; if (err.status === 409) { A.show("squad"); setTimeout(openEditor, 400); } } });
    btn("Share", "", () => shareLink(location.href.split("#")[0], `${p.name} on Wackometer 👉`, $("pBio")));
    if (!p.you) {
      if (p.relation === "blocked") btn("Unblock", "", async () => { await api(`/api/u/${p.username}/unblock`, { body: {} }); loadProfile(p.username); });
      else {
        const more = document.createElement("details"); more.className = "pmore"; more.innerHTML = `<summary aria-label="More options">•••</summary><div class="pmenu"><button class="linkbtn" data-a="report">🚩 Report profile</button><button class="linkbtn" data-a="block">🚫 Block @${esc(p.username)}</button></div>`;
        more.querySelector('[data-a="report"]').onclick = async (e) => { const t = e.target; if (!t.dataset.sure) { t.dataset.sure = 1; t.textContent = "Tap again to report (offensive or fake)"; return; } await api(`/api/u/${p.username}/report`, { body: { reason: "profile" } }).catch(() => {}); t.textContent = "Reported. Thanks."; t.disabled = true; };
        more.querySelector('[data-a="block"]').onclick = async (e) => { const t = e.target; if (!t.dataset.sure) { t.dataset.sure = 1; t.textContent = "Tap again: they can't friend or battle you"; return; } await api(`/api/u/${p.username}/block`, { body: {} }).catch(() => {}); loadProfile(p.username); };
        act.appendChild(more);
      }
    }
  } catch (e) {
    $("pName").textContent = "No writer here"; $("pUser").textContent = "@" + username; $("pBio").textContent = e.message; $("pActions").innerHTML = ""; $("pAvatar").innerHTML = charSVG(3);
    ["pStats", "pTags", "pRecent", "pUnlocks"].forEach((i) => ($(i).innerHTML = "")); $("pPin").hidden = true; $("pLinksBox").hidden = true; $("pLastDaily").hidden = true;
  }
}
