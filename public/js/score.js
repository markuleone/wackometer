// Wackometer scoring engine. Shared by the browser and the API worker,
// so a score posted to the Wall is always re-checked on the server.

export const TIERS = [
  { n: "Wicked",   lo: 0,  blurb: "Fresh, specific, yours. Nobody's heard it put this way." },
  { n: "Well put", lo: 20, blurb: "Solid writing. A couple of safe choices, but it lands." },
  { n: "Whatever", lo: 40, blurb: "It's fine. It's also forgettable. Push the images harder." },
  { n: "Weird",    lo: 60, blurb: "Something's off. Too many borrowed lines or lazy rhymes." },
  { n: "Wack",     lo: 80, blurb: "Greeting-card territory. Wingman is standing by." },
];
export const MID = [10, 30, 50, 70, 90];
export const tierOf = (s) => (s >= 80 ? 4 : s >= 60 ? 3 : s >= 40 ? 2 : s >= 20 ? 1 : 0);
export const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));

export const CLICHES = ["heart of gold","break my heart","broken heart","tears fall","tears falling","fire inside","burning desire","on my mind","end of time","night and day","rise above","feel alive","set me free","all night long","dancing in the rain","dance in the rain","shine bright","broken wings","cold as ice","love is blind","walls come down","lost without you","forever and always","meant to be","until the end","in the dark","light the way","touch the sky","reach for the stars","chasing dreams","chase my dreams","no regrets","hold me tight","my everything","took my breath away","stars align","into the night","like a bird","spread my wings","rollercoaster","against all odds","deep inside","in my soul","fly away","never let you go","never let go","only one","by my side","heart and soul","through the storm","after the rain","like a fire","burn so bright","world is mine","on top of the world","living the dream","just be yourself","love will find a way","you complete me","made for each other","shattered dreams","fallen angel","rise from the ashes","lose control","edge of the world","young and free","one more time","save me","the rest of my life","in your eyes","make it right","take me higher"];
const LAZY = [["fire","desire","higher","liar"],["heart","apart","start","part"],["love","above","of","dove"],["night","light","tonight","right","bright","fight","sight"],["pain","rain","again","insane","chain"],["cry","die","sky","why","fly","goodbye","lie","try","eye","high"],["true","you","through","blue","new","do"],["me","free","be","see","sea","need"],["go","know","so","show","slow","grow"],["away","stay","day","say","way","okay","pray"],["eyes","lies","skies","cries","goodbyes","rise"],["soul","whole","control","hole","goal"],["alone","home","phone","own","stone"],["mind","find","behind","kind","blind"],["time","mine","fine","line","shine","sign"]];
const LAZYMAP = {}; LAZY.forEach((g, i) => g.forEach((w) => (LAZYMAP[w] = i)));
export const FILLER = new Set(["yeah","oh","ooh","oooh","baby","uh","hey","na","la","whoa","woah","mmm","ayy","ay","ohh","yeahh","girl","babe"]);
export const WEIGHTLESS = new Set(["love","heart","soul","dream","dreams","pain","life","time","world","forever","everything","feelings","feeling","emotions","destiny","fate","freedom","hope","faith","truth","sorrow","darkness","light","eternity","passion","spirit","desire"]);

export const METRICS = [
  { k: "worn",       n: "Worn-out phrases",     w: .28, d: "Phrases you've heard a thousand times: 'end of time', 'set me free', 'break my heart'." },
  { k: "wimpy",      n: "Wimpy rhymes",         w: .20, d: "Rhyming the first word anyone would grab (fire / desire, heart / apart), or a word with itself." },
  { k: "weightless", n: "Weightless words",     w: .17, d: "Big abstract nouns like love, soul, destiny standing in for concrete, sensory detail." },
  { k: "variety",    n: "Word variety",         w: .13, d: "How often you reuse the same words. Measured in sliding 30-word windows so long songs aren't punished." },
  { k: "wasted",     n: "Wasted words",         w: .12, d: "Filler syllables: yeah, ooh, baby, na na. A little is style. A lot is padding." },
  { k: "wallpaper",  n: "Wallpaper repetition", w: .10, d: "Lines repeated past what a chorus needs. Choruses are fine; a third of the song on loop isn't." },
];

export function words(t) {
  return (t.toLowerCase().match(/[a-z']+/g) || []).map((w) => w.replace(/^'+|'+$/g, "")).filter(Boolean);
}
function endWord(l) {
  const w = words(l);
  for (let i = w.length - 1; i >= 0; i--) if (!FILLER.has(w[i])) return w[i];
  return null;
}

export function analyze(text) {
  const lines = text.split(/\r?\n/);
  const real = lines.map((l) => l.trim()).filter(Boolean);
  const ws = words(text), N = ws.length;
  const lower = " " + text.toLowerCase().replace(/[^a-z'\n ]+/g, " ").replace(/\s+/g, " ") + " ";
  const found = [];
  CLICHES.forEach((c) => { const m = lower.match(new RegExp("\\b" + c + "\\b", "g")); if (m) found.push([c, m.length]); });
  const clicheCount = found.reduce((a, b) => a + b[1], 0);
  const worn = clamp((clicheCount / Math.max(N, 1)) * 100 * 30);

  const ends = real.map(endWord); const lazyLines = new Set(); let pairs = 0, lazyPairs = 0;
  for (let i = 0; i < ends.length; i++) for (const j of [i + 1, i + 2]) {
    if (j >= ends.length || !ends[i] || !ends[j]) continue;
    const a = ends[i], b = ends[j];
    const rh = a === b || (LAZYMAP[a] !== undefined && LAZYMAP[a] === LAZYMAP[b]);
    if (j === i + 1) pairs++;
    if (rh) { lazyPairs++; lazyLines.add(i); lazyLines.add(j); }
  }
  const wimpy = clamp((lazyPairs / Math.max(pairs, 1)) * 160);

  const fill = ws.filter((w) => FILLER.has(w)).length; const wasted = clamp((fill / Math.max(N, 1)) * 500);
  const ab = ws.filter((w) => WEIGHTLESS.has(w)).length; const weightless = clamp(((ab / Math.max(N, 1)) - .02) / .09 * 100);
  let mattr; const W = 30;
  if (N <= W) mattr = new Set(ws).size / Math.max(N, 1);
  else { let s = 0, c = 0; for (let i = 0; i + W <= N; i++) { s += new Set(ws.slice(i, i + W)).size / W; c++; } mattr = s / c; }
  const variety = clamp((.9 - mattr) / .36 * 100);
  const norm = real.map((l) => words(l).join(" ")); const uniq = new Set(norm).size;
  const dup = 1 - uniq / Math.max(norm.length, 1); const wallpaper = clamp((dup - .25) / .45 * 100);

  const vals = { worn, wimpy, wasted, weightless, variety, wallpaper };
  let raw = 0; METRICS.forEach((m) => (raw += vals[m.k] * m.w));
  raw = raw * .7 + Math.max(...Object.values(vals)) * .3;
  const notes = {
    worn: found.length ? found.slice(0, 4).map((f) => `"${f[0]}"` + (f[1] > 1 ? ` ×${f[1]}` : "")).join(", ") : "None spotted.",
    wimpy: lazyPairs ? `${lazyPairs} lazy pair${lazyPairs > 1 ? "s" : ""} at the line ends.` : "Rhymes feel earned.",
    wasted: fill ? `${fill} filler word${fill > 1 ? "s" : ""} out of ${N}.` : "No padding.",
    weightless: `${ab} abstract word${ab !== 1 ? "s" : ""} (${Math.round((ab / Math.max(N, 1)) * 100)}% of the text).`,
    variety: `${Math.round(mattr * 100)}% fresh words per 30-word stretch.`,
    wallpaper: dup > 0 ? `${Math.round(dup * 100)}% of lines are repeats.` : "No repeated lines.",
  };
  return { vals, notes, raw: clamp(raw), N, lines, lazyLines, real, found };
}

// The Daily W: one prompt per day, same for everyone, picked from the date.
export const DAILY_PROMPTS = [
  "4 lines about your phone at 2%",
  "4 lines set in a gas station at 3am",
  "A hook about someone who never texts back, without the word 'love'",
  "4 lines about your childhood bedroom",
  "A breakup verse that mentions a specific food",
  "4 lines about the first warm day of the year",
  "A hype verse about doing laundry",
  "4 lines about a city you've never been to",
  "A love song to your car",
  "4 lines about a group chat going silent",
  "A verse about money that never says money",
  "4 lines about the last song on a party playlist",
  "A sad song about a sunny day",
  "4 lines about your grandma's kitchen",
  "A hook about being late, again",
  "4 lines about a parking lot after a concert",
  "A villain origin story in 4 lines",
  "4 lines about a smell that takes you back",
  "A brag verse about being bad at something",
  "4 lines about rain on a tin roof, without the word 'rain'",
  "A song for the night shift",
  "4 lines about a friend who moved away",
  "A hook about a hoodie you never gave back",
  "4 lines about the beach at 6am",
  "A verse written to your 12-year-old self",
  "4 lines about waiting for a delivery",
  "A love song that rhymes only on the last line",
  "4 lines about a power outage",
  "A diss track aimed at your alarm clock",
  "4 lines about a photo you can't delete",
  "A song about leaving a party early",
];
export function dailyKey(d = new Date()) {
  // Daily W rolls over at midnight US Eastern.
  const et = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
}
export function dailyPrompt(key) {
  const [y, m, d] = key.split("-").map(Number);
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return { number: n - 20750, prompt: DAILY_PROMPTS[n % DAILY_PROMPTS.length] };
}
export const DAILY_EMOJI = ["🟦", "🟩", "🟪", "🟧", "🤢"];
