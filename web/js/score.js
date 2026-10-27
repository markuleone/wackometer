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

// Fresh swaps for every cliché the meter knows. Tap a highlighted phrase to use one.
export const SWAPS = {
  "heart of gold": ["a pocket full of spare change for strangers", "the kind who leaves the porch light on", "soft as day-old bread"],
  "break my heart": ["fold me up like a receipt", "leave me on read for a year", "crack my phone screen from the inside"],
  "broken heart": ["a chipped mug I still drink from", "a cracked windshield I keep driving", "a speaker with a blown-out bass"],
  "tears fall": ["mascara draws a map", "my face goes full monsoon", "the salt beats me to the sink"],
  "tears falling": ["mascara drawing maps", "my eyes leaking like a cheap roof", "salt on my upper lip"],
  "fire inside": ["a pilot light I can't turn off", "a stovetop left on high", "a lighter that won't quit clicking"],
  "burning desire": ["a want like a fever at 3am", "an itch under the cast", "hunger with the windows down"],
  "on my mind": ["stuck on repeat behind my eyes", "rent-free in the back row of my head", "the tab I never close"],
  "end of time": ["till the streetlights quit", "till the last bus stops running", "till the sun runs out of battery"],
  "night and day": ["dawn shift and graveyard shift", "both ends of the dimmer switch", "every hour the clock can count"],
  "rise above": ["climb out the sunroof", "take the stairs two at a time", "float like a balloon at a car lot"],
  "feel alive": ["feel the voltage in my teeth", "feel every hair stand up", "feel loud"],
  "set me free": ["cut the zip tie", "open the gate and leave it swinging", "hand me back my keys"],
  "all night long": ["till the birds start gossiping", "till the ice in the cooler is water", "till the neighbors bang the wall"],
  "dancing in the rain": ["sliding barefoot through the parking lot puddles", "two-stepping in a flooded crosswalk", "spinning while the gutters overflow"],
  "dance in the rain": ["slide through the parking lot puddles", "two-step in a flooded crosswalk", "spin while the gutters overflow"],
  "shine bright": ["glow like a gas station at midnight", "beam like a fresh phone screen", "burn like a road flare"],
  "broken wings": ["a kite stuck in a power line", "a bike with a bent rim", "one shoe in the gutter"],
  "cold as ice": ["cold as a car seat in January", "cold as the back of a freezer aisle", "cold as a hospital floor"],
  "love is blind": ["love walks into glass doors", "love can't read the warning signs", "love forgot its glasses"],
  "walls come down": ["the drywall gives", "the fence boards fall like dominoes", "the curtains finally open"],
  "lost without you": ["a GPS with no signal", "a left shoe on the highway", "a key with no door"],
  "forever and always": ["past the last page", "longer than a lease", "till the tattoo fades"],
  "meant to be": ["written in the fine print", "already on the calendar", "the puzzle piece that clicks"],
  "until the end": ["till the credits roll", "till the battery dies", "till the last song at the wedding"],
  "in the dark": ["with the lights cut", "under a blackout curtain", "in the glow of one phone screen"],
  "light the way": ["hold the flashlight steady", "leave the porch light on", "drop breadcrumbs that glow"],
  "touch the sky": ["scrape the ceiling fan", "tap the top of the stadium", "kiss the clouds through the sunroof"],
  "reach for the stars": ["climb the water tower", "aim past the billboard", "stretch for the top shelf"],
  "chasing dreams": ["chasing the last train", "running after the ice cream truck", "following a song I half remember"],
  "chase my dreams": ["chase the last train", "run after the ice cream truck", "follow a song I half remember"],
  "no regrets": ["no receipts to return", "no take-backs", "I'd buy the same ticket"],
  "hold me tight": ["hold me like a seatbelt", "grip me like a handrail on the subway", "keep me like a lighter in your pocket"],
  "my everything": ["my whole group chat", "my morning coffee and my last call", "the wallpaper on my phone"],
  "took my breath away": ["knocked the air out like a cannonball", "made me forget my password", "stopped me mid-sentence"],
  "stars align": ["the lights turn green all the way down", "every song on shuffle hits", "the vending machine drops two"],
  "into the night": ["past the last streetlight", "out where the radio gets static", "into the hours nobody posts"],
  "like a bird": ["like a plastic bag in the wind", "like a paper airplane", "like a kite off its string"],
  "spread my wings": ["roll the windows down", "kick off my shoes", "stretch like a cat in the sun"],
  "rollercoaster": ["a stomach-drop elevator", "a car with no brakes on a hill", "a bad flight with good snacks"],
  "against all odds": ["with a dead phone and no ride", "down by twenty in the fourth", "on the last dollar"],
  "deep inside": ["under the floorboards of me", "in the junk drawer of my chest", "past the basement"],
  "in my soul": ["in my bones like humidity", "in the back of my throat", "in my fingertips"],
  "fly away": ["peel out of the driveway", "take the red-eye with no bag", "float off like a lost balloon"],
  "never let you go": ["keep you like a ticket stub", "hold on like the last fry", "keep your hoodie forever"],
  "never let go": ["keep my grip on the rail", "hold on like the last fry", "white-knuckle it"],
  "only one": ["the one name in my favorites", "the last slice", "my one good pen"],
  "by my side": ["in my passenger seat", "on the next barstool", "on the other half of the headphones"],
  "heart and soul": ["sweat and Sundays", "every penny in the jar", "guts and grocery money"],
  "through the storm": ["through the power outage", "through the flood warnings", "through the worst of hurricane season"],
  "after the rain": ["when the asphalt steams", "when the puddles hold the sky", "when the worms come out to dry"],
  "like a fire": ["like a grease fire", "like a match in a hay barn", "like a sparkler in a fist"],
  "burn so bright": ["burn like a road flare", "glow like a gas station sign", "flash like a camera at a concert"],
  "world is mine": ["the whole block is mine", "every aux cord is mine", "the city's on my keychain"],
  "on top of the world": ["on the roof of the parking garage", "at the top of the Ferris wheel", "on the highest step"],
  "living the dream": ["living on a group-chat high", "living the screenshot", "living the good part of the song"],
  "just be yourself": ["wear the loud shirt", "laugh with your whole mouth", "keep your accent"],
  "love will find a way": ["love takes the back roads", "love picks the lock", "love always gets a signal"],
  "you complete me": ["you're the charger to my phone", "you finish my sentences and my fries", "you're the missing sock"],
  "made for each other": ["a lid and a jar", "a lock and a key cut the same day", "matching phone cases"],
  "shattered dreams": ["dreams like a dropped phone", "a vision board in the recycling", "plans on a wet napkin"],
  "fallen angel": ["a saint with a parking ticket", "a halo in the lost and found", "a choir kid at the after-party"],
  "rise from the ashes": ["get up off the kitchen floor", "come back like a weed in concrete", "reboot after the crash"],
  "lose control": ["spin out on the wet road", "drop the wheel", "let the song drive"],
  "edge of the world": ["the end of the pier", "the last exit before the toll", "the edge of the map app"],
  "young and free": ["sixteen with a learner's permit", "broke and laughing", "no curfew, no rent"],
  "one more time": ["run it back", "one more lap around the block", "again, from the top"],
  "save me": ["pull me out the deep end", "throw me the rope", "come get me from the party"],
  "the rest of my life": ["every Tuesday from now on", "all the birthdays left", "until my hair goes gray"],
  "in your eyes": ["in the way you squint at the sun", "in your reflection on the train window", "behind your sunglasses"],
  "make it right": ["fix the dent", "patch the hole in the screen door", "pay back the twenty"],
  "take me higher": ["take me to the roof", "turn the volume past the red", "push me higher on the swing"],
};

const COMMON = new Set("the a an and or but so to of in on at for with from by up out over is are was were be been am i me my mine you your yours we us our they them their he him his she her it its this that these those just like all no not yes do did does done have has had will would can could should get got go went gone come came make made know knew see saw say said tell told want need feel felt think thought take took give gave one two then than when where what who why how there here now still even only really very too much more most some any every each again back down off into onto about around through".split(" "));

// Rough English syllable count. Good enough to flag lines that rush or drag.
export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
export function lineSyllables(line) { return (line.match(/[A-Za-z']+/g) || []).reduce((a, w) => a + syllables(w), 0); }

// Wiz's pick: the line that sounds most like only you could have written it.
export function bestLine(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let best = null;
  lines.forEach((line, i) => {
    const ws = words(line); if (ws.length < 4) return;
    const low = " " + ws.join(" ") + " ";
    if (CLICHES.some((c) => low.includes(" " + c + " "))) return;
    let score = 0;
    ws.forEach((w) => {
      if (FILLER.has(w)) score -= 3; else if (WEIGHTLESS.has(w)) score -= 2;
      else if (COMMON.has(w)) score += 0; else score += w.length >= 6 ? 2.2 : 1.4;
    });
    if (/\d/.test(line)) score += 2;                                   // specific numbers
    if (/\s[A-Z][a-z]+/.test(line.slice(1))) score += 2;               // a name or a place mid-line
    score = score / Math.sqrt(ws.length);
    if (!best || score > best.score) best = { i, line, score };
  });
  return best && best.score >= 2.2 ? best : null;
}

// The Daily W: one prompt per day, same for everyone, picked from the date.
export const DAILY_PROMPTS = [
  { e: "📱🪫😬", p: "4 lines about your phone at 2%" },
  { e: "⛽🌙🍫", p: "4 lines set in a gas station at 3am" },
  { e: "📵💬👻", p: "A hook about someone who never texts back, without the word 'love'" },
  { e: "🛏️🧸🌌", p: "4 lines about your childhood bedroom" },
  { e: "💔🍝🥡", p: "A breakup verse that mentions a specific food" },
  { e: "☀️🩴🌸", p: "4 lines about the first warm day of the year" },
  { e: "🧺🔥👕", p: "A hype verse about doing laundry" },
  { e: "🗺️✈️🏙️", p: "4 lines about a city you've never been to" },
  { e: "🚗💘🛞", p: "A love song to your car" },
  { e: "💬🤐🦗", p: "4 lines about a group chat going silent" },
  { e: "💸🙊🧾", p: "A verse about money that never says money" },
  { e: "🎉🎶🚪", p: "4 lines about the last song on a party playlist" },
  { e: "😢☀️🕶️", p: "A sad song about a sunny day" },
  { e: "👵🍳🏠", p: "4 lines about your grandma's kitchen" },
  { e: "⏰🏃💨", p: "A hook about being late, again" },
  { e: "🅿️🎤🌃", p: "4 lines about a parking lot after a concert" },
  { e: "🦹🌩️🎬", p: "A villain origin story in 4 lines" },
  { e: "👃🕰️💭", p: "4 lines about a smell that takes you back" },
  { e: "😎🤡🏆", p: "A brag verse about being bad at something" },
  { e: "🌧️🏚️🚫", p: "4 lines about rain on a tin roof, without the word 'rain'" },
  { e: "🌙🏥☕", p: "A song for the night shift" },
  { e: "📦👋🚚", p: "4 lines about a friend who moved away" },
  { e: "🧥💌🙈", p: "A hook about a hoodie you never gave back" },
  { e: "🌊🌅🐚", p: "4 lines about the beach at 6am" },
  { e: "🧒✉️🪞", p: "A verse written to your 12-year-old self" },
  { e: "📦⏳🚪", p: "4 lines about waiting for a delivery" },
  { e: "💞🎯🔚", p: "A love song that rhymes only on the last line" },
  { e: "🔌🕯️🌑", p: "4 lines about a power outage" },
  { e: "⏰🎤🔥", p: "A diss track aimed at your alarm clock" },
  { e: "🖼️🗑️😶", p: "4 lines about a photo you can't delete" },
  { e: "🎈🚶‍♂️🌃", p: "A song about leaving a party early" },
];
export function dailyKey(d = new Date()) {
  // Daily W rolls over at midnight US Eastern.
  const et = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
}
export function dailyPrompt(key) {
  const [y, m, d] = key.split("-").map(Number);
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const pr = DAILY_PROMPTS[n % DAILY_PROMPTS.length];
  return { number: n - 20750, prompt: pr.p, emoji: pr.e };
}
export const DAILY_EMOJI = ["🟦", "🟩", "🟪", "🟧", "🤢"];
