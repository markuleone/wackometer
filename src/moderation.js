// Content filter.
// - Hate slurs are blocked everywhere (names, bios, lyrics, Pen lines, battles).
// - General profanity is blocked in public identity fields (usernames, display names, bios, titles)
//   but allowed in lyrics, because plenty of real songs curse.
// Matching normalizes common dodges: leetspeak (4→a, 3→e, 1→i, 0→o, $→s…), repeated letters and
// separators (f.u.c.k, f u c k).

// Stored as reversed strings so the source isn't a wall of slurs; they're un-reversed at load.
const SLURS_R = ["reggin", "aggin", "zaggin", "toggaf", "togaf", "gaf", "ekyd", "knihc", "nooc", "cips", "kcips", "kcabtew", "daehgar", "daehlewot", "ekik", "koog", "ynnart", "drater", "dedrater", "reggindnas", "renaeb", "ikap", "elamehs", "daehreppiz", "yeknomhcrop", "ynnubelgnuj", "gowillog"];
const PROFANITY_R = ["kcuf", "gnikcuf", "rekcuf", "rekcufrehtom", "tihs", "hctib", "tnuc", "kcid", "ssip", "elohssa", "ssa", "dratsab", "kcoc", "knaw", "reknaw", "zzij", "erohw", "tuls", "nrop", "yssup", "sinep", "anigav", "muc", "odlid", "tawt"];
const rev = (s) => [...s].reverse().join("");
const SLURS = [...new Set(SLURS_R.map(rev))];
const PROFANITY = [...new Set(PROFANITY_R.map(rev))];

const LEET = { "4": "a", "@": "a", "3": "e", "1": "i", "!": "i", "|": "i", "0": "o", "$": "s", "5": "s", "7": "t", "+": "t", "8": "b", "9": "g" };
function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[4@3!1|0$57+89]/g, (c) => LEET[c] || c);
}
// Words, plus a squashed version with separators removed (catches "f.u.c.k" and "n i g").
function tokens(text) {
  const n = normalize(text);
  const words = n.split(/[^a-z]+/).filter(Boolean).map((w) => w.replace(/(.)\1{2,}/g, "$1$1"));
  const squashed = n.replace(/[^a-z]/g, "").replace(/(.)\1{2,}/g, "$1$1");
  // Glue runs of single letters back together: "f u c k" / "f.u.c.k" -> "fuck".
  const glued = []; let run = "";
  for (const w of words) { if (w.length === 1) run += w; else { if (run.length > 1) glued.push(run); run = ""; glued.push(w); } }
  if (run.length > 1) glued.push(run);
  return { words: glued.concat(words), squashed };
}
const hasWord = (words, list) => words.some((w) => list.some((b) => w === b || w === b + "s" || w === b + "z" || (b.length >= 5 && w.startsWith(b))));

// Short slurs only match as whole words; long ones also match inside squashed text.
export function containsSlur(text) {
  const { words, squashed } = tokens(text);
  if (hasWord(words, SLURS)) return true;
  return SLURS.some((b) => b.length >= 6 && squashed.includes(b));
}
export function containsProfanity(text) {
  const { words, squashed } = tokens(text);
  if (hasWord(words, PROFANITY)) return true;
  return PROFANITY.some((b) => b.length >= 5 && squashed.includes(b));
}
// For names, usernames, bios, titles: no slurs, no profanity.
export function cleanIdentity(...fields) { return !fields.some((f) => f && (containsSlur(f) || containsProfanity(f))); }
// For lyrics: no slurs. Profanity is fine.
export function cleanLyrics(text) { return !containsSlur(text); }
