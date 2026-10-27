// Static search landing pages, generated at build time:
//   /rhymes/            index of rhyme pages     /rhymes/<word>   perfect + slant rhymes, lazy-rhyme warnings
//   /cliches/           index of clichés          /cliches/<slug>  why it's wack + fresh swaps
//   /syllable-counter   a live syllable counter for lyrics
// Each page is tiny, plain HTML with the shared stylesheet, so they load instantly and index well.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { CLICHES, SWAPS } from "../web/js/score.js";

const BASE = "https://wackometer.com";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const DBV = `<a class="dbv" href="https://donebyverde.com" target="_blank" rel="noopener noreferrer" aria-label="Website by donebyverde (opens in a new tab)" title="Website by donebyverde"><svg viewBox="0 0 200 200" aria-hidden="true"><path d="M75 0H125L123 61L174 28L200 72L146 100L200 128L174 172L123 139L125 200H75L77 139L26 172L0 128L54 100L0 72L26 28L77 61Z"/></svg></a>`;

let CSS = "/css/site.css";
function page({ path, title, desc, body, ld }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${BASE}/og.png">
<meta property="og:url" content="${BASE}${path}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FBFCFF">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="${CSS}">
<script>try{var t=localStorage.getItem("wk-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}
</head>
<body>
<div class="wrap seo">
<header class="top"><a class="logo" href="/" aria-label="Wackometer home"><span class="w">W</span>ackometer</a>
<nav id="mainNav" aria-label="Tools"><a href="/">⚖️ Weigh</a><a href="/#wash">🫧 Wash</a><a href="/#storm">🎤 Wordstorm</a><a href="/#workshop">🏋️ Workshop</a><a href="/rhymes/">Rhymes</a><a href="/cliches/">Clichés</a><a href="/syllable-counter">Syllables</a></nav></header>
<main id="main">
${body}
<div class="cta"><b>How wack are your lyrics?</b><p>Paste a verse into the Wackometer. It scores it from Wicked to Wack, circles the clichés and lazy rhymes, and shows you how to fix them.</p><a class="btn bile" href="/">Weigh my lyrics, free</a></div>
</main>
<footer><p class="flinks">Wackometer · <a href="/rhymes/">Fresh rhymes</a> · <a href="/cliches/">Cliché fixer</a> · <a href="/syllable-counter">Syllable counter</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></p>${DBV}</footer>
</div>
</body>
</html>`;
}
const crumbs = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([n, p], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: BASE + p })) });

export function buildSeoPages(OUT, cssHref) {
  if (cssHref) CSS = cssHref;
  const urls = [];
  const write = (path, html) => { const file = path.endsWith("/") ? `${OUT}${path}index.html` : `${OUT}${path}.html`; mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true }); writeFileSync(file, html.replace(/\n\s+/g, "\n")); urls.push(path); };

  // ----- rhymes -----
  const { pages, lazy } = JSON.parse(readFileSync("scripts/rhyme-pages.json", "utf8"));
  const lazyOf = {}; lazy.forEach((g) => g.forEach((w) => (lazyOf[w] = g)));
  const words = Object.keys(pages).sort();
  for (const w of words) {
    const p = pages[w]; if (!p.perfect.length && !p.near.length) continue;
    const L = lazyOf[w];
    const bySyl = {}; p.perfect.forEach((r, i) => { const n = (p.psyl && p.psyl[i]) || 1; (bySyl[n] ||= []).push(r); });
    const chips = (list) => list.map((r) => { const lz = L && L.includes(r) ? " lazy" : ""; return pages[r] ? `<a class="rchip${lz}" href="/rhymes/${r}">${esc(r)}</a>` : `<span class="rchip${lz}"${lz ? ' title="Lazy rhyme"' : ""}>${esc(r)}</span>`; }).join("");
    const body = `<article class="seoart">
<p class="eyebrow"><a href="/rhymes/">Rhymes</a></p>
<h1>Words that rhyme with ${esc(w)}</h1>
<p class="lead">${p.perfect.length} perfect rhymes and ${p.near.length} slant rhymes for “${esc(w)}”, picked from everyday words${L ? `. Heads up: ${esc(w)} is on the Wackometer's lazy-rhyme list` : ", sorted by how common they are"}.</p>
${L ? `<div class="warn"><b>🤢 Lazy rhyme alert</b><p>${L.map(esc).join(" / ")} is one of the most overused rhyme families in pop songs. The Wackometer flags it as a <em>wimpy rhyme</em>. Try a slant rhyme from the list below, or rhyme two syllables at once.</p></div>` : ""}
${p.perfect.length ? `<h2>Perfect rhymes</h2>${Object.keys(bySyl).sort((a, b) => a - b).map((n) => `<h3>${n} syllable${n > 1 ? "s" : ""}</h3><div class="rchips">${chips(bySyl[n])}</div>`).join("")}` : ""}
${p.near.length ? `<h2>Slant rhymes (fresher)</h2><p class="hint">Same vowel sounds, different consonants. Listeners hear the rhyme without seeing it coming.</p><div class="rchips">${chips(p.near)}</div>` : ""}
<h2>Write with it</h2><p>Want a beat to practice on? <a href="/#storm">Wordstorm</a> drops words like “${esc(w)}” on the beat with rhymes underneath, so you can freestyle with them.</p>
</article>`;
    write(`/rhymes/${w}`, page({ path: `/rhymes/${w}`, title: `Words that rhyme with ${w} (perfect + slant rhymes) · Wackometer`, desc: `Rhymes for ${w}: ${p.perfect.slice(0, 6).concat(p.near.slice(0, 4)).join(", ")} and more. Perfect and slant rhymes for songwriters, with lazy rhymes flagged.`, body, ld: crumbs([["Rhymes", "/rhymes/"], [w, `/rhymes/${w}`]]) }));
  }
  const letters = {}; words.forEach((w) => (letters[w[0]] ||= []).push(w));
  write("/rhymes/", page({ path: "/rhymes/", title: "Rhyming dictionary for songwriters: fresh and slant rhymes · Wackometer", desc: "Find rhymes that aren't lazy. Perfect rhymes and slant rhymes for hundreds of words, with the overused ones (fire/desire, heart/apart) flagged.",
    body: `<article class="seoart"><h1>Rhymes for songwriters</h1><p class="lead">Perfect rhymes, slant rhymes, and a warning when you're about to rhyme fire with desire. Pick a word.</p>${Object.keys(letters).sort().map((l) => `<h2>${l.toUpperCase()}</h2><div class="rchips">${letters[l].map((w) => `<a class="rchip" href="/rhymes/${w}">${esc(w)}</a>`).join("")}</div>`).join("")}</article>` }));

  // ----- clichés -----
  for (const c of CLICHES) {
    const sw = SWAPS[c] || []; const s = slug(c);
    const body = `<article class="seoart">
<p class="eyebrow"><a href="/cliches/">Cliché fixer</a></p>
<h1>“${esc(c)}”: the cliché, and what to write instead</h1>
<p class="lead">“${esc(c[0].toUpperCase() + c.slice(1))}” is on the Wackometer's list of worn-out phrases. Your listener has heard it so many times they finish it before you do, and that's the moment they stop listening.</p>
<h2>Fresh swaps for “${esc(c)}”</h2>
<ul class="swaps">${sw.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<p class="hint">These are starting points. The best swap is the one only you could write: a real place, a real object, a real moment.</p>
<h2>How to fix any cliché</h2>
<ol><li>Ask what the phrase is trying to say (heartbreak, freedom, devotion).</li><li>Find one object or moment from your own life that shows it.</li><li>Describe that thing plainly. Specific beats poetic.</li></ol>
<p>Paste your lyrics into the <a href="/">Wackometer</a> and it highlights every cliché it knows. Tap one to swap it in place.</p>
</article>`;
    write(`/cliches/${s}`, page({ path: `/cliches/${s}`, title: `“${c}” cliché: fresh alternatives for songwriters · Wackometer`, desc: `Stop writing “${c}”. Fresh, specific lyric alternatives${sw[0] ? ` like “${sw[0]}”` : ""}, and how to fix any cliché in your songs.`, body, ld: crumbs([["Cliché fixer", "/cliches/"], [c, `/cliches/${s}`]]) }));
  }
  write("/cliches/", page({ path: "/cliches/", title: `The ${CLICHES.length} most overused lyric clichés (and what to write instead) · Wackometer`, desc: "Every cliché the Wackometer flags in song lyrics, with fresh, specific alternatives for each one.",
    body: `<article class="seoart"><h1>Lyric clichés and how to fix them</h1><p class="lead">These ${CLICHES.length} phrases make the Wackometer gag. Each one links to fresh swaps you can steal and twist.</p><div class="rchips">${CLICHES.map((c) => `<a class="rchip" href="/cliches/${slug(c)}">${esc(c)}</a>`).join("")}</div></article>` }));

  // ----- syllable counter -----
  write("/syllable-counter", page({ path: "/syllable-counter", title: "Syllable counter for lyrics and poems, line by line · Wackometer", desc: "Free syllable counter for songwriters. Paste lyrics and see syllables per line, so your verses fit the beat.",
    ld: { "@context": "https://schema.org", "@type": "WebApplication", name: "Wackometer Syllable Counter", url: BASE + "/syllable-counter", applicationCategory: "MusicApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    body: `<article class="seoart"><h1>Syllable counter for lyrics</h1><p class="lead">Paste your lyrics. Each line's syllable count shows up live, so you can spot the line that rushes or drags before you're in the booth.</p>
<label class="hint" for="sc">Your lyrics</label><textarea id="sc" spellcheck="false" placeholder="Paste a verse…"></textarea>
<div id="scOut" class="scout" aria-live="polite"></div>
<h2>Why syllables matter</h2><p>Lines that sit in the same syllable range fit the same pocket on the beat. When one line has 6 syllables and the next has 14, you either rush or stretch. Keep lines close, then break the pattern on purpose when you want a moment to hit.</p>
<script>
function syl(w){w=w.toLowerCase().replace(/[^a-z]/g,"");if(!w)return 0;if(w.length<=3)return 1;w=w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,"").replace(/^y/,"");var m=w.match(/[aeiouy]{1,2}/g);return Math.max(1,m?m.length:1)}
var t=document.getElementById("sc"),o=document.getElementById("scOut");
function run(){var ls=t.value.split(/\\n/),tot=0,rows=ls.map(function(l){var n=(l.match(/[A-Za-z']+/g)||[]).reduce(function(a,w){return a+syl(w)},0);tot+=n;return l.trim()?'<div class="scl"><b>'+n+'</b><span>'+l.replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c]})+'</span></div>':''}).join("");o.innerHTML=rows?rows+'<p class="hint">'+tot+' syllables total</p>':''}
t.addEventListener("input",run);
</script></article>` }));
  return urls;
}
