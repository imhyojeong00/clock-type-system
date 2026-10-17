(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const TOUCH = document.documentElement.classList.contains("touch-ui");

  const root = document.documentElement;
  const uiBar = $("ui-bar");

  if (TOUCH) {
    keyCapture.readOnly = true;
    keyCapture.setAttribute("inputmode", "none");
    LITE_FX = true;
    ANCHOR_Y = 0.5;
    root.style.setProperty("--anchor-y", String(ANCHOR_Y));
  }

  function updateLayout() {
    if (TOUCH) {
      const dockH = Math.max(0, Math.round(window.innerHeight - uiBar.getBoundingClientRect().top));
      root.style.setProperty("--dock-h", `${dockH}px`);
      const lb = $("main-label").getBoundingClientRect();
      FIT_MARGIN.top = Math.round(lb.top + 46);
      FIT_MARGIN.bottom = 34;
      FIT_MARGIN.side = 8;
    }
  }

  const scrim = $("scrim");
  const overlays = ["drawer", "about"].map($);
  const anyOpen = () => overlays.some((o) => o.classList.contains("open"));

  function openOverlay(el) {
    overlays.forEach((o) => { if (o !== el) closeOverlay(o); });
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    if (el.id === "drawer") {
      scrim.hidden = false;
      $("menu-btn").setAttribute("aria-expanded", "true");
      syncDrawer();
    }
  }
  function closeOverlay(el) {
    if (!el.classList.contains("open")) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    if (el.id === "drawer") $("menu-btn").setAttribute("aria-expanded", "false");
    if (!anyOpen()) scrim.hidden = true;
  }
  overlays.forEach((o) => {
    o.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeOverlay(o)));
    if (o.classList.contains("modal")) o.addEventListener("click", (e) => { if (e.target === o) closeOverlay(o); });
  });
  scrim.addEventListener("click", () => overlays.forEach(closeOverlay));

  document.addEventListener("keydown", (e) => {
    if (!anyOpen()) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      overlays.forEach(closeOverlay);
      return;
    }
    if (/^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey) overlays.forEach(closeOverlay);
  }, true);

  $("menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    $("drawer").classList.contains("open") ? closeOverlay($("drawer")) : openOverlay($("drawer"));
  });

  const ACTIONS = {
    about: () => openOverlay($("about")),
    xray: () => { $("xray-toggle").click(); syncDrawer(); },
    sound: () => { $("sound-toggle").click(); syncDrawer(); },
    latest: () => { closeOverlay($("drawer")); goLatest(); },
    zoomreset: () => { closeOverlay($("drawer")); $("zoom-reset-btn").click(); },
    clear: () => {
      if (lineItems.length && !window.confirm(tr("confirm_clear"))) return;
      closeOverlay($("drawer"));
      clearAll();
    },
  };
  $("drawer").querySelectorAll("[data-act]").forEach((b) => {
    b.addEventListener("click", () => ACTIONS[b.dataset.act] && ACTIONS[b.dataset.act]());
  });
  function syncDrawer() {
    const q = (a) => $("drawer").querySelector(`[data-act="${a}"]`);
    q("xray").classList.toggle("on", xrayMode);
    q("sound").classList.toggle("on", Sound.enabled);
    q("sound").textContent = tr(Sound.enabled ? "sound_on" : "sound_off");
  }

  function step(dir) {
    if (!lineItems.length) return;
    const cur = focusIdx < 0 ? lineItems.length - 1 : focusIdx;
    const next = Math.max(0, Math.min(lineItems.length - 1, cur + dir));
    followCamera = next === lineItems.length - 1;
    focusOn(next);
  }
  function goLatest() {
    if (!lineItems.length) return;
    followCamera = true;
    focusOn(lineItems.length - 1);
  }

  const ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M", "⌫"],
    ["‹", "›", "LATEST", "−", "+"],
  ];
  const LABEL = { "⌫": "k_back", "‹": "k_prev", "›": "k_next", LATEST: "k_latest", "−": "zoom_out", "+": "zoom_in" };

  function buildKeyboard() {
    const kbd = $("kbd");
    kbd.innerHTML = "";
    ROWS.forEach((row, ri) => {
      const r = document.createElement("div");
      r.className = "kbd-row" + (ri === 3 ? " kbd-nav" : "");
      row.forEach((k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "key";
        b.dataset.key = k;
        b.textContent = k === "LATEST" ? tr("k_latest_short") : k;
        if (LABEL[k]) { b.classList.add("key-fn"); b.setAttribute("aria-label", tr(LABEL[k])); }
        if (k === "Z") b.classList.add("key-empty");
        if (k === "⌫") b.classList.add("key-back");
        if (k === "LATEST") b.classList.add("key-wide");
        r.appendChild(b);
      });
      kbd.appendChild(r);
    });
  }

  let repeatTimer = null;
  let repeatInterval = null;
  function stopRepeat() {
    clearTimeout(repeatTimer);
    clearInterval(repeatInterval);
    repeatTimer = repeatInterval = null;
  }

  function press(k) {
    if (/^[A-Z]$/.test(k)) { typeKey(k); return; }
    if (k === "⌫") undoLast();
    else if (k === "‹") step(-1);
    else if (k === "›") step(1);
    else if (k === "LATEST") goLatest();
    else if (k === "−") setZoom(zoomScale - 0.14, true);
    else if (k === "+") setZoom(zoomScale + 0.14, true);
  }

  function onKeyDown(e) {
    const btn = e.target.closest(".key");
    if (!btn) return;
    e.preventDefault();
    Sound.init();
    btn.classList.add("pressed");
    const k = btn.dataset.key;
    press(k);
    if (k === "⌫" || k === "‹" || k === "›") {
      repeatTimer = setTimeout(() => { repeatInterval = setInterval(() => press(k), k === "⌫" ? 110 : 160); }, 450);
    }
  }
  function onKeyUp() {
    stopRepeat();
    document.querySelectorAll(".key.pressed").forEach((b) => b.classList.remove("pressed"));
    Sound.init();
  }

  function setKbdCollapsed(c) {
    document.body.classList.toggle("kbd-collapsed", c);
    $("kbd-toggle").textContent = tr(c ? "keys_show" : "keys_hide");
    requestAnimationFrame(updateLayout);
  }

  function start() {
    if (TOUCH) {
      buildKeyboard();
      const kbd = $("kbd");
      kbd.addEventListener("pointerdown", onKeyDown);
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => kbd.addEventListener(ev, onKeyUp));
      kbd.addEventListener("contextmenu", (e) => e.preventDefault());
      $("kbd-toggle").addEventListener("click", (e) => {
        e.stopPropagation();
        setKbdCollapsed(!document.body.classList.contains("kbd-collapsed"));
      });
      $("typed-display").addEventListener("click", () => {
        if (document.body.classList.contains("kbd-collapsed")) setKbdCollapsed(false);
      });
      if ("ResizeObserver" in window) new ResizeObserver(updateLayout).observe(uiBar);
    }
    $("lang-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      setLang(LANG === "ko" ? "en" : "ko");
    });
    document.addEventListener("langchange", () => {
      if (TOUCH) {
        buildKeyboard();
        $("kbd-toggle").textContent = tr(document.body.classList.contains("kbd-collapsed") ? "keys_show" : "keys_hide");
      }
      syncDrawer();
      requestAnimationFrame(updateLayout);
      if (!TOUCH) keyCapture.focus();
    });
    applyStaticText();

    ["xray-toggle", "sound-toggle"].forEach((id) => $(id).addEventListener("click", () => setTimeout(syncDrawer, 0)));
    window.addEventListener("resize", updateLayout);
    updateLayout();
    syncDrawer();
    if (TOUCH) openOverlay($("about"));
  }
  start();
})();
