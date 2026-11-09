// One header and one footer for the whole site. Three doors: Wreviews (the main event), Write (the free tools:
// Weigh, Wingman, Workout, the Wall, with their own tab row on /write) and Get Weighed (the $10 submission).
// Everything else lives in the footer. Used by the worker, scripts/seo-pages.mjs and the build (static pages),
// so it must stay plain JS with no imports.
const NAV = [["/", "reviews", "🎧", "Wreviews"], ["/write#weigh", "write", "✍️", "Write"], ["/get-reviewed", "submit", "⚖️", "Get Weighed"]];
const WRITE_KEYS = ["write", "wingman", "workout"];
export function siteHeader(active = "reviews", q = "") {
  const qv = String(q).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<header class="rtop">
<a class="logo" href="/" aria-label="Wackometer home"><span class="w"><svg class="wsvg" viewBox="-8 -10 194 214" aria-hidden="true" focusable="false"><path transform="translate(7 7)" d="M18 30 L52 150 L86 66 L120 154 L158 18" fill="none" stroke="#111111" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/><path transform="translate(7 7)" d="M52 150 L50 184 M120 154 L123 172" fill="none" stroke="#111111" stroke-width="24" stroke-linecap="round"/><path transform="translate(0 0)" d="M18 30 L52 150 L86 66 L120 154 L158 18" fill="none" stroke="#111111" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/><path transform="translate(0 0)" d="M52 150 L50 184 M120 154 L123 172" fill="none" stroke="#111111" stroke-width="24" stroke-linecap="round"/><path transform="translate(0 0)" d="M18 30 L52 150 L86 66 L120 154 L158 18" fill="none" stroke="#9FE03A" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><path transform="translate(0 0)" d="M52 150 L50 184 M120 154 L123 172" fill="none" stroke="#9FE03A" stroke-width="12" stroke-linecap="round"/><path d="M22 44 L30 72" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/><circle cx="34" cy="86" r="2.6" fill="#ffffff"/><path d="M151 36 L147 50" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/></svg></span>ackometer</a>
<nav class="rnav wnav" aria-label="Main">${NAV.map(([href, key, icon, label]) => `<a href="${href}" data-hub="nav_${key}"${active === key || (key === "write" && WRITE_KEYS.includes(active)) || (key === "reviews" && ![...WRITE_KEYS, "submit", "none"].includes(active)) ? ' aria-current="page"' : ""}><span class="ni" aria-hidden="true">${icon}</span> ${label}</a>`).join("")}</nav>
<form class="rsearch" action="/reviews" role="search"><input type="search" name="q" value="${qv}" placeholder="Search artists and songs" aria-label="Search reviews" maxlength="80"></form>
<div class="util"><a class="ubtn pro" href="/write#pro" title="Wingman Pro" data-hub="nav_pro">W+</a><a class="ubtn" id="acctLink" href="/write?account=1" aria-label="Sign in"><span aria-hidden="true">👤</span><span class="albl"> Sign in</span></a></div>
<script>try{var k=localStorage.getItem("wk-acct"),b=document.getElementById("acctLink");if(k&&b){b.querySelector(".albl").textContent=" "+k;b.setAttribute("aria-label","Account: "+k)}}catch(e){}</script>
</header>`;
}
const COLS = [
  ["Wreviews", [["/reviews", "Latest reviews"], ["/genres", "Genres"], ["/lists", "Wicked lists"], ["/artists", "Top artists"], ["/reviews?f=wicked", "Certified Wicked"], ["/reviews?f=videos", "Music videos"], ["/get-reviewed", "Get your song reviewed"], ["/critics", "Become a critic"]]],
  ["Write", [["/write#weigh", "Weigh your lyrics"], ["/write#wingman", "Wingman (Pro)"], ["/write#workout", "Workout"], ["/write#community", "The Wall"], ["/write#pro", "Wingman Pro"], ["/write#why", "How scoring works"]]],
  ["Words", [["/cliches/", "Cliché dictionary"], ["/rhymes/", "Fresh rhymes"], ["/syllable-counter", "Syllable counter"]]],
  ["Wackometer", [["https://instagram.com/wackometer", "Instagram @wackometer"], ["/terms", "Terms"], ["/privacy", "Privacy"]]],
];
export function siteFooterLinks() {
  return `<nav class="fcols" aria-label="Site">${COLS.map(([h, links]) => `<div><b>${h}</b>${links.map(([href, t]) => `<a href="${href}"${href.startsWith("http") ? ' target="_blank" rel="noopener me"' : ""}>${t}</a>`).join("")}</div>`).join("")}</nav>`;
}
