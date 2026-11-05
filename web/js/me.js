// Profiles: your own page + settings (#me) and anyone's public page at /u/<username>. Loaded when needed.
import { TIERS } from "./score.js";
import { $, esc, S, A, api, CREW, charSVG, UNLOCKS, accFor, avatarHTML, shareLink } from "./core.js";

/* ---------- your profile + account settings ---------- */
let PROFILE = null;
export async function loadMe() {
  PROFILE = await api("/api/profile").catch(() => null);
  renderMeCard();
}
function renderMeCard() {
  const el = $("meCard"), p = PROFILE || {};
  const me = { username: p.username, name: p.name || p.username || "You", avatar: p.avatar, color: p.color, streak: (S.ME && S.ME.streak) || 0 };
  el.style.setProperty("--pc", p.color || "#3D8BFF");
  el.innerHTML = `<div class="mcbanner"></div><div class="mcin">${avatarHTML(me, 72)}<div class="mcid"><b></b><span></span></div></div>
    <p class="mcbio"></p>
    <div class="row">${p.username ? `<a class="btn go" href="/u/${p.username}" id="mcView">View my page</a>` : ""}<button class="btn ${p.username ? "" : "bile"}" id="mcEdit">${p.username ? "Edit profile" : "Claim your @username"}</button>${p.username ? '<button class="btn" id="mcShare">Share</button>' : ""}</div>
    <span class="hint" id="mcNote"></span>
    ${!p.signedIn ? `<p class="hint">Tip: <a href="#" id="mcSignin">sign in with email</a> so your profile and streak follow you to any device.</p>` : ""}
    <details class="acct"><summary>Account settings</summary>
      <div class="danger"><b>Delete my account</b><p class="hint">Removes your profile, posts, Daily Ws and votes. This can't be undone.</p>
      <div class="row"><input type="text" id="mcDelConfirm" placeholder="Type DELETE" aria-label="Type DELETE to confirm" style="max-width:160px"><button class="btn" id="mcDel">Delete forever</button></div><span class="hint" id="mcDelNote"></span></div>
    </details>`;
  el.querySelector("b").textContent = me.name; el.querySelector(".mcid span").textContent = p.username ? "@" + p.username : "No username yet";
  el.querySelector(".mcbio").textContent = p.bio || (p.username ? "" : "Pick a username to get your own page with your best lines, streak and music links.");
  $("mcEdit").onclick = openEditor;
  $("mcDel").onclick = async () => {
    try { await api("/api/account/delete", { body: { confirm: $("mcDelConfirm").value } }); try { localStorage.clear(); } catch (e) {} location.href = "/?deleted=1"; }
    catch (err) { $("mcDelNote").textContent = err.message; }
  };
  if ($("mcView")) $("mcView").onclick = (e) => { e.preventDefault(); history.pushState(null, "", "/u/" + p.username); A.show("profile"); };
  if ($("mcShare")) $("mcShare").onclick = () => shareLink(`${location.origin}/u/${p.username}`, "My lyrics page on Wackometer 👉", $("mcNote"));
  if ($("mcSignin")) $("mcSignin").onclick = (e) => { e.preventDefault(); A.openLogin(); };
}
let pfAvatar = 5, pfColor = "#3D8BFF";
export async function openEditor() {
  if (!PROFILE) await loadMe();
  const p = PROFILE || {}, f = $("pEdit"); f.hidden = false; $("pfNote").textContent = "";
  $("pfUser").value = p.username || ""; $("pfName").value = p.name || ""; $("pfBio").value = p.bio || ""; $("pfPinned").value = p.pinned || "";
  $("pfIg").value = p.links?.instagram || ""; $("pfTt").value = p.links?.tiktok || ""; $("pfSp").value = p.links?.spotify || ""; $("pfSc").value = p.links?.soundcloud || ""; $("pfYt").value = p.links?.youtube || "";
  pfAvatar = p.avatar ?? 5; pfColor = p.color || "#3D8BFF";
  $("pfGenre").innerHTML = `<option value="">Pick one</option>` + (p.genres || []).map((g) => `<option${g === p.genre ? " selected" : ""}>${esc(g)}</option>`).join("");
  const drawPick = () => {
    $("pfAvatars").innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<button type="button" class="avb${i === pfAvatar ? " on" : ""}" data-i="${i}" aria-pressed="${i === pfAvatar}" style="--avc:${pfColor}" title="${CREW[i].name}">${charSVG(i)}</button>`).join("");
    $("pfColors").innerHTML = (p.colors || []).map((c) => `<button type="button" class="colb${c === pfColor ? " on" : ""}" data-c="${c}" aria-label="Color ${c}" aria-pressed="${c === pfColor}" style="background:${c}"></button>`).join("");
    $("pfAvatars").querySelectorAll(".avb").forEach((b) => (b.onclick = () => { pfAvatar = +b.dataset.i; drawPick(); }));
    $("pfColors").querySelectorAll(".colb").forEach((b) => (b.onclick = () => { pfColor = b.dataset.c; drawPick(); }));
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
    $("pfNote").textContent = "Saved."; $("pEdit").hidden = true; await A.loadMe(); loadMe();
  } catch (err) { $("pfNote").textContent = err.message; }
  b.disabled = false;
});

/* ---------- public profile ---------- */
export async function loadProfile(username) {
  username = decodeURIComponent(username || "").toLowerCase();
  try {
    const p = await api("/api/u/" + encodeURIComponent(username));
    document.title = `${p.name} (@${p.username}) · Wackometer`;
    $("pBanner").style.setProperty("--pc", p.color);
    $("pAvatar").innerHTML = charSVG(p.avatar, null, accFor(p.streak));
    $("pName").textContent = p.name; $("pUser").textContent = "@" + p.username + (p.streak ? `  ·  🔥 ${p.streak}-day streak` : "");
    $("pBio").textContent = p.bio || (p.you ? "Add a bio from Edit profile." : "");
    $("pTags").innerHTML = p.genre ? `<span class="tag2">🎵 ${esc(p.genre)}</span>` : "";
    $("pPin").hidden = !p.pinned; $("pPinText").textContent = "“" + p.pinned + "”";
    const st = [["Daily Ws", p.stats.dailies, 0], ["Wicked scores", p.stats.wicked, 1], ["Posts", p.stats.posts, 4]];
    $("pStats").innerHTML = st.map(([l, n, t]) => `<div class="pst" style="--sc:var(--t${t})"><b>${n}</b><span>${l}</span></div>`).join("");
    $("pUnlocks").innerHTML = UNLOCKS.map((u) => { const got = p.streak >= u.d; return `<div class="unl${got ? " got" : ""}"><span class="um">${charSVG(u.who, null, accFor(got ? 99 : 0))}</span><span>${got ? "Unlocked" : u.d + "-day streak"}<br><b>${u.name}</b></span></div>`; }).join("");
    const L = { instagram: "📸 Instagram", tiktok: "🎬 TikTok", spotify: "🎧 Spotify", soundcloud: "☁️ SoundCloud", youtube: "▶️ YouTube" };
    const links = Object.entries(p.links || {}); $("pLinksBox").hidden = !links.length;
    $("pLinks").innerHTML = links.map(([k, u]) => `<a class="btn" href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${L[k]}</a>`).join("");
    const ld = $("pLastDaily"); ld.hidden = !p.lastDaily;
    if (p.lastDaily) { ld.innerHTML = `<h3>Latest Daily W</h3><span class="pill bg-t${p.lastDaily.tier}">${TIERS[p.lastDaily.tier].n} ${p.lastDaily.score}</span><pre class="dmine"></pre><span class="hint">${p.lastDaily.day}</span>`; ld.querySelector("pre").textContent = p.lastDaily.lines; }
    const rc = $("pRecent"); rc.innerHTML = "";
    if (!p.recent.length) rc.innerHTML = `<div class="empty small"><div class="ch">${charSVG(2)}</div>Nothing posted yet.</div>`;
    p.recent.forEach((r) => { const c = document.createElement("article"); c.className = "card"; c.innerHTML = `<div class="ch"><span class="ttl"></span><span class="pill bg-t${r.tier}">${TIERS[r.tier].n} ${r.score}</span></div><pre></pre>`; c.querySelector(".ttl").textContent = r.title || "Untitled"; c.querySelector("pre").textContent = r.excerpt; rc.appendChild(c); });
    const act = $("pActions"); act.innerHTML = "";
    const btn = (label, cls, fn) => { const b = document.createElement("button"); b.className = "btn " + cls; b.textContent = label; b.onclick = fn; act.appendChild(b); return b; };
    if (p.you) btn("Edit profile", "bile", () => { A.show("me"); setTimeout(openEditor, 300); });
    btn("Share", "", () => shareLink(location.href.split("#")[0], `${p.name} on Wackometer 👉`, $("pBio")));
    if (!p.you) {
      const rep = btn("🚩 Report", "", async (e) => { const t = e.target; if (!t.dataset.sure) { t.dataset.sure = 1; t.textContent = "Tap again to report (offensive or fake)"; return; } await api(`/api/u/${p.username}/report`, { body: { reason: "profile" } }).catch(() => {}); t.textContent = "Reported. Thanks."; t.disabled = true; });
      rep.classList.add("quiet");
    }
  } catch (e) {
    $("pName").textContent = "No writer here"; $("pUser").textContent = "@" + username; $("pBio").textContent = e.message; $("pActions").innerHTML = ""; $("pAvatar").innerHTML = charSVG(3);
    ["pStats", "pTags", "pRecent", "pUnlocks"].forEach((i) => ($(i).innerHTML = "")); $("pPin").hidden = true; $("pLinksBox").hidden = true; $("pLastDaily").hidden = true;
  }
}
