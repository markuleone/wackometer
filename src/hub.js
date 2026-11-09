// Growth features around the reviews:
//   /lists                      every monthly Wicked list
//   /lists/2026-11              "The Wicked list: best songs, November 2026" (ranked, lowest score first)
//   /lists/2026-11/indie        the same month, one genre
//   /reviews/indie, /reviews/r-and-b ...   genre pages
//   /badge/artist/<slug>.svg    an artist's average score, to embed on their site
//   artist claims (artists link their socials to their page, approved in the editor)
//   reactions and short comments on each review
//   the thank-you email a paid submitter gets right after paying
import { shell, html, json, bad, esc, card, pill, safeUrl, igHandle, BASE, TC, tierName, ctaHTML as submitHTML, emailShell, eCard, eBtn, emailHeadline, slugify, artistTable } from "./reviews.js";
import { TIERS, tierOf } from "../web/js/score.js";
import { CFG } from "./settings.js";
import { containsSlur, containsProfanity } from "./moderation.js";

/* ---------- genres: free-text genres on reviews fall into a few buckets (a song can be in more than one) ---------- */
export const GENRES = [
  ["walternative", "Walternative", /\balt|shoegaze|\bemo\b|post.?punk|grunge|new wave/i],
  ["windie", "Windie", /indie|dream ?pop|bedroom|lo-?fi|folk|acoustic|singer.?songwriter|\bpop\b|pop$|^pop|electro|synth|house|dance|ambient|downtempo|latin|bossa|country/i],
  ["wrythme-and-blues", "Wrythme & Blues", /r&b|r ?and ?b|rnb|soul|funk|disco|boogie|jazz|gospel/i],
  ["wrock-and-wroll", "Wrock & Wroll", /rock|punk|metal|garage|grunge/i],
  ["wrap", "Wrap", /hip.?hop|\brap\b|trap|drill|grime/i],
];
// Each genre has art (web/brand/genres) and a Wackometer playlist on Spotify.
export const GENRE_INFO = {
  walternative: { playlist: "1M0RfvgZp1lkWCeIhHoyi6", bg: "#0E766D", tint: "#DDF4F1", blurb: "Left of the dial: alt-rock, shoegaze, post-punk and everything with a fuzz pedal." },
  windie: { playlist: "28zLbCcAOwwMYkHrqRkYDY", bg: "#F3A261", tint: "#FFF0E5", blurb: "Bedroom pop, dream pop, folk and the indie stuff your friends haven't found yet." },
  "wrythme-and-blues": { playlist: "6LRkeHzJTk76yHRvKeH5fu", bg: "#3A0764", tint: "#F0E8FA", blurb: "R&B, soul, funk and late-night slow jams." },
  "wrock-and-wroll": { playlist: "6waZ4TX6p6lOoLLDj8TsyR", bg: "#DC2625", tint: "#FDE7E7", blurb: "Guitars up. Rock, punk, garage and anything that needs earplugs." },
  wrap: { playlist: "1z4IpLlUksLRMoiMprJZLi", bg: "#6D28D9", tint: "#EEE7FC", blurb: "Hip-hop, rap, trap and drill. Bars get weighed here." },
};
// Every review gets a picture: its own cover, or the Wacko for its genre.
export const coverOf = (r, base = "") => (r && r.cover_url) || `${base}/brand/genres/${genresOf(r && r.genre)[0]}.jpg`;
export const TOP10_PLAYLIST = "4ljZ2a0DEpeTR4iWOO3Lnb";
// The old genre addresses point at the new ones.
export const OLD_GENRES = { indie: "windie", "r-and-b": "wrythme-and-blues", soul: "wrythme-and-blues", "hip-hop": "wrap", pop: "windie", rock: "wrock-and-wroll", alternative: "walternative", electronic: "windie", "funk-and-disco": "wrythme-and-blues", latin: "windie", jazz: "wrythme-and-blues", folk: "windie" };
export const playlistEmbed = (id, title, h = 352) => `<iframe class="sp-embed" title="${title} playlist on Spotify" src="https://open.spotify.com/embed/playlist/${id}?utm_source=generator" width="100%" height="${h}" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
export const GENRE_KEYS = GENRES.map(([k]) => k);
const genreName = (k) => (GENRES.find(([g]) => g === k) || [k, k])[1];
export const genresOf = (g) => { const k = GENRES.filter(([, , re]) => re.test(g || "")).map(([k]) => k); return k.length ? k : ["windie"]; };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthKey = (ts) => new Date(ts).toISOString().slice(0, 7);
const monthName = (k) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

async function liveReviews(DB) {
  return (await DB.prepare("SELECT slug,title,artist,score,cover_url,verdict,genre,kind,instrumental,published_at,s_lyrics,s_melody,s_vocals,s_production,s_replay FROM reviews WHERE status='live' ORDER BY published_at DESC LIMIT 5000").all()).results;
}
// { "2026-11": [reviews...] }
function byMonth(rows) {
  const m = {};
  for (const r of rows) (m[monthKey(r.published_at)] = m[monthKey(r.published_at)] || []).push(r);
  return m;
}
const rank = (rows) => [...rows].sort((a, b) => a.score - b.score || b.published_at - a.published_at);
const MIN_INDEX = 3; // fewer reviews than this: the page works but stays out of Google

/* ---------- the Wicked list pages ---------- */
function listItem(r, i) {
  const t = tierOf(r.score);
  return `<li class="wl-item"><span class="wl-rank">${i + 1}</span>
<a class="wl-cover" href="/reviews/${esc(r.slug)}" tabindex="-1" aria-hidden="true">${coverOf(r) ? `<img src="${esc(coverOf(r))}" alt="" width="120" height="120" loading="lazy">` : `<span class="rv-nocover">♪</span>`}</a>
<div class="wl-text"><a class="wl-title" href="/reviews/${esc(r.slug)}"><b>${esc(r.title)}</b></a><span class="wl-artist">by <a href="/artists/${esc(slugify(r.artist))}">${esc(r.artist)}</a>${r.genre ? ` · ${esc(r.genre)}` : ""}</span>
<span class="wl-verdict">“${esc(r.verdict)}”</span></div>
<span class="wl-score">${pill(t, `${t === 0 && r.score < 20 ? "Wicked" : TIERS[t].n} · ${r.score}`)}</span></li>`;
}
export async function listsPage(req, env, path, ensureSchema) {
  await ensureSchema(env);
  const DB = env.DB, rows = await liveReviews(DB), months = byMonth(rows), keys = Object.keys(months).sort().reverse();
  const SUB = submitHTML();
  if (path === "/lists") {
    const body = `<article class="seoart wl">
<p class="eyebrow">The Wicked list</p>
<h1><span class="cm cm-h1" data-tier="0" aria-hidden="true"></span>The best songs we weighed, month by month</h1>
<p class="lead">Every month we rank the songs we reviewed, most Wicked first. Pick a month, or a genre inside it.</p>
<section class="ftop10" aria-labelledby="wlTop"><h2 id="wlTop">🔥 Listen to the Top 10</h2>${playlistEmbed(CFG.top10_playlist || TOP10_PLAYLIST, "Wackometer Top 10", 232)}</section>
${keys.length ? `<ul class="wl-months">${keys.map((k) => { const top = rank(months[k]).slice(0, 3); const gs = monthGenres(months[k]);
  return `<li class="wl-month"><a class="wl-mlink" href="/lists/${k}"><span class="wl-covers">${top.map((r) => coverOf(r) ? `<img src="${esc(coverOf(r))}" alt="" width="64" height="64" loading="lazy">` : `<span class="rv-nocover">♪</span>`).join("")}</span><b>${monthName(k)}</b><span class="hint">${months[k].length} song${months[k].length === 1 ? "" : "s"} · #1: ${esc(top[0].title)}</span></a>
${gs.length ? `<span class="rchips">${gs.map(([g, n]) => `<a class="rchip" href="/lists/${k}/${g}">${esc(genreName(g))} <span class="hint">${n}</span></a>`).join("")}</span>` : ""}</li>`; }).join("")}</ul>` : `<div class="warn"><b>The first list drops when the reviews do.</b><p><a href="/reviews">Read the reviews</a> so far.</p></div>`}
${SUB}</article>`;
    return html(shell({ active: "lists", path: "/lists", title: "The Wicked list: best new songs by month · Wackometer", desc: "The best songs Wackometer reviewed each month, ranked from Wicked to Wack, with genre lists for Walternative, Windie, Wrythme & Blues, Wrock & Wroll and Wrap, plus the Top 10 playlist.", body }));
  }
  const m = path.match(/^\/lists\/(\d{4}-\d{2})(?:\/([a-z-]+))?$/);
  if (m && m[2] && OLD_GENRES[m[2]]) return new Response(null, { status: 301, headers: { location: `/lists/${m[1]}/${OLD_GENRES[m[2]]}` } });
  if (!m || !months[m[1]] || (m[2] && !GENRE_KEYS.includes(m[2]))) return html(shell({ path, title: "List not found · Wackometer", desc: "", noindex: true, body: `<article class="seoart"><h1>That list isn't here.</h1><p class="lead"><a href="/lists">See every Wicked list</a>.</p></article>` }), 404, "no-store");
  const [, k, g] = m, all = months[k], items = rank(g ? all.filter((r) => genresOf(r.genre).includes(g)) : all);
  if (!items.length) return html(shell({ path, title: "List not found · Wackometer", desc: "", noindex: true, body: `<article class="seoart"><h1>No ${esc(genreName(g))} songs that month.</h1><p class="lead"><a href="/lists/${k}">See the full ${monthName(k)} list</a>.</p></article>` }), 404, "no-store");
  const intro = await DB.prepare("SELECT v FROM settings WHERE k=?").bind(`list_intro:${k}${g ? ":" + g : ""}`).first();
  const gLabel = g ? genreName(g) : "", what = g ? `${gLabel} songs` : "songs", mn = monthName(k);
  const h1 = `The Wicked list: best ${g ? gLabel + " " : ""}songs, ${mn}`;
  const lead = intro ? esc(intro.v) : `Every ${g ? gLabel + " " : ""}song we reviewed in ${mn}, ranked from most Wicked down. ${items[0].title} by ${esc(items[0].artist)} takes #1 with a ${items[0].score}.`;
  const idx = keys.indexOf(k), newer = keys[idx - 1], older = keys[idx + 1];
  const gs = monthGenres(all).filter(([x]) => x !== g);
  const shareText = `${g ? `Best ${gLabel} songs` : "The Wicked list"}, ${mn} on @wackometer`;
  const body = `<article class="seoart wl">
<p class="eyebrow"><a href="/lists">The Wicked list</a> · ${mn}${g ? ` · ${esc(gLabel)}` : ""}</p>
<h1>${esc(h1)}</h1>
<p class="lead">${lead}</p>
<ol class="wl-list">${items.map(listItem).join("")}</ol>
${gs.length || g ? `<nav class="rchips" aria-label="Other lists this month">${g ? `<a class="rchip" href="/lists/${k}">All genres</a>` : ""}${gs.map(([x, n]) => `<a class="rchip" href="/lists/${k}/${x}">${esc(genreName(x))} <span class="hint">${n}</span></a>`).join("")}</nav>` : ""}
<div class="wl-share"><b>Made the list?</b><p>Share it. Post your spot and tag <a href="https://instagram.com/wackometer" target="_blank" rel="noopener">@wackometer</a> and we'll repost.</p>
<div class="row"><button class="btn bile" type="button" id="wlShare" data-text="${esc(shareText)}">Share this list</button><span class="hint" id="wlNote" role="status"></span></div></div>
<p class="wl-nav">${older ? `<a href="/lists/${older}${g && months[older].some((r) => genresOf(r.genre).includes(g)) ? "/" + g : ""}">← ${monthName(older)}</a>` : ""}${newer ? `<a href="/lists/${newer}${g && months[newer].some((r) => genresOf(r.genre).includes(g)) ? "/" + g : ""}">${monthName(newer)} →</a>` : ""}</p>
<div class="ad-slot" hidden></div>
${SUB}</article>`;
  const ld = [{ "@context": "https://schema.org", "@type": "ItemList", name: h1, itemListOrder: "https://schema.org/ItemListOrderAscending", numberOfItems: items.length, itemListElement: items.slice(0, 100).map((r, i) => ({ "@type": "ListItem", position: i + 1, url: `${BASE}/reviews/${r.slug}`, name: `${r.title} by ${r.artist}` })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "The Wicked list", item: `${BASE}/lists` }, { "@type": "ListItem", position: 2, name: mn, item: `${BASE}/lists/${k}` }, ...(g ? [{ "@type": "ListItem", position: 3, name: gLabel, item: `${BASE}/lists/${k}/${g}` }] : [])] }];
  return html(shell({ active: "lists", path, title: `Best ${g ? gLabel + " " : "new "}songs of ${mn}: the Wicked list · Wackometer`, desc: `The ${what} Wackometer reviewed in ${mn}, ranked from Wicked to Wack. #1: ${items[0].title} by ${items[0].artist} (${items[0].score}).`.slice(0, 300), body, ld, noindex: items.length < MIN_INDEX }));
}
function monthGenres(rows) {
  const n = {};
  for (const r of rows) for (const g of genresOf(r.genre)) n[g] = (n[g] || 0) + 1;
  return GENRE_KEYS.filter((g) => n[g]).map((g) => [g, n[g]]);
}

/* ---------- genres: tiles (front page, /genres) ---------- */
export async function genreTilesHTML(DB, limit = 12, front = false) {
  const rows = await liveReviews(DB), by = {};
  for (const r of rows) for (const g of genresOf(r.genre)) (by[g] = by[g] || []).push(r);
  const tiles = GENRE_KEYS.slice(0, limit).map((g) => { const n = (by[g] || []).length;
    return `<a class="gtile gart" href="/reviews/${g}" style="--gt:${GENRE_INFO[g].bg}"><img src="/brand/genres/${g}-sm.jpg" alt="${esc(genreName(g))}" width="320" height="320" loading="lazy"><span class="gt-n">${n ? `${n} review${n === 1 ? "" : "s"}` : "Playlist"}</span></a>`; }).join("");
  return front ? `<section class="fgenres" aria-labelledby="rGen"><div class="frh"><h2 id="rGen">Browse by genre</h2><a href="/genres">All genres <span aria-hidden="true">→</span></a></div><div class="gtiles g5">${tiles}</div></section>` : `<div class="gtiles g5">${tiles}</div>`;
}
export async function genresIndex(req, env, ensureSchema) {
  await ensureSchema(env);
  const body = `<article class="seoart">
<p class="eyebrow">Song reviews</p>
<h1><span class="cm cm-h1" data-tier="1" aria-hidden="true"></span>Browse by genre</h1>
<p class="lead">Five sounds, five Wackos. Every review lands in at least one, and each genre has its own Wackometer playlist on Spotify.</p>
${await genreTilesHTML(env.DB)}
<p class="hint">Want the best of each month instead? <a href="/lists">See the Wicked lists</a>.</p>
${submitHTML()}</article>`;
  return html(shell({ active: "genres", path: "/genres", title: "Song reviews by genre: Walternative, Windie, Wrythme & Blues, Wrock & Wroll, Wrap · Wackometer", desc: "Browse Wackometer song reviews and playlists by genre: alternative, indie, R&B, rock and rap, each scored from Wicked to Wack.", body }));
}

/* ---------- genre pages (/reviews/indie) ---------- */
export async function genreCounts(DB) {
  const n = {};
  for (const r of (await DB.prepare("SELECT genre FROM reviews WHERE status='live'").all()).results) for (const g of genresOf(r.genre)) n[g] = (n[g] || 0) + 1;
  return GENRE_KEYS.filter((g) => n[g]).map((g) => [g, n[g], genreName(g)]);
}
export async function genrePage(req, env, g, ensureSchema) {
  await ensureSchema(env);
  const DB = env.DB, rows = (await liveReviews(DB)).filter((r) => genresOf(r.genre).includes(g));
  const name = genreName(g), months = byMonth(rows), keys = Object.keys(months).sort().reverse();
  const counts = await genreCounts(DB);
  const best = rank(rows).slice(0, 3);
  const body = `<article class="seoart rv-index">
<p class="eyebrow"><a href="/reviews">Song reviews</a> · <a href="/genres">Genres</a></p>
<section class="ghero" style="--gbg:${GENRE_INFO[g].bg};--gtint:${GENRE_INFO[g].tint}"><img src="/brand/genres/${g}.jpg" alt="${esc(name)}: Wacko as a ${esc(name)} fan" width="640" height="640">
<div class="ghero-t"><h1>${esc(name)}</h1><p class="lead">${esc(GENRE_INFO[g].blurb)} ${rows.length ? `${rows.length} review${rows.length === 1 ? "" : "s"} so far, scored from Wicked to Wack.` : "Reviews land here as they go live."}</p>
${playlistEmbed(CFG["playlist_" + g] || GENRE_INFO[g].playlist, esc(name), 232)}</div></section>
<nav class="rchips" aria-label="Genres"><a class="rchip" href="/reviews">All</a>${GENRE_KEYS.map((k) => { const c = counts.find(([x]) => x === k); return `<a class="rchip${k === g ? " on" : ""}" href="/reviews/${k}"${k === g ? ' aria-current="page"' : ""}>${esc(genreName(k))}${c ? ` <span class="hint">${c[1]}</span>` : ""}</a>`; }).join("")}</nav>
${best.length >= 3 ? `<section aria-labelledby="gbH"><h2 id="gbH">The best ${esc(name)} we've heard</h2><ol class="wl-list">${best.map(listItem).join("")}</ol></section>` : ""}
${rows.length ? `<h2>Latest ${esc(name)} reviews</h2><div class="rv-grid">${rows.slice(0, 120).map(card).join("")}</div>` : ""}
${keys.length ? `<p class="hint">Monthly lists: ${keys.map((k) => `<a href="/lists/${k}/${g}">${monthName(k)}</a>`).join(" · ")}</p>` : ""}
<div class="ad-slot" hidden></div>
${submitHTML()}</article>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: `${name} song reviews`, url: `${BASE}/reviews/${g}`, hasPart: rows.slice(0, 30).map((r) => ({ "@type": "Review", url: `${BASE}/reviews/${r.slug}`, name: `${r.artist}: ${r.title}` })) };
  return html(shell({ active: "genres", path: `/reviews/${g}`, title: `${name}: ${name === "Wrap" ? "rap & hip-hop" : name === "Windie" ? "indie & pop" : name === "Walternative" ? "alternative" : name === "Wrock & Wroll" ? "rock" : "R&B & soul"} song reviews and playlist · Wackometer`, desc: `Honest reviews of new ${name} songs and albums (lyrics, hook, vocals, production) scored from Wicked to Wack, plus a crowd score you can vote on.`, body, ld, noindex: false }));
}

/* ---------- sitemap entries ---------- */
export async function hubUrls(DB) {
  const rows = await liveReviews(DB), months = byMonth(rows), out = [];
  out.push(["/genres", "weekly", "0.7"], ...GENRE_KEYS.map((g) => [`/reviews/${g}`, "weekly", "0.7"]));
  if (rows.length) out.push(["/lists", "weekly", "0.7"]);
  for (const [k, list] of Object.entries(months)) {
    if (list.length >= MIN_INDEX) out.push([`/lists/${k}`, "weekly", "0.7"]);
    for (const [g, n] of monthGenres(list)) if (n >= MIN_INDEX) out.push([`/lists/${k}/${g}`, "weekly", "0.6"]);
  }
  return out;
}

/* ---------- artists: claimed profiles, the claim form, the embed ---------- */
export async function artistProfile(DB, slug) {
  return DB.prepare("SELECT * FROM artist_profiles WHERE slug=?").bind(slug).first();
}
const SOCIALS = [["ig", "Instagram", (v) => `https://instagram.com/${v}`], ["tiktok", "TikTok", (v) => `https://www.tiktok.com/@${v}`], ["spotify", "Spotify", (v) => v], ["website", "Website", (v) => v]];
export function artistLinksHTML(p) {
  if (!p) return "";
  const links = SOCIALS.filter(([k]) => p[k]).map(([k, label, to]) => `<a class="ar-link" href="${esc(to(p[k]))}" target="_blank" rel="noopener me">${label}${k === "ig" || k === "tiktok" ? ` @${esc(p[k])}` : ""} ↗</a>`);
  return `<p class="ar-claimed"><span class="ar-check">✓ Claimed by the artist</span>${links.join("")}</p>${p.bio ? `<p class="ar-bio">${esc(p.bio)}</p>` : ""}`;
}
export function artistExtrasHTML(a, p) {
  const t = tierOf(a.avg), label = t === 0 ? "Wicked" : TIERS[t].n;
  const code = `<a href="${BASE}/artists/${a.slug}"><img src="${BASE}/badge/artist/${a.slug}.svg" alt="${label} on Wackometer (${a.avg}/100)" width="240" height="64"></a>`;
  return `<section class="ar-tools" aria-labelledby="arToolsH"><h2 id="arToolsH">Are you ${esc(a.name)}?</h2>
<div class="ar-grid">
<div class="ar-box"><b>Put your score on your site</b><p>Add this badge to your website or link-in-bio. It updates on its own as we review more of your songs, and links back here.</p>
<img src="/badge/artist/${esc(a.slug)}.svg" alt="${esc(label)} on Wackometer" width="240" height="64">
<textarea id="arBadgeCode" rows="3" readonly aria-label="Badge embed code">${esc(code)}</textarea>
<button class="btn" type="button" id="arBadgeCopy">Copy the code</button></div>
${p ? `<div class="ar-box"><b>This page is claimed.</b><p>Want to change your links? Email <a href="mailto:hello@wackometer.com">hello@wackometer.com</a> from ${esc(p.email ? p.email.replace(/^(.).*(@.*)$/, "$1…$2") : "the address you claimed with")}.</p></div>`
  : `<form class="ar-box ar-claim" id="claimForm" autocomplete="on"><b>Claim this page</b><p>Link your socials so fans can find you, and get an email every time we review one of your songs.</p>
<input type="hidden" name="artist" value="${esc(a.slug)}">
<label>Your name<input name="name" maxlength="80" required autocomplete="name"></label>
<label>Email<input name="email" type="email" maxlength="200" required autocomplete="email"></label>
<label>You are…<select name="role"><option value="artist">The artist</option><option value="team">Manager, label or team</option></select></label>
<label>Instagram<input name="ig" maxlength="80" placeholder="@handle"></label>
<label>TikTok<input name="tiktok" maxlength="80" placeholder="@handle"></label>
<label>Spotify artist link<input name="spotify" type="url" maxlength="300" placeholder="https://open.spotify.com/artist/…"></label>
<label>Website or link-in-bio<input name="website" type="url" maxlength="300" placeholder="https://"></label>
<label>How can we tell it's you? <span class="hint">(optional: e.g. “DM us from the band's Instagram”)</span><input name="proof" maxlength="300"></label>
<button class="btn bile" type="submit">Send my claim</button><span class="hint" id="claimNote" role="status"></span></form>`}
</div></section>`;
}
export async function artistBadge(env, slug, ensureSchema) {
  await ensureSchema(env);
  const headers = { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600", "access-control-allow-origin": "*", "x-content-type-options": "nosniff" };
  const a = /^[a-z0-9-]{1,80}$/.test(slug) ? (await artistTable(env.DB)).find((x) => x.slug === slug) : null;
  if (!a) return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64"/>`, { status: 404, headers });
  const t = tierOf(a.avg), word = (t === 0 ? "Wicked" : TIERS[t].n).toUpperCase();
  const F = "font-family='Fredoka,Avenir Next,Segoe UI,Helvetica,Arial,sans-serif' font-weight='700'";
  return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64" role="img" aria-label="${esc(a.name)}: ${word} on Wackometer, ${a.avg} out of 100">
<rect x="1.5" y="1.5" width="237" height="61" rx="30.5" fill="#1F2340"/>
<rect x="98" y="7" width="134" height="50" rx="25" fill="${TC[t]}"/>
<text x="51" y="25" ${F} font-size="9.5" fill="#A4A8CC" text-anchor="middle" letter-spacing=".6">WACKOMETER</text>
<text x="165" y="27" ${F} font-size="10" fill="#1F2340" text-anchor="middle" letter-spacing="1" opacity=".85">ARTIST AVG</text>
<text x="165" y="46" ${F} font-size="${word.length > 6 ? 16 : 19}" fill="#1F2340" text-anchor="middle">${word}</text>
<text x="51" y="48" ${F} font-size="22" fill="#BCD83C" text-anchor="middle">${a.avg}</text>
</svg>`, { headers });
}

/* ---------- reactions + comments on a review ---------- */
export const REACTIONS = [["fire", "🔥", "Fire"], ["love", "😍", "Love it"], ["mind", "🤯", "Mind blown"], ["sleep", "😴", "Snooze"], ["ick", "🤮", "Ick"]];
async function socialOf(DB, slug, uid) {
  const counts = Object.fromEntries(REACTIONS.map(([k]) => [k, 0]));
  for (const r of (await DB.prepare("SELECT emoji, COUNT(*) c FROM review_reactions WHERE slug=? GROUP BY emoji").bind(slug).all()).results) counts[r.emoji] = r.c;
  const mine = uid ? (await DB.prepare("SELECT emoji FROM review_reactions WHERE slug=? AND user_id=?").bind(slug, uid).all()).results.map((r) => r.emoji) : [];
  const comments = (await DB.prepare("SELECT id, name, body, created_at, user_id FROM review_comments WHERE slug=? AND hidden=0 ORDER BY created_at DESC LIMIT 60").bind(slug).all()).results;
  return { counts, mine, comments: comments.map((c) => ({ id: c.id, name: c.name || "Listener", body: c.body, at: c.created_at, me: !!uid && c.user_id === uid })) };
}
const when = (ts) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const commentHTML = (c) => `<li class="cm-item"><b>${esc(c.name)}</b> <span class="hint">${when(c.at)}</span><p>${esc(c.body)}</p></li>`;
export async function reviewSocialHTML(DB, slug) {
  const s = await socialOf(DB, slug, null);
  return `<section class="rv-social" id="talk" aria-labelledby="talkH"><h2 id="talkH">What people think</h2>
<div class="rx" role="group" aria-label="React to this song">${REACTIONS.map(([k, e, label]) => `<button type="button" class="rx-b" data-rx="${k}" aria-pressed="false" title="${label}"><span aria-hidden="true">${e}</span><span class="sr">${label}</span><span class="rx-n" id="rx-${k}">${s.counts[k] || ""}</span></button>`).join("")}</div>
<form class="cm-form" id="cmForm" autocomplete="off"><label class="sr" for="cmBody">Your take</label><textarea id="cmBody" name="body" maxlength="280" rows="2" placeholder="Your take on the song (280 characters)" required></textarea>
<div class="row"><label class="sr" for="cmName">Name</label><input id="cmName" name="name" maxlength="40" placeholder="Name (optional)" autocomplete="nickname"><button class="btn bile" type="submit">Post</button><span class="hint" id="cmNote" role="status"></span></div></form>
<ul class="cm-list" id="cmList">${s.comments.map(commentHTML).join("")}</ul>
${s.comments.length ? "" : '<p class="hint" id="cmEmpty">No takes yet. Start it off.</p>'}
</section>`;
}

/* ---------- emails ---------- */
function fromOf(env) {
  const fromRaw = env.EMAIL_FROM || "Wackometer <hello@wackometer.com>";
  const fm = fromRaw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return fm ? { name: fm[1] || "Wackometer", email: fm[2] } : { email: fromRaw.trim() };
}
async function sendMail(env, to, subject, htmlBody, text) {
  if (!env.SENDGRID_API_KEY || !to) return false;
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { authorization: `Bearer ${env.SENDGRID_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: fromOf(env), subject, content: [{ type: "text/plain", value: text }, { type: "text/html", value: htmlBody }], tracking_settings: { click_tracking: { enable: false, enable_text: false } } }) });
    if (!res.ok) console.error("mail", res.status, await res.text());
    return res.ok;
  } catch (e) { console.error("mail", e); return false; }
}
// Right after a $10 submission is paid: say thanks and what happens next. Sends once per submission.
export async function thankSubmitter(env, requestId) {
  if (!requestId || !env.SENDGRID_API_KEY) return;
  const DB = env.DB;
  const claim = await DB.prepare("UPDATE review_requests SET thanked_at=? WHERE id=? AND paid=1 AND thanked_at IS NULL").bind(Date.now(), requestId).run();
  if (!claim.meta || !claim.meta.changes) return;
  const q = await DB.prepare("SELECT * FROM review_requests WHERE id=?").bind(requestId).first();
  if (!q || !q.email) return;
  const base = env.APP_URL || BASE, amount = `$${((q.amount || 1000) / 100).toFixed(2).replace(/\.00$/, "")}`;
  const song = q.title ? `“${q.title}”` : "your song";
  const steps = [["🎧", "A critic plays it start to finish", "No skipping. The words, the hook, the vocals, the mix."], ["✍️", "You get written feedback within 7 days", "What lands, what's wack, and what to fix, straight to this inbox."], ["✨", "If it's Wicked, it gets a review page", "A permanent page with your score, a share card, a video and a badge for your links."]];
  const htmlBody = emailShell({ base, env, preheader: `We got ${song}. Feedback lands within 7 days.`, eyebrow: "SUBMISSION RECEIVED",
    content: `${emailHeadline(`Got it, ${q.artist}. You're in the queue.`, `Thanks for sending us ${song}. Your ${amount} payment went through, and your song is lined up for a real listen.`)}
${eCard(`<div style="font-family:'Fredoka','Arial Rounded MT Bold','Trebuchet MS',Arial,sans-serif;font-weight:700;font-size:20px;color:#1F2340;padding-bottom:6px">What happens next</div>
${steps.map(([i, h, d]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #E4E7F4"><tr><td width="44" valign="top" style="padding:12px 10px 12px 0;font-size:24px">${i}</td><td style="padding:12px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2340"><b style="font-size:16px">${h}</b><div style="font-size:14px;color:#646A8C;padding-top:2px">${d}</div></td></tr></table>`).join("")}`)}
${eCard(`<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1F2340">While you wait, follow <a href="https://instagram.com/wackometer" style="color:#5A6E0C;font-weight:bold">@wackometer</a> so you see your review when it drops. Questions? Just reply to this email.</div>
<div style="padding-top:14px">${eBtn(`${base}/reviews`, "Read some reviews")}</div>`)}` });
  const text = `Got it, ${q.artist}. Thanks for sending us ${song}. Your ${amount} payment went through.\n\nWhat happens next:\n- A critic plays it start to finish.\n- You get written feedback within 7 days, by email.\n- If it's Wicked, it gets a review page with a share card and a badge.\n\nFollow @wackometer on Instagram to see it when it drops. Questions? Reply to this email.\n\nWackometer`;
  await sendMail(env, q.email, `Got it: ${q.title || "your song"} is in the Wackometer queue`, htmlBody, text);
}

/* ---------- API: public (reactions, comments, claims) and admin (/api/hub-admin/...) ---------- */
export async function hubApi(path, method, url, body, u, env, admin, newId) {
  const DB = env.DB;
  let m;
  if ((m = path.match(/^\/api\/reviews\/([a-z0-9-]{1,80})\/social$/)) && method === "GET") return json(await socialOf(DB, m[1], u && u.id));
  if ((m = path.match(/^\/api\/reviews\/([a-z0-9-]{1,80})\/react$/)) && method === "POST") {
    const k = String(body.emoji || ""); if (!REACTIONS.some(([x]) => x === k)) return bad("Pick a reaction.");
    if (!(await DB.prepare("SELECT 1 FROM reviews WHERE slug=? AND status='live'").bind(m[1]).first())) return bad("That review isn't live.", 404);
    const had = await DB.prepare("SELECT 1 FROM review_reactions WHERE slug=? AND user_id=? AND emoji=?").bind(m[1], u.id, k).first();
    if (had) await DB.prepare("DELETE FROM review_reactions WHERE slug=? AND user_id=? AND emoji=?").bind(m[1], u.id, k).run();
    else await DB.prepare("INSERT INTO review_reactions (slug,user_id,emoji,created_at) VALUES (?,?,?,?)").bind(m[1], u.id, k, Date.now()).run();
    return json(await socialOf(DB, m[1], u.id));
  }
  if ((m = path.match(/^\/api\/reviews\/([a-z0-9-]{1,80})\/comment$/)) && method === "POST") {
    const text = String(body.body || "").replace(/\s+/g, " ").trim(), name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (text.length < 2) return bad("Say a little more.");
    if (text.length > 280) return bad("Keep it to 280 characters.");
    if (/https?:\/\/|www\.|\.com\b/i.test(text)) return bad("No links in comments, please.");
    if (containsSlur(text) || containsSlur(name) || containsProfanity(name)) return bad("That includes language we don't allow on Wackometer. Try different words.");
    if (!(await DB.prepare("SELECT 1 FROM reviews WHERE slug=? AND status='live'").bind(m[1]).first())) return bad("That review isn't live.", 404);
    const recent = await DB.prepare("SELECT COUNT(*) c, MAX(created_at) last FROM review_comments WHERE user_id=? AND created_at>?").bind(u.id, Date.now() - 86400000).first();
    if (recent.c >= 15) return bad("That's a lot of takes for one day. Come back tomorrow.", 429);
    if (recent.last && Date.now() - recent.last < 20000) return bad("Give it a few seconds between comments.", 429);
    await DB.prepare("INSERT INTO review_comments (id,slug,user_id,name,body,created_at) VALUES (?,?,?,?,?,?)").bind(newId() + newId(), m[1], u.id, name || null, text, Date.now()).run();
    return json(await socialOf(DB, m[1], u.id));
  }
  if (path === "/api/artists/claim" && method === "POST") {
    const f = (k, n = 200) => String(body[k] ?? "").trim().slice(0, n);
    const slug = slugify(f("artist", 80)), email = f("email").toLowerCase(), name = f("name", 80);
    if (!(await artistTable(DB)).some((a) => a.slug === slug)) return bad("We haven't reviewed that artist yet.", 404);
    if (!name) return bad("Add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad("That doesn't look like an email address.");
    if (containsSlur(name) || containsProfanity(name)) return bad("That includes language we don't allow on Wackometer.");
    const n = await DB.prepare("SELECT COUNT(*) c FROM artist_claims WHERE (user_id=? OR email=?) AND created_at>?").bind(u.id, email, Date.now() - 86400000).first();
    if (n.c >= 3) return bad("We've got your claim. We'll email you soon.", 429);
    const handle = (h) => String(h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/i, "").replace(/[/?].*$/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30) || null;
    await DB.prepare("INSERT INTO artist_claims (id,artist_slug,name,email,role,ig,spotify,website,tiktok,proof,user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(newId(), slug, name, email, f("role") === "team" ? "team" : "artist", handle(body.ig), safeUrl(f("spotify", 300)) || null, safeUrl(f("website", 300)) || null, handle(body.tiktok), f("proof", 300) || null, u.id, Date.now()).run();
    return json({ ok: true });
  }

  if (!path.startsWith("/api/hub-admin/")) return null;
  if (!admin) return bad("Admins only.", 403);
  if (path === "/api/hub-admin/overview" && method === "GET") {
    const rows = await liveReviews(DB), months = byMonth(rows);
    const intros = Object.fromEntries((await DB.prepare("SELECT k, v FROM settings WHERE k LIKE 'list_intro:%'").all()).results.map((r) => [r.k.slice(11), r.v]));
    const lists = Object.keys(months).sort().reverse().map((k) => ({ key: k, name: monthName(k), count: months[k].length, intro: intros[k] || "", genres: monthGenres(months[k]).map(([g, n]) => ({ key: g, name: genreName(g), count: n, intro: intros[`${k}:${g}`] || "" })) }));
    const claims = (await DB.prepare("SELECT * FROM artist_claims ORDER BY status='new' DESC, created_at DESC LIMIT 200").all()).results;
    const profiles = (await DB.prepare("SELECT * FROM artist_profiles ORDER BY claimed_at DESC LIMIT 500").all()).results;
    const comments = (await DB.prepare("SELECT c.*, r.title, r.artist FROM review_comments c LEFT JOIN reviews r ON r.slug=c.slug ORDER BY c.created_at DESC LIMIT 200").all()).results;
    const genres = await genreCounts(DB);
    return json({ lists, claims, profiles, comments, genres });
  }
  if (path === "/api/hub-admin/list-intro" && method === "POST") {
    const key = String(body.key || ""); if (!/^\d{4}-\d{2}(:[a-z-]+)?$/.test(key)) return bad("Bad list.");
    const v = String(body.intro || "").trim().slice(0, 1200);
    if (v) await DB.prepare("INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(`list_intro:${key}`, v).run();
    else await DB.prepare("DELETE FROM settings WHERE k=?").bind(`list_intro:${key}`).run();
    return json({ ok: true });
  }
  if (path === "/api/hub-admin/claim" && method === "POST") {
    const c = await DB.prepare("SELECT * FROM artist_claims WHERE id=?").bind(String(body.id || "")).first();
    if (!c) return bad("No such claim.", 404);
    const status = body.status === "approved" ? "approved" : body.status === "passed" ? "passed" : "new";
    await DB.prepare("UPDATE artist_claims SET status=? WHERE id=?").bind(status, c.id).run();
    if (status === "approved") {
      await DB.prepare("INSERT INTO artist_profiles (slug,ig,spotify,website,tiktok,email,claimed_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET ig=excluded.ig, spotify=excluded.spotify, website=excluded.website, tiktok=excluded.tiktok, email=excluded.email, claimed_at=excluded.claimed_at")
        .bind(c.artist_slug, c.ig, c.spotify, c.website, c.tiktok, c.email, Date.now()).run();
      const base = env.APP_URL || BASE, link = `${base}/artists/${c.artist_slug}`;
      const htmlBody = emailShell({ base, env, preheader: "Your Wackometer artist page is yours.", eyebrow: "PAGE CLAIMED", content: `${emailHeadline(`It's official, ${c.name}.`, "Your Wackometer artist page is claimed. Your links are live on it, and we'll email you whenever we review one of your songs.")}
${eCard(`<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1F2340;padding-bottom:14px">On your page there's a badge you can put on your website or link-in-bio. It shows your average score and updates on its own.</div>${eBtn(link, "See your page")}`)}` });
      await sendMail(env, c.email, "Your Wackometer artist page is claimed", htmlBody, `It's official, ${c.name}. Your Wackometer artist page is claimed: ${link}\n\nYour links are live on it, and there's a badge you can put on your site.\n\nWackometer`);
    }
    return json({ ok: true });
  }
  if (path === "/api/hub-admin/profile" && method === "POST") {
    const slug = slugify(String(body.slug || "")); if (!slug) return bad("Which artist?");
    const f = (k, n = 300) => String(body[k] ?? "").trim().slice(0, n);
    if (body.remove) { await DB.prepare("DELETE FROM artist_profiles WHERE slug=?").bind(slug).run(); return json({ ok: true }); }
    await DB.prepare("INSERT INTO artist_profiles (slug,ig,spotify,website,tiktok,bio,claimed_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET ig=excluded.ig, spotify=excluded.spotify, website=excluded.website, tiktok=excluded.tiktok, bio=excluded.bio")
      .bind(slug, igHandle(f("ig", 80)) || null, safeUrl(f("spotify")) || null, safeUrl(f("website")) || null, igHandle(f("tiktok", 80)) || null, f("bio", 600) || null, Date.now()).run();
    return json({ ok: true });
  }
  if (path === "/api/hub-admin/comment" && method === "POST") {
    const id = String(body.id || "");
    if (body.action === "delete") await DB.prepare("DELETE FROM review_comments WHERE id=?").bind(id).run();
    else await DB.prepare("UPDATE review_comments SET hidden=? WHERE id=?").bind(body.action === "hide" ? 1 : 0, id).run();
    return json({ ok: true });
  }
  return bad("Not found", 404);
}
