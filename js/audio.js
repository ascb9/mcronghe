/* ═══════════════ VOXEL SKY — 合成音效引擎 (Web Audio) ═══════════════ */
/* 所有音效均由振荡器/噪声实时合成，无外部素材 */
const AudioSys = (() => {
  let ctx = null, master = null, sfxBus = null, ambBus = null, musBus = null;
  let started = false;
  const state = { ambientNodes: [], musicTimer: null, laserNode: null, engineNodes: null, windGain: null };

  function init() {
    if (started) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.6; ambBus.connect(comp);
    musBus = ctx.createGain(); musBus.gain.value = 0.34; musBus.connect(comp);
    started = true;
  }
  const now = () => ctx.currentTime;

  /* ---------- 基础工具 ---------- */
  function env(g, t0, a, peak, d, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
  }
  function osc(type, freq, t0, dur, gainNode) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    o.connect(gainNode); o.start(t0); o.stop(t0 + dur + 0.05); return o;
  }
  function noiseBuffer(dur = 1) {
    const len = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function noise(t0, dur, gainNode, filterType, filterFreq, q = 1) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur + 0.1); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.setValueAtTime(filterFreq, t0); f.Q.value = q;
    src.connect(f); f.connect(gainNode); src.start(t0); src.stop(t0 + dur + 0.05);
    return { src, f };
  }

  /* ---------- UI 音效 ---------- */
  function uiHover() {
    if (!started) return; const t = now(), g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.005, 0.08, 0.07);
    osc('sine', 1200, t, 0.1, g);
  }
  function uiClick() {
    if (!started) return; const t = now(), g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.004, 0.16, 0.09);
    const o = osc('triangle', 880, t, 0.12, g);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
  }
  function uiOpen() {
    if (!started) return; const t = now(), g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.01, 0.14, 0.22);
    const o = osc('sine', 420, t, 0.25, g);
    o.frequency.exponentialRampToValueAtTime(940, t + 0.18);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t + 0.05, 0.01, 0.06, 0.2);
    osc('sine', 1560, t + 0.05, 0.2, g2);
  }
  function uiClose() {
    if (!started) return; const t = now(), g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.01, 0.12, 0.18);
    const o = osc('sine', 900, t, 0.2, g);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.16);
  }
  function uiError() {
    if (!started) return; const t = now(), g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.005, 0.15, 0.16);
    osc('square', 220, t, 0.09, g);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t + 0.11, 0.005, 0.15, 0.16);
    osc('square', 185, t + 0.11, 0.09, g2);
  }
  /* NMS风格通知: 上行琶音钟声 */
  function notify() {
    if (!started) return; const t = now();
    [660, 880, 1320].forEach((f, i) => {
      const g = ctx.createGain(); g.connect(sfxBus);
      env(g, t + i * 0.09, 0.008, 0.12, 0.5);
      osc('sine', f, t + i * 0.09, 0.6, g);
      const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t + i * 0.09, 0.008, 0.04, 0.4);
      osc('sine', f * 2, t + i * 0.09, 0.5, g2);
    });
  }
  function missionComplete() {
    if (!started) return; const t = now();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const g = ctx.createGain(); g.connect(sfxBus);
      env(g, t + i * 0.13, 0.01, 0.14, 0.8);
      osc('sine', f, t + i * 0.13, 0.9, g);
      const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t + i * 0.13, 0.01, 0.05, 0.7);
      osc('triangle', f * 1.005, t + i * 0.13, 0.8, g2);
    });
  }
  function pickup() {
    if (!started) return; const t = now(), g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.004, 0.13, 0.14);
    const o = osc('sine', 780 + Math.random() * 120, t, 0.16, g);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.1);
  }
  function craft() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus); env(g, t, 0.01, 0.12, 0.3);
    const o = osc('sawtooth', 200, t, 0.35, g); o.frequency.exponentialRampToValueAtTime(800, t + 0.25);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600;
    o.disconnect(); o.connect(f); f.connect(g);
    [1046, 1568].forEach((fr, i) => {
      const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t + 0.22 + i * 0.08, 0.008, 0.1, 0.5);
      osc('sine', fr, t + 0.22 + i * 0.08, 0.55, g2);
    });
  }

  /* ---------- 采矿 / 方块 ---------- */
  function laserStart() {
    if (!started || state.laserNode) return;
    const t = now();
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.08); g.connect(sfxBus);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 95;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 142;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 22;
    const lfoG = ctx.createGain(); lfoG.gain.value = 350;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    o.connect(f); o2.connect(f); f.connect(g);
    const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuffer(2); hiss.loop = true;
    const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 3000;
    const hg = ctx.createGain(); hg.gain.value = 0.02;
    hiss.connect(hf); hf.connect(hg); hg.connect(sfxBus);
    o.start(t); o2.start(t); lfo.start(t); hiss.start(t);
    state.laserNode = { o, o2, lfo, hiss, g, hg };
  }
  function laserStop() {
    if (!state.laserNode) return;
    const t = now(), n = state.laserNode;
    n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(n.g.gain.value, t);
    n.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    [n.o, n.o2, n.lfo, n.hiss].forEach(x => { try { x.stop(t + 0.2); } catch (e) {} });
    state.laserNode = null;
  }
  function blockBreak(hard = false) {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.003, hard ? 0.35 : 0.28, 0.16);
    const { f } = noise(t, 0.2, g, 'lowpass', hard ? 900 : 1500, 0.8);
    f.frequency.exponentialRampToValueAtTime(160, t + 0.18);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t, 0.002, 0.2, 0.09);
    const o = osc('triangle', hard ? 150 : 240, t, 0.12, g2);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
  }
  function blockHit() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.002, 0.09, 0.05);
    noise(t, 0.06, g, 'bandpass', 2400 + Math.random() * 800, 3);
  }
  function blockPlace() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.003, 0.25, 0.1);
    const o = osc('triangle', 190, t, 0.13, g);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.09);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t, 0.002, 0.1, 0.05);
    noise(t, 0.06, g2, 'lowpass', 1200);
  }
  function footstep(soft = false) {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.003, soft ? 0.045 : 0.075, 0.07);
    noise(t, 0.08, g, 'lowpass', 500 + Math.random() * 300);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t, 0.002, 0.03, 0.04);
    osc('sine', 95 + Math.random() * 40, t, 0.06, g2);
  }
  function jump() {
    if (!started) return; const t = now(), g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.008, 0.06, 0.1);
    const o = osc('sine', 220, t, 0.13, g); o.frequency.exponentialRampToValueAtTime(420, t + 0.1);
  }
  function land(hard = false) {
    if (!started) return; const t = now(), g = ctx.createGain(); g.connect(sfxBus);
    env(g, t, 0.004, hard ? 0.3 : 0.14, 0.12);
    noise(t, 0.14, g, 'lowpass', 600);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t, 0.003, hard ? 0.22 : 0.1, 0.09);
    const o = osc('sine', 130, t, 0.11, g2); o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
  }

  /* ---------- 喷气背包 ---------- */
  let jetNode = null;
  function jetpackStart() {
    if (!started || jetNode) return;
    const t = now();
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.15); g.connect(sfxBus);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.7;
    src.connect(f); f.connect(g);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 68;
    const og = ctx.createGain(); og.gain.value = 0.05; o.connect(og); og.connect(g);
    src.start(t); o.start(t);
    jetNode = { src, o, g };
  }
  function jetpackStop() {
    if (!jetNode) return;
    const t = now();
    jetNode.g.gain.cancelScheduledValues(t); jetNode.g.gain.setValueAtTime(jetNode.g.gain.value, t);
    jetNode.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    try { jetNode.src.stop(t + 0.3); jetNode.o.stop(t + 0.3); } catch (e) {}
    jetNode = null;
  }

  /* ---------- 扫描仪 ---------- */
  function scan() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    const o = osc('sine', 500, t, 1.2, g);
    o.frequency.exponentialRampToValueAtTime(1900, t + 1.0);
    const g2 = ctx.createGain(); g2.connect(sfxBus);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.05, t + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const o2 = osc('sine', 1000, t, 1.15, g2);
    o2.frequency.exponentialRampToValueAtTime(3800, t + 1.0);
  }
  function scanPing() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus); env(g, t, 0.005, 0.09, 0.4);
    osc('sine', 1720, t, 0.45, g);
  }
  function hazardWarn() {
    if (!started) return; const t = now();
    [0, 0.22].forEach(dt => {
      const g = ctx.createGain(); g.connect(sfxBus); env(g, t + dt, 0.01, 0.1, 0.15);
      osc('triangle', 640, t + dt, 0.17, g);
    });
  }
  function damage() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus); env(g, t, 0.004, 0.3, 0.2);
    noise(t, 0.22, g, 'lowpass', 800);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t, 0.004, 0.2, 0.25);
    const o = osc('sawtooth', 160, t, 0.28, g2); o.frequency.exponentialRampToValueAtTime(55, t + 0.25);
  }
  function refill() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    const o = osc('sine', 340, t, 0.65, g); o.frequency.linearRampToValueAtTime(880, t + 0.55);
  }

  /* ---------- 飞船 ---------- */
  function shipEngineStart(inSpace = false) {
    if (!started || state.engineNodes) return;
    const t = now();
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.6); g.connect(sfxBus);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 52;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 52.7;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    o1.connect(f); o2.connect(f); f.connect(g);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = inSpace ? 300 : 800; nf.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.035;
    src.connect(nf); nf.connect(ng); ng.connect(g);
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 104;
    const humG = ctx.createGain(); humG.gain.value = 0.04; hum.connect(humG); humG.connect(g);
    o1.start(t); o2.start(t); src.start(t); hum.start(t);
    state.engineNodes = { o1, o2, src, hum, g, f, nf };
  }
  function shipEngineUpdate(throttle, boost) {
    if (!state.engineNodes) return;
    const n = state.engineNodes, t = now();
    const base = 52 + throttle * 46 + (boost ? 55 : 0);
    n.o1.frequency.setTargetAtTime(base, t, 0.12);
    n.o2.frequency.setTargetAtTime(base * 1.013, t, 0.12);
    n.f.frequency.setTargetAtTime(420 + throttle * 900 + (boost ? 1400 : 0), t, 0.15);
    n.g.gain.setTargetAtTime(0.07 + throttle * 0.07 + (boost ? 0.05 : 0), t, 0.15);
  }
  function shipEngineStop() {
    if (!state.engineNodes) return;
    const t = now(), n = state.engineNodes;
    n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(n.g.gain.value, t);
    n.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    [n.o1, n.o2, n.src, n.hum].forEach(x => { try { x.stop(t + 1.1); } catch (e) {} });
    state.engineNodes = null;
  }
  function launchRumble() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    const { f } = noise(t, 3.4, g, 'lowpass', 300, 0.5);
    f.frequency.linearRampToValueAtTime(1400, t + 3.0);
    const g2 = ctx.createGain(); g2.connect(sfxBus);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.22, t + 0.3);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    const o = osc('sawtooth', 38, t, 3.3, g2);
    o.frequency.linearRampToValueAtTime(130, t + 3.0);
  }
  function pulseDriveStart() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.5);
    const o = osc('sawtooth', 90, t, 1.2, g);
    o.frequency.exponentialRampToValueAtTime(660, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
    const g2 = ctx.createGain(); g2.connect(sfxBus);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.12, t + 0.6);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    const { f } = noise(t, 1.3, g2, 'bandpass', 500, 1.4);
    f.frequency.exponentialRampToValueAtTime(4000, t + 1.1);
  }
  function pulseDriveEnd() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus); env(g, t, 0.01, 0.24, 0.7);
    const o = osc('sawtooth', 520, t, 0.8, g); o.frequency.exponentialRampToValueAtTime(70, t + 0.65);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t, 0.005, 0.14, 0.5);
    noise(t, 0.55, g2, 'lowpass', 2500);
  }
  function atmosphereEntry() {
    if (!started) return null; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.38, t + 1.6);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(250, t);
    f.frequency.linearRampToValueAtTime(2600, t + 3.2);
    src.connect(f); f.connect(g); src.start(t);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 44;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.18, t + 1.5);
    o.connect(og); og.connect(sfxBus); o.start(t);
    return {
      stop() {
        const tt = now();
        g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value, tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
        og.gain.cancelScheduledValues(tt); og.gain.setValueAtTime(og.gain.value, tt);
        og.gain.exponentialRampToValueAtTime(0.0001, tt + 1.2);
        try { src.stop(tt + 1.5); o.stop(tt + 1.4); } catch (e) {}
      }
    };
  }
  function shipLand() {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus); env(g, t, 0.01, 0.3, 0.5);
    noise(t, 0.5, g, 'lowpass', 400);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t, 0.005, 0.24, 0.3);
    const o = osc('sine', 90, t, 0.35, g2); o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    // 液压嘶声
    const g3 = ctx.createGain(); g3.connect(sfxBus); env(g3, t + 0.35, 0.02, 0.08, 0.45);
    noise(t + 0.35, 0.5, g3, 'highpass', 4000);
  }
  function cockpitToggle(enter) {
    if (!started) return; const t = now();
    const g = ctx.createGain(); g.connect(sfxBus); env(g, t, 0.01, 0.12, 0.3);
    const o = osc('sine', enter ? 300 : 620, t, 0.35, g);
    o.frequency.exponentialRampToValueAtTime(enter ? 620 : 300, t + 0.28);
    const g2 = ctx.createGain(); g2.connect(sfxBus); env(g2, t + 0.1, 0.01, 0.07, 0.3);
    noise(t + 0.1, 0.35, g2, 'highpass', 3500);
  }

  /* ---------- 环境音 ---------- */
  function stopAmbient() {
    state.ambientNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} });
    state.ambientNodes = [];
    if (state.musicTimer) { clearInterval(state.musicTimer); state.musicTimer = null; }
  }
  function startPlanetAmbient() {
    if (!started) return; stopAmbient();
    const t = now();
    // 风声
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.06, t + 3);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 220;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(ambBus);
    src.start(t); lfo.start(t);
    state.ambientNodes.push(src, lfo, g);
    state.windGain = g;
    startMusic('planet');
  }
  function startSpaceAmbient() {
    if (!started) return; stopAmbient();
    const t = now();
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.045, t + 4);
    o1.connect(g); o2.connect(g); g.connect(ambBus);
    o1.start(t); o2.start(t);
    state.ambientNodes.push(o1, o2, g);
    startMusic('space');
  }
  /* 生成式环境音乐: 五声音阶随机钟声垫 */
  const SCALES = {
    planet: [220, 261.63, 293.66, 329.63, 392, 440, 523.25],
    space: [174.61, 220, 261.63, 349.23, 440, 523.25]
  };
  function startMusic(mode) {
    if (state.musicTimer) clearInterval(state.musicTimer);
    const scale = SCALES[mode] || SCALES.planet;
    const play = () => {
      if (!started || document.hidden) return;
      if (Math.random() < 0.35) return;
      const t = now();
      const f0 = scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.25 ? 2 : 1);
      const g = ctx.createGain(); g.connect(musBus);
      const dur = 3 + Math.random() * 3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09 + Math.random() * 0.05, t + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const o = osc('sine', f0, t, dur, g);
      o.detune.setValueAtTime((Math.random() - 0.5) * 8, t);
      const g2 = ctx.createGain(); g2.connect(musBus);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(0.03, t + dur * 0.4);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc('triangle', f0 * (mode === 'space' ? 1.5 : 2), t, dur, g2);
    };
    state.musicTimer = setInterval(play, 2400);
    play();
  }
  function setWind(v) {
    if (state.windGain) state.windGain.gain.setTargetAtTime(0.03 + v * 0.09, now(), 0.5);
  }
  function death() {
    if (!started) return; const t = now();
    stopAmbient(); laserStop(); jetpackStop(); shipEngineStop();
    const g = ctx.createGain(); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    const o = osc('sawtooth', 330, t, 2.5, g);
    o.frequency.exponentialRampToValueAtTime(40, t + 2.2);
    [392, 311.13, 233.08].forEach((f, i) => {
      const g2 = ctx.createGain(); g2.connect(sfxBus);
      env(g2, t + 0.3 + i * 0.45, 0.02, 0.12, 1.4);
      osc('sine', f, t + 0.3 + i * 0.45, 1.5, g2);
    });
  }

  return {
    init, get started() { return started; },
    uiHover, uiClick, uiOpen, uiClose, uiError, notify, missionComplete, pickup, craft,
    laserStart, laserStop, blockBreak, blockHit, blockPlace,
    footstep, jump, land, jetpackStart, jetpackStop,
    scan, scanPing, hazardWarn, damage, refill,
    shipEngineStart, shipEngineUpdate, shipEngineStop, launchRumble,
    pulseDriveStart, pulseDriveEnd, atmosphereEntry, shipLand, cockpitToggle,
    startPlanetAmbient, startSpaceAmbient, stopAmbient, setWind, death
  };
})();
