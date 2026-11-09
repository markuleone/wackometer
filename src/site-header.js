// One header for every page outside the writing tools: the front page, reviews, and the rhyme/cliché pages.
// Song reviews on the left, the writing tools ("Weigh my lyrics") as a button on the right.
// Used by the worker and by scripts/seo-pages.mjs at build time, so it must stay plain JS with no imports.
export function siteHeader(active = "", q = "") {
  const a = (href, key, label) => `<a href="${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const qv = String(q).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<header class="rtop">
<a class="logo" href="/" aria-label="Wackometer home"><span class="w"><img src="/brand/wacky-w.svg" alt="" width="40" height="44"></span>ackometer</a>
<nav class="rnav" aria-label="Reviews">${a("/reviews", "reviews", "Reviews")}${a("/genres", "genres", "Genres")}${a("/lists", "lists", '<span class="nd">Wicked lists</span><span class="nm">Lists</span>')}${a("/artists", "artists", "Top artists")}${a("/get-reviewed", "submit", "Get reviewed")}</nav>
<form class="rsearch" action="/reviews" role="search"><input type="search" name="q" value="${qv}" placeholder="Search artists and songs" aria-label="Search reviews" maxlength="80"></form>
<div class="rcta"><a class="rbtn rb-w" href="/write#weigh" data-hub="write">✍️ <span class="l">Weigh my lyrics</span><span class="s">Weigh</span></a></div>
</header>`;
}
