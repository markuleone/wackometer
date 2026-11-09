// Ads on the content pages (front page, reviews, artists, rhymes, clichés). The writing tools at /write stay ad-free.
// Nothing shows until ADSENSE_CLIENT is set in Cloudflare, and Wingman Pro members never see ads.
// With ADSENSE_SLOT set, our own .ad-slot spots get a responsive unit each; without it, AdSense Auto ads places them.
// No imports on purpose: this file is loaded on its own by every content page.
const slots = [...document.querySelectorAll(".ad-slot")];
const bot = navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent);
if (!bot) init();

async function init() {
  let cfg;
  try { cfg = await (await fetch("/api/ads-config", { credentials: "same-origin" })).json(); } catch (e) { return; }
  if (!cfg.client || cfg.pro) return; // Pro: requests stay paused, so no ads load at all
  const manual = !!cfg.slot && slots.length;
  if (manual) slots.forEach((s) => {
    s.hidden = false;
    s.innerHTML = `<span class="ad-label">Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.client}" data-ad-slot="${cfg.slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
  });
  const go = () => { const q = (window.adsbygoogle = window.adsbygoogle || []); if (manual) slots.forEach(() => { try { q.push({}); } catch (e) {} }); q.pauseAdRequests = 0; };
  // The AdSense tag is already in the page head; only add it if this page doesn't have it.
  let s = document.querySelector('script[src*="pagead2.googlesyndication.com"]');
  if (!s) {
    s = document.createElement("script"); s.async = true; s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.client)}`;
    document.head.appendChild(s);
  }
  s.addEventListener("error", blocked);
  go();
  // If a blocker killed the head tag before we got here, AdSense never defines its loader.
  setTimeout(() => { if (!window.adsbygoogle || !window.adsbygoogle.loaded) blocked(); }, 8000);
}

// An ad blocker stopped the script: one friendly, dismissible note instead of a wall.
let noted = false;
function blocked() {
  if (noted) return; noted = true;
  slots.forEach((s) => (s.hidden = true));
  let seen = 0; try { seen = Number(localStorage.getItem("wk-adnote")) || 0; } catch (e) {}
  if (Date.now() - seen < 7 * 864e5) return;
  const host = slots[0] || document.querySelector("main"); if (!host) return;
  const n = document.createElement("div");
  n.className = "adnote"; n.setAttribute("role", "note");
  n.innerHTML = `<span><b>Ads keep Wackometer free.</b> If you like what we do, allow ads on wackometer.com, or <a href="/write#pro">go Pro</a> for no ads at all.</span><button type="button" aria-label="Dismiss">×</button>`;
  n.querySelector("button").onclick = () => { n.remove(); try { localStorage.setItem("wk-adnote", String(Date.now())); } catch (e) {} };
  if (slots[0]) { slots[0].hidden = false; slots[0].classList.add("is-note"); slots[0].replaceChildren(n); } else host.prepend(n);
}
