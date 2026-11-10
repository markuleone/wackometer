// About, FAQ and How we review: the pages that tell people (and search engines) who's behind the reviews and how they're made.
import { shell } from "./reviews.js";
import { CFG, money } from "./settings.js";

const BASE = "https://wackometer.com";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const html = (body) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" } });
const ORG = { "@type": "Organization", "@id": `${BASE}/#org`, name: "Wackometer", url: BASE, logo: `${BASE}/favicon.svg`, email: "hello@wackometer.com", sameAs: ["https://instagram.com/wackometer"], description: "Music reviews for underground and independent artists, plus free tools for songwriters." };
const crumbs = (name, path) => ({ "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Wackometer", item: BASE }, { "@type": "ListItem", position: 2, name, item: BASE + path }] });
const hero = (eye, h1, lead, ch = 1) => `<div class="gr-hero"><span class="cm cm-hero" data-tier="${ch}" aria-hidden="true"></span><p class="eyebrow">${eye}</p><h1>${h1}</h1><p class="lead">${lead}</p></div>`;
const more = `<nav class="info-more" aria-label="More about Wackometer"><a href="/about">About</a><a href="/faq">FAQ</a><a href="/editorial-standards">How we review</a><a href="/critics">Become a critic</a><a href="mailto:hello@wackometer.com">hello@wackometer.com</a></nav>`;

// Answers are plain HTML (links allowed). The FAQ schema gets a text-only copy.
const FAQ = () => {
  const price = money(CFG.review_price_cents), pro = money(CFG.review_price_pro_cents);
  return [
    ["About Wackometer", [
      ["What is Wackometer?", `A music review site for underground and independent artists. Real critics listen to new songs and score them from Wicked to Wack, and listeners vote too. We also make free tools for songwriters: <a href="/write#weigh">Weigh</a> scores your lyrics, and <a href="/write#workout">Workout</a> teaches you to write better ones.`],
      ["Who writes the reviews?", `Wackometer <a href="/critics">critics</a>: songwriters, rappers and producers whose taste we trust. Every review has the critic's name on it.`],
      ["Is Wackometer only for underground artists?", `Mostly. Our reviews, charts and lists are for artists with under 100,000 monthly Spotify listeners or without a major-label deal. Once in a while we weigh a mainstream hit for fun. Those are <a href="/reviews?f=big">the Big Ones</a>, and they never count toward our charts.`],
      ["Does Wackometer use AI?", `Every review is published by a person who listened to the whole song. Some first drafts are started with AI help, then a critic listens, rewrites and signs off. Wingman, our co-writing tool, runs on AI and says so. More on <a href="/editorial-standards">how we review</a>.`],
    ]],
    ["Scores", [
      ["How do scores work?", `Every song gets a score from 0 to 100, and lower is better: Wicked (0–19), Well put (20–39), Whatever (40–59), Weird (60–79) and Wack (80–100). Reviews also break the song down into lyrics, hook, vocals, production and replay value.`],
      ["What's the crowd score?", `Listeners vote on every review, so each song has the critic's score and the crowd's. When they disagree, you see it.`],
      ["What does Certified Wicked mean?", `The song scored under 20, our top tier. Certified Wicked artists get a badge for their website and link in bio.`],
      ["How does the lyric meter work?", `Weigh reads six things in your words, like clichés, lazy rhymes and filler, and blends them into one score from 0 to 100. It's the same scale our critics use, so you can check a verse before you record it. <a href="/write#why">See the six W-metrics</a>.`],
    ]],
    ["Getting your song reviewed", [
      ["How do I get my song reviewed?", `Send it on <a href="/get-reviewed">Get Weighed</a>. It's ${price} for a song or album (${pro} for <a href="/write#pro">Wingman Pro</a> members). A critic listens start to finish and you get written feedback.`],
      ["Does paying get me a better score?", `No. Paying gets you a guaranteed listen and written feedback, not a better score. Reviews that came in through paid submissions say so on the page, and we publish how all our scores spread out on <a href="/get-reviewed">Get Weighed</a>.`],
      ["How long does it take?", `Written feedback lands within 7 days of paying. If it doesn't, email <a href="mailto:hello@wackometer.com">hello@wackometer.com</a> and we refund you in full.`],
      ["Can I submit for free?", `Sometimes. A few times a month we open free submissions for a limited number of songs, announced on <a href="/get-reviewed">Get Weighed</a> and <a href="https://instagram.com/wackometer" target="_blank" rel="noopener">@wackometer</a>. Free picks get a listen when we can, with no 7-day promise.`],
      ["Will every song get a review page?", `No. Everyone who pays gets written feedback by email. Public review pages are for songs the critic loves, which is what makes a page worth having.`],
      ["Do you review songs live?", `Yes. We play songs live on stream. Tick "OK to play it live" when you submit and yours could be one of them. You get the clip.`],
    ]],
    ["For artists", [
      ["My song was reviewed and I didn't send it in. Is that OK?", `Yes, we find a lot of songs ourselves. If you're the artist or on their team, you can send us your lyrics with "Is this your song?" on the review page, and email <a href="mailto:hello@wackometer.com">hello@wackometer.com</a> to fix a link, a credit or anything else.`],
      ["Can my lyrics go on my review?", `Yes, if you wrote them or have the right to share them. Add them when you submit, or use "Is this your song?" on your review. We only show lyrics the artist or their team gave us permission to show.`],
      ["Can I use my review in my bio or press kit?", `Please do. Quote the review with a link back to it. Certified Wicked songs also get an official badge to embed.`],
      ["Can a review be taken down?", `Reviews are the critic's honest opinion and stay up. We fix factual mistakes fast, and we take down anything that shouldn't be there, like a wrong song or someone else's lyrics. Email <a href="mailto:hello@wackometer.com">hello@wackometer.com</a>.`],
    ]],
    ["Writing tools and accounts", [
      ["Are the writing tools free?", `Weigh, Workout and the Wall are free. Wingman Pro is the paid plan for the AI tools: Wingman, Roast and Humanize.`],
      ["Do I need an account?", `No. You can weigh lyrics without one. An account (just your email, no password) keeps your profile, streak and Pro on any device.`],
      ["How do I become a critic?", `<a href="/critics">Apply here</a>. Tell us where we can hear or read your stuff and what you listen to.`],
      ["How do I reach you?", `Email <a href="mailto:hello@wackometer.com">hello@wackometer.com</a> or DM <a href="https://instagram.com/wackometer" target="_blank" rel="noopener">@wackometer</a>.`],
    ]],
  ];
};
const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function faqPage() {
  const groups = FAQ();
  const body = `<article class="seoart gr info">
${hero("FAQ", "Questions, <em>answered</em>.", "How reviews and scores work, getting your song weighed, and the writing tools.", 2)}
<nav class="info-toc" aria-label="Topics">${groups.map(([g]) => `<a href="#${slugify(g)}">${g}</a>`).join("")}</nav>
${groups.map(([g, qs]) => `<section aria-labelledby="${slugify(g)}" class="gr-faq"><h2 id="${slugify(g)}">${g}</h2>${qs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}</section>`).join("")}
<p class="lead">Still stuck? Email <a href="mailto:hello@wackometer.com">hello@wackometer.com</a>.</p>
${more}</article>`;
  const ld = { "@context": "https://schema.org", "@graph": [{ "@type": "FAQPage", mainEntity: groups.flatMap(([, qs]) => qs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: strip(a) } }))) }, crumbs("FAQ", "/faq")] };
  return html(shell({ active: "none", path: "/faq", title: "FAQ: reviews, scores and getting your song weighed · Wackometer", desc: "How Wackometer reviews work, what Wicked to Wack means, how to get your song reviewed, and how the free songwriting tools work.", body, ld }));
}

export function aboutPage() {
  const body = `<article class="seoart gr info">
${hero("About", "Honest reviews for music that's still <em>on its way up</em>.", "Wackometer reviews songs from underground and independent artists, and makes free tools that help songwriters write better ones.", 1)}
<section aria-labelledby="whyH"><h2 id="whyH">Why we exist</h2>
<p>Most new music never gets written about. Big outlets cover artists who are already big, and the playlists and blogs that could help a new artist are hard to reach. So a lot of great songs go out with nothing on the internet about them but a streaming link.</p>
<p>Wackometer is built for those songs. We listen, we say what's great and what's wack, and we give the best ones a permanent page, a spot on our charts and a badge to prove it.</p></section>
<section aria-labelledby="whatH"><h2 id="whatH">What we do</h2>
<div class="gr-perks">
<div class="gr-perk"><span class="gr-i" aria-hidden="true">🎧</span><b>Reviews</b><p>Critics score new songs from Wicked to Wack, with a breakdown for lyrics, hook, vocals, production and replay. <a href="/reviews">Read the latest</a>.</p></div>
<div class="gr-perk"><span class="gr-i" aria-hidden="true">🏆</span><b>Charts and lists</b><p><a href="/lists">Wicked lists</a>, <a href="/artists">top artists</a> and <a href="/genres">genre pages</a>, built only from underground music.</p></div>
<div class="gr-perk"><span class="gr-i" aria-hidden="true">✍️</span><b>Tools for writers</b><p><a href="/write#weigh">Weigh</a> your lyrics on the same scale our critics use, then fix them in <a href="/write#workout">Workout</a>. Free.</p></div>
<div class="gr-perk"><span class="gr-i" aria-hidden="true">⚖️</span><b>Get weighed</b><p>Artists can <a href="/get-reviewed">send us a song</a> for a guaranteed listen and written feedback in 7 days.</p></div>
</div></section>
<section aria-labelledby="whoH"><h2 id="whoH">Who's behind it</h2>
<p>Wackometer is run by independent artists. Our reviews are written by <a href="/critics">critics</a>: songwriters, rappers and producers whose names go on every review they publish. If you've got ears people trust, <a href="/critics">apply to review</a>.</p></section>
<section aria-labelledby="howH"><h2 id="howH">How we stay honest</h2>
<p>Paying never buys a better score. Paid submissions are labeled on the page, and we publish how all our scores land. Read our <a href="/editorial-standards">editorial standards</a> for how songs get picked, scored and corrected.</p></section>
<section aria-labelledby="nameH"><h2 id="nameH">The name</h2>
<p>Everything here starts with a W. Wicked is the best a song can do. Wack is the worst. Most songs land somewhere in between, and the crew of characters you see around the site tells you which.</p></section>
<section aria-labelledby="contactH"><h2 id="contactH">Get in touch</h2>
<p>Press, partnerships, corrections or just to say hi: <a href="mailto:hello@wackometer.com">hello@wackometer.com</a>. Follow <a href="https://instagram.com/wackometer" target="_blank" rel="noopener me">@wackometer</a> for new reviews.</p></section>
${more}</article>`;
  const ld = { "@context": "https://schema.org", "@graph": [ORG, { "@type": "AboutPage", url: `${BASE}/about`, name: "About Wackometer", about: { "@id": `${BASE}/#org` } }, crumbs("About", "/about")] };
  return html(shell({ active: "none", path: "/about", title: "About Wackometer: honest reviews for underground music", desc: "Wackometer reviews songs from underground and independent artists, publishes charts built only from new music, and makes free tools for songwriters.", body, ld }));
}

export function standardsPage() {
  const body = `<article class="seoart gr info">
${hero("How we review", "Our editorial <em>standards</em>.", "How songs get picked, who scores them, how money fits in, and what we do when we get something wrong.", 4)}
<section aria-labelledby="pickH"><h2 id="pickH">How songs get picked</h2>
<p>Three ways: we find them (new releases, local scenes, and artists people tell us about), artists send them through <a href="/get-reviewed">Get Weighed</a>, or they come in during a free-submission window. We focus on artists with under 100,000 monthly Spotify listeners or without a major-label deal. Mainstream songs we weigh for fun are marked as <a href="/reviews?f=big">the Big Ones</a> and kept out of our charts.</p></section>
<section aria-labelledby="scoreH"><h2 id="scoreH">How songs get scored</h2>
<p>A critic listens to the whole song, not a preview. They score it from 0 to 100, where lower is better: Wicked (0–19), Well put (20–39), Whatever (40–59), Weird (60–79) and Wack (80–100). They break it down into lyrics, hook, vocals, production and replay value, and write what works and what doesn't. Listeners vote too, and the crowd score is shown right next to the critic's.</p></section>
<section aria-labelledby="moneyH"><h2 id="moneyH">Money and scores</h2>
<ul class="gr-checks">
<li>Paying gets a song a guaranteed listen and written feedback. It never buys a better score or a guaranteed review page.</li>
<li>Reviews that came in through paid submissions say so on the page.</li>
<li>We publish how our scores spread across every tier on <a href="/get-reviewed">Get Weighed</a>, so you can see we hand out Wack as often as it's earned.</li>
<li>Labels, managers and artists can't pay to change, remove or bump a review.</li>
</ul></section>
<section aria-labelledby="peopleH"><h2 id="peopleH">Real people, real names</h2>
<p>Every review is published under the name of the critic who stands behind it. Critics don't review their own music or music they're paid to promote. Some first drafts are started with AI help to save time on the basics, then the critic listens, rewrites and signs off. Nothing goes live until a person has heard the song.</p></section>
<section aria-labelledby="lyrH"><h2 id="lyrH">Lyrics</h2>
<p>We only show lyrics on a review when the artist or their team gave us permission. The meter's notes on those lyrics, like best line and worn-out phrases, are generated by the same scale writers use in <a href="/write#weigh">Weigh</a>.</p></section>
<section aria-labelledby="fixH"><h2 id="fixH">Corrections</h2>
<p>If we get a fact wrong (a credit, a link, a release date, the wrong song), email <a href="mailto:hello@wackometer.com">hello@wackometer.com</a> and we fix it fast. Opinions stay the critic's, but anything that shouldn't be on the page comes down.</p></section>
${more}</article>`;
  const ld = { "@context": "https://schema.org", "@graph": [ORG, { "@type": "WebPage", url: `${BASE}/editorial-standards`, name: "Wackometer editorial standards", publisher: { "@id": `${BASE}/#org` } }, crumbs("How we review", "/editorial-standards")] };
  return html(shell({ active: "none", path: "/editorial-standards", title: "How we review: Wackometer editorial standards", desc: "How Wackometer picks songs, how critics score them from Wicked to Wack, how paid submissions are labeled, and how we handle corrections.", body, ld }));
}
