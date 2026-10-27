// Workshop: short lessons that fix the habit, not just the verse.
// Each drill is checked by the same engine that scores your lyrics, so passing means you actually did it.
import { analyze, words, lineSyllables, bestLine, FILLER, WEIGHTLESS, CLICHES } from "./score.js";

const lines = (t) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const need = (t, n) => (lines(t).length < n ? `Write at least ${n} lines first.` : null);

export const LESSONS = [
  { id: "worn", metric: "worn", title: "Kill the cliché", sub: "Worn-out phrases", xp: 20,
    why: "A cliché is a phrase your listener has already finished in their head before you sing it. The moment they can predict you, they stop listening. Fresh writing says the same feeling with a picture only you would pick.",
    before: "You break my heart\nTears fall like rain", after: "You left me on read for a year\nMascara drew a map down to my chin",
    drill: "Write 4 lines about a breakup. Zero clichés. The meter knows 70+ of them.",
    check: (t) => need(t, 4) || (analyze(t).found.length ? `Caught one: "${analyze(t).found[0][0]}". Swap it for something you saw.` : true) },
  { id: "wimpy", metric: "wimpy", title: "Earn your rhymes", sub: "Wimpy rhymes", xp: 20,
    why: "Fire/desire, heart/apart, night/light: these are the rhymes everyone reaches for first, so they feel automatic. Push past the first rhyme you think of. Slant rhymes (window/pillow) and multi-syllable rhymes sound smarter and surprise the ear.",
    before: "I feel the fire inside\nThis burning desire I can't hide", after: "I've got a stovetop left on high\nI keep forgetting, I keep driving by",
    drill: "Write 4 lines that rhyme in pairs (AABB). No lazy pairs allowed.",
    check: (t) => need(t, 4) || (analyze(t).vals.wimpy > 0 ? "The meter spotted a lazy pair at the line ends. Try a slant rhyme instead." : true) },
  { id: "weightless", metric: "weightless", title: "Show, don't tell", sub: "Weightless words", xp: 25,
    why: "Love, soul, pain, dreams: big words that name a feeling but don't make anyone feel it. Concrete details (a smell, an object, a place) let the listener feel it themselves, which hits harder than being told.",
    before: "My love for you is endless\nYou are my soul, my everything", after: "I still save you the last fry\nI know your coffee order better than mine",
    drill: "Write 4 lines about missing someone without love, heart, soul, pain, dream, life, forever or any other big abstract word.",
    check: (t) => { const n = need(t, 4); if (n) return n; const bad = words(t).filter((w) => WEIGHTLESS.has(w)); return bad.length ? `"${bad[0]}" is a weightless word. Show it with an object instead.` : true; } },
  { id: "variety", metric: "variety", title: "Stretch your vocab", sub: "Word variety", xp: 20,
    why: "Repeating the same words makes a verse feel smaller than it is. Hooks repeat on purpose; verses should keep moving and give the ear new words to chew on.",
    before: "I want you, I need you\nI want you here, I need you near", after: "I want you in the passenger seat\nArguing with the GPS, singing off-beat",
    drill: "Write 6 lines without using any word longer than 3 letters twice.",
    check: (t) => { const n = need(t, 6); if (n) return n; const seen = new Set(); for (const w of words(t)) { if (w.length <= 3) continue; if (seen.has(w)) return `You used "${w}" twice. Find another word for one of them.`; seen.add(w); } return true; } },
  { id: "wasted", metric: "wasted", title: "Cut the padding", sub: "Wasted words", xp: 15,
    why: "Yeah, ooh, baby, na na: a little is style, a lot is a writer stalling. If a line only works with filler, the line isn't done yet. Make every syllable carry something.",
    before: "Oh baby yeah you know\nOoh I miss you so", after: "Your toothbrush is still in the cup\nI keep it like a ticket stub",
    drill: "Write a 4-line hook with zero filler words (no yeah, oh, ooh, baby, hey, na).",
    check: (t) => { const n = need(t, 4); if (n) return n; const f = words(t).filter((w) => FILLER.has(w)); return f.length ? `Spotted "${f[0]}". Replace it with a real word.` : true; } },
  { id: "wallpaper", metric: "wallpaper", title: "Make the hook earn it", sub: "Wallpaper repetition", xp: 20,
    why: "A great hook repeats one line and changes what's around it, so the same words mean something new each time. Repeating whole blocks is just wallpaper.",
    before: "Until the end of time\nUntil the end of time\nUntil the end of time", after: "Call me when you land\nI'll be up, I always am\nI'll leave the porch light on\nCall me when you land",
    drill: "Write a 4-line hook where the first and last lines match, and the two middle lines are different from each other and from the hook line.",
    check: (t) => { const L = lines(t).map((l) => words(l).join(" ")); if (L.length < 4) return need(t, 4); if (L[0] !== L[L.length - 1]) return "Make the first and last lines the same."; const mid = L.slice(1, -1); if (new Set(mid).size !== mid.length || mid.includes(L[0])) return "Keep the middle lines different."; return true; } },
  { id: "specific", title: "Get specific", sub: "Names, places, numbers", xp: 25,
    why: "Specific details make a song feel true. '3am' beats 'late at night'. 'Hillsboro' beats 'the street'. The more specific you are, the more universal it feels, because listeners swap in their own version.",
    before: "We drove around late at night\nTalking about everything", after: "We split a cherry slush at the light on Hillsboro\nYou counted red cars out loud like a prayer",
    drill: "Write 4 lines that include a number, a real place name, and a brand or a person's name.",
    check: (t) => { const n = need(t, 4); if (n) return n; const hasNum = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|hundred)\b/i.test(t); const caps = (t.match(/(?:^|\s)[A-Z][a-z]{2,}/gm) || []).length - lines(t).length; if (!hasNum) return "Add a number: a time, an age, an address."; if (caps < 2) return "Add proper names: a real place and a brand or a person."; return true; } },
  { id: "flow", title: "Find your pocket", sub: "Syllables and flow", xp: 20,
    why: "When line lengths are wildly different, you'll have to rush or stretch to fit the beat. Count syllables and keep lines in the same range, then break the pattern on purpose when you want a moment to hit.",
    before: "I\nWalked down the whole entire street looking for you every day", after: "I walked the whole street twice\nI checked the bus stop, the corner store\nI said your name to the ice",
    drill: "Write 4 lines where every line is within 2 syllables of the others.",
    check: (t) => { const n = need(t, 4); if (n) return n; const s = lines(t).map(lineSyllables); const lo = Math.min(...s), hi = Math.max(...s); return hi - lo > 2 ? `Your lines run from ${lo} to ${hi} syllables. Tighten it to a 2-syllable range.` : true; } },
  { id: "feel", title: "Feelings in the body", sub: "Don't name the emotion", xp: 25,
    why: "Instead of saying you're nervous, show the sweaty hands. Instead of happy, show the grin you couldn't hide on the bus. Listeners feel what bodies do, not what labels say.",
    before: "I was so nervous to see you\nI was scared and anxious", after: "I checked my teeth in a spoon\nWiped my palms on my jeans twice",
    drill: "Write 4 lines showing you're nervous without nervous, scared, anxious, afraid, worried or fear.",
    check: (t) => { const n = need(t, 4); if (n) return n; const bad = words(t).find((w) => /^(nervous|scared|anxious|afraid|worried|fear|fears|feared|anxiety)$/.test(w)); return bad ? `"${bad}" names it. Show it instead.` : true; } },
  { id: "wiz", title: "Write a Wiz pick", sub: "The line only you'd write", xp: 30,
    why: "Every great song has one line people quote. It's usually the most specific, strangest-but-true line in the song. Wiz's pick hunts for that line in your writing.",
    before: "You make me feel so alive", after: "I keep the receipt in the cupholder like proof we were ever that easy",
    drill: "Write up to 4 lines. Pass if Wiz finds a line worth keeping.",
    check: (t) => (lines(t).length < 1 ? "Write something first." : bestLine(t) ? true : "Wiz didn't find a standout yet. Add a detail only you would know.") },
];

export const RANKS = [[0, "Wannabe"], [40, "Word Rookie"], [90, "Wordsmith"], [150, "Wiz Kid"], [200, "Wicked Writer"]];
export function rankOf(xp) { let r = RANKS[0], next = null; for (let i = 0; i < RANKS.length; i++) { if (xp >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } } return { name: r[1], at: r[0], next }; }
export const CLICHE_COUNT = CLICHES.length;
