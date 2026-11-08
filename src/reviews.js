// Lyric reviews: we weigh the writing on released songs and albums, and the crowd weighs in too.
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
const html = (body, status = 200, cache = "public, max-age=300") => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache, "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" } });
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
</head>
<body${data ? ` data-review="${esc(data)}"` : ""}>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap seo">
${siteHeader(active, q)}
<main id="main">
${body}
</main>
<footer><p class="flinks">Wackometer · <a href="/reviews">Lyric reviews</a> · <a href="/rhymes/">Fresh rhymes</a> · <a href="/cliches/">Cliché fixer</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></p>${DBV}</footer>
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

const SUBMIT = `<section class="rv-submit" id="submit" aria-labelledby="subH">
<h2 id="subH">Want your music weighed?</h2>
<p>Send us a song or album. We read every lyric we get and review the ones we love. If yours makes the cut, you get a review page, a share card and a badge for your links.</p>
<form id="subForm" class="rv-form">
<label>Artist name<input name="artist" required maxlength="80" autocomplete="off"></label>
<label>Link to the song or album<input name="link" type="url" required maxlength="300" placeholder="Spotify, Apple Music, YouTube, SoundCloud…"></label>
<label>Your email <span class="hint">(so we can tell you when it's up)</span><input name="email" type="email" maxlength="120" autocomplete="email"></label>
<label>Anything we should know? <span class="hint">(optional)</span><textarea name="note" rows="3" maxlength="600"></textarea></label>
<div class="row"><button class="btn bile" type="submit">Send it</button><span class="hint" id="subNote" role="status"></span></div>
</form></section>`;

/* ---------- HTML routes ---------- */
export async function reviewsPage(req, env, path, ensureSchema) {
  await ensureSchema(env);
  const DB = env.DB, url = new URL(req.url);
  if (path === "/reviews") {
    const f = url.searchParams.get("f") || "", q = (url.searchParams.get("q") || "").trim().slice(0, 80);
    let where = f === "wicked" ? " AND score<20" : f === "songs" ? " AND kind='song'" : f === "albums" ? " AND kind='album'" : f === "videos" ? " AND youtube_url IS NOT NULL AND youtube_url<>''" : "";
    const binds = [];
    if (q) { where += " AND (lower(artist) LIKE ? OR lower(title) LIKE ? OR lower(coalesce(genre,'')) LIKE ?)"; const like = "%" + q.toLowerCase().replace(/[%_]/g, "") + "%"; binds.push(like, like, like); }
    const list = (await DB.prepare(`SELECT * FROM reviews WHERE status='live'${where} ORDER BY published_at DESC LIMIT 120`).bind(...binds).all()).results;
    const heads = { wicked: ["Certified Wicked", "The best writing we've reviewed. Every one of these scored under 20 on the Wackometer."], videos: ["Music videos", "Videos for songs we've reviewed. Watch, read the review, then cast your vote."], songs: ["Song reviews", "Single songs, weighed from Wicked to Wack."], albums: ["Album reviews", "Full albums, weighed from Wicked to Wack."] };
    const [h1, lead] = q ? [`Results for “${esc(q)}”`, `${list.length} review${list.length === 1 ? "" : "s"} match. Don't see the artist? Send them our way below.`] : heads[f] || ["How wack are their lyrics?", "We weigh the writing on new songs and albums, from Wicked to Wack. Mostly artists you haven't heard of yet. You get a vote too."];
    const chip = (k, label) => `<a class="rchip${f === k ? " on" : ""}" href="/reviews${k ? "?f=" + k : ""}"${f === k ? ' aria-current="page"' : ""}>${label}</a>`;
    const body = `<article class="seoart rv-index">
<p class="eyebrow">Lyric reviews</p>
<h1>${h1}</h1>
<p class="lead">${lead}</p>
<nav class="rchips" aria-label="Filter reviews">${chip("", "All")}${chip("wicked", "✨ Certified Wicked")}${chip("videos", "🎬 Music videos")}${chip("songs", "Songs")}${chip("albums", "Albums")}</nav>
${list.length ? `<div class="rv-grid">${list.map(card).join("")}</div>` : `<div class="warn"><b>${f || q ? "Nothing here yet." : "The first reviews drop soon."}</b><p>${f || q ? `<a href="/reviews">See all reviews</a>, or send us your music below.` : "Know an artist whose writing deserves more ears? Send them our way below."}</p></div>`}
${SUBMIT}
</article>`;
    const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Wackometer lyric reviews", url: `${BASE}/reviews`, hasPart: list.slice(0, 30).map((r) => ({ "@type": "Review", url: `${BASE}/reviews/${r.slug}`, name: `${r.artist}: ${r.title}` })) };
    return html(shell({ active: q ? "" : f === "wicked" ? "wicked" : f === "videos" ? "videos" : "reviews", q, noindex: !!q, path: "/reviews" + (f ? "?f=" + f : ""), title: q ? `“${q}” · Wackometer reviews` : f === "videos" ? "Music videos with lyric reviews · Wackometer" : f === "wicked" ? "Certified Wicked songs and albums · Wackometer reviews" : "Lyric reviews: new songs and albums, Wicked to Wack · Wackometer", desc: "Honest reviews of the songwriting on new songs and albums, scored from Wicked to Wack, with a crowd score you can vote on. Indie artists first.", body, ld, data: JSON.stringify({ index: true }) }));
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
<p class="eyebrow"><a href="/reviews">Lyric reviews</a> · ${r.kind === "album" ? "Album" : "Song"}${r.genre ? " · " + esc(r.genre) : ""}</p>
<div class="rv-hero">
<div class="rv-art">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="Cover art for ${esc(r.title)} by ${esc(r.artist)}" width="640" height="640">` : `<span class="rv-nocover" aria-hidden="true">♪</span>`}${certified(r) ? '<span class="rv-cert big">Certified Wicked</span>' : ""}</div>
<div class="rv-head">
<h1>${esc(r.title)}</h1>
<p class="rv-by">by ${artistUrl ? `<a href="${esc(artistUrl)}" target="_blank" rel="noopener">${esc(r.artist)}</a>` : esc(r.artist)}${r.released ? ` · ${esc(r.released)}` : ""}</p>
<div class="rv-scores">
<div class="rv-score"><span class="rv-sl">Wackometer</span>${gaugeSVG(r.score)}<span class="rv-num">${r.score}</span>${pill(t, tierName(r))}<span class="rv-char" data-tier="${t}" aria-hidden="true"></span></div>
<div class="rv-score rv-crowd" id="crowdBox"><span class="rv-sl">The crowd</span><span class="rv-cn" id="crowdTier">${crowd.n ? pill(crowd.tier, crowdLabel) : `<span class="hint">${crowdLabel}</span>`}</span><span class="hint" id="crowdN">${crowd.n ? `${crowd.n} vote${crowd.n === 1 ? "" : "s"}` : "Be the first"}</span>
<div class="rv-dist" id="crowdDist" aria-hidden="true">${crowd.dist.map((c, i) => `<i style="--tc:${TC[i]};--h:${crowd.n ? Math.round((c / crowd.n) * 100) : 0}%"></i>`).join("")}</div></div>
</div>
<p class="rv-verdict">“${esc(r.verdict)}”</p>
</div>
</div>
<section class="rv-vote" aria-labelledby="voteH"><h2 id="voteH">Your call: how are the lyrics?</h2>
<div class="rv-tiers" role="group" aria-label="Vote on the lyrics">${TIERS.map((T, i) => `<button type="button" class="rv-t" data-t="${i}" style="--tc:${TC[i]};--to:${TEXT_ON[i]}" aria-pressed="false">${esc(T.n)}</button>`).join("")}</div>
<span class="hint" id="voteNote" role="status"></span></section>
${sp ? `<div class="rv-listen"><iframe title="Listen to ${esc(r.title)} on Spotify" src="${esc(sp.src)}" width="100%" height="${sp.type === "track" ? 152 : 352}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style="border:0;border-radius:14px"></iframe></div>` : ""}
${yt ? `<div class="rv-listen yt" id="watch"><iframe title="Watch ${esc(r.title)} on YouTube" src="https://www.youtube-nocookie.com/embed/${yt}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" style="border:0"></iframe></div>` : ""}
${listen.length ? `<p class="rv-links">Listen on ${listen.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join(" · ")}</p>` : ""}
<div class="rv-body">
${bodyHTML(r.body)}
${r.best_line ? `<figure class="rv-best"><figcaption>⭐ Best line</figcaption><blockquote>${esc(r.best_line)}</blockquote></figure>` : ""}
${standouts.length ? `<h2>Standout tracks</h2><ul class="rv-stand">${standouts.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
<p class="hint rv-sig">Reviewed by ${esc(r.reviewer || "Wackometer")} · <time datetime="${date.toISOString().slice(0, 10)}">${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</time></p>
</div>
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
<div class="cta"><b>Now weigh your own.</b><p>Paste a verse into the Wackometer. It scores it from Wicked to Wack, circles the clichés and lazy rhymes, and shows you how to fix them.</p><a class="btn bile" href="/write#weigh">Weigh my lyrics, free</a></div>
${SUBMIT}
</article>`;
  const item = { "@type": r.kind === "album" ? "MusicAlbum" : "MusicRecording", name: r.title, byArtist: { "@type": "MusicGroup", name: r.artist, ...(artistUrl ? { url: artistUrl } : {}) }, ...(r.cover_url ? { image: r.cover_url } : {}), ...(r.genre ? { genre: r.genre } : {}) };
  if (crowd.n >= 5) item.aggregateRating = { "@type": "AggregateRating", ratingValue: 100 - crowd.avg, bestRating: 100, worstRating: 0, ratingCount: crowd.n };
  const ld = [{ "@context": "https://schema.org", "@type": "Review", name: `${r.title} by ${r.artist}: lyric review`, reviewBody: r.verdict, datePublished: date.toISOString().slice(0, 10), author: { "@type": "Organization", name: "Wackometer", url: BASE }, publisher: { "@type": "Organization", name: "Wackometer", url: BASE },
      reviewRating: { "@type": "Rating", ratingValue: 100 - r.score, bestRating: 100, worstRating: 0, ratingExplanation: `${tierName(r)} on the Wackometer (${r.score}/100, lower is better)` }, itemReviewed: item },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Lyric reviews", item: `${BASE}/reviews` }, { "@type": "ListItem", position: 2, name: `${r.artist}: ${r.title}`, item: `${BASE}/reviews/${slug}` }] }];
  const title = `${r.title} by ${r.artist}: lyric review (${tierName(r)}) · Wackometer`;
  const desc = `${tierName(r)} (${r.score}/100). ${r.verdict} Read the review of the songwriting on ${r.artist}'s ${r.kind === "album" ? "album" : "song"} “${r.title}” and cast your vote.`.slice(0, 300);
  return html(shell({ active: "reviews", path: `/reviews/${slug}`, title, desc, image: r.cover_url || "", body, ld: draft ? null : ld, noindex: draft, data: JSON.stringify({ slug, artist: r.artist, title: r.title, kind: r.kind, score: r.score, tier: t, cert: certified(r), verdict: r.verdict, cover: !!r.cover_url, ig }) }), 200, draft ? "no-store" : "public, max-age=120");
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
  const DB = env.DB;
  const all = (await DB.prepare("SELECT * FROM reviews WHERE status='live' ORDER BY published_at DESC LIMIT 200").all()).results;
  const crowd = crowdMap((await DB.prepare("SELECT v.slug, v.tier, COUNT(*) c FROM review_votes v JOIN reviews r ON r.slug=v.slug AND r.status='live' GROUP BY v.slug, v.tier").all()).results);
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
<div class="fintro"><h1>How wack are <em>their</em> lyrics?</h1><p>Reviews of the songwriting on new music, scored from Wicked to Wack. We weigh in, then you do.</p></div>
${hero.length ? `<section class="fhero" aria-roledescription="carousel" aria-label="Featured reviews"><div class="fslides" id="fSlides">${hero.map(slide).join("")}</div>${hero.length > 1 ? `<div class="fdots" role="group" aria-label="Choose a featured review">${hero.map((r, i) => `<button type="button" data-i="${i}" aria-label="Show ${esc(r.title)}"${i ? "" : ' aria-current="true"'}></button>`).join("")}</div>` : ""}</section>`
      : `<section class="fempty"><b>The first reviews drop soon.</b><p>Know an artist whose writing deserves more ears? <a href="#submit">Send them our way</a>.</p></section>`}
${all.length ? row("rNew", "Latest reviews", "/reviews", all.slice(0, 12).map((r) => rowCard(r, crowd)).join("")) : ""}
<section class="fpromo" aria-label="More from Wackometer">
<a class="fp fp-weigh" href="/write#weigh" data-hub="write"><span class="fp-char" data-tier="4" aria-hidden="true"></span><span class="hey">✍️ For writers · Free</span><b>How wack are <em>your</em> lyrics?</b><span>Paste a verse and the Wackometer scores it in a second, circles the clichés, then helps you fix them with Wingman, the Workshop and Wordstorm.</span><span class="fpgo">Weigh my lyrics <span aria-hidden="true">→</span></span></a>
<a class="fp fp-plug" href="/write#plugin" data-hub="plugin"><span class="fp-char" data-tier="3" aria-hidden="true"></span><span class="hey">🎛️ In the studio <span class="hsoon">Coming soon</span></span><b>Wingman plugin</b><span>The Wackometer inside FL Studio, Ableton and Logic. Weigh lines and get rewrites without leaving your session.</span><span class="fpgo">Get early access <span aria-hidden="true">→</span></span></a>
</section>
${wicked.length ? row("rWicked", "✨ Certified Wicked", "/reviews?f=wicked", wicked.map((r) => rowCard(r, crowd)).join("")) : ""}
${videos.length ? row("rVid", "🎬 Music videos", "/reviews?f=videos", videos.map(videoCard).join(""), " fvids") : ""}
${split.length ? `<section class="fsplit" aria-labelledby="rSplit"><div class="frh"><h2 id="rSplit">⚔️ Critics vs. the crowd</h2></div><p class="hint">Where the voters and the Wackometer don't agree. Pick a side.</p><ol>${split.map(({ r, c }) => `<li><a href="/reviews/${esc(r.slug)}"><b>${esc(r.title)}</b> <span class="rv-ca">${esc(r.artist)}</span></a><span class="fvs">We said ${pill(tierOf(r.score), `${TIERS[tierOf(r.score)].n} ${r.score}`)} Crowd said ${pill(c.tier, `${TIERS[c.tier].n} ${c.avg}`)}</span></li>`).join("")}</ol></section>` : ""}
${SUBMIT}
</div>`;
  const ld = [{ "@context": "https://schema.org", "@type": "WebSite", name: "Wackometer", url: BASE + "/", potentialAction: { "@type": "SearchAction", target: `${BASE}/reviews?q={search_term_string}`, "query-input": "required name=search_term_string" } },
    { "@context": "https://schema.org", "@type": "Organization", name: "Wackometer", url: BASE + "/", logo: BASE + "/favicon.svg" }];
  // Old links to the tools (wackometer.com/#weigh etc.) go to their new home before anything renders.
  const head = `<script>if(/^#(${OLD_TOOL_HASH})$/.test(location.hash)||/[?&](paid|signin|unsubscribed|deleted)=/.test(location.search))location.replace("/write"+location.search+location.hash)</script>`;
  return html(shell({ path: "/", title: "Wackometer · Lyric reviews of new music, from Wicked to Wack", desc: "Honest reviews of the songwriting on new songs, albums and music videos, scored from Wicked to Wack, with a crowd score you vote on. Plus free tools to weigh your own lyrics.", image: "", body, ld, head, data: JSON.stringify({ front: true }) }), 200, "public, max-age=120");
}

function notFound() {
  return shell({ path: "/reviews", title: "Review not found · Wackometer", desc: "That review isn't here.", noindex: true, body: `<article class="seoart"><h1>That review isn't here.</h1><p class="lead">It may have moved or never existed. <a href="/reviews">See all lyric reviews</a>.</p></article>` });
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
export async function reviewApi(path, method, url, body, u, env, admin, newId) {
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
  if (path === "/api/reviews/submit" && method === "POST") {
    const artist = String(body.artist || "").trim().slice(0, 80), link = safeUrl(String(body.link || "").replace(/^http:/i, "https:")).slice(0, 300);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 120), note = String(body.note || "").trim().slice(0, 600);
    if (!artist) return bad("Add the artist name.");
    if (!link) return bad("Add a link that starts with https://");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("That email doesn't look right.");
    const recent = await DB.prepare("SELECT COUNT(*) c FROM review_requests WHERE user_id=? AND created_at>?").bind(u.id, Date.now() - 86400000).first();
    if (recent.c >= 5) return bad("That's plenty for today. Try again tomorrow.", 429);
    await DB.prepare("INSERT INTO review_requests (id,artist,link,email,note,user_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(newId(), artist, link, email || null, note || null, u.id, Date.now()).run();
    return json({ ok: true });
  }

  if (!path.startsWith("/api/reviews-admin/")) return null;
  if (!admin) return bad("Admins only. Sign in with an admin email.", 403);
  if (path === "/api/reviews-admin/list" && method === "GET") {
    const reviews = (await DB.prepare("SELECT r.*, (SELECT COUNT(*) FROM review_votes v WHERE v.slug=r.slug) votes FROM reviews r ORDER BY updated_at DESC LIMIT 500").all()).results;
    const requests = (await DB.prepare("SELECT * FROM review_requests ORDER BY status='done', created_at DESC LIMIT 200").all()).results;
    return json({ reviews, requests });
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
      safeUrl(f("cover_url", 500)) || null, safeUrl(f("spotify_url", 300)) || null, safeUrl(f("youtube_url", 300)) || null, safeUrl(f("apple_url", 300)) || null, safeUrl(f("artist_url", 300)) || null, igHandle(f("artist_ig", 80)) || null, f("reviewer", 60) || null, status, body.featured ? 1 : 0];
    const published = status === "live" ? (prev && prev.published_at) || t : (prev && prev.published_at) || null;
    if (prev) {
      await DB.batch([
        DB.prepare("UPDATE reviews SET slug=?,kind=?,artist=?,title=?,genre=?,released=?,score=?,verdict=?,body=?,best_line=?,standouts=?,cover_url=?,spotify_url=?,youtube_url=?,apple_url=?,artist_url=?,artist_ig=?,reviewer=?,status=?,featured=?,updated_at=?,published_at=? WHERE slug=?").bind(slug, ...vals, t, published, prev.slug),
        DB.prepare("UPDATE review_votes SET slug=? WHERE slug=?").bind(slug, prev.slug),
      ]);
    } else {
      await DB.prepare("INSERT INTO reviews (slug,kind,artist,title,genre,released,score,verdict,body,best_line,standouts,cover_url,spotify_url,youtube_url,apple_url,artist_url,artist_ig,reviewer,status,featured,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(slug, ...vals, t, t, published).run();
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
