// Song reviews: we weigh released songs and albums (lyrics, hook, vocals, production, replay), and the crowd weighs in too.
//   /reviews              list of live reviews (filters: ?f=wicked | songs | albums)
//   /reviews/<slug>       one review, rendered here so search engines and link previews get the full page
//   /badge/<slug>.svg     embeddable badge for artists ("Certified Wicked on Wackometer")
//   /api/reviews/...      crowd votes, cover image proxy (for the share card), artist submissions
//   /api/reviews-admin/...  the editor at /admin-reviews (admins only)
import { TIERS, tierOf, MID } from "../web/js/score.js";
import META from "./build-meta.js";
import { siteHeader } from "./site-header.js";

const BASE = "https://wackometer.com";
const TC = ["#3D8BFF", "#22C29B", "#A9A2DA", "#FF8A3D", "#A8C42E"];
const TEXT_ON = ["#1F2340", "#1F2340", "#1F2340", "#1F2340", "#1F2340"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const html = (body, status = 200, cache = "no-cache") => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache, "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" } });
export const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const certified = (r) => tierOf(r.score) === 0;
const tierName = (r) => (certified(r) ? "Certified Wicked" : TIERS[tierOf(r.score)].n);

/* ---------- links ---------- */
export function spotifyEmbed(u) {
  const m = String(u || "").match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]{22})/);
  return m ? { type: m[1], id: m[2], src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=wackometer` } : null;
}
export function youtubeId(u) {
  const m = String(u || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");
const igHandle = (h) => String(h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);

/* ---------- crowd ---------- */
async function crowdOf(DB, slug, userId) {
  const rows = (await DB.prepare("SELECT tier, COUNT(*) c FROM review_votes WHERE slug=? GROUP BY tier").bind(slug).all()).results;
  const dist = [0, 0, 0, 0, 0]; rows.forEach((r) => (dist[r.tier] = r.c));
  const n = dist.reduce((a, b) => a + b, 0);
  const avg = n ? Math.round(dist.reduce((a, c, i) => a + c * MID[i], 0) / n) : null;
  let mine = null;
  if (userId) { const m = await DB.prepare("SELECT tier FROM review_votes WHERE slug=? AND user_id=?").bind(slug, userId).first(); mine = m ? m.tier : null; }
  return { n, avg, tier: avg === null ? null : tierOf(avg), dist, mine };
}

/* ---------- page shell (matches the rhyme/cliché pages) ---------- */
const DBV = `<a class="dbv" href="https://donebyverde.com" target="_blank" rel="noopener noreferrer" aria-label="Website by donebyverde (opens in a new tab)" title="Website by donebyverde"><svg viewBox="0 0 200 200" aria-hidden="true"><path d="M75 0H125L123 61L174 28L200 72L146 100L200 128L174 172L123 139L125 200H75L77 139L26 172L0 128L54 100L0 72L26 28L77 61Z"/></svg></a>`;
export function shell({ path, title, desc, image, body, ld, noindex, data, active = "", q = "", head = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${head}
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${BASE}${path}">`}
<meta property="og:type" content="article">
<meta property="og:site_name" content="Wackometer">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image || BASE + "/og.png")}">
<meta property="og:url" content="${BASE}${path}">
<meta name="twitter:card" content="${image ? "summary" : "summary_large_image"}">
<meta name="theme-color" content="#FBFCFF">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="${META.css}">
<script>try{var t=localStorage.getItem("wk-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<script>(function(c,l,a,r,i,t,y){if(navigator.webdriver||/bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent))return;c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","z8yr2p57ys");</script>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` : ""}
<script type="module" src="${META.reviewJs}"></script>
<script type="module" src="${META.adsJs}"></script>
</head>
<body${data ? ` data-review="${esc(data)}"` : ""}>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap seo">
${siteHeader(active, q)}
<main id="main">
${body}
</main>
<footer><p class="flinks">Wackometer · <a href="/reviews">Song reviews</a> · <a href="/get-reviewed">Get reviewed</a> · <a href="/critics">Become a critic</a> · <a href="/rhymes/">Fresh rhymes</a> · <a href="/cliches/">Cliché fixer</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></p>${DBV}</footer>
</div>
<div class="modal" id="humanModal" hidden role="dialog" aria-labelledby="humanH"><div class="mbox"><div class="mch" id="humanChar"></div><h3 id="humanH">Quick check: are you a human?</h3><p class="tag">Keeps bots out of the votes. You only do this once a month.</p><div id="turnstileBox"></div><span class="hint" id="humanNote"></span></div></div>
</body>
</html>`;
}

// Small half-gauge with the needle on the score (drawn on the server so it shows before any script runs).
function gaugeSVG(score) {
  const cx = 110, cy = 104, r = 84, seg = [];
  for (let i = 0; i < 5; i++) {
    const a0 = Math.PI + ((i * 20 + (i ? 1 : 0)) / 100) * Math.PI, a1 = Math.PI + (((i + 1) * 20 - (i < 4 ? 1 : 0)) / 100) * Math.PI;
    const p = (a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    seg.push(`<path d="M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}" stroke="${TC[i]}" stroke-width="22" fill="none"/>`);
  }
  const na = Math.PI + (Math.max(0, Math.min(100, score)) / 100) * Math.PI;
  return `<svg class="rv-gauge" viewBox="0 0 220 118" aria-hidden="true">${seg.join("")}<line x1="${cx}" y1="${cy}" x2="${(cx + (r - 18) * Math.cos(na)).toFixed(1)}" y2="${(cy + (r - 18) * Math.sin(na)).toFixed(1)}" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="10" fill="currentColor"/></svg>`;
}
// The song breakdown: each part scored 0-100 like the overall (0 = Wicked). The overall is set by the critic, not averaged.
export const PARTS = [["s_lyrics", "Lyrics"], ["s_melody", "Melody & hook"], ["s_vocals", "Vocals & delivery"], ["s_production", "Production"], ["s_replay", "Replay value"]];
function breakdownHTML(r) {
  const rated = PARTS.filter(([k]) => r[k] !== null && r[k] !== undefined);
  if (!rated.length) return "";
  return `<section class="rv-break" aria-labelledby="brkH"><h2 id="brkH">The breakdown</h2><ul>${rated.map(([k, label]) => { const v = r[k], t = tierOf(v);
    return `<li><span class="bk-l">${label}</span><span class="bk-bar" aria-hidden="true"><i style="--w:${Math.max(4, 100 - v)}%;--tc:${TC[t]}"></i></span><span class="bk-v">${pill(t, `${TIERS[t].n} ${v}`)}</span></li>`; }).join("")}</ul>
<p class="hint">Each part is scored from 0 (Wicked) to 100 (Wack). The overall Wackometer score is the critic's call on the whole song, not an average.</p></section>`;
}
const pill = (t, label) => `<span class="rv-pill" style="--tc:${TC[t]};--to:${TEXT_ON[t]}">${esc(label)}</span>`;

function bodyHTML(text) {
  return String(text || "").trim().split(/\n\s*\n/).filter(Boolean).map((para) => {
    if (/^>\s?/.test(para)) return `<blockquote>${esc(para.replace(/^>\s?/gm, "")).replace(/\n/g, "<br>")}</blockquote>`;
    return `<p>${esc(para).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
}

function card(r) {
  const t = tierOf(r.score);
  return `<a class="rv-card" href="/reviews/${esc(r.slug)}">
<span class="rv-cover">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="" loading="lazy" width="300" height="300">` : `<span class="rv-nocover" aria-hidden="true">♪</span>`}${certified(r) ? '<span class="rv-cert">Certified Wicked</span>' : ""}</span>
<span class="rv-meta">${pill(t, `${TIERS[t].n} · ${r.score}`)}<span class="rv-kind">${r.kind === "album" ? "Album" : "Song"}</span></span>
<b class="rv-ct">${esc(r.title)}</b><span class="rv-ca">${esc(r.artist)}</span>
<span class="rv-cv">${esc(r.verdict)}</span></a>`;
}

// Paid submissions: the card form (Stripe Payment Element) sits right in the page; see review.js.
function submitHTML(critics = [], picked = "", more = true) {
  const opts = critics.map((c) => `<option value="${esc(c.slug)}"${c.slug === picked ? " selected" : ""}>${esc(c.name)}${c.tagline ? " · " + esc(c.tagline) : ""}</option>`).join("");
  return `<section class="rv-submit" id="submit" aria-labelledby="subH">
<form id="subForm" class="sub-grid">
<div class="sub-left">
<h2 id="subH">Want your music weighed?</h2>
<p>Send us a song or album. We listen, then email you written feedback on your song within 7 days: lyrics, hook, vocals and production. If we love it, it also gets a public review page, a share card and a badge for your links.</p>
<label>Artist name<input name="artist" required maxlength="80" autocomplete="off"></label>
<label>Link to the song or album<input name="link" type="url" required maxlength="300" placeholder="Spotify, SoundCloud, Apple Music, YouTube…"></label>
<label>Your email <span class="hint">(your feedback goes here)</span><input name="email" type="email" required maxlength="120" autocomplete="email"></label>
${critics.length ? `<label>Who should review it?<select name="critic" id="subCritic"><option value="">Any critic (fastest)</option>${opts}</select></label>` : ""}
<label>Anything we should know? <span class="hint">(optional)</span><textarea name="note" rows="3" maxlength="600"></textarea></label>
${more ? '<a class="sub-more" href="/get-reviewed">What you get and who reviews it →</a>' : ""}
</div>
<div class="paycard" role="group" aria-labelledby="payH">
<div class="pay-top"><h3 id="payH" class="price" aria-label="10 dollars"><span class="cur" aria-hidden="true">$</span><span aria-hidden="true">10</span><span class="spark" aria-hidden="true">✦</span></h3>
<div><p class="per">one song or album · one-time</p>
<ul class="perks"><li>A guaranteed listen</li><li>Written feedback in 7 days</li><li>A shot at Certified Wicked</li></ul></div></div>
<div id="payEl" class="payel"><span class="hint">Loading the card form…</span></div>
<button class="btn bile paybtn" type="submit" id="payBtn">Pay $10 &amp; send it</button>
<span class="hint paynote" id="subNote" role="status">🔒 Secure payment by Stripe. Paying gets you heard, not a better score.</span>
</div>
</form>
<div class="sub-done" id="subDone" hidden tabindex="-1"><b>You're in. 🎧</b><p>Payment received. Your feedback lands in your inbox within 7 days, and Stripe is emailing your receipt now.</p><button class="btn" type="button" id="subAgain">Send another song</button></div>
</section>`;
}

/* ---------- HTML routes ---------- */
export async function reviewsPage(req, env, path, ensureSchema) {
  await ensureSchema(env);
  const critics = await activeCritics(env.DB), SUB = submitHTML();
  const DB = env.DB, url = new URL(req.url);
  if (path === "/reviews") {
    const f = url.searchParams.get("f") || "", q = (url.searchParams.get("q") || "").trim().slice(0, 80);
    let where = f === "wicked" ? " AND score<20" : f === "songs" ? " AND kind='song'" : f === "albums" ? " AND kind='album'" : f === "videos" ? " AND youtube_url IS NOT NULL AND youtube_url<>''" : "";
    const binds = [];
    if (q) { where += " AND (lower(artist) LIKE ? OR lower(title) LIKE ? OR lower(coalesce(genre,'')) LIKE ?)"; const like = "%" + q.toLowerCase().replace(/[%_]/g, "") + "%"; binds.push(like, like, like); }
    const list = (await DB.prepare(`SELECT * FROM reviews WHERE status='live'${where} ORDER BY published_at DESC LIMIT 120`).bind(...binds).all()).results;
    const heads = { wicked: ["Certified Wicked", "The best writing we've reviewed. Every one of these scored under 20 on the Wackometer."], videos: ["Music videos", "Videos for songs we've reviewed. Watch, read the review, then cast your vote."], songs: ["Song reviews", "Single songs, weighed from Wicked to Wack."], albums: ["Album reviews", "Full albums, weighed from Wicked to Wack."] };
    const [h1, lead] = q ? [`Results for “${esc(q)}”`, `${list.length} review${list.length === 1 ? "" : "s"} match. Don't see the artist? Send them our way below.`] : heads[f] || ["Wicked or wack?", "Reviews of new songs and albums, from the lyrics to the hook to the production, scored from Wicked to Wack. Mostly artists you haven't heard of yet. You get a vote too."];
    const chip = (k, label) => `<a class="rchip${f === k ? " on" : ""}" href="/reviews${k ? "?f=" + k : ""}"${f === k ? ' aria-current="page"' : ""}>${label}</a>`;
    const body = `<article class="seoart rv-index">
<p class="eyebrow">Song reviews</p>
<h1>${h1}</h1>
<p class="lead">${lead}</p>
<nav class="rchips" aria-label="Filter reviews">${chip("", "All")}${chip("wicked", "✨ Certified Wicked")}${chip("videos", "🎬 Music videos")}${chip("songs", "Songs")}${chip("albums", "Albums")}</nav>
${list.length ? `<div class="rv-grid">${list.map(card).join("")}</div><div class="ad-slot" hidden></div>` : `<div class="warn"><b>${f || q ? "Nothing here yet." : "The first reviews drop soon."}</b><p>${f || q ? `<a href="/reviews">See all reviews</a>, or send us your music below.` : "Know an artist whose writing deserves more ears? Send them our way below."}</p></div>`}
${SUB}
</article>`;
    const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Wackometer song reviews", url: `${BASE}/reviews`, hasPart: list.slice(0, 30).map((r) => ({ "@type": "Review", url: `${BASE}/reviews/${r.slug}`, name: `${r.artist}: ${r.title}` })) };
    return html(shell({ active: q ? "" : f === "wicked" ? "wicked" : f === "videos" ? "videos" : "reviews", q, noindex: !!q, path: "/reviews" + (f ? "?f=" + f : ""), title: q ? `“${q}” · Wackometer reviews` : f === "videos" ? "Music videos with lyric reviews · Wackometer" : f === "wicked" ? "Certified Wicked songs and albums · Wackometer reviews" : "Song reviews: new music, Wicked to Wack · Wackometer", desc: "Honest reviews of new songs and albums (lyrics, hook, vocals, production) scored from Wicked to Wack, with a crowd score you can vote on. Indie artists first.", body, ld, data: JSON.stringify({ index: true }) }));
  }

  const slug = decodeURIComponent(path.slice("/reviews/".length)).toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return html(notFound(), 404);
  const r = await DB.prepare("SELECT * FROM reviews WHERE slug=?").bind(slug).first();
  if (!r || (r.status !== "live" && url.searchParams.get("preview") !== "1")) return html(notFound(), 404, "no-store");
  const draft = r.status !== "live";
  const crowd = await crowdOf(DB, slug);
  const t = tierOf(r.score);
  const sp = spotifyEmbed(r.spotify_url), yt = youtubeId(r.youtube_url);
  const more = (await DB.prepare("SELECT * FROM reviews WHERE status='live' AND slug<>? ORDER BY published_at DESC LIMIT 3").bind(slug).all()).results;
  const ig = igHandle(r.artist_ig), artistUrl = safeUrl(r.artist_url) || (ig ? `https://instagram.com/${ig}` : "");
  const listen = [["Spotify", safeUrl(r.spotify_url)], ["Apple Music", safeUrl(r.apple_url)], ["YouTube", safeUrl(r.youtube_url)]].filter(([, u]) => u);
  const date = new Date(r.published_at || r.updated_at);
  const standouts = String(r.standouts || "").split(",").map((s) => s.trim()).filter(Boolean);
  const crowdLabel = crowd.n ? `${TIERS[crowd.tier].n} · ${crowd.avg}` : "No votes yet";
  const body = `${draft ? '<div class="warn"><b>Draft preview.</b><p>Only people with this link can see it. Publish it from <a href="/admin-reviews">the editor</a>.</p></div>' : ""}
<article class="rv" data-slug="${esc(slug)}">
<p class="eyebrow"><a href="/reviews">Song reviews</a> · ${r.kind === "album" ? "Album" : "Song"}${r.genre ? " · " + esc(r.genre) : ""}</p>
<div class="rv-hero">
<div class="rv-art">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="Cover art for ${esc(r.title)} by ${esc(r.artist)}" width="640" height="640">` : `<span class="rv-nocover" aria-hidden="true">♪</span>`}${certified(r) ? '<span class="rv-cert big">Certified Wicked</span>' : ""}</div>
<div class="rv-head">
<h1>${esc(r.title)}</h1>
<p class="rv-by">by <a href="/artists/${esc(slugify(r.artist))}">${esc(r.artist)}</a>${artistUrl ? ` · <a class="rv-ext" href="${esc(artistUrl)}" target="_blank" rel="noopener">${ig ? "@" + esc(ig) : "Website"} ↗</a>` : ""}${r.released ? ` · ${esc(r.released)}` : ""}</p>
<div class="rv-scores">
<div class="rv-score"><span class="rv-sl">Wackometer</span>${gaugeSVG(r.score)}<span class="rv-num">${r.score}</span>${pill(t, tierName(r))}<span class="rv-char" data-tier="${t}" aria-hidden="true"></span></div>
<div class="rv-score rv-crowd" id="crowdBox"><span class="rv-sl">The crowd</span><span class="rv-cn" id="crowdTier">${crowd.n ? pill(crowd.tier, crowdLabel) : `<span class="hint">${crowdLabel}</span>`}</span><span class="hint" id="crowdN">${crowd.n ? `${crowd.n} vote${crowd.n === 1 ? "" : "s"}` : "Be the first"}</span>
<div class="rv-dist" id="crowdDist" aria-hidden="true">${crowd.dist.map((c, i) => `<i style="--tc:${TC[i]};--h:${crowd.n ? Math.round((c / crowd.n) * 100) : 0}%"></i>`).join("")}</div></div>
</div>
<p class="rv-verdict">“${esc(r.verdict)}”</p>
</div>
</div>
${breakdownHTML(r)}
<section class="rv-vote" aria-labelledby="voteH"><h2 id="voteH">Your call: how's the song?</h2>
<div class="rv-tiers" role="group" aria-label="Vote on the song">${TIERS.map((T, i) => `<button type="button" class="rv-t" data-t="${i}" style="--tc:${TC[i]};--to:${TEXT_ON[i]}" aria-pressed="false">${esc(T.n)}</button>`).join("")}</div>
<span class="hint" id="voteNote" role="status"></span></section>
${sp ? `<div class="rv-listen"><iframe title="Listen to ${esc(r.title)} on Spotify" src="${esc(sp.src)}" width="100%" height="${sp.type === "track" ? 152 : 352}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style="border:0;border-radius:14px"></iframe></div>` : ""}
${yt ? `<div class="rv-listen yt" id="watch"><iframe title="Watch ${esc(r.title)} on YouTube" src="https://www.youtube-nocookie.com/embed/${yt}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" style="border:0"></iframe></div>` : ""}
${listen.length ? `<p class="rv-links">Listen on ${listen.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join(" · ")}</p>` : ""}
<div class="rv-body">
${bodyHTML(r.body)}
${r.best_line ? `<figure class="rv-best"><figcaption>⭐ Best line</figcaption><blockquote>${esc(r.best_line)}</blockquote></figure>` : ""}
${standouts.length ? `<h2>Standout tracks</h2><ul class="rv-stand">${standouts.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
${r.submitted ? '<p class="hint rv-paid">💵 The artist sent this in through paid submissions. Paying gets a listen, not a better score.</p>' : ""}
<p class="hint rv-sig">Reviewed by ${(() => { const c = critics.find((x) => x.name.toLowerCase() === String(r.reviewer || "").trim().toLowerCase()); return c ? `<a href="/critics/${esc(c.slug)}">${esc(c.name)}</a>` : esc(r.reviewer || "Wackometer"); })()} · <time datetime="${date.toISOString().slice(0, 10)}">${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</time></p>
</div>
<div class="ad-slot" hidden></div>
<section class="rv-share" aria-labelledby="shareH"><h2 id="shareH">Pass it on</h2>
<div class="row"><button class="btn bile" type="button" id="rvShare">Share this review</button><button class="btn" type="button" id="rvCard">Save story card</button></div>
<span class="hint" id="shareNote" role="status"></span>
<details class="rv-badge"><summary>Are you ${esc(r.artist)}? Get your badge</summary>
<p>Put this on your website or link-in-bio page. It links back to this review.</p>
<img src="/badge/${esc(slug)}.svg" alt="${esc(tierName(r))} on Wackometer" width="240" height="64">
<textarea id="badgeCode" rows="3" readonly aria-label="Badge embed code">&lt;a href="${BASE}/reviews/${esc(slug)}"&gt;&lt;img src="${BASE}/badge/${esc(slug)}.svg" alt="${esc(tierName(r))} on Wackometer" width="240" height="64"&gt;&lt;/a&gt;</textarea>
<button class="btn" type="button" id="badgeCopy">Copy the code</button></details>
</section>
${more.length ? `<section class="rv-more" aria-labelledby="moreH"><h2 id="moreH">More reviews</h2><div class="rv-grid">${more.map(card).join("")}</div><p><a href="/reviews">All reviews →</a></p></section>` : ""}
<div class="ad-slot" hidden></div>
<div class="cta"><b>Now weigh your own.</b><p>Paste a verse into the Wackometer. It scores it from Wicked to Wack, circles the clichés and lazy rhymes, and shows you how to fix them.</p><a class="btn bile" href="/write#weigh">Weigh my lyrics, free</a></div>
${SUB}
</article>`;
  const item = { "@type": r.kind === "album" ? "MusicAlbum" : "MusicRecording", name: r.title, byArtist: { "@type": "MusicGroup", name: r.artist, ...(artistUrl ? { url: artistUrl } : {}) }, ...(r.cover_url ? { image: r.cover_url } : {}), ...(r.genre ? { genre: r.genre } : {}) };
  if (crowd.n >= 5) item.aggregateRating = { "@type": "AggregateRating", ratingValue: 100 - crowd.avg, bestRating: 100, worstRating: 0, ratingCount: crowd.n };
  const ld = [{ "@context": "https://schema.org", "@type": "Review", name: `${r.title} by ${r.artist}: review`, reviewBody: r.verdict, datePublished: date.toISOString().slice(0, 10), author: { "@type": "Organization", name: "Wackometer", url: BASE }, publisher: { "@type": "Organization", name: "Wackometer", url: BASE },
      reviewRating: { "@type": "Rating", ratingValue: 100 - r.score, bestRating: 100, worstRating: 0, ratingExplanation: `${tierName(r)} on the Wackometer (${r.score}/100, lower is better)` }, itemReviewed: item },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Song reviews", item: `${BASE}/reviews` }, { "@type": "ListItem", position: 2, name: `${r.artist}: ${r.title}`, item: `${BASE}/reviews/${slug}` }] }];
  const title = `${r.title} by ${r.artist} review: ${tierName(r)} · Wackometer`;
  const desc = `${tierName(r)} (${r.score}/100). ${r.verdict} Read the review of ${r.artist}'s ${r.kind === "album" ? "album" : "song"} “${r.title}” and cast your vote.`.slice(0, 300);
  return html(shell({ active: "reviews", path: `/reviews/${slug}`, title, desc, image: r.cover_url || "", body, ld: draft ? null : ld, noindex: draft, data: JSON.stringify({ slug, artist: r.artist, title: r.title, kind: r.kind, score: r.score, tier: t, cert: certified(r), verdict: r.verdict, cover: !!r.cover_url, ig }) }), 200, draft ? "no-store" : "no-cache");
}

/* ---------- front page (/) ---------- */
const OLD_TOOL_HASH = "weigh|wingman|community|workshop|storm|why|pro|me|plugin|wash|daily|wall|squad|pen|train|home";
function crowdMap(rows) {
  const m = {};
  for (const v of rows) { const c = (m[v.slug] = m[v.slug] || { dist: [0, 0, 0, 0, 0] }); c.dist[v.tier] = v.c; }
  for (const c of Object.values(m)) { c.n = c.dist.reduce((a, b) => a + b, 0); c.avg = Math.round(c.dist.reduce((a, x, i) => a + x * MID[i], 0) / c.n); c.tier = tierOf(c.avg); }
  return m;
}
const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
function rowCard(r, crowd) {
  const t = tierOf(r.score), c = crowd[r.slug];
  return `<a class="rcard" href="/reviews/${esc(r.slug)}">
<span class="rv-cover">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="" loading="lazy" width="300" height="300">` : `<span class="rv-nocover" aria-hidden="true">♪</span>`}${certified(r) ? '<span class="rv-cert">Certified Wicked</span>' : ""}</span>
<span class="rsc"><span class="rsw" title="Wackometer score">${pill(t, `${TIERS[t].n} ${r.score}`)}</span><span class="rsc-c" title="Crowd score">👥 ${c ? esc(TIERS[c.tier].n) : "No votes"}</span></span>
<b class="rv-ct">${esc(r.title)}</b><span class="rv-ca">${esc(r.artist)}</span></a>`;
}
function videoCard(r) {
  const t = tierOf(r.score), id = youtubeId(r.youtube_url);
  return `<a class="vcard" href="/reviews/${esc(r.slug)}#watch">
<span class="vthumb"><img src="${ytThumb(id)}" alt="" loading="lazy" width="480" height="360"><span class="vplay" aria-hidden="true">▶</span>${pill(t, `${TIERS[t].n} ${r.score}`)}</span>
<b class="rv-ct">${esc(r.title)}</b><span class="rv-ca">${esc(r.artist)}</span></a>`;
}
const row = (id, title, more, inner, cls = "") => `<section class="frow${cls}" aria-labelledby="${id}"><div class="frh"><h2 id="${id}">${title}</h2>${more ? `<a href="${more}">See all <span aria-hidden="true">→</span></a>` : ""}</div><div class="fscroll" tabindex="0">${inner}</div></section>`;

export async function frontPage(req, env, ensureSchema) {
  await ensureSchema(env);
  const SUB = submitHTML();
  const DB = env.DB;
  const all = (await DB.prepare("SELECT * FROM reviews WHERE status='live' ORDER BY published_at DESC LIMIT 200").all()).results;
  const crowd = crowdMap((await DB.prepare("SELECT v.slug, v.tier, COUNT(*) c FROM review_votes v JOIN reviews r ON r.slug=v.slug AND r.status='live' GROUP BY v.slug, v.tier").all()).results);
  const artists = await artistTable(DB);
  const feat = all.filter((r) => r.featured);
  const hero = (feat.length ? feat : all).slice(0, 3);
  const wicked = all.filter(certified).slice(0, 12), videos = all.filter((r) => youtubeId(r.youtube_url)).slice(0, 12);
  const split = all.filter((r) => crowd[r.slug] && crowd[r.slug].n >= 3).map((r) => ({ r, c: crowd[r.slug], d: Math.abs(crowd[r.slug].avg - r.score) })).filter((x) => x.d >= 15).sort((a, b) => b.d - a.d).slice(0, 6);
  const slide = (r, i) => {
    const t = tierOf(r.score), c = crowd[r.slug];
    return `<article class="fslide" id="fs${i}" aria-roledescription="slide" aria-label="${i + 1} of ${hero.length}"${r.cover_url ? ` style="--bg:url('${esc(r.cover_url)}')"` : ""}>
<a class="fcover" href="/reviews/${esc(r.slug)}" tabindex="-1" aria-hidden="true">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="" width="640" height="640"${i ? ' loading="lazy"' : ""}>` : `<span class="rv-nocover">♪</span>`}${certified(r) ? '<span class="rv-cert big">Certified Wicked</span>' : ""}</a>
<div class="ftext"><p class="eyebrow">${feat.length ? "Featured review" : "New review"} · ${r.kind === "album" ? "Album" : "Song"}${r.genre ? " · " + esc(r.genre) : ""}</p>
<h2><a href="/reviews/${esc(r.slug)}">${esc(r.title)}</a></h2><p class="fby">by ${esc(r.artist)}</p>
<div class="fscores"><span class="fsc"><span class="rv-sl">Wackometer</span><span class="fnum">${r.score}</span>${pill(t, tierName(r))}</span><span class="fsc"><span class="rv-sl">The crowd</span>${c ? `<span class="fnum">${c.avg}</span>${pill(c.tier, TIERS[c.tier].n)}` : `<span class="hint">No votes yet.<br>Be the first.</span>`}</span></div>
<p class="fverdict">“${esc(r.verdict)}”</p>
<a class="btn bile" href="/reviews/${esc(r.slug)}">Read the review</a></div></article>`;
  };
  const body = `<div class="front">
<div class="fintro"><h1>Wicked or <em>wack</em>?</h1><p>Reviews of new music, from the lyrics to the hook to the production, scored from Wicked to Wack. We weigh in, then you do.</p></div>
${hero.length ? `<section class="fhero" aria-roledescription="carousel" aria-label="Featured reviews"><div class="fslides" id="fSlides">${hero.map(slide).join("")}</div>${hero.length > 1 ? `<div class="fdots" role="group" aria-label="Choose a featured review">${hero.map((r, i) => `<button type="button" data-i="${i}" aria-label="Show ${esc(r.title)}"${i ? "" : ' aria-current="true"'}></button>`).join("")}</div>` : ""}</section>`
      : `<section class="fempty"><b>The first reviews drop soon.</b><p>Know an artist whose writing deserves more ears? <a href="#submit">Send them our way</a>.</p></section>`}
${all.length ? row("rNew", "Latest reviews", "/reviews", all.slice(0, 12).map((r) => rowCard(r, crowd)).join("")) : ""}
<div class="ad-slot" hidden></div>
<section class="fpromo" aria-label="More from Wackometer">
<a class="fp fp-weigh" href="/write#weigh" data-hub="write"><span class="fp-char" data-tier="4" aria-hidden="true"></span><span class="hey">✍️ For writers · Free</span><b>How wack are <em>your</em> lyrics?</b><span>Paste a verse and the Wackometer scores it in a second, circles the clichés, then helps you fix them with Wingman, the Workshop and Wordstorm.</span><span class="fpgo">Weigh my lyrics <span aria-hidden="true">→</span></span></a>
<a class="fp fp-plug" href="/write#plugin" data-hub="plugin"><span class="fp-char" data-tier="3" aria-hidden="true"></span><span class="hey">🎛️ In the studio <span class="hsoon">Coming soon</span></span><b>Wingman plugin</b><span>The Wackometer inside FL Studio, Ableton and Logic. Weigh lines and get rewrites without leaving your session.</span><span class="fpgo">Get early access <span aria-hidden="true">→</span></span></a>
</section>
${wicked.length ? row("rWicked", "✨ Certified Wicked", "/reviews?f=wicked", wicked.map((r) => rowCard(r, crowd)).join("")) : ""}
${artists.length ? `<section class="flb" aria-labelledby="rLb"><div class="frh"><h2 id="rLb">🏆 Top artists</h2><a href="/artists">Full leaderboard <span aria-hidden="true">→</span></a></div><p class="hint">Each artist's score is the average of every song we've weighed. Lower is better.</p><ol class="lb-list">${leaderRows(artists.slice(0, 5))}</ol></section>` : ""}
<div class="ad-slot" hidden></div>
${videos.length ? row("rVid", "🎬 Music videos", "/reviews?f=videos", videos.map(videoCard).join(""), " fvids") : ""}
${split.length ? `<section class="fsplit" aria-labelledby="rSplit"><div class="frh"><h2 id="rSplit">⚔️ Critics vs. the crowd</h2></div><p class="hint">Where the voters and the Wackometer don't agree. Pick a side.</p><ol>${split.map(({ r, c }) => `<li><a href="/reviews/${esc(r.slug)}"><b>${esc(r.title)}</b> <span class="rv-ca">${esc(r.artist)}</span></a><span class="fvs">We said ${pill(tierOf(r.score), `${TIERS[tierOf(r.score)].n} ${r.score}`)} Crowd said ${pill(c.tier, `${TIERS[c.tier].n} ${c.avg}`)}</span></li>`).join("")}</ol></section>` : ""}
${SUB}
</div>`;
  const ld = [{ "@context": "https://schema.org", "@type": "WebSite", name: "Wackometer", url: BASE + "/", potentialAction: { "@type": "SearchAction", target: `${BASE}/reviews?q={search_term_string}`, "query-input": "required name=search_term_string" } },
    { "@context": "https://schema.org", "@type": "Organization", name: "Wackometer", url: BASE + "/", logo: BASE + "/favicon.svg" }];
  // Old links to the tools (wackometer.com/#weigh etc.) go to their new home before anything renders.
  const head = `<script>if(/^#(${OLD_TOOL_HASH})$/.test(location.hash)||/[?&](paid|signin|unsubscribed|deleted)=/.test(location.search))location.replace("/write"+location.search+location.hash)</script>`;
  return html(shell({ path: "/", title: "Wackometer · Song reviews of new music, from Wicked to Wack", desc: "Honest reviews of new songs, albums and music videos (lyrics, hook, vocals, production) scored from Wicked to Wack, with a crowd score you vote on. Plus free tools to weigh your own lyrics.", image: "", body, ld, head, data: JSON.stringify({ front: true }) }), 200, "no-cache");
}

/* ---------- artists: leaderboard (/artists) and one page per artist (/artists/<slug>) ---------- */
// Every live review counts toward its artist. The artist's score is the plain average of their songs' scores,
// so lower is better: 0 is as Wicked as it gets, 100 is all-out Wack.
export async function artistTable(DB) {
  const rows = (await DB.prepare("SELECT slug,artist,title,score,cover_url,artist_ig,artist_url,published_at FROM reviews WHERE status='live' ORDER BY published_at DESC LIMIT 5000").all()).results;
  const by = new Map();
  for (const r of rows) {
    const key = slugify(r.artist); if (!key) continue;
    const a = by.get(key) || { slug: key, name: r.artist, songs: [], ig: "", url: "" };
    a.songs.push(r); if (!a.ig && r.artist_ig) a.ig = r.artist_ig; if (!a.url && r.artist_url) a.url = r.artist_url;
    by.set(key, a);
  }
  const list = [...by.values()].map((a) => {
    const sum = a.songs.reduce((s, r) => s + r.score, 0);
    const best = a.songs.reduce((b, r) => (r.score < b.score ? r : b), a.songs[0]);
    return { ...a, n: a.songs.length, avg: Math.round(sum / a.songs.length), exact: sum / a.songs.length, best, cover: (a.songs.find((r) => r.cover_url) || {}).cover_url || "" };
  });
  list.sort((x, y) => x.exact - y.exact || y.n - x.n || x.name.localeCompare(y.name));
  list.forEach((a, i) => (a.rank = i > 0 && list[i - 1].exact === a.exact && list[i - 1].n === a.n ? list[i - 1].rank : i + 1));
  return list;
}
const medal = (rank) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`);
export function leaderRows(list) {
  return list.map((a) => { const t = tierOf(a.avg); return `<li class="lb-row${a.rank <= 3 ? " top" : ""}"><span class="lb-rank">${medal(a.rank)}</span>
<a class="lb-art" href="/artists/${esc(a.slug)}" tabindex="-1" aria-hidden="true">${a.cover ? `<img src="${esc(a.cover)}" alt="" width="56" height="56" loading="lazy">` : "<i>♪</i>"}</a>
<span class="lb-who"><a href="/artists/${esc(a.slug)}"><b>${esc(a.name)}</b></a><span class="hint">${a.n} song${a.n === 1 ? "" : "s"} weighed · best: <a href="/reviews/${esc(a.best.slug)}">${esc(a.best.title)}</a> (${a.best.score})</span></span>
<span class="lb-score"><span class="lb-num">${a.avg}</span>${pill(t, t === 0 ? "Wicked" : TIERS[t].n)}</span></li>`; }).join("");
}

export async function artistsPage(req, env, path, ensureSchema) {
  await ensureSchema(env);
  const SUB = submitHTML();
  const list = await artistTable(env.DB);
  if (path === "/artists") {
    const body = `<article class="seoart lb">
<p class="eyebrow">Artist leaderboard</p>
<h1>Who makes the best songs?</h1>
<p class="lead">Every song we weigh counts toward its artist. Their score is the average of all their songs, so <b>lower is better</b>: 0 is as Wicked as it gets, 100 is all-out Wack.</p>
${list.length ? `<ol class="lb-list">${leaderRows(list)}</ol>` : `<div class="warn"><b>The leaderboard fills up as reviews go live.</b><p><a href="/reviews">Read the reviews</a> so far.</p></div>`}
<div class="ad-slot" hidden></div>
<p class="hint">Artists with one song weighed can move a lot. The more songs we review, the steadier their spot.</p>
${SUB}
</article>`;
    const ld = { "@context": "https://schema.org", "@type": "ItemList", name: "Wackometer artist leaderboard", itemListOrder: "https://schema.org/ItemListOrderAscending", numberOfItems: list.length, itemListElement: list.slice(0, 100).map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${BASE}/artists/${a.slug}`, name: a.name })) };
    return html(shell({ active: "artists", path: "/artists", title: "Artist leaderboard: who makes the best songs? · Wackometer", desc: "Artists ranked by the average Wackometer score of their reviewed songs, from Wicked to Wack. Lower is better.", body, ld }));
  }
  const slug = decodeURIComponent(path.slice("/artists/".length)).toLowerCase();
  const a = list.find((x) => x.slug === slug);
  if (!a) return html(shell({ path, title: "Artist not found · Wackometer", desc: "We haven't reviewed this artist yet.", noindex: true, active: "artists", body: `<article class="seoart"><h1>We haven't weighed this artist yet.</h1><p class="lead"><a href="/artists">See the leaderboard</a>, or send us their music below.</p>${SUB}</article>` }), 404, "no-store");
  const t = tierOf(a.avg), ig = igHandle(a.ig), ext = safeUrl(a.url) || (ig ? `https://instagram.com/${ig}` : "");
  const body = `<article class="rv artist">
<p class="eyebrow"><a href="/artists">Artist leaderboard</a> · ${medal(a.rank)} of ${list.length}</p>
<div class="ar-head">
<div class="ar-art">${a.cover ? `<img src="${esc(a.cover)}" alt="" width="320" height="320">` : `<span class="rv-nocover" aria-hidden="true">♪</span>`}</div>
<div class="rv-head"><h1>${esc(a.name)}</h1>
<p class="rv-by">${a.n} song${a.n === 1 ? "" : "s"} weighed${ext ? ` · <a href="${esc(ext)}" target="_blank" rel="noopener">${ig ? "@" + esc(ig) : "Website"} ↗</a>` : ""}</p>
<div class="rv-scores one"><div class="rv-score"><span class="rv-sl">Average score</span>${gaugeSVG(a.avg)}<span class="rv-num">${a.avg}</span>${pill(t, t === 0 ? "Wicked" : TIERS[t].n)}<span class="rv-char" data-tier="${t}" aria-hidden="true"></span></div></div>
<p class="hint">Ranked ${a.rank === 1 ? "first" : "#" + a.rank} of ${list.length} artists we've reviewed. Lower is better.</p></div></div>
<section class="rv-more" aria-labelledby="arH"><h2 id="arH">Every song we've weighed</h2><div class="rv-grid">${a.songs.map(card).join("")}</div></section>
<div class="ad-slot" hidden></div>
<p><a href="/artists">See the full leaderboard →</a></p>
</article>`;
  const ld = { "@context": "https://schema.org", "@type": "MusicGroup", name: a.name, url: `${BASE}/artists/${a.slug}`, ...(ext ? { sameAs: [ext] } : {}), ...(a.cover ? { image: a.cover } : {}) };
  return html(shell({ active: "artists", path: `/artists/${a.slug}`, title: `${a.name}: song reviews and score (${t === 0 ? "Wicked" : TIERS[t].n}, ${a.avg}/100) · Wackometer`, desc: `${a.name} averages ${a.avg}/100 on the Wackometer across ${a.n} reviewed song${a.n === 1 ? "" : "s"}, #${a.rank} on the artist leaderboard. Read every review.`, image: a.cover, body, ld, data: JSON.stringify({ artist: a.slug }) }));
}

/* ---------- critics (/critics, /critics/<slug>) and the Get reviewed page (/get-reviewed) ---------- */
export async function activeCritics(DB) {
  try { return (await DB.prepare("SELECT * FROM critics WHERE active=1 ORDER BY sort, name").all()).results; } catch (e) { return []; }
}
const criticPhoto = (c, size = 120) => c.photo_url && safeUrl(c.photo_url) ? `<img src="${esc(c.photo_url)}" alt="" width="${size}" height="${size}" loading="lazy">` : `<span class="cr-initial" aria-hidden="true">${esc((c.name || "?").trim()[0] || "?")}</span>`;
const genreChips = (g) => String(g || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5).map((x) => `<span class="cr-genre">${esc(x)}</span>`).join("");
async function criticCounts(DB) {
  const rows = (await DB.prepare("SELECT lower(trim(reviewer)) k, COUNT(*) n FROM reviews WHERE status='live' AND reviewer IS NOT NULL GROUP BY k").all()).results;
  return Object.fromEntries(rows.map((r) => [r.k, r.n]));
}
function criticCard(c, n, pick) {
  return `<article class="cr-card">
<a class="cr-photo" href="/critics/${esc(c.slug)}" tabindex="-1" aria-hidden="true">${criticPhoto(c)}</a>
<div class="cr-text"><h3><a href="/critics/${esc(c.slug)}">${esc(c.name)}</a></h3>${c.tagline ? `<p class="cr-tag">${esc(c.tagline)}</p>` : ""}
<div class="cr-genres">${genreChips(c.genres)}</div>
<p class="hint">${n ? `${n} review${n === 1 ? "" : "s"} on Wackometer` : "New critic"}</p></div>
${pick ? `<a class="btn bile cr-pick" href="/get-reviewed?critic=${esc(c.slug)}#submit" data-critic="${esc(c.slug)}">Get reviewed by ${esc(c.name.split(" ")[0])}</a>` : ""}
</article>`;
}

const APPLY = `<section class="rv-submit apply" id="apply" aria-labelledby="applyH">
<form id="applyForm" class="sub-grid">
<div class="sub-left">
<h2 id="applyH">Review for Wackometer</h2>
<p>Write songs, rap, produce, or just have ears people trust? Apply to be a Wackometer critic. Critics review songs that come in, write honest feedback, and get credit on every review they write.</p>
<label>Your name<input name="name" required maxlength="80" autocomplete="name"></label>
<label>Your email<input name="email" type="email" required maxlength="120" autocomplete="email"></label>
<label>Where can we hear or read your stuff? <span class="hint">(Instagram, SoundCloud, Spotify, a site)</span><input name="link" maxlength="300" placeholder="@handle or a link"></label>
</div>
<div class="sub-left">
<label>Genres you know best<input name="genres" maxlength="200" placeholder="indie, R&amp;B, drill, emo, country…"></label>
<label>Why you? <span class="hint">(a few lines on your taste)</span><textarea name="why" rows="5" required maxlength="1500"></textarea></label>
<div class="row"><button class="btn bile" type="submit">Apply to review</button><span class="hint" id="applyNote" role="status"></span></div>
</div>
</form></section>`;

export async function getReviewedPage(req, env, ensureSchema) {
  await ensureSchema(env);
  const DB = env.DB, url = new URL(req.url), critics = await activeCritics(DB), counts = await criticCounts(DB);
  const picked = critics.some((c) => c.slug === url.searchParams.get("critic")) ? url.searchParams.get("critic") : "";
  const perks = [
    ["🎧", "A guaranteed listen", "A real person plays your song start to finish: the words, the hook, the vocals, the mix. No bots, no skimming."],
    ["✍️", "Written feedback in 7 days", "What lands, what's wack and what to fix in your lyrics, hook, vocals and production, straight to your inbox."],
    ["📄", "Your own review page", "If the song makes the cut, it gets a permanent page with both scores, your player and your links, built to show up on Google."],
    ["🏆", "A spot on the leaderboard", "Every reviewed song counts toward your artist page and your rank on the Top artists board."],
    ["✨", "A badge and a story card", "Certified Wicked? Get a badge for your website and link-in-bio and a ready-made card for your story."],
    ["👥", "A crowd score", "Listeners vote on your song too, so you see how the critic and the crowd compare."],
  ];
  const body = `<article class="seoart gr">
<div class="gr-hero">
<p class="eyebrow">Get reviewed</p>
<h1>Get your song weighed by people who <em>make</em> music.</h1>
<p class="lead">Every song is reviewed by a Wackometer critic: songwriters, rappers and producers who hear everything. <b>$10</b> gets you a guaranteed listen and real feedback on your song.</p>
<div class="row"><a class="btn bile" href="#submit">Send my song, $10</a><a class="btn" href="#apply">Review for us</a></div>
</div>
<section aria-labelledby="perksH"><h2 id="perksH">What you get</h2>
<div class="gr-perks">${perks.map(([i, t, d], k) => `<div class="gr-perk${k > 1 ? " maybe" : ""}"><span class="gr-i" aria-hidden="true">${i}</span><b>${t}</b><p>${d}</p></div>`).join("")}</div>
<p class="hint">The first two come with every submission. The rest happen when the song earns them. Paying gets you heard, not a better score.</p></section>
<section aria-labelledby="critH"><h2 id="critH">Who reviews it</h2>
<div class="gr-who"><span class="gr-i" aria-hidden="true">🎧</span><p>A <b>Wackometer critic</b>: a songwriter, rapper or producer whose taste we trust. They play your song start to finish and score it from Wicked to Wack, with a breakdown for the lyrics, hook, vocals, production and replay value. Their name goes on any review they publish.</p></div></section>
<section aria-labelledby="howH"><h2 id="howH">How it works</h2>
<ol class="gr-steps"><li><b>Send it.</b> Your link and your email. Add a note if there's something we should know.</li><li><b>Pay $10.</b> Right here on the page: card, Apple Pay or Google Pay.</li><li><b>They listen.</b> Your critic scores the song from Wicked to Wack, with a breakdown for each part.</li><li><b>Feedback lands.</b> Within 7 days. If it's Wicked, your review page goes live and you get your badge.</li></ol></section>
${submitHTML([], "", false)}
<section aria-labelledby="faqH" class="gr-faq"><h2 id="faqH">Questions</h2>
<details><summary>Does paying get me a better score?</summary><p>No. Paying gets you a guaranteed listen and written feedback. Scores are the critic's honest take, and reviews that came in through paid submissions say so on the page.</p></details>
<details><summary>What if my song doesn't get a review page?</summary><p>You still get written feedback on your song within 7 days. Public pages are for songs the critic loves, which is what makes the badge worth having.</p></details>
<details><summary>Who are the critics?</summary><p>Songwriters, rappers and producers we trust to be honest and specific. Want in? <a href="#apply">Apply below</a>.</p></details>
<details><summary>What kind of music?</summary><p>Any genre. Songs, EPs and albums are all welcome, and instrumentals too (they just skip the lyrics score). For an album, tell us your favorite tracks in the notes.</p></details>
<details><summary>Something else?</summary><p>Email <a href="mailto:hello@wackometer.com">hello@wackometer.com</a>.</p></details>
</section>
${APPLY}
</article>`;
  const ld = { "@context": "https://schema.org", "@type": "Service", name: "Get your song reviewed", provider: { "@type": "Organization", name: "Wackometer", url: BASE }, url: `${BASE}/get-reviewed`, description: "A guaranteed listen and written feedback on your song within 7 days from a Wackometer critic.", offers: { "@type": "Offer", price: "10.00", priceCurrency: "USD" } };
  return html(shell({ active: "submit", path: "/get-reviewed", title: "Get your song reviewed · $10 · Wackometer", desc: "Reviewed by songwriters, rappers and producers. $10 gets your song a guaranteed listen and written feedback within 7 days, plus a shot at a review page, the leaderboard and a Certified Wicked badge.", body, ld, data: JSON.stringify({ getReviewed: true }) }));
}

export async function criticsPage(req, env, path, ensureSchema) {
  await ensureSchema(env);
  const DB = env.DB, critics = await activeCritics(DB), counts = await criticCounts(DB);
  if (path === "/critics") {
    const body = `<article class="seoart gr"><div class="gr-hero"><p class="eyebrow">Critics</p><h1>Become a Wackometer <em>critic</em>.</h1>
<p class="lead">Every review on Wackometer is written by a real person who makes or lives for music. If that's you, review songs from new artists, write honest feedback, and get your name on every review you publish.</p></div>
${APPLY}</article>`;
    return html(shell({ active: "submit", path: "/critics", title: "Become a Wackometer critic: review new songs", desc: "Songwriter, rapper or producer with ears people trust? Apply to review songs from new artists on Wackometer and get credit on every review.", body, data: JSON.stringify({ apply: true }) }));
  }
  const slug = decodeURIComponent(path.slice("/critics/".length)).toLowerCase();
  const c = critics.find((x) => x.slug === slug);
  if (!c) return html(shell({ path, title: "Critic not found · Wackometer", desc: "That critic isn't here.", noindex: true, body: `<article class="seoart"><h1>That critic isn't here.</h1><p class="lead"><a href="/critics">See all critics</a>.</p></article>` }), 404, "no-store");
  const reviews = (await DB.prepare("SELECT * FROM reviews WHERE status='live' AND lower(trim(reviewer))=? ORDER BY published_at DESC LIMIT 200").bind(c.name.trim().toLowerCase()).all()).results;
  const ig = igHandle(c.ig), link = safeUrl(c.link);
  const avg = reviews.length ? Math.round(reviews.reduce((a, r) => a + r.score, 0) / reviews.length) : null;
  const body = `<article class="rv critic">
<p class="eyebrow"><a href="/critics">Critics</a></p>
<div class="cr-head"><div class="cr-big">${criticPhoto(c, 240)}</div>
<div class="rv-head"><h1>${esc(c.name)}</h1>${c.tagline ? `<p class="rv-by">${esc(c.tagline)}</p>` : ""}
<div class="cr-genres">${genreChips(c.genres)}</div>
${c.bio ? bodyHTML(c.bio) : ""}
<p class="hint">${reviews.length} review${reviews.length === 1 ? "" : "s"}${avg !== null ? ` · gives an average of ${avg} (${TIERS[tierOf(avg)].n})` : ""}${ig ? ` · <a href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener">@${esc(ig)} ↗</a>` : ""}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">Website ↗</a>` : ""}</p>
<a class="btn bile" href="/get-reviewed">Get your music reviewed, $10</a></div></div>
${reviews.length ? `<section class="rv-more" aria-labelledby="crRevH"><h2 id="crRevH">Reviews by ${esc(c.name)}</h2><div class="rv-grid">${reviews.map(card).join("")}</div></section>` : ""}
</article>`;
  const ld = { "@context": "https://schema.org", "@type": "Person", name: c.name, url: `${BASE}/critics/${c.slug}`, ...(c.tagline ? { jobTitle: c.tagline } : {}), ...(ig || link ? { sameAs: [link, ig ? `https://instagram.com/${ig}` : ""].filter(Boolean) } : {}) };
  return html(shell({ active: "submit", path: `/critics/${c.slug}`, title: `${c.name}: song reviews · Wackometer critic`, desc: `${c.name}${c.tagline ? `, ${c.tagline},` : ""} reviews songs on Wackometer. Read their reviews.`, image: safeUrl(c.photo_url), body, ld }));
}

function notFound() {
  return shell({ path: "/reviews", title: "Review not found · Wackometer", desc: "That review isn't here.", noindex: true, body: `<article class="seoart"><h1>That review isn't here.</h1><p class="lead">It may have moved or never existed. <a href="/reviews">See all song reviews</a>.</p></article>` });
}

/* ---------- badge ---------- */
export async function badgeSVG(env, slug, ensureSchema) {
  await ensureSchema(env);
  const r = /^[a-z0-9-]{1,80}$/.test(slug) ? await env.DB.prepare("SELECT score FROM reviews WHERE slug=? AND status='live'").bind(slug).first() : null;
  const headers = { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600", "access-control-allow-origin": "*", "x-content-type-options": "nosniff" };
  if (!r) return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64"/>`, { status: 404, headers });
  const t = tierOf(r.score), cert = t === 0;
  const top = cert ? "CERTIFIED" : "RATED", word = TIERS[t].n.toUpperCase();
  const F = "font-family='Fredoka,Avenir Next,Segoe UI,Helvetica,Arial,sans-serif' font-weight='700'";
  return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64" role="img" aria-label="${top === "CERTIFIED" ? "Certified Wicked" : word} on Wackometer">
<rect x="1.5" y="1.5" width="237" height="61" rx="30.5" fill="#1F2340"/>
<rect x="98" y="7" width="134" height="50" rx="25" fill="${TC[t]}"/>
<text x="18" y="29" ${F} font-size="12" fill="#A4A8CC" letter-spacing=".5">WACK</text><text x="18" y="45" ${F} font-size="13" fill="#FFFFFF">OMETER</text>
<text x="165" y="27" ${F} font-size="10" fill="${TEXT_ON[t]}" text-anchor="middle" letter-spacing="1" opacity=".85">${top}</text>
<text x="165" y="46" ${F} font-size="${word.length > 6 ? 16 : 19}" fill="${TEXT_ON[t]}" text-anchor="middle">${word}</text>
<text x="76" y="40" ${F} font-size="18" fill="#BCD83C" text-anchor="middle">${r.score}</text>
</svg>`, { headers });
}

/* ---------- API ---------- */
// Returns a Response for review routes, or null so the main router keeps looking.
export async function reviewApi(path, method, url, body, u, env, admin, newId, stripe) {
  const DB = env.DB;
  let m;
  if ((m = path.match(/^\/api\/reviews\/([a-z0-9-]{1,80})\/crowd$/)) && method === "GET") return json(await crowdOf(DB, m[1], u && u.id));
  if ((m = path.match(/^\/api\/reviews\/([a-z0-9-]{1,80})\/vote$/)) && method === "POST") {
    const tier = Number(body.tier);
    if (!(tier >= 0 && tier <= 4 && Number.isInteger(tier))) return bad("Pick one of the five.");
    const r = await DB.prepare("SELECT slug FROM reviews WHERE slug=? AND status='live'").bind(m[1]).first();
    if (!r) return bad("That review isn't live.", 404);
    await DB.prepare("INSERT INTO review_votes (slug,user_id,tier,created_at) VALUES (?,?,?,?) ON CONFLICT(slug,user_id) DO UPDATE SET tier=excluded.tier").bind(m[1], u.id, tier, Date.now()).run();
    return json(await crowdOf(DB, m[1], u.id));
  }
  // Same-origin copy of the cover so the share card can draw it.
  if ((m = path.match(/^\/api\/reviews\/([a-z0-9-]{1,80})\/cover$/)) && method === "GET") {
    const r = await DB.prepare("SELECT cover_url FROM reviews WHERE slug=?").bind(m[1]).first();
    const src = r && safeUrl(r.cover_url);
    if (!src || !/^https:\/\/([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com|mzstatic\.com|ytimg\.com|wackometer\.com)\//i.test(src)) return bad("No cover.", 404);
    const res = await fetch(src, { cf: { cacheTtl: 86400 } });
    if (!res.ok || !/^image\//.test(res.headers.get("content-type") || "")) return bad("No cover.", 404);
    return new Response(res.body, { headers: { "content-type": res.headers.get("content-type"), "cache-control": "public, max-age=86400" } });
  }
  if (path === "/api/reviews/latest" && method === "GET") {
    return json((await DB.prepare("SELECT slug,title,artist,cover_url,score FROM reviews WHERE status='live' ORDER BY published_at DESC LIMIT 5").all()).results);
  }
  if (path === "/api/critics/apply" && method === "POST") {
    const f = (k, n) => String(body[k] ?? "").trim().slice(0, n);
    const name = f("name", 80), email = f("email", 120).toLowerCase(), why = f("why", 1500);
    if (!name) return bad("Add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Add an email we can reach you at.");
    if (why.length < 20) return bad("Tell us a little more about your taste.");
    const recent = await DB.prepare("SELECT COUNT(*) c FROM critic_applications WHERE email=? AND created_at>?").bind(email, Date.now() - 7 * 864e5).first();
    if (recent.c >= 2) return bad("We've got your application. We'll be in touch.", 429);
    await DB.prepare("INSERT INTO critic_applications (id,name,email,link,genres,why,user_id,status,created_at) VALUES (?,?,?,?,?,?,?,'new',?)").bind(newId(), name, email, f("link", 300) || null, f("genres", 200) || null, why, u.id, Date.now()).run();
    return json({ ok: true });
  }
  if (path === "/api/reviews/submit" && method === "POST") {
    const artist = String(body.artist || "").trim().slice(0, 80), link = safeUrl(String(body.link || "").replace(/^http:/i, "https:")).slice(0, 300);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 120), note = String(body.note || "").trim().slice(0, 600);
    if (!artist) return bad("Add the artist name.");
    if (!link) return bad("Add a link that starts with https://");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Add your email so we can send your feedback.");
    const criticSlug = String(body.critic || "").slice(0, 80);
    const critic = criticSlug ? await DB.prepare("SELECT slug,name FROM critics WHERE slug=? AND active=1").bind(criticSlug).first() : null;
    if (!env.STRIPE_SECRET_KEY) return bad("Paid submissions open very soon. Check back in a day or two.", 503);
    const recent = await DB.prepare("SELECT COUNT(*) c FROM review_requests WHERE user_id=? AND created_at>?").bind(u.id, Date.now() - 86400000).first();
    if (recent.c >= 10) return bad("That's plenty for today. Try again tomorrow.", 429);
    // Saved as "pending" until Stripe confirms the payment, so unpaid ones never reach the queue.
    // The page's card form then confirms this PaymentIntent in place (no redirect to a checkout page).
    const id = newId(), cents = Number(env.SUBMIT_PRICE_CENTS) || 1000;
    await DB.prepare("INSERT INTO review_requests (id,artist,link,email,note,user_id,critic,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',?)").bind(id, artist, link, email, note || null, u.id, critic ? critic.slug : null, Date.now()).run();
    const pi = await stripe(env, "payment_intents", {
      amount: cents, currency: "usd", payment_method_types: ["card", "link", "cashapp"], receipt_email: email,
      description: `Wackometer: get your music weighed (${artist})${critic ? `, reviewed by ${critic.name}` : ""}`, statement_descriptor_suffix: "WACKOMETER",
      metadata: { kind: "review_submission", request: id, user: u.id },
    });
    await DB.prepare("UPDATE review_requests SET stripe_session=? WHERE id=?").bind(pi.id, id).run();
    return json({ id, clientSecret: pi.client_secret });
  }
  // What the card form needs to load. The publishable key is public by design.
  if (path === "/api/reviews/pay-config" && method === "GET") {
    return json({ pk: env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY ? env.STRIPE_PUBLISHABLE_KEY : "", cents: Number(env.SUBMIT_PRICE_CENTS) || 1000 });
  }
  // Right after paying, the page asks us to check with Stripe so the song joins the queue immediately (the webhook does the same).
  if (path === "/api/reviews/submit/confirm" && method === "POST") {
    const piId = String(body.pi || "");
    if (!/^pi_[A-Za-z0-9]+$/.test(piId) || !env.STRIPE_SECRET_KEY) return bad("Missing payment.");
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, { headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    const pi = await res.json();
    if (!res.ok) return bad("Couldn't check that payment.", 502);
    if (pi.status !== "succeeded" || pi.metadata?.kind !== "review_submission") return json({ ok: false, status: pi.status });
    await DB.prepare("UPDATE review_requests SET paid=1, amount=?, status='new' WHERE id=? AND status='pending'").bind(pi.amount_received || pi.amount, pi.metadata.request).run();
    return json({ ok: true });
  }

  if (!path.startsWith("/api/reviews-admin/")) return null;
  if (!admin) return bad("Admins only. Sign in with an admin email.", 403);
  if (path === "/api/reviews-admin/list" && method === "GET") {
    const reviews = (await DB.prepare("SELECT r.*, (SELECT COUNT(*) FROM review_votes v WHERE v.slug=r.slug) votes FROM reviews r ORDER BY updated_at DESC LIMIT 500").all()).results;
    const critics = (await DB.prepare("SELECT * FROM critics ORDER BY active DESC, sort, name").all()).results;
    const requests = (await DB.prepare("SELECT * FROM review_requests WHERE status<>'pending' ORDER BY status='done', paid DESC, created_at DESC LIMIT 300").all()).results;
    const applications = (await DB.prepare("SELECT * FROM critic_applications ORDER BY status='new' DESC, created_at DESC LIMIT 200").all()).results;
    return json({ reviews, requests, critics, applications });
  }
  if (path === "/api/reviews-admin/lookup" && method === "GET") {
    const link = safeUrl(url.searchParams.get("url")), q = (url.searchParams.get("q") || "").trim().slice(0, 120);
    // No streaming link? Search Apple's free catalog by artist + title for the cover art and an Apple Music link.
    if (!spotifyEmbed(link) && !youtubeId(link) && q) {
      try {
        const res = await (await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=5&term=${encodeURIComponent(q)}`, { headers: { "user-agent": "Wackometer/1.0 (+https://wackometer.com)" } })).json();
        const hit = (res.results || [])[0];
        if (!hit) return bad("Couldn't find that song. Paste a Spotify or YouTube link instead.");
        return json({ apple: true, title: hit.trackName || "", artist: hit.artistName || "", cover: String(hit.artworkUrl100 || "").replace(/\/\d+x\d+bb\./, "/600x600bb."), apple_url: hit.trackViewUrl ? hit.trackViewUrl.split("?")[0] + (hit.trackViewUrl.includes("?i=") ? "?i=" + hit.trackId : "") : "", genre: hit.primaryGenreName || "", released: hit.releaseDate ? String(hit.releaseDate).slice(0, 4) : "" });
      } catch (e) { return bad("Couldn't search right now. Paste a Spotify or YouTube link instead."); }
    }
    if (!link) return bad("Paste a full https:// link, or type the artist and title first.");
    const out = { spotify: !!spotifyEmbed(link), youtube: !!youtubeId(link) };
    const oembed = out.spotify ? `https://open.spotify.com/oembed?url=${encodeURIComponent(link)}` : out.youtube ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}` : null;
    if (!oembed) return bad("Paste a Spotify or YouTube link to auto-fill.");
    try {
      const o = await (await fetch(oembed, { headers: { "user-agent": "Wackometer/1.0 (+https://wackometer.com)" } })).json();
      out.title = o.title || ""; out.cover = o.thumbnail_url || ""; out.artist = o.author_name || "";
      if (out.spotify) out.kind = spotifyEmbed(link).type === "album" ? "album" : "song";
    } catch (e) { return bad("Couldn't reach that link. Fill it in by hand."); }
    return json(out);
  }
  if (path === "/api/reviews-admin/save" && method === "POST") {
    const f = (k, n = 200) => String(body[k] ?? "").trim().slice(0, n);
    const artist = f("artist", 120), title = f("title", 160), verdict = f("verdict", 220);
    const score = Math.round(Number(body.score));
    if (!artist || !title) return bad("Artist and title are required.");
    if (!(score >= 0 && score <= 100)) return bad("Score goes from 0 (Wicked) to 100 (Wack).");
    if (!verdict) return bad("Write a one-line verdict.");
    const best = f("best_line", 160);
    if (best.split(/\s+/).length > 25) return bad("Keep the best line short: one line, 25 words at most (it's someone else's lyric).");
    const slug = slugify(f("slug", 80) || `${artist} ${title}`);
    if (!slug) return bad("Couldn't make a link name from that. Add a slug.");
    const prev = body.original ? await DB.prepare("SELECT * FROM reviews WHERE slug=?").bind(slugify(body.original)).first() : null;
    if (!prev || prev.slug !== slug) { const taken = await DB.prepare("SELECT slug FROM reviews WHERE slug=?").bind(slug).first(); if (taken) return bad("Another review already uses that link name. Change the slug."); }
    const status = body.status === "live" ? "live" : "draft", t = Date.now();
    const vals = [f("kind") === "album" ? "album" : "song", artist, title, f("genre", 60) || null, f("released", 40) || null, score, verdict, f("body", 12000) || null, best || null, f("standouts", 600) || null,
      safeUrl(f("cover_url", 500)) || null, safeUrl(f("spotify_url", 300)) || null, safeUrl(f("youtube_url", 300)) || null, safeUrl(f("apple_url", 300)) || null, safeUrl(f("artist_url", 300)) || null, igHandle(f("artist_ig", 80)) || null, f("reviewer", 60) || null, status, body.featured ? 1 : 0, body.submitted ? 1 : 0];
    const published = status === "live" ? (prev && prev.published_at) || t : (prev && prev.published_at) || null;
    const parts = PARTS.map(([k]) => { const v = body[k]; if (v === "" || v === null || v === undefined) return null; const n = Math.round(Number(v)); return n >= 0 && n <= 100 ? n : null; });
    if (prev) {
      await DB.batch([
        DB.prepare("UPDATE reviews SET slug=?,kind=?,artist=?,title=?,genre=?,released=?,score=?,verdict=?,body=?,best_line=?,standouts=?,cover_url=?,spotify_url=?,youtube_url=?,apple_url=?,artist_url=?,artist_ig=?,reviewer=?,status=?,featured=?,submitted=?,updated_at=?,published_at=? WHERE slug=?").bind(slug, ...vals, t, published, prev.slug),
        DB.prepare("UPDATE review_votes SET slug=? WHERE slug=?").bind(slug, prev.slug),
        DB.prepare(`UPDATE reviews SET ${PARTS.map(([k]) => k + "=?").join(",")} WHERE slug=?`).bind(...parts, slug),
      ]);
    } else {
      await DB.prepare("INSERT INTO reviews (slug,kind,artist,title,genre,released,score,verdict,body,best_line,standouts,cover_url,spotify_url,youtube_url,apple_url,artist_url,artist_ig,reviewer,status,featured,submitted,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(slug, ...vals, t, t, published).run();
      await DB.prepare(`UPDATE reviews SET ${PARTS.map(([k]) => k + "=?").join(",")} WHERE slug=?`).bind(...parts, slug).run();
    }
    return json({ ok: true, slug, status });
  }
  if (path === "/api/reviews-admin/delete" && method === "POST") {
    const slug = slugify(body.slug);
    await DB.batch([DB.prepare("DELETE FROM reviews WHERE slug=?").bind(slug), DB.prepare("DELETE FROM review_votes WHERE slug=?").bind(slug)]);
    return json({ ok: true });
  }
  // Quick add: one song per line, "Title - Artist" or a link.
  if (path === "/api/reviews-admin/queue" && method === "POST") {
    const lines = String(body.lines || "").split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 100);
    const stmts = lines.map((l) => {
      const link = safeUrl(l.match(/https:\/\/\S+/)?.[0] || "");
      const text = l.replace(/https:\/\/\S+/, "").trim();
      const [title, artist] = text.split(/\s+[-–—|]\s+/);
      const t = (title || "").slice(0, 160), a = (artist || (link ? "" : "Unknown")).slice(0, 120);
      return DB.prepare("INSERT INTO review_requests (id,artist,title,link,note,status,created_at) VALUES (?,?,?,?,?,'new',?)").bind(newId(), a || "Unknown", t || null, link || `https://open.spotify.com/search/${encodeURIComponent((t + " " + a).trim())}`, "Added from the editor.", Date.now());
    });
    if (!stmts.length) return bad("Add at least one song.");
    await DB.batch(stmts);
    return json({ ok: true, added: stmts.length });
  }
  if (path === "/api/reviews-admin/critic-save" && method === "POST") {
    const f = (k, n = 200) => String(body[k] ?? "").trim().slice(0, n);
    const name = f("name", 80); if (!name) return bad("Add the critic's name.");
    const slug = slugify(f("slug", 60) || name), prev = slugify(body.original || "");
    if (!slug) return bad("Couldn't make a link name from that.");
    if (slug !== prev && (await DB.prepare("SELECT slug FROM critics WHERE slug=?").bind(slug).first())) return bad("Another critic already uses that link name.");
    const vals = [slug, name, f("tagline", 100) || null, f("bio", 3000) || null, safeUrl(f("photo_url", 500)) || null, f("genres", 200) || null, igHandle(f("ig", 80)) || null, safeUrl(f("link", 300)) || null, body.active === false ? 0 : 1, Math.round(Number(body.sort) || 0)];
    if (prev && (await DB.prepare("SELECT slug FROM critics WHERE slug=?").bind(prev).first())) {
      await DB.batch([DB.prepare("UPDATE critics SET slug=?,name=?,tagline=?,bio=?,photo_url=?,genres=?,ig=?,link=?,active=?,sort=? WHERE slug=?").bind(...vals, prev), DB.prepare("UPDATE review_requests SET critic=? WHERE critic=?").bind(slug, prev)]);
    } else await DB.prepare("INSERT INTO critics (slug,name,tagline,bio,photo_url,genres,ig,link,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(...vals, Date.now()).run();
    return json({ ok: true, slug });
  }
  if (path === "/api/reviews-admin/application" && method === "POST") {
    await DB.prepare("UPDATE critic_applications SET status=? WHERE id=?").bind(["new", "accepted", "passed"].includes(body.status) ? body.status : "new", String(body.id || "")).run();
    return json({ ok: true });
  }
  if (path === "/api/reviews-admin/critic-delete" && method === "POST") {
    await DB.prepare("DELETE FROM critics WHERE slug=?").bind(slugify(body.slug)).run();
    return json({ ok: true });
  }
  if (path === "/api/reviews-admin/request" && method === "POST") {
    await DB.prepare("UPDATE review_requests SET status=? WHERE id=?").bind(body.status === "done" ? "done" : "new", String(body.id || "")).run();
    return json({ ok: true });
  }
  return bad("Not found", 404);
}

// Live reviews for the sitemap.
export async function reviewUrls(DB) {
  return (await DB.prepare("SELECT slug, updated_at FROM reviews WHERE status='live' ORDER BY published_at DESC LIMIT 20000").all()).results;
}
