// Site settings the owner can change from the back office (no code change, no redeploy).
// Stored in the settings table as cfg:<key>. Read once per request (cached for 30 seconds per worker).

export const SETTING_DEFS = [
  // [key, label, type, default, help]
  ["review_price_cents", "Song review price (cents)", "int", 1000, "What artists pay to get a song reviewed. 1000 = $10."],
  ["review_price_pro_cents", "Song review price for Pro members (cents)", "int", 700, "700 = $7."],
  ["announce", "Announcement bar", "text", "", "One line shown at the top of every review page. Leave empty to hide it."],
  ["announce_link", "Announcement link", "url", "", "Optional. Where the announcement goes when tapped."],
  ["front_latest", "Front page: latest reviews", "bool", true, ""],
  ["front_wicked_list", "Front page: this month's Wicked list", "bool", true, ""],
  ["front_top10", "Front page: Top 10 playlist", "bool", true, ""],
  ["front_genres", "Front page: genre tiles", "bool", true, ""],
  ["front_artists", "Front page: top artists", "bool", true, ""],
  ["top10_playlist", "Top 10 Spotify playlist", "spotify", "4ljZ2a0DEpeTR4iWOO3Lnb", "Paste the playlist link or ID."],
  ["playlist_walternative", "Walternative playlist", "spotify", "1M0RfvgZp1lkWCeIhHoyi6", ""],
  ["playlist_windie", "Windie playlist", "spotify", "28zLbCcAOwwMYkHrqRkYDY", ""],
  ["playlist_wrythme-and-blues", "Wrythme & Blues playlist", "spotify", "6LRkeHzJTk76yHRvKeH5fu", ""],
  ["playlist_wrock-and-wroll", "Wrock & Wroll playlist", "spotify", "6waZ4TX6p6lOoLLDj8TsyR", ""],
  ["playlist_wrap", "Wrap playlist", "spotify", "1z4IpLlUksLRMoiMprJZLi", ""],
];
const DEFAULTS = Object.fromEntries(SETTING_DEFS.map(([k, , , d]) => [k, d]));

// The current values, readable from anywhere (sync). refreshSettings() keeps it fresh.
export let CFG = { ...DEFAULTS };
let loadedAt = 0;

export async function refreshSettings(DB, force = false) {
  if (!force && Date.now() - loadedAt < 30000) return CFG;
  try {
    const { results } = await DB.prepare("SELECT k, v FROM settings WHERE k LIKE 'cfg:%'").all();
    const next = { ...DEFAULTS };
    for (const { k, v } of results) { const key = k.slice(4); if (key in DEFAULTS) next[key] = parse(key, v); }
    CFG = next; loadedAt = Date.now();
  } catch (e) {}
  return CFG;
}
const typeOf = (k) => (SETTING_DEFS.find(([x]) => x === k) || [])[2];
function parse(k, v) { const t = typeOf(k); if (t === "int") return parseInt(v, 10) || 0; if (t === "bool") return v === "1"; return String(v); }

// Clean one submitted value. Returns [ok, stored string or error].
export function cleanSetting(k, v) {
  const t = typeOf(k);
  if (!t) return [false, "Unknown setting."];
  if (t === "int") { const n = parseInt(v, 10); if (!(n >= 100 && n <= 100000)) return [false, "Prices go from 100 ($1) to 100000 ($1,000) cents."]; return [true, String(n)]; }
  if (t === "bool") return [true, v === true || v === "1" || v === "true" ? "1" : "0"];
  if (t === "spotify") { const m = String(v || "").match(/(?:playlist[/:])?([A-Za-z0-9]{22})/); if (!m) return [false, "That doesn't look like a Spotify playlist link."]; return [true, m[1]]; }
  if (t === "url") { const s = String(v || "").trim(); if (s && !/^(https:\/\/|\/)[^\s<>"]{0,300}$/.test(s)) return [false, "Links start with https:// or /."]; return [true, s]; }
  return [true, String(v || "").replace(/\s+/g, " ").trim().slice(0, 160)];
}

export const money = (c) => "$" + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
export const playlistFor = (genre) => CFG["playlist_" + genre] || "";
