// Wordstorm: a freestyle word generator locked to a beat.
// The beat is synthesized with Web Audio (no samples to download). Words change on bar lines,
// scheduled against the audio clock so they never drift from the drums.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ROUND = 16; // words per round

export function initStorm({ ls, track, copyText }) {
  let data = null, actx = null, master = null, playing = false, timer = null, raf = null;
  let bpm = +(ls("wk-bpm") || 90), every = 2, mode = "rhyme", theme = "";
  let nextBeatTime = 0, beatIdx = 0, queue = [], shown = [], deck = [], rec = null, heard = new Set();

  const load = async () => {
    if (data) return data;
    try { data = await (await fetch("/data/words.json")).json(); }
    catch (e) { data = { themes: { Everyday: "phone keys window pizza tiger river diamond ladder rooftop candle".split(" ") }, rhymes: {} }; }
    const sel = $("stTheme"); Object.keys(data.themes).forEach((t) => { const o = document.createElement("option"); o.value = t; o.textContent = t; sel.appendChild(o); });
    return data;
  };

  // ----- drums -----
  function noiseBuf() { const b = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  let NB = null;
  function kick(t) { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g).connect(master); o.start(t); o.stop(t + 0.4); }
  function snare(t) { const s = actx.createBufferSource(); s.buffer = NB; const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; const g = actx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 0.25);
    const o = actx.createOscillator(), g2 = actx.createGain(); o.type = "triangle"; o.frequency.value = 190; g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g2).connect(master); o.start(t); o.stop(t + 0.12); }
  function hat(t, v = 0.12) { const s = actx.createBufferSource(); s.buffer = NB; const f = actx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000; const g = actx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 0.06); }
  function bass(t, f0) { const o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); o.connect(g).connect(master); o.start(t); o.stop(t + 0.5); }
  const ROOTS = [55, 55, 49, 41.2]; // A, A, G, E: a loop that sits under anything

  // boom-bap, 16th-note grid; 4 beats per bar
  function scheduleBeat(i, t) {
    const beatInBar = i % 4, bar = Math.floor(i / 4), spb = 60 / bpm;
    if ($("stBeat").checked) {
      if (beatInBar === 0 || (beatInBar === 2 && bar % 2 === 1)) kick(t);
      if (beatInBar === 2 && bar % 2 === 0) kick(t + spb * 0.5);
      if (beatInBar === 1 || beatInBar === 3) snare(t);
      for (let s = 0; s < 2; s++) hat(t + s * spb / 2, s ? 0.07 : 0.12);
      if (beatInBar === 0) bass(t, ROOTS[bar % 4]);
    }
    if (beatInBar === 0 && bar % every === 0) queue.push({ t, kind: "word", bar });
    queue.push({ t, kind: "beat", beatInBar, bar });
  }
  function scheduler() {
    while (nextBeatTime < actx.currentTime + 0.12) { scheduleBeat(beatIdx, nextBeatTime); nextBeatTime += 60 / bpm; beatIdx++; }
  }
  function draw() {
    const now = actx.currentTime;
    while (queue.length && queue[0].t <= now) {
      const ev = queue.shift();
      if (ev.kind === "beat") renderBars(ev.beatInBar, ev.bar);
      else nextWord();
      if (!playing) return;
    }
    raf = requestAnimationFrame(draw);
  }
  function renderBars(b, bar) { const el = $("stBars"); const n = every * 4; const pos = (bar % every) * 4 + b; el.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i <= pos ? "on" : ""}"></i>`).join(""); }

  // ----- words -----
  function pool() { return theme ? data.themes[theme] : Object.values(data.themes).flat(); }
  function draw1() { if (!deck.length) deck = pool().slice().sort(() => Math.random() - 0.5); return deck.pop(); }
  let upcoming = null;
  function nextWord() {
    if (shown.length >= ROUND) return finish();
    const w = upcoming || draw1(); upcoming = draw1(); shown.push(w);
    const el = $("stWord"); el.textContent = w; el.classList.remove("drop"); void el.offsetWidth; el.classList.add("drop");
    const r = data.rhymes[w] || [];
    $("stRhymes").innerHTML = mode === "rhyme" && r.length ? "rhymes: " + r.slice(0, 4).map((x) => `<b>${esc(x)}</b>`).join(" · ") : "&nbsp;";
    $("stNext").textContent = shown.length < ROUND ? `next: ${upcoming} · word ${shown.length} of ${ROUND}` : "last word!";
  }

  // ----- mic scoring (optional) -----
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $("stMicRow").hidden = true; $("stMicNote").textContent = "Mic scoring works in Chrome, Edge and Safari."; }
  function startMic() {
    if (!SR || !$("stMic").checked) return;
    try {
      rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
      rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) e.results[i][0].transcript.toLowerCase().split(/[^a-z']+/).forEach((w) => w && heard.add(w)); };
      rec.onend = () => { if (playing && rec) try { rec.start(); } catch (e) {} };
      rec.start();
    } catch (e) { rec = null; }
  }
  const hit = (w) => heard.has(w) || heard.has(w + "s") || [...heard].some((h) => h.length > 3 && (h.startsWith(w) || w.startsWith(h)));

  // ----- round -----
  async function start() {
    await load();
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") await actx.resume();
    NB = NB || noiseBuf();
    master = actx.createGain(); master.gain.value = 0.8; master.connect(actx.destination);
    shown = []; deck = []; upcoming = null; queue = []; heard = new Set(); beatIdx = 0;
    $("stResult").hidden = true; $("stShare").hidden = true;
    nextBeatTime = actx.currentTime + 0.15; playing = true;
    $("stPlay").textContent = "■ Stop"; $("stWord").textContent = "…"; $("stRhymes").textContent = "First word on the one.";
    timer = setInterval(scheduler, 25); scheduler(); raf = requestAnimationFrame(draw);
    startMic(); track("storm_start");
  }
  function stop() {
    playing = false; clearInterval(timer); cancelAnimationFrame(raf); queue = [];
    if (master) { const m = master; m.gain.setTargetAtTime(0, actx.currentTime, 0.05); setTimeout(() => m.disconnect(), 300); }
    if (rec) { const r = rec; rec = null; try { r.stop(); } catch (e) {} }
    $("stPlay").textContent = "▶ Start"; $("stBars").innerHTML = "";
  }
  let lastResult = "";
  function finish() {
    const n = shown.length; stop();
    let msg;
    if ($("stMic").checked && SR) {
      const caught = shown.filter(hit);
      const best = Math.max(+(ls("wk-storm-best") || 0), caught.length); ls("wk-storm-best", best);
      msg = `You caught <b>${caught.length} of ${n}</b> words at ${bpm} BPM.` + (caught.length < n ? ` Missed: ${shown.filter((w) => !hit(w)).slice(0, 6).map(esc).join(", ")}.` : " Every single one. Wicked.");
      lastResult = `🎤 Wordstorm: I caught ${caught.length}/${n} words freestyling at ${bpm} BPM on the Wackometer. Your turn: https://wackometer.com/#storm`;
      $("stBest").textContent = `Your best: ${best}/${ROUND}`;
    } else {
      msg = `Round done: ${n} words at ${bpm} BPM. Turn on "Score me" to count the words you actually land.`;
      lastResult = `🎤 I just survived a ${n}-word Wordstorm at ${bpm} BPM on the Wackometer. Can you? https://wackometer.com/#storm`;
    }
    $("stWord").textContent = "Done"; $("stRhymes").innerHTML = "&nbsp;"; $("stNext").textContent = "";
    $("stResult").innerHTML = msg; $("stResult").hidden = false; $("stShare").hidden = false;
    track("storm_done");
  }

  // ----- controls -----
  const setBpm = (v) => { bpm = Math.max(60, Math.min(170, Math.round(v))); $("stBpm").value = bpm; $("stBpmV").textContent = bpm; ls("wk-bpm", bpm); };
  setBpm(bpm);
  $("stBpm").addEventListener("input", (e) => setBpm(+e.target.value));
  let taps = [];
  $("stTap").onclick = () => { const now = performance.now(); taps = taps.filter((t) => now - t < 3000); taps.push(now); if (taps.length >= 3) { const gaps = taps.slice(1).map((t, i) => t - taps[i]); setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)); } };
  const seg = (id, attr, set) => $(id).querySelectorAll("button").forEach((b) => (b.onclick = () => { $(id).querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); set(b.dataset[attr]); }));
  seg("stEvery", "n", (v) => (every = +v));
  seg("stMode", "m", (v) => (mode = v));
  $("stTheme").onchange = (e) => { theme = e.target.value; deck = []; };
  $("stPlay").onclick = () => (playing ? stop() : start());
  $("stShare").onclick = () => copyText(lastResult, $("stShare"), "Share my round");
  const best = ls("wk-storm-best"); if (best) $("stBest").textContent = `Your best: ${best}/${ROUND}`;
  document.addEventListener("keydown", (e) => { if (e.code === "Space" && !$("v-storm").hidden && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); playing ? stop() : start(); } });
  return { onShow: load, onHide: () => playing && stop() };
}
