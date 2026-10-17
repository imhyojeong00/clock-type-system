const ORIGINAL_DIR = "assets/original";
const XRAY_DIR = "assets/xray";

const HAND_TARGET = 0.3;
const FIT_MARGIN = { side: 10, top: 96, bottom: 110 };
const MAX_WIDTH_FRAC = 0.72;
let ANCHOR_Y = 0.46;
let LITE_FX = false;
const viewW = () => (document.getElementById("main-view") || {}).clientWidth || window.innerWidth;
const viewH = () => (document.getElementById("main-view") || {}).clientHeight || window.innerHeight;
const T = {
  body: 0,
  graftBody: 380,
  dial: 780,
  graftDial: 1120,
  hands: 1520,
  graftHands: 1900,
  wind: 2320,
  second: 2750
};
const PART_MS = 420;
const SET_MS = 700;
const SET_DEG = -75;
const PRESS_SCALE = 1.045;
const EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)";

const GROW_MS = 1100;
const GROW_SECOND = 900;

const keyIndex = new Map();
CLOCKS.forEach((c, i) => keyIndex.set(c.key, i));

const hasXray = (c) => c.layers && c.layers.length > 0;
const hasHands = (c) => hasXray(c) && c.layers.includes("hands");

const PARTS_DIR = "assets/parts";
const GRAFT_DONORS = CLOCKS.filter(hasHands);
const SECOND_DONORS = CLOCKS.filter((c) => hasXray(c) && c.layers.includes("second"));

function hideIfMissing(img) {
  img.addEventListener("error", () => {
    img.style.display = "none";
    console.warn("Image file missing:", img.getAttribute("src"));
  }, { once: true });
  return img;
}

function seededRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function graftPlan(index) {
  const c = CLOCKS[index];
  const r = (n) => seededRandom(index * 7.13 + n * 3.71 + 11);
  const pick = (pool, n) => pool[Math.floor(r(n) * pool.length) % pool.length];
  const pool = GRAFT_DONORS.filter((d) => d.id !== c.id);
  const dialDonor = pick(pool, 1);
  const handsDonor = pick(pool.filter((d) => d !== dialDonor), 2);
  const secondDonor = pick(SECOND_DONORS.filter((d) => d.id !== c.id), 3);
  const bodyDonor = pick(pool.filter((d) => d !== dialDonor && d !== handsDonor), 15);
  const dial2Donor = pick(pool.filter((d) => d !== dialDonor && d !== handsDonor && d !== bodyDonor), 30);
  return [
    { role: "body", donor: bodyDonor,
      rot: 0, dx: (r(17) - 0.5) * 0.35, dy: (r(18) - 0.5) * 0.3,
      size: 0.85 + r(19) * 0.4, delay: T.graftBody },
    { role: "dial", donor: dialDonor,
      rot: 0, dx: (r(6) - 0.5) * 0.3, dy: (r(7) - 0.5) * 0.3,
      size: 0.9 + r(8) * 0.35, delay: T.graftDial },
    { role: "dial", donor: dial2Donor, layer: 2,
      rot: 0, dx: -(r(6) - 0.5) * 0.3 + (r(31) - 0.5) * 0.12, dy: -(r(7) - 0.5) * 0.3 + (r(32) - 0.5) * 0.12,
      size: 0.8 + r(33) * 0.45, delay: T.graftDial + 170 },
    { role: "hands", donor: handsDonor,
      rot: 40 + r(9) * 280, dx: (r(10) - 0.5) * 0.05, dy: (r(11) - 0.5) * 0.05,
      size: 0.82 + r(12) * 0.2, delay: T.graftHands },
    { role: "second", donor: secondDonor,
      rot: r(13) * 360, dx: 0, dy: 0,
      size: 0.95 + r(14) * 0.15, delay: T.second }
  ];
}

function buildGraft(g, own, ownW, ownH, assemble) {
  const d = g.donor;
  const ownHandPx = own.handR * ownW;
  let k = (ownHandPx / (d.handR * d.w)) * g.size;
  if (g.role === "body") k = Math.min(k, (ownW * 1.35) / d.w, (ownH * 1.35) / d.h);
  const W = d.w * k;
  const H = d.h * k;
  const ownPx = own.pivot.x * ownW;
  const ownPy = own.pivot.y * ownH;

  const el = document.createElement("div");
  el.className = `graft graft-${g.role}`;
  el.style.width = `${W}px`;
  el.style.height = `${H}px`;
  el.style.left = `${ownPx - d.pivot.x * W}px`;
  el.style.top = `${ownPy - d.pivot.y * H}px`;
  el.style.setProperty("--px", `${d.pivot.x * 100}%`);
  el.style.setProperty("--py", `${d.pivot.y * 100}%`);
  const tx = g.dx * ownHandPx;
  const ty = g.dy * ownHandPx;
  const finalT = `translate(${tx}px, ${ty}px) rotate(${g.rot}deg)`;
  el.style.transform = finalT;

  if (g.role === "body") {
    const back = document.createElement("div");
    back.className = "xr-back";
    back.style.setProperty("--silhouette", `url("${ORIGINAL_DIR}/${d.id}.webp")`);
    el.appendChild(back);
  }
  ["orig", "xr"].forEach((mode) => {
    const img = document.createElement("img");
    img.decoding = "async";
    img.className = `gp-${mode}`;
    img.src = g.role === "body"
      ? (mode === "orig" ? `${ORIGINAL_DIR}/${d.id}.webp` : `${XRAY_DIR}/${d.id}-body.webp`)
      : mode === "orig"
      ? `${PARTS_DIR}/${d.id}-${g.role}.webp`
      : g.role === "dial" ? `${PARTS_DIR}/${d.id}-dial-xr.webp` : `${XRAY_DIR}/${d.id}-${g.role}.webp`;
    img.alt = "";
    hideIfMissing(img);
    if (g.role === "second") img.classList.add("x-second", `m-${d.second || "sweep"}`);
    el.appendChild(img);
  });

  if (assemble === "grow") {
    const stagger = { body: 0, dial: g.layer === 2 ? 150 : 90, hands: 220, second: GROW_SECOND };
    el.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: g.role === "second" ? 160 : 700, delay: stagger[g.role] || 0, easing: EASE, fill: "backwards" });
  } else if (assemble) {
    const floatT = `translate(${tx}px, ${ty}px) rotate(${g.rot}deg) scale(${PRESS_SCALE})`;
    if (g.role === "hands") {
      el.animate(
        [
          { transform: `translate(${tx}px, ${ty}px) rotate(${g.rot + SET_DEG}deg) scale(${PRESS_SCALE})`, opacity: 0 },
          { transform: `translate(${tx}px, ${ty}px) rotate(${g.rot + SET_DEG}deg)`, opacity: 1, offset: 0.36 },
          { transform: finalT, opacity: 1 }
        ],
        { duration: PART_MS + SET_MS, delay: g.delay, easing: EASE, fill: "backwards" }
      );
    } else if (g.role === "second") {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: g.delay, fill: "backwards" });
    } else {
      el.animate(
        [{ transform: floatT, opacity: 0 }, { transform: finalT, opacity: 1 }],
        { duration: PART_MS, delay: g.delay, easing: EASE, fill: "backwards" }
      );
    }
  }
  return el;
}

function assembleOwn(node, xr, orig, opts) {
  if (opts.assemble === "grow") {
    node.style.setProperty("--sec-delay", `${GROW_SECOND}ms`);
    node.classList.add("grow-in");
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add("settled")));
    return;
  }
  node.style.setProperty("--sec-delay", `${T.second}ms`);
  const fadeIn = (el, delay, ms = PART_MS) =>
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, delay, easing: EASE, fill: "backwards" });
  const pressIn = (el, delay) =>
    el.animate(
      [{ transform: `scale(${PRESS_SCALE})`, opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: PART_MS, delay, easing: EASE, fill: "backwards" }
    );
  const q = (sel) => xr.querySelector(sel);
  if (q(".x-body")) fadeIn(q(".x-body"), T.body);
  if (q(".x-dial")) pressIn(q(".x-dial"), T.dial);
  if (!q(".x-body")) fadeIn(xr.lastElementChild, T.body);
  const hands = q(".x-hands");
  if (hands && !opts.dropHands) {
    hands.animate(
      [
        { transform: `rotate(${SET_DEG}deg) scale(${PRESS_SCALE})`, opacity: 0 },
        { transform: `rotate(${SET_DEG}deg)`, opacity: 1, offset: 0.36 },
        { transform: "none", opacity: 1 }
      ],
      { duration: PART_MS + SET_MS, delay: T.hands, easing: EASE, fill: "backwards" }
    );
  }
  const sec = q(".x-second");
  if (sec && !opts.dropHands) fadeIn(sec, T.second, 160);
}

function attachGraft(node, el, g) {
  if (g.role === "body") node.insertBefore(el, node.firstChild);
  else node.appendChild(el);
}

function anchorScreen() {
  return { x: viewW() * 0.5, y: viewH() * ANCHOR_Y };
}

function displaySize(c) {
  const vw = viewW();
  const vh = viewH();
  const a = anchorScreen();
  const handPx = c.handR * c.w;
  let s = (Math.min(vw, vh) * HAND_TARGET) / handPx;
  const halfMax = vw * MAX_WIDTH_FRAC * 0.5;
  const fit = Math.min(
    Math.min(a.x - FIT_MARGIN.side, halfMax) / (c.pivot.x * c.w),
    Math.min(vw - a.x - FIT_MARGIN.side, halfMax) / ((1 - c.pivot.x) * c.w),
    (a.y - FIT_MARGIN.top) / (c.pivot.y * c.h),
    (vh - a.y - FIT_MARGIN.bottom) / ((1 - c.pivot.y) * c.h)
  );
  s = Math.min(s, fit) * (SIZE_ADJUST[c.key] ?? 1);
  return { w: c.w * s, h: c.h * s };
}

function buildClock(c, opts = {}) {
  const plan = typeof opts.index === "number" ? graftPlan(opts.index) : [];
  const { w, h } = displaySize(c);
  const px = c.pivot.x * w;
  const py = c.pivot.y * h;
  const offsetX = opts.offsetX || 0;

  const node = document.createElement("div");
  node.className = "clock-node";
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
  node.style.left = `${offsetX - px}px`;
  node.style.top = `${-py}px`;
  node.style.setProperty("--px", `${c.pivot.x * 100}%`);
  node.style.setProperty("--py", `${c.pivot.y * 100}%`);
  node.dataset.id = c.id;

  const orig = document.createElement("img");
  orig.className = "orig";
  orig.decoding = "async";
  orig.src = `${ORIGINAL_DIR}/${c.id}.webp`;
  orig.alt = "";
  hideIfMissing(orig);
  node.appendChild(orig);

  const xr = document.createElement("div");
  xr.className = "xr";
  node.appendChild(xr);
  const back = document.createElement("div");
  back.className = "xr-back";
  back.style.setProperty("--silhouette", `url("${ORIGINAL_DIR}/${c.id}.webp")`);
  xr.appendChild(back);

  if (!hasXray(c)) {
    node.classList.add("no-xray");
    node.style.setProperty("--mask", `url("${ORIGINAL_DIR}/${c.id}.webp")`);
    const img = document.createElement("img");
    img.decoding = "async";
    img.src = `${ORIGINAL_DIR}/${c.id}.webp`;
    img.alt = "";
    hideIfMissing(img);
    xr.appendChild(img);
    plan.forEach((g) => attachGraft(node, buildGraft(g, c, w, h, opts.assemble), g));
    if (opts.dropHands) node.classList.add("hands-dropped");
    if (opts.assemble) assembleOwn(node, xr, orig, opts);
    return { node, w, h, px, py, plan };
  }

  c.layers.forEach((role) => {
    const img = document.createElement("img");
    img.decoding = "async";
    img.className = `x-${role}`;
    img.src = `${XRAY_DIR}/${c.id}-${role}.webp`;
    img.alt = "";
    hideIfMissing(img);
    if (role === "second" && c.second) img.classList.add(`m-${c.second}`);
    xr.appendChild(img);
  });

  if (opts.dropHands) {
    node.classList.add("hands-dropped");
    node.style.setProperty("--mask", `url("${XRAY_DIR}/${c.id}-body.webp")`);
  }

  if (opts.assemble) assembleOwn(node, xr, orig, opts);
  plan.forEach((g) => attachGraft(node, buildGraft(g, c, w, h, opts.assemble), g));
  return { node, w, h, px, py, plan };
}

const mainView = document.getElementById("main-view");
const world = document.getElementById("world");
const stripLayer = document.getElementById("xray-strip-layer");
const mainLabel = document.getElementById("main-label");
const typedDisplay = document.getElementById("typed-display");
const keyCapture = document.getElementById("key-capture");
const xrayToggleBtn = document.getElementById("xray-toggle");
const zoomLabel = document.getElementById("zoom-label");

function makeArbor(layer) {
  const a = document.createElement("div");
  a.className = "arbor";
  layer.appendChild(a);
  return a;
}
const lineArbor = makeArbor(stripLayer);

let typed = [];
let lastIndex = null;
let generation = 0;

let xrayMode = false;
function setXrayMode(on) {
  xrayMode = on;
  document.body.classList.toggle("xray-mode", on);
  xrayToggleBtn.setAttribute("aria-pressed", String(on));
  Sound.shutter(on);
}
xrayToggleBtn.addEventListener("click", () => {
  setXrayMode(!xrayMode);
  keyCapture.focus();
});

const LINE_GAP = -0.38;
let lineItems = [];
let lineLastPivotX = 0;
let lineLastRight = 0;
let focusIdx = -1;

const TAG_ROW_Y = () => viewH() * Math.min(0.36, 0.94 - ANCHOR_Y);

const DISPLACE_BASE = 6;
const DISPLACE_PEAK_ADD = 22;
let meltFilterRaf = null;
function animateMeltFilter(durationMs) {
  const disp = document.getElementById("goo-displace");
  if (!disp) return;
  cancelAnimationFrame(meltFilterRaf);
  const start = performance.now();
  function step(now) {
    const t = Math.max(0, Math.min(1, (now - start) / durationMs));
    disp.setAttribute("scale", String(DISPLACE_BASE + DISPLACE_PEAK_ADD * Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.6)));
    if (t < 1) meltFilterRaf = requestAnimationFrame(step);
    else disp.setAttribute("scale", String(DISPLACE_BASE));
  }
  meltFilterRaf = requestAnimationFrame(step);
}

function placeInLine(c, index, opts) {
  clearTimeout(snapTimer);
  const { w } = displaySize(c);
  const left = c.pivot.x * w;
  const pivotX = lineItems.length === 0
    ? 0
    : lineLastPivotX + (lineLastRight + left) * (1 + LINE_GAP);

  const effect = xrayMode ? "steps" : "grow";
  const slot = document.createElement("div");
  slot.className = "line-slot" + (effect === "grow" && !LITE_FX ? " growing" : "");
  const built = buildClock(c, { assemble: effect, dropHands: opts.dropHands, offsetX: pivotX, index });
  const n = built.node;
  slot.appendChild(n);

  const tag = document.createElement("button");
  tag.type = "button";
  tag.className = "line-tag";
  tag.textContent = c.key;
  tag.style.left = `${pivotX}px`;
  tag.style.top = `${TAG_ROW_Y()}px`;
  tag.dataset.item = String(lineItems.length);
  slot.appendChild(tag);

  lineArbor.appendChild(slot);
  if (effect === "grow" && !LITE_FX) {
    animateMeltFilter(GROW_MS);
    setTimeout(() => slot.classList.remove("growing"), GROW_MS + 60);
  }

  lineItems.push({ slot, c, index, pivotX, opts });
  lineLastPivotX = pivotX;
  lineLastRight = w - left;

  const item = lineItems[lineItems.length - 1];
  item.plan = built.plan;
  item.right = w - left;
  item.secStart = effect === "grow" ? Sound.grow(c, built.plan, opts) : Sound.assemble(c, built.plan, opts);
  Sound.addClockToRoom(c, built.plan, opts, lineItems.length - 1);
  followCamera = true;
  focusOn(lineItems.length - 1, false);
}

function focusOn(i, updateLabel = true, pan = true) {
  if (i < 0 || i >= lineItems.length) return;
  if (!pan && i === focusIdx) return;
  focusIdx = i;
  const it = lineItems[i];
  if (pan) animatePanTo(-it.pivotX * zoomScale, 0, 620);
  lineItems.forEach((x, k) => x.slot.classList.toggle("is-focus", k === i));
  Sound.setFocus(i);
  Sound.focusItem(it);
  if (updateLabel) mainLabel.innerHTML = labelFor(it.c, it.opts, graftPlan(it.index));
}

function clearLine() {
  lineItems.forEach((x) => x.slot.remove());
  lineItems = [];
  lineLastPivotX = 0;
  lineLastRight = 0;
  focusIdx = -1;
}

const roleName = (r) => tr("role_" + r);
let zShown = false;
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

function labelFor(c, opts, plan) {
  zShown = false;
  let head = `<span class="lb-key">${esc(c.key)}</span><span class="lb-name">${esc(clockName(c))}</span>`;
  if (c.year) head += `<span class="lb-year">${esc(c.year)}</span>`;
  const notes = [];
  if (!hasXray(c)) notes.push(tr("note_noxray"));
  else if (opts.dropHands) notes.push(tr("note_drop"));
  if (notes.length) head += `<span class="lb-note">${notes.join(" · ")}</span>`;

  const parts = (plan || [])
    .filter((g) => !(opts.dropHands && (g.role === "hands" || g.role === "second")))
    .map((g) => `<span class="lb-part"><span class="lb-role">${roleName(g.role)}</span>` +
      `${esc(clockName(g.donor))} <span class="lb-from">${esc(g.donor.key)}</span></span>`);
  const list = parts.length
    ? `<div class="lb-list"><span class="lb-title">${tr("layered")} ${parts.length}</span>${parts.join("")}</div>`
    : "";
  return `<div class="lb-head">${head}</div>${list}`;
}

function zLabel() {
  return `<div class="lb-head"><span class="lb-key">Z</span><span class="lb-name">${esc(tr("z_empty"))}</span></div>`;
}

function refreshLabel() {
  if (zShown) { mainLabel.innerHTML = zLabel(); return; }
  const i = focusIdx >= 0 ? focusIdx : lineItems.length - 1;
  if (i < 0 || !lineItems[i]) return;
  const it = lineItems[i];
  mainLabel.innerHTML = labelFor(it.c, it.opts, graftPlan(it.index));
}
document.addEventListener("langchange", refreshLabel);

const MOVEMENT = {
  "00": ["pendulum", "wood"], "01": ["pendulum", "wood"], "02": ["pendulum", "wood"],
  "03": ["pendulum", "wood"], "04": ["synchronous", "metal", 50], "05": ["torsion", "wood"],
  "06": ["synchronous", "bakelite", 60], "07": ["synchronous", "bakelite", 60],
  "08": ["quartz", "metal"], "09": ["quartz", "bakelite"], "10": ["quartz", "metal"],
  "11": ["synchronous", "bakelite", 50], "12": ["synchronous", "metal", 50],
  "13": ["quartz", "metal"], "14": ["quartz", "bakelite"], "15": ["quartz", "metal"],
  "16": ["quartz", "metal"], "17": ["quartz", "bakelite"], "18": ["synchronous", "metal", 50],
  "19": ["quartz", "metal"], "20": ["synchronous", "metal", 50], "21": ["pendulum", "wood"],
  "22": ["pendulum", "wood"], "23": ["quartz", "metal"], "24": ["quartz", "metal"]
};
const mv = (c) => MOVEMENT[c.id] || ["quartz", "metal"];

const Sound = (() => {
  let ctx = null;
  let master = null;
  let dry = null;
  let wet = null;
  let noise = null;
  let enabled = true;
  let room = [];
  let focus = -1;
  let schedTimer = null;
  let focusSecond = null;
  let humNodes = [];
  let voices = 0;
  const pending = [];
  let humTimer = null;
  const buses = new Map();

  function init() {
    if (ctx) { if (ctx.state !== "running") ctx.resume(); return ctx; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);
    dry = ctx.createGain();
    dry.connect(master);
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.3);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    conv.buffer = ir;
    wet = ctx.createGain();
    wet.gain.value = 0.28;
    wet.connect(conv);
    conv.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    startRoomTone();
    schedTimer = setInterval(schedule, 30);
    return ctx;
  }

  function out(pan = 0, gain = 1, send = 0.3) {
    const key = Math.round(Math.max(-1, Math.min(1, pan)) * 20) + "|" + Math.round(send * 20);
    let g = buses.get(key);
    if (!g) {
      g = ctx.createGain();
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(dry); }
      else g.connect(dry);
      if (send > 0) {
        const sg = ctx.createGain();
        sg.gain.value = send;
        g.connect(sg);
        sg.connect(wet);
      }
      buses.set(key, g);
    }
    return g;
  }
  function take(prio) {
    if (voices >= (prio ? 400 : 260)) return false;
    voices++;
    return true;
  }
  function defer(fn, t, args) {
    if (t - ctx.currentTime <= 0.3) return false;
    pending.push({ t, fn, args: Array.prototype.slice.call(args) });
    return true;
  }
  function flushPending() {
    if (!pending.length) return;
    const lim = ctx.currentTime + 0.25;
    let w = 0;
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (p.t <= lim) { if (enabled || p.t > ctx.currentTime) { try { p.fn.apply(null, p.args); } catch (e) { console.error("sound", e.message); } } }
      else pending[w++] = p;
    }
    pending.length = w;
  }
  function release(src, ...nodes) {
    src.onended = () => {
      voices--;
      try { src.disconnect(); nodes.forEach((n) => n.disconnect()); } catch (e) {}
    };
  }
  function burst(t, opt) {
    if (defer(burst, t, arguments)) return;
    const { freq = 3000, q = 4, dur = 0.03, gain = 0.3, pan = 0, send = 0.3, type = "bandpass", prio = 1 } = opt;
    if (!take(prio)) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(e); e.connect(out(pan, 1, send));
    release(src, f, e);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }
  function tone(t, opt) {
    if (defer(tone, t, arguments)) return;
    const { freq = 200, dur = 0.2, gain = 0.2, pan = 0, send = 0.3, drop = 1, type = "sine", prio = 1 } = opt;
    if (!take(prio)) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e); e.connect(out(pan, 1, send));
    release(o, e);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function metalRing(t, base, gain, pan = 0, dur = 0.35) {
    [1, 2.76, 5.4, 8.93].forEach((m, i) =>
      tone(t, { freq: base * m, dur: dur / (1 + i * 0.6), gain: gain / (1 + i * 1.3), pan, send: 0.45, prio: i === 0 ? 1 : 0 }));
  }

  function caseSound(t, material, gain = 1, pan = 0) {
    if (material === "wood") {
      tone(t, { freq: 140, drop: 0.7, dur: 0.22, gain: 0.5 * gain, pan, send: 0.35 });
      burst(t, { freq: 700, q: 1.2, dur: 0.07, gain: 0.35 * gain, pan, type: "lowpass" });
    } else if (material === "metal") {
      tone(t, { freq: 110, drop: 0.8, dur: 0.15, gain: 0.35 * gain, pan });
      metalRing(t + 0.005, 620, 0.12 * gain, pan, 0.6);
      burst(t, { freq: 2500, q: 2, dur: 0.03, gain: 0.25 * gain, pan });
    } else {
      tone(t, { freq: 260, drop: 0.85, dur: 0.08, gain: 0.35 * gain, pan, send: 0.2 });
      burst(t, { freq: 1600, q: 3, dur: 0.035, gain: 0.35 * gain, pan, send: 0.2 });
    }
  }
  function dialSound(t, pitch = 1, gain = 1, pan = 0) {
    burst(t, { freq: 3800 * pitch, q: 5, dur: 0.02, gain: 0.3 * gain, pan });
    metalRing(t + 0.003, 1150 * pitch, 0.07 * gain, pan, 0.4);
  }
  function handsSound(t, gain = 1, pan = 0) {
    burst(t, { freq: 5200, q: 8, dur: 0.015, gain: 0.3 * gain, pan });
    const start = t + (PART_MS * 0.36) / 1000;
    const span = (SET_MS + PART_MS * 0.64) / 1000;
    const n = 11;
    for (let i = 0; i < n; i++) {
      const u = Math.pow(i / (n - 1), 1.7);
      burst(start + u * span, { freq: 3400 + (i % 2) * 500, q: 9, dur: 0.012, gain: 0.07 * gain * (1 - i / n * 0.5), pan, send: 0.15, prio: 0 });
    }
  }
  function powerSound(t, c) {
    if (defer(powerSound, t, arguments)) return;
    const [kind, , hz] = mv(c);
    if (kind === "pendulum" || kind === "torsion") {
      for (let i = 0; i < 9; i++) {
        const tt = t + i * 0.085 + Math.pow(i, 1.4) * 0.006;
        burst(tt, { freq: 2600 + i * 90, q: 7, dur: 0.018, gain: 0.16 + i * 0.012, prio: 0 });
        tone(tt, { freq: 900 + i * 25, dur: 0.03, gain: 0.02, prio: 0 });
      }
    } else if (kind === "synchronous") {
      burst(t, { freq: 1200, q: 2, dur: 0.05, gain: 0.35 });
      tone(t, { freq: 180, drop: 0.9, dur: 0.06, gain: 0.2 });
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = (hz || 60) * 2;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 420;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t + 0.05);
      e.gain.exponentialRampToValueAtTime(0.06, t + 0.2);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(f); f.connect(e); e.connect(out(0, 1, 0.2));
      o.start(t + 0.05); o.stop(t + 1);
    } else {
      burst(t, { freq: 900, q: 1.5, dur: 0.05, gain: 0.25, type: "lowpass" });
      burst(t + 0.09, { freq: 4200, q: 6, dur: 0.02, gain: 0.35 });
      metalRing(t + 0.09, 1900, 0.04, 0, 0.2);
    }
  }
  function tickSound(t, kind, gain = 1, pan = 0, alt = false) {
    if (kind === "pendulum") {
      burst(t, { freq: alt ? 2100 : 2600, q: 6, dur: 0.03, gain: 0.22 * gain, pan, send: 0.4 });
      tone(t, { freq: alt ? 480 : 560, dur: 0.05, gain: 0.05 * gain, pan, send: 0.4 });
    } else if (kind === "torsion") {
      burst(t, { freq: 1800, q: 4, dur: 0.05, gain: 0.2 * gain, pan, send: 0.5 });
      metalRing(t, 820, 0.03 * gain, pan, 0.5);
    } else if (kind === "stop2go") {
      burst(t, { freq: 900, q: 1.5, dur: 0.09, gain: 0.4 * gain, pan, send: 0.4, type: "lowpass" });
      tone(t, { freq: 150, drop: 0.7, dur: 0.12, gain: 0.25 * gain, pan });
    } else {
      burst(t, { freq: 4300, q: 10, dur: 0.012, gain: 0.2 * gain, pan, send: 0.2 });
    }
  }
  function emptySound(t) {
    tone(t, { freq: 320, drop: 0.6, dur: 0.18, gain: 0.18, send: 0.5 });
    burst(t, { freq: 600, q: 1, dur: 0.1, gain: 0.15, type: "lowpass" });
  }

  function assemble(c, plan, opts) {
    if (!init()) return;
    const t0 = ctx.currentTime + 0.03;
    const at = (ms) => t0 + ms / 1000;
    const g = (role) => plan.find((p) => p.role === role);
    const hasX = hasXray(c);
    caseSound(at(T.body), mv(c)[1], 1);
    if (g("body")) caseSound(at(T.graftBody), mv(g("body").donor)[1], 0.55, -0.15);
    if (hasX) dialSound(at(T.dial), 1, 1);
    plan.filter((p) => p.role === "dial").forEach((p, i) =>
      dialSound(at(p.delay), 0.82 + i * 0.18, 0.8 - i * 0.2, i ? -0.12 : 0.12));
    if (opts.dropHands) {
      emptySound(at(T.hands));
      return at(T.second);
    }
    if (hasX) handsSound(at(T.hands), 1);
    if (g("hands")) handsSound(at(T.graftHands), 0.8, 0.1);
    powerSound(at(T.wind), c);
    const sg = g("second");
    tickSound(at(T.second), "quartz", 1.3);
    return at(T.second);
  }
  let focusOwnSecond = null;

  function grow(c, plan, opts) {
    if (!init()) return null;
    const t0 = ctx.currentTime + 0.03;
    tone(t0, { freq: 72, drop: 0.75, dur: 0.9, gain: 0.28, send: 0.5 });
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = 0.9;
    f.frequency.setValueAtTime(1800, t0);
    f.frequency.exponentialRampToValueAtTime(300, t0 + GROW_MS / 1000);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t0);
    e.gain.exponentialRampToValueAtTime(0.12, t0 + 0.25);
    e.gain.exponentialRampToValueAtTime(0.0001, t0 + GROW_MS / 1000);
    src.connect(f); f.connect(e); e.connect(out(0, 1, 0.5));
    src.start(t0, 0, GROW_MS / 1000 + 0.1);
    const settle = t0 + (GROW_MS * 0.8) / 1000;
    caseSound(settle, mv(c)[1], 0.8);
    const sg = plan.find((p) => p.role === "body");
    if (sg) caseSound(settle + 0.04, mv(sg.donor)[1], 0.4, -0.1);
    const start = t0 + GROW_SECOND / 1000;
    if (opts.dropHands) { emptySound(start); return start; }
    tickSound(start, "quartz", 1.1);
    return start;
  }

  function focusItem(item) {
    focusSecond = null;
    focusOwnSecond = null;
    if (!item || item.opts.dropHands || item.secStart == null) return;
    const sg = item.plan.find((p) => p.role === "second");
    if (sg) focusSecond = { motion: sg.donor.second, start: item.secStart };
    const c = item.c;
    if (hasXray(c) && c.layers.includes("second") && c.second) focusOwnSecond = { motion: c.second, start: item.secStart };
  }

  function addClockToRoom(c, plan, opts, lineIndex) {
    if (!init()) return;
    const [kind, , hz] = mv(c);
    const period = kind === "torsion" ? 7.5 : 1;
    room.push({
      c, kind, hz, lineIndex, period, alt: false,
      next: ctx.currentTime + T.wind / 1000 + 0.4 + Math.random() * period,
      stopped: !!opts.dropHands
    });
    if (room.length > 14) room.shift();
    setFocus(lineIndex);
  }

  function roomMix(r) {
    const d = r.lineIndex - focus;
    const near = d === 0;
    const gain = near ? 0.95 : Math.max(0.05, 0.3 / (1 + Math.abs(d) * 0.7));
    const pan = Math.max(-0.9, Math.min(0.9, d * 0.22));
    return { gain, pan, near };
  }

  function setFocus(i) {
    focus = i;
    if (!ctx) return;
    clearTimeout(humTimer);
    humTimer = setTimeout(updateHum, 180);
  }

  function updateHum() {
    humNodes.forEach((h) => {
      h.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      setTimeout(() => { try { h.o.forEach((o) => o.stop()); } catch (e) {} }, 800);
    });
    humNodes = [];
    room.filter((r) => r.kind === "synchronous" && !r.stopped).slice(-4).forEach((r) => {
      const { gain, pan } = roomMix(r);
      const g = out(pan, 1, 0.15);
      g.gain.value = 0.0001;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 500;
      f.connect(g);
      const os = [2, 3, 4].map((m, k) => {
        const o = ctx.createOscillator();
        o.type = k === 0 ? "triangle" : "sine";
        o.frequency.value = (r.hz || 60) * m;
        const og = ctx.createGain();
        og.gain.value = 1 / (1 + k * 1.5);
        o.connect(og); og.connect(f);
        o.start();
        return o;
      });
      g.gain.setTargetAtTime(0.022 * gain, ctx.currentTime + 0.3, 0.4);
      humNodes.push({ g, o: os });
    });
  }

  function schedule() {
    if (!ctx) return;
    flushPending();
    if (!enabled) return;
    const now = ctx.currentTime;
    const ahead = now + 0.2;
    room.forEach((r) => {
      if (r.stopped || r.kind === "synchronous") return;
      if (r.next < now - 1) r.next = now + 0.05;
      while (r.next < ahead) {
        if (r.next > now - 0.05) {
          const { gain, pan } = roomMix(r);
          tickSound(r.next, r.kind === "pendulum" ? "pendulum" : r.kind, gain, pan, r.alt);
        }
        r.alt = !r.alt;
        r.next += r.period * (1 + (Math.random() - 0.5) * 0.004);
      }
    });
    [focusSecond, focusOwnSecond].forEach((fs, k) => {
      if (!fs) return;
      const step = fs.motion === "tick" ? 1 : fs.motion === "stop2go" ? 60 : 0;
      if (!step) return;
      if (fs.next === undefined) fs.next = fs.start + step;
      if (fs.next < now - 1) fs.next += Math.ceil((now - fs.next) / step) * step;
      while (fs.next < ahead) {
        if (fs.next > now - 0.05) tickSound(fs.next, fs.motion === "tick" ? "quartz" : "stop2go", k ? 0.7 : 0.9, k ? -0.05 : 0.05);
        fs.next += step;
      }
    });
  }

  function startRoomTone() {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.5);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  function shutter(on) {
    if (!init()) return;
    const t = ctx.currentTime + 0.01;
    burst(t, { freq: on ? 1500 : 1100, q: 2, dur: 0.05, gain: 0.25, send: 0.2 });
    tone(t, { freq: on ? 95 : 80, dur: 0.1, gain: 0.12 });
  }

  function clear() {
    pending.length = 0;
    room = [];
    focus = -1;
    focusSecond = null;
    focusOwnSecond = null;
    if (ctx) { clearTimeout(humTimer); updateHum(); }
  }

  function setEnabled(on) {
    enabled = on;
    if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
  }

  function dropFrom(i) {
    room = room.filter((r) => r.lineIndex < i);
    if (ctx) { clearTimeout(humTimer); humTimer = setTimeout(updateHum, 60); }
  }

  return { init, assemble, grow, focusItem, addClockToRoom, setFocus, shutter, clear, dropFrom, setEnabled, get enabled() { return enabled; } };
})();

function typeKey(raw) {
  const k = raw.toUpperCase();
  if (k === "Z") {
    mainLabel.innerHTML = zLabel();
    zShown = true;
    return;
  }
  if (!keyIndex.has(k)) return;
  const index = keyIndex.get(k);
  const c = CLOCKS[index];

  const dropHands = lastIndex === index && hasHands(c);
  const opts = { dropHands };

  generation++;
  placeInLine(c, index, opts);

  mainLabel.innerHTML = labelFor(c, opts, graftPlan(index));
  typed.push(k);
  lastIndex = index;
  updateTypedDisplay();
}

function undoLast() {
  if (!lineItems.length) return;
  const it = lineItems.pop();
  it.slot.remove();
  typed.pop();
  Sound.dropFrom(lineItems.length);
  generation++;
  if (!lineItems.length) { clearAll(); return; }
  const prev = lineItems[lineItems.length - 1];
  lastIndex = prev.index;
  lineLastPivotX = prev.pivotX;
  lineLastRight = prev.right || 0;
  followCamera = true;
  focusIdx = -1;
  focusOn(lineItems.length - 1);
  updateTypedDisplay();
}

function updateTypedDisplay() {
  const text = typed.join("");
  typedDisplay.textContent = text;
  keyCapture.value = text;
  typedDisplay.scrollLeft = typedDisplay.scrollWidth;
}

function clearAll() {
  typed = [];
  lastIndex = null;
  clearLine();
  Sound.clear();
  mainLabel.textContent = "TYPE A–Y";
  zShown = false;
  generation++;
  updateTypedDisplay();
  panX = 0;
  panY = 0;
  applyPan();
}

function handleKeydown(e) {
  if (e.isComposing) return;
  Sound.init();
  if (e.key === "Tab") {
    e.preventDefault();
    setXrayMode(!xrayMode);
    return;
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    if (!lineItems.length) return;
    const cur = focusIdx < 0 ? lineItems.length - 1 : focusIdx;
    const next = Math.max(0, Math.min(lineItems.length - 1, cur + (e.key === "ArrowLeft" ? -1 : 1)));
    followCamera = next === lineItems.length - 1;
    focusOn(next);
    return;
  }
  if (e.key === "Backspace" || e.key === "Escape") {
    e.preventDefault();
    const touchUI = document.documentElement.classList.contains("touch-ui");
    if (e.key === "Escape" || !touchUI) clearAll();
    else undoLast();
    return;
  }
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!/^[a-z]$/i.test(e.key)) return;
  e.preventDefault();
  typeKey(e.key);
}
keyCapture.addEventListener("keydown", handleKeydown);
keyCapture.addEventListener("input", () => { keyCapture.value = typed.join(""); });
document.body.addEventListener("click", () => {
  keyCapture.focus();
  Sound.init();
});
document.getElementById("clear-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  clearAll();
  keyCapture.focus();
});

document.getElementById("sound-toggle").addEventListener("click", (e) => {
  e.stopPropagation();
  Sound.init();
  Sound.setEnabled(!Sound.enabled);
  e.currentTarget.setAttribute("aria-pressed", String(Sound.enabled));
  keyCapture.focus();
});

let panX = 0;
let panY = 0;
let zoomScale = 1;
let followCamera = true;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.8;

function applyPan() {
  world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
  scheduleCull();
}

let cullRaf = null;
function scheduleCull() {
  if (cullRaf) return;
  cullRaf = requestAnimationFrame(() => {
    cullRaf = null;
    const reach = viewW() * 0.5 + viewW() * 1.2 + 700 * zoomScale;
    lineItems.forEach((it) => {
      const off = Math.abs(it.pivotX * zoomScale + panX) > reach;
      if (it.culled !== off) {
        it.culled = off;
        it.slot.style.display = off ? "none" : "";
      }
    });
  });
}
function setZoom(z, animate) {
  zoomScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  world.classList.toggle("world-animated", !!animate);
  if (focusIdx >= 0 && !isPanning) panX = -lineItems[focusIdx].pivotX * zoomScale;
  applyPan();
  zoomLabel.textContent = `${Math.round(zoomScale * 100)}%`;
}
document.getElementById("zoom-out-btn").addEventListener("click", () => { setZoom(zoomScale - 0.14, true); keyCapture.focus(); });
document.getElementById("zoom-in-btn").addEventListener("click", () => { setZoom(zoomScale + 0.14, true); keyCapture.focus(); });
document.getElementById("zoom-reset-btn").addEventListener("click", () => {
  setZoom(1, true);
  followCamera = true;
  if (lineItems.length) focusOn(lineItems.length - 1);
  keyCapture.focus();
});

let panAnimId = null;
function animatePanTo(tx, ty, duration = 520) {
  cancelAnimationFrame(panAnimId);
  world.classList.remove("world-animated");
  const sx = panX;
  const sy = panY;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const e = 1 - Math.pow(1 - t, 3);
    panX = sx + (tx - sx) * e;
    panY = sy + (ty - sy) * e;
    applyPan();
    if (t < 1) panAnimId = requestAnimationFrame(step);
  }
  panAnimId = requestAnimationFrame(step);
}

let isPanning = false;
let panStart = { x: 0, y: 0, px: 0, py: 0 };
const activePointers = new Set();
mainView.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  activePointers.add(e.pointerId);
  if (activePointers.size > 1) { endPan(); return; }
  cancelAnimationFrame(panAnimId);
  isPanning = true;
  panStart = { x: e.clientX, y: e.clientY, px: panX, py: panY };
  mainView.classList.add("dragging");
  world.classList.remove("world-animated");
  mainView.setPointerCapture(e.pointerId);
  keyCapture.focus();
  Sound.init();
});
mainView.addEventListener("pointermove", (e) => {
  if (!isPanning || activePointers.size > 1) return;
  const dx = e.clientX - panStart.x;
  const dy = e.clientY - panStart.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) followCamera = false;
  panX = panStart.px + dx;
  panY = panStart.py + dy;
  clampPan();
  applyPan();
  browseFocus();
});
function endPan() {
  isPanning = false;
  mainView.classList.remove("dragging");
}
mainView.addEventListener("pointerup", (e) => {
  const wasPinch = activePointers.size > 1 || !isPanning;
  activePointers.delete(e.pointerId);
  if (wasPinch) { endPan(); snapSoon(120); return; }
  const moved = Math.abs(e.clientX - panStart.x) > 3 || Math.abs(e.clientY - panStart.y) > 3;
  endPan();
  if (moved) { snapSoon(60); return; }
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const tag = hit && hit.closest(".line-tag");
  if (tag) {
    const i = Number(tag.dataset.item);
    followCamera = i === lineItems.length - 1;
    focusOn(i);
  }
});
mainView.addEventListener("pointercancel", (e) => { activePointers.delete(e.pointerId); endPan(); });

function clampPan() {
  if (!lineItems.length) return;
  const margin = window.innerWidth * 0.45;
  const first = -lineItems[0].pivotX * zoomScale;
  const last = -lineItems[lineItems.length - 1].pivotX * zoomScale;
  panX = Math.min(first + margin, Math.max(last - margin, panX));
  panY = Math.max(-window.innerHeight * 0.4, Math.min(window.innerHeight * 0.4, panY));
}

function nearestItem() {
  let best = -1;
  let bestD = Infinity;
  lineItems.forEach((it, i) => {
    const d = Math.abs(it.pivotX * zoomScale + panX);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

let browseRaf = null;
function browseFocus() {
  if (browseRaf) return;
  browseRaf = requestAnimationFrame(() => {
    browseRaf = null;
    const i = nearestItem();
    if (i >= 0) focusOn(i, true, false);
  });
}

let snapTimer = null;
function snapSoon(delay = 260) {
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    const i = nearestItem();
    if (i >= 0) {
      followCamera = i === lineItems.length - 1;
      animatePanTo(-lineItems[i].pivotX * zoomScale, 0, 420);
    }
  }, delay);
}

mainView.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.ctrlKey) {
    setZoom(zoomScale - e.deltaY * 0.012, false);
    return;
  }
  cancelAnimationFrame(panAnimId);
  world.classList.remove("world-animated");
  followCamera = false;
  const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerWidth : 1;
  const dx = e.deltaX * unit;
  const dy = e.deltaY * unit;
  panX -= Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  clampPan();
  applyPan();
  browseFocus();
  snapSoon();
}, { passive: false });

let pinchDist = null;
let pinchZoom = 1;
mainView.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    const [a, b] = e.touches;
    pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchZoom = zoomScale;
  }
}, { passive: true });
mainView.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2 && pinchDist) {
    const [a, b] = e.touches;
    setZoom(pinchZoom * (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinchDist), false);
  }
}, { passive: true });
mainView.addEventListener("touchend", (e) => { if (e.touches.length < 2) pinchDist = null; });

window.addEventListener("resize", () => {
  world.classList.add("world-animated");
  applyPan();
});

const preloaded = [];
(function preload() {
  const q0 = [], q1 = [], q2 = [];
  CLOCKS.forEach((c) => {
    q0.push(`${ORIGINAL_DIR}/${c.id}.webp`);
    (c.layers || []).forEach((r) => {
      if (r !== "body") q1.push(`${PARTS_DIR}/${c.id}-${r}.webp`);
      q2.push(`${XRAY_DIR}/${c.id}-${r}.webp`);
      if (r === "dial") q2.push(`${PARTS_DIR}/${c.id}-dial-xr.webp`);
    });
  });
  const queue = [...q0, ...q1, ...q2];
  let cursor = 0;
  const next = () => {
    if (cursor >= queue.length) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = next;
    img.src = queue[cursor++];
    preloaded.push(img);
  };
  for (let i = 0; i < 6; i++) next();
})();

applyPan();
keyCapture.value = "";
