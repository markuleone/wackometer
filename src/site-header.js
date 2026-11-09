// One header and one footer for the whole site. Four doors, all W: Wreviews, Write, Wingman, Workout.
// Everything else lives in the footer. Used by the worker, scripts/seo-pages.mjs and the build (static pages),
// so it must stay plain JS with no imports.
const NAV = [["/", "reviews", "🎧", "Wreviews"], ["/write#weigh", "write", "✍️", "Write"], ["/write#wingman", "wingman", "🪽", "Wingman"], ["/write#workout", "workout", "🏋️", "Workout"]];
export function siteHeader(active = "reviews", q = "") {
  const qv = String(q).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<header class="rtop">
<a class="logo" href="/" aria-label="Wackometer home"><span class="w"><img src="/brand/wacky-w.svg" alt="" width="40" height="44"></span>ackometer</a>
<nav class="rnav wnav" aria-label="Main">${NAV.map(([href, key, icon, label]) => `<a href="${href}"${active === key || (key === "reviews" && !["write", "wingman", "workout"].includes(active)) ? ' aria-current="page"' : ""}><span class="ni" aria-hidden="true">${icon}</span> ${label}</a>`).join("")}</nav>
<form class="rsearch" action="/reviews" role="search"><input type="search" name="q" value="${qv}" placeholder="Search artists and songs" aria-label="Search reviews" maxlength="80"></form>
</header>`;
}
const COLS = [
  ["Wreviews", [["/reviews", "Latest reviews"], ["/genres", "Genres"], ["/lists", "Wicked lists"], ["/artists", "Top artists"], ["/reviews?f=wicked", "Certified Wicked"], ["/reviews?f=videos", "Music videos"], ["/get-reviewed", "Get your song reviewed"], ["/critics", "Become a critic"]]],
  ["Write", [["/write#weigh", "Weigh your lyrics"], ["/write#wingman", "Wingman"], ["/write#workout", "Workout"], ["/write#community", "The Wall"], ["/write#pro", "Wingman Pro"], ["/write#why", "How scoring works"]]],
  ["Words", [["/cliches/", "Cliché dictionary"], ["/rhymes/", "Fresh rhymes"], ["/syllable-counter", "Syllable counter"]]],
  ["Wackometer", [["https://instagram.com/wackometer", "Instagram @wackometer"], ["/terms", "Terms"], ["/privacy", "Privacy"]]],
];
export function siteFooterLinks() {
  return `<nav class="fcols" aria-label="Site">${COLS.map(([h, links]) => `<div><b>${h}</b>${links.map(([href, t]) => `<a href="${href}"${href.startsWith("http") ? ' target="_blank" rel="noopener me"' : ""}>${t}</a>`).join("")}</div>`).join("")}</nav>`;
}
