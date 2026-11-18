// Static search landing pages, generated at build time:
//   /rhymes/            index of rhyme pages     /rhymes/<word>   perfect + slant rhymes, lazy-rhyme warnings
//   /cliches/           index of clichés          /cliches/<slug>  why it's wack + fresh swaps
//   /syllable-counter   a live syllable counter for lyrics
// Each page is tiny, plain HTML with the shared stylesheet, so they load instantly and index well.
import { adsenseTag } from "../src/ads-tag.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { CLICHES } from "../web/js/score.js";
import { SWAPS } from "../web/js/swaps.js";
import { siteHeader, siteFooterLinks } from "../src/site-header.js";

const BASE = "https://wackometer.com";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const DBV = `<a class="dbv" href="https://donebyverde.com" target="_blank" rel="noopener noreferrer" aria-label="Website by donebyverde (opens in a new tab)" title="Website by donebyverde"><svg viewBox="0 0 200 200" aria-hidden="true"><path d="M75 0H125L123 61L174 28L200 72L146 100L200 128L174 172L123 139L125 200H75L77 139L26 172L0 128L54 100L0 72L26 28L77 61Z"/></svg></a>`;

let CSS = "/css/site.css";
let ADS = "";
// First-party counters for landing pages: one "view", which kind of page they landed on, and where they came from.
const TRACK = (path) => `(function(){try{if(navigator.webdriver||/bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent))return;var land=${JSON.stringify(path.startsWith("/rhymes") ? "rhymes" : path.startsWith("/cliches") ? "cliches" : "syllables")};var r=document.referrer,h="";try{h=r?new URL(r).hostname.replace(/^www\\./,""):""}catch(e){}var m=[["google","google"],["bing","bing"],["duckduckgo","duckduckgo"],["instagram","instagram"],["tiktok","tiktok"],["facebook","facebook"],["t.co","x"],["twitter","x"],["x.com","x"],["reddit","reddit"],["youtube","youtube"],["chatgpt","chatgpt"],["perplexity","perplexity"]],s=h?"other":"direct";if(h.indexOf("wackometer")>-1)return;for(var i=0;i<m.length;i++)if(h.indexOf(m[i][0])>-1){s=m[i][1];break}var send=function(t){fetch("/api/event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:t}),keepalive:true})};send("view");send("land:"+land);send("src:"+s);fetch("/api/landing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({path:location.pathname,src:s}),keepalive:true})}catch(e){}})();`;
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
<meta name="theme-color" content="#FFFFFF">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="${CSS}">
<meta name="color-scheme" content="light only">
<script>(function(c,l,a,r,i,t,y){if(navigator.webdriver||/bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent))return;c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","z8yr2p57ys");</script>
<script>${TRACK(path)}</script>
${adsenseTag()}
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}
</head>
<body>
<div class="wrap seo">
${siteHeader("none")}
<main id="main">
${body}
<div class="ad-slot" hidden></div>
<section class="seorev" id="seoRev" hidden aria-labelledby="seoRevH"><div class="frh"><h2 id="seoRevH">Fresh off the Wackometer</h2><a href="/reviews">All reviews <span aria-hidden="true">→</span></a></div><p class="hint">New songs we just weighed, Wicked to Wack.</p><div class="seorev-list" id="seoRevList"></div></section>
<script>(function(){var N=["Wicked","Well put","Whatever","Weird","Wack"],e=function(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
fetch("/api/reviews/latest").then(function(r){return r.json()}).then(function(l){if(!l||!l.length)return;document.getElementById("seoRevList").innerHTML=l.slice(0,4).map(function(r){var t=r.score>=80?4:r.score>=60?3:r.score>=40?2:r.score>=20?1:0;return '<a class="bcard" href="/reviews/'+e(r.slug)+'"><img src="'+e(r.cover_url)+'" alt="" width="64" height="64" loading="lazy"><span class="bct"><b>'+e(r.title)+'</b><span>'+e(r.artist)+'</span></span><span class="bsc bg-t'+t+'">'+N[t]+' '+r.score+'</span></a>'}).join("");document.getElementById("seoRev").hidden=false}).catch(function(){})})();</script>
<div class="cta"><b>How wack are your lyrics?</b><p>Paste a verse into the Wackometer. It scores it from Wicked to Wack, circles the clichés and lazy rhymes, and shows you how to fix them.</p><a class="btn bile" href="/write#weigh">Weigh my lyrics, free</a></div>
</main>
<footer>${siteFooterLinks()}${DBV}</footer>
</div>
${ADS ? `<script type="module" src="${ADS}"></script>` : ""}
</body>
</html>`;
}
const crumbs = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([n, p], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: BASE + p })) });

export function buildSeoPages(OUT, cssHref, adsHref) {
  if (cssHref) CSS = cssHref;
  if (adsHref) ADS = adsHref;
  const urls = [];
  const write = (path, html) => { const file = path.endsWith("/") ? `${OUT}${path}index.html` : `${OUT}${path}.html`; mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true }); writeFileSync(file, html.replace(/\n\s+/g, "\n")); urls.push(path); };

  // ----- rhymes -----
  const { pages, lazy } = JSON.parse(readFileSync("scripts/rhyme-pages.json", "utf8"));
  const lazyOf = {}; lazy.forEach((g) => g.forEach((w) => (lazyOf[w] = g)));
  const words = Object.keys(pages).sort();
  const FAMILY = {}; words.forEach((x) => { const rp = pages[x].rp; if (rp && (pages[x].perfect.length || pages[x].near.length)) (FAMILY[rp] ||= []).push(x); });
  for (const w of words) {
    const p = pages[w]; if (!p.perfect.length && !p.near.length) continue;
    const L = lazyOf[w];
    const bySyl = {}; p.perfect.forEach((r, i) => { const n = (p.psyl && p.psyl[i]) || 1; (bySyl[n] ||= []).push(r); });
    const chips = (list) => list.map((r) => { const lz = L && L.includes(r) ? " lazy" : ""; return pages[r] ? `<a class="rchip${lz}" href="/rhymes/${r}">${esc(r)}</a>` : `<span class="rchip${lz}"${lz ? ' title="Lazy rhyme"' : ""}>${esc(r)}</span>`; }).join("");
    // Everything below is worked out from the word's sound, so every page says something specific about its word.
    const syl = p.syl || 1, st = String(p.stress || "");
    const stressAt = st.indexOf("1") >= 0 ? st.indexOf("1") + 1 : 1;
    const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth"];
    const nP = p.perfect.length, nN = p.near.length;
    const level = nP < 10 ? ["Hard to rhyme", `Only ${nP} common perfect rhyme${nP === 1 ? "" : "s"}, so slant rhymes are your friend here. Listeners forgive a near rhyme far more than a forced one.`]
      : nP < 30 ? ["Medium", `${nP} perfect rhymes to choose from: enough room to pick one that fits the meaning instead of one that just fits the sound.`]
      : ["Easy to rhyme", `${nP}+ perfect rhymes, which is a trap: the obvious ones are in a thousand songs already. Reach past the first few, or go for a two-syllable rhyme.`];
    const multi = p.perfect.filter((r, i) => ((p.psyl && p.psyl[i]) || 1) > Math.max(1, syl)).slice(0, 8);
    const fresh = p.perfect.filter((r) => !(L && L.includes(r))).slice(Math.min(6, Math.floor(nP / 3)), Math.min(6, Math.floor(nP / 3)) + 6);
    const family = (FAMILY[p.rp] || []).filter((x) => x !== w).slice(0, 14);
    const famLabel = p.rp ? p.rp.replace(/\d/g, "").toLowerCase() : "";
    const top8 = p.perfect.slice(0, 8), near5 = p.near.slice(0, 5);
    const faq = [
      [`What rhymes with ${w}?`, top8.length ? `The most common perfect rhymes for ${w} are ${top8.join(", ")}.${nN ? ` For something less expected, try a slant rhyme like ${near5.slice(0, 3).join(", ")}.` : ""}` : `${w} has almost no perfect rhymes in everyday English. Use a slant rhyme like ${near5.join(", ")}.`],
      ...(nN ? [[`What is a slant rhyme for ${w}?`, `Slant rhymes share the vowel sound of ${w} without matching it exactly: ${near5.join(", ")}. They sound fresher than perfect rhymes because the listener doesn't see them coming.`]] : []),
      [`How many syllables are in ${w}?`, `${w} has ${syl} syllable${syl > 1 ? "s" : ""}${syl > 1 ? `, with the stress on the ${ORD[stressAt] || stressAt + "th"}` : ""}. Rhymes land hardest when the stressed syllables line up.`],
    ];
    const body = `<article class="seoart">
<p class="eyebrow"><a href="/rhymes/">Rhymes</a></p>
<h1>Words that rhyme with ${esc(w)}</h1>
<p class="lead">${nP} perfect rhymes and ${nN} slant rhymes for “${esc(w)}”, picked from everyday words${L ? `. Heads up: ${esc(w)} is on the Wackometer's lazy-rhyme list` : ", sorted by how common they are"}.</p>
<div class="rfacts"><div><b>${syl}</b><span>syllable${syl > 1 ? "s" : ""}</span></div>${syl > 1 ? `<div><b>${ORD[stressAt] || stressAt}</b><span>stressed syllable</span></div>` : ""}<div><b>${nP}</b><span>perfect rhymes</span></div><div><b>${level[0]}</b><span>difficulty</span></div></div>
${L ? `<div class="warn"><b>🤢 Lazy rhyme alert</b><p>${L.map(esc).join(" / ")} is one of the most overused rhyme families in pop songs. The Wackometer flags it as a <em>wimpy rhyme</em>. Try a slant rhyme from the list below, or rhyme two syllables at once.</p></div>` : ""}
${nP ? `<h2>Perfect rhymes</h2>${Object.keys(bySyl).sort((a, b) => a - b).map((n) => `<h3>${n} syllable${n > 1 ? "s" : ""}</h3><div class="rchips">${chips(bySyl[n])}</div>`).join("")}` : ""}
${nN ? `<h2>Slant rhymes (fresher)</h2><p class="hint">Same vowel sounds, different consonants. Listeners hear the rhyme without seeing it coming.</p><div class="rchips">${chips(p.near)}</div>` : ""}
<h2>How to rhyme “${esc(w)}” without sounding wack</h2>
<p><b>${level[0]}.</b> ${level[1]}</p>
${fresh.length ? `<p><b>Skip the first rhyme that comes to mind.</b> Everyone reaches for ${esc(p.perfect.slice(0, 2).join(" or "))}. Rhymes a little further down the list, like ${fresh.map(esc).join(", ")}, still land clean but feel like you picked them on purpose.</p>` : ""}
${multi.length ? `<p><b>Go longer.</b> Ending a line on a word with more syllables, like ${multi.slice(0, 4).map(esc).join(", ")} gives the rhyme more weight, especially at the end of a hook.</p>` : ""}
${nN ? `<p><b>Bend it.</b> A slant rhyme like ${near5.slice(0, 3).map(esc).join(", ")} keeps the vowel and changes the ending, the trick most rappers use to keep a run of rhymes going.</p>` : ""}
<p><b>Check it.</b> Paste your verse into the <a href="/write#weigh">Wackometer</a> and it flags lazy rhymes, clichés and filler for you.</p>
${family.length ? `<h2>Same rhyme family</h2><p class="hint">Words that end on the same sound as ${esc(w)}. Each one has its own page of rhymes.</p><div class="rchips">${family.map((x) => `<a class="rchip" href="/rhymes/${x}">${esc(x)}</a>`).join("")}</div>` : ""}
<h2>Questions about rhyming ${esc(w)}</h2>
${faq.map(([q, a2]) => `<details><summary>${esc(q)}</summary><p>${esc(a2)}</p></details>`).join("")}
<h2>Write with it</h2><p>Want a beat to practice on? <a href="/write#storm">Wordstorm</a> drops words like “${esc(w)}” on the beat with rhymes underneath, so you can freestyle with them. More free tools on the <a href="/tools">writing tools</a> page.</p>
</article>`;
    write(`/rhymes/${w}`, page({ path: `/rhymes/${w}`, title: `Words that rhyme with ${w} (perfect + slant rhymes) · Wackometer`, desc: `Rhymes for ${w}: ${p.perfect.slice(0, 6).concat(p.near.slice(0, 4)).join(", ")} and more. ${nP} perfect and ${nN} slant rhymes for songwriters, with lazy rhymes flagged.`, body,
      ld: [crumbs([["Rhymes", "/rhymes/"], [w, `/rhymes/${w}`]]), { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a2]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a2 } })) }] }));
  }
  const letters = {}; words.forEach((w) => (letters[w[0]] ||= []).push(w));
  write("/rhymes/", page({ path: "/rhymes/", title: "Rhyming dictionary for songwriters: fresh and slant rhymes · Wackometer", desc: "Find rhymes that aren't lazy. Perfect rhymes and slant rhymes for hundreds of words, with the overused ones (fire/desire, heart/apart) flagged.",
    body: `<article class="seoart"><h1>Rhymes for songwriters</h1><p class="lead">Perfect rhymes, slant rhymes, and a warning when you're about to rhyme fire with desire. Pick a word.</p>${Object.keys(letters).sort().map((l) => `<h2>${l.toUpperCase()}</h2><div class="rchips">${letters[l].map((w) => `<a class="rchip" href="/rhymes/${w}">${esc(w)}</a>`).join("")}</div>`).join("")}</article>` }));

  // ----- clichés -----
  const SORTED = [...CLICHES].sort((x, y) => x.localeCompare(y));
  const cap = (c) => c[0].toUpperCase() + c.slice(1);
  for (const c of CLICHES) {
    const sw = SWAPS[c] || []; const s = slug(c);
    const i = SORTED.indexOf(c);
    const near = [-2, -1, 1, 2, 3].map((d) => SORTED[(i + d + SORTED.length) % SORTED.length]).filter((x) => x !== c);
    const body = `<article class="seoart cbook">
<p class="eyebrow"><a href="/cliches/">The Wackometer Book of Clichés</a></p>
<div class="centry big"><h1 class="chw">${esc(cap(c))}</h1><span class="cpos">phrase · worn smooth from overuse</span>
<p class="cdef">Heard so often your listener finishes it before you do, and that's the moment they stop listening.</p></div>
<h2 class="csub">Instead, try</h2>
<ol class="cswaps">${sw.map((x) => `<li>“${esc(x)}”</li>`).join("")}</ol>
<p class="hint">Starting points, not answers. The best swap is the one only you could write: a real place, a real object, a real moment.</p>
<h2 class="csub">How to fix any cliché</h2>
<ol class="cfix"><li>Ask what the phrase is trying to say (heartbreak, freedom, devotion).</li><li>Find one object or moment from your own life that shows it.</li><li>Describe that thing plainly. Specific beats poetic.</li></ol>
<p class="csee"><i>See also:</i> ${near.map((n) => `<a href="/cliches/${slug(n)}">${esc(n)}</a>`).join(" · ")}</p>
<p>Paste your lyrics into the <a href="/write#weigh">Wackometer</a> and it highlights every cliché in this book. Tap one to swap it in place.</p>
</article>`;
    write(`/cliches/${s}`, page({ path: `/cliches/${s}`, title: `“${c}” cliché: fresh alternatives for songwriters · Wackometer`, desc: `Stop writing “${c}”. Fresh, specific lyric alternatives${sw[0] ? ` like “${sw[0]}”` : ""}, and how to fix any cliché in your songs.`, body, ld: crumbs([["Book of Clichés", "/cliches/"], [c, `/cliches/${s}`]]) }));
  }
  const byL = {}; for (const c of SORTED) (byL[c[0].toUpperCase()] ||= []).push(c);
  write("/cliches/", page({ path: "/cliches/", title: `The Book of Clichés: ${CLICHES.length} phrases songwriters overuse (and what to write instead) · Wackometer`, desc: "A dictionary of the clichés people actually say and sing, from “at the end of the day” to “head over heels”, each with fresh lyric alternatives.",
    body: `<article class="seoart cbook"><p class="eyebrow">Revised edition · ${CLICHES.length} entries</p><h1 class="ctitle">The Wackometer Book of Clichés</h1><p class="lead">The phrases everybody says, everybody sings, and nobody hears anymore. Look one up, then write something only you could have written.</p>
<nav class="cletters" aria-label="Jump to letter">${Object.keys(byL).map((l) => `<a href="#l-${l}">${l}</a>`).join("")}</nav>
${Object.entries(byL).map(([l, cs]) => `<section class="cletter" id="l-${l}"><h2 class="cl">${l}</h2>${cs.map((c) => `<a class="centry" href="/cliches/${slug(c)}"><b class="chw">${esc(cap(c))}</b> <span class="cpos">phr.</span> <span class="ctry">Try: “${esc((SWAPS[c] || [""])[0])}”</span></a>`).join("")}</section>`).join("")}
</article>` }));

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
