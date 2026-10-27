// AI Wash: spots the habits that make lyrics read machine-written, explains each one,
// and hands the writer a human fix. Runs entirely in the browser; Wingman's rewrite is optional.
import { words, lineSyllables } from "./score.js";

// [phrase or word, why it reads as AI, how to fix it]
const TELLS = [
  ["neon", "AI's favorite color. Every generated city verse glows neon.", "Name the actual sign: the Pizza Hut sign with the dead P."],
  ["echoes", "Generated lyrics love echoes. Nothing in them ever just sounds.", "Say what you actually heard, and where."],
  ["echo", "Same trap as echoes.", "Swap for the real sound: a car alarm two blocks over."],
  ["whispers", "Everything whispers in AI lyrics: winds, streets, hearts.", "Who actually whispered? What did they say?"],
  ["whisper", "Same as whispers.", "Quote the actual words instead."],
  ["tapestry", "Nobody has ever said tapestry out loud in a song they meant.", "Cut it. Describe one real thread."],
  ["symphony", "A fancy word standing in for a feeling.", "Name the one song that was playing."],
  ["embers", "Glowing embers show up in nearly every generated breakup song.", "What's actually left over? A hoodie, a toothbrush?"],
  ["ignite", "Big launch-trailer verb.", "Use a smaller verb you'd text a friend."],
  ["ignites", "Big launch-trailer verb.", "Use a smaller verb you'd text a friend."],
  ["unbreakable", "Motivational-poster word.", "Show something that took a hit and stayed standing."],
  ["unspoken", "Vague on purpose. AI hides from specifics.", "Say the thing. Or say who didn't say it."],
  ["soar", "Inspirational filler.", "Where did you actually go up? A roof, a Ferris wheel?"],
  ["soaring", "Inspirational filler.", "Where did you actually go up? A roof, a Ferris wheel?"],
  ["journey", "The most generated noun in pop lyrics.", "Name the actual road, bus route or year."],
  ["embrace", "Formal, greeting-card hug.", "Just say hug, or describe it: chin on my shoulder."],
  ["boundless", "Abstract and endless. Gives the ear nothing to hold.", "Give a size you can picture."],
  ["realm", "Fantasy-novel word.", "Name a real place."],
  ["beacon", "Lighthouse metaphor on autopilot.", "What actually guided you? A friend's porch light?"],
  ["testament", "Essay word, not a song word.", "Cut it."],
  ["ethereal", "Sounds deep, says nothing.", "Describe what you saw."],
  ["celestial", "Space words stand in for real feelings.", "Use one real star or skip the sky."],
  ["labyrinth", "Generated lyrics get lost in labyrinths a lot.", "Get lost somewhere real: an IKEA, a parking garage."],
  ["kaleidoscope", "Pretty word, no picture.", "Name the colors."],
  ["resonate", "Corporate word.", "Say what it reminded you of."],
  ["silhouette", "Heavy rotation in generated lyrics.", "Describe the person, not the outline."],
  ["serenade", "Old-fashioned, unearned.", "What did they actually sing? Off-key?"],
  ["cascade", "Waterfall word for anything that falls.", "Pick a messier verb: spill, dump, drip."],
  ["velvet", "Default texture for nights and voices.", "Pick a texture you've touched today."],
  ["shimmer", "Everything shimmers in generated verses.", "Say what's actually shining and why."],
  ["shimmering", "Everything shimmers in generated verses.", "Say what's actually shining and why."],
  ["ablaze", "Poster word.", "Something actually on fire? Name it."],
  ["eternal", "Big abstract time word.", "Give a real length of time."],
  ["infinite", "Big abstract time word.", "Give a real length of time."],
  ["electric", "AI's go-to adjective for any good feeling.", "Describe the feeling in your body."],
  ["golden hour", "The phrase every generated summer song uses.", "Say the actual time and where the light hit."],
  ["city lights", "Generic skyline.", "Pick one building or one window."],
  ["in the silence", "Generated lyrics live in the silence.", "What sound would have been there? Its absence is the line."],
  ["through the night", "Filler timestamp.", "Say the hour."],
  ["we rise", "Anthem-generator ending.", "End on an image instead of a slogan."],
  ["hearts entwined", "Greeting card.", "Show one real moment you were close."],
  ["fading light", "Default sad sunset.", "What were you doing when the light went?"],
  ["chasing shadows", "Sounds deep, means nothing.", "What were you actually chasing?"],
  ["dance with", "AI dances with everything: fate, shadows, the wind.", "Who or what, really?"],
  ["stars above", "Default sky.", "Cut it or name the real view."],
  ["in this moment", "Placeholder.", "Describe the moment."],
  ["hand in hand", "Stock photo.", "What were your hands actually doing?"],
  ["guiding light", "Lighthouse metaphor on autopilot.", "Name the person and one thing they did."],
  ["tangled", "Hair, hearts, and wires: AI tangles all of them.", "Untangle it: say what's complicated."],
];
const WORD_TELLS = new Map(TELLS.filter((t) => !t[0].includes(" ")).map((t) => [t[0], t]));
const PHRASE_TELLS = TELLS.filter((t) => t[0].includes(" "));
const CONTRACTABLE = /\b(i am|do not|can not|cannot|will not|it is|you are|we are|they are|i will|i have|does not|is not|are not)\b/gi;

export function washScan(text) {
  const lines = text.split(/\r?\n/);
  const real = lines.map((l) => l.trim()).filter(Boolean);
  const ws = words(text), N = ws.length || 1;
  const hits = []; // {line, start, end, tell}
  lines.forEach((line, li) => {
    const low = line.toLowerCase();
    PHRASE_TELLS.forEach((t) => { let i = low.indexOf(t[0]); while (i >= 0) { hits.push({ li, s: i, e: i + t[0].length, t }); i = low.indexOf(t[0], i + 1); } });
    const re = /[a-z']+/gi; let m;
    while ((m = re.exec(line))) { const w = m[0].toLowerCase(); if (WORD_TELLS.has(w) && !hits.some((h) => h.li === li && m.index >= h.s && m.index < h.e)) hits.push({ li, s: m.index, e: m.index + w.length, t: WORD_TELLS.get(w) }); }
  });
  const shape = [];
  // Every line the same length: generated verses are metrically too tidy.
  if (real.length >= 4) {
    const syl = real.map(lineSyllables); const mean = syl.reduce((a, b) => a + b, 0) / syl.length;
    const sd = Math.sqrt(syl.reduce((a, b) => a + (b - mean) ** 2, 0) / syl.length);
    if (sd < 1.1) shape.push(["Too tidy", `Every line lands at about ${Math.round(mean)} syllables. People breathe unevenly. Machines don't.`, "Let one line run long and cut one short."]);
  }
  const stiff = (text.match(CONTRACTABLE) || []);
  if (stiff.length >= 2) shape.push(["No contractions", `"${stiff[0]}" and ${stiff.length - 1} more. Nobody sings "I am" when they mean "I'm".`, "Write it how you'd say it."]);
  const commaEnds = real.filter((l) => /[,;]$/.test(l)).length;
  if (real.length >= 4 && commaEnds / real.length > 0.6) shape.push(["Comma at every line end", "Generated lyrics punctuate like an essay.", "Drop the commas. Lyrics breathe at the line break."]);
  const capsStart = real.filter((l) => /^[A-Z]/.test(l)).length;
  if (/—/.test(text)) shape.push(["Em dashes", "The em dash is a classic tell in generated text.", "Use a line break or nothing at all."]);
  if (/^\s*\[?(verse|chorus|bridge|pre-chorus|outro|intro)\s*\d*\]?:?\s*$/im.test(text) && real.length < 14) shape.push(["Section labels on a short piece", "Generators label everything. A short verse doesn't need [Chorus].", "Cut the labels unless it's a full song."]);
  const specific = /\d/.test(text) || real.some((l) => /\s[A-Z][a-z]{2,}/.test(l.slice(1)));
  if (!specific && real.length >= 4) shape.push(["Nothing specific", "No names, no places, no numbers. AI avoids specifics because it doesn't have a life.", "Add one detail only you know: a street, a time, a brand, a name."]);
  const wordScore = Math.min(70, (hits.length / N) * 100 * 9);
  const score = Math.round(Math.min(100, wordScore + shape.length * 9 + (hits.length >= 3 ? 8 : 0)));
  return { score, hits, shape, lines, capsStart };
}

export const WASH_EXAMPLE = `In the neon glow of city lights,
Our hearts entwined through the night,
Whispers echo in the silence deep,
A tapestry of dreams we keep.
We dance with shadows, unbreakable and free,
Our journey soaring, eternal symphony.`;

export function washVerdict(s) {
  if (s < 15) return ["All you", 1];
  if (s < 35) return ["Mostly human", 0];
  if (s < 60) return ["Half bot", 2];
  if (s < 80) return ["Robot-ish", 3];
  return ["Full robot", 4];
}
