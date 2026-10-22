// ================================================================
// EXHIBITION MODE — 전시용 자동 타이핑 (app.js 다음에 로드)
//
// · 아무도 치지 않을 때: A→Y를 사람이 치듯 타이핑하고 마지막에 Z(아직 비어 있는 자리)
//   그동안 오리지널 ↔ X-ray가 일정 시간마다 번갈아 바뀜
//   다 치면 잠시 머문 뒤 지우고 다시 A부터
// · 관람자가 키를 누르거나 화면을 누르는 순간: 화면을 모두 비우고
//   오리지널 상태에서 원래 기능 그대로 타이핑
// · 관람자가 일정 시간 아무것도 하지 않으면: 리셋되어(영문으로 돌아가며) 다시 자동 타이핑
//
// 끄고 싶을 때: 주소 뒤에 ?demo=off
// ================================================================

const EXHIBIT = {
  LETTERS: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  START_DELAY_MS: 1400,      // 화면이 비워진 뒤 첫 글자가 나오기까지
  BASE_MS: 950,              // 글자 사이 기본 간격 (시계가 조립되는 연출이 끝날 만큼, 작을수록 빠름)
  JITTER_MS: 150,            // 간격의 흔들림 폭
  HESITATE_CHANCE: 0.08,     // 아주 가끔 숨 고르듯 쉬는 확률
  HESITATE_MS: [250, 550],
  ORIGINAL_MS: 4500,         // 오리지널이 보이는 시간
  XRAY_MS: 4500,             // X-ray가 보이는 시간 (둘이 계속 번갈아 반복)
  PHASE_JITTER_MS: 600,
  HOLD_AFTER_Z_MS: 7000,     // 다 친 뒤 그 화면을 보여주는 시간
  IDLE_RETURN_MS: 20000      // 관람자가 마지막으로 친 뒤 리셋되어 자동 타이핑으로 돌아가기까지
};

const exhibitEnabled = !/[?&]demo=off\b/i.test(location.search);
const exhibitInFrame = window.parent !== window;

let exhibitMode = "demo";    // "demo" | "user"
let exhibitTimer = null;
let exhibitPhaseTimer = null;
let exhibitIdleTimer = null;
let exhibitIndex = 0;
let exhibitToken = 0;

(function exhibitBoot() {
  if (!exhibitEnabled || typeof typeKey !== "function") return;

  window.addEventListener("keydown", onVisitorKey, true);
  window.addEventListener("pointerdown", onVisitorPointer, true);
  window.addEventListener("message", onStageMessage);

  waitForImages().then(() => { if (exhibitMode === "demo") startDemo(); });
})();

// 이미지 요청이 1초 동안 더 늘지 않을 때까지(=다 받아질 때까지, 최대 8초) 기다림
function waitForImages() {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let last = -1, still = 0;
    const poll = () => {
      const n = performance.getEntriesByType("resource").length;
      still = n === last && document.readyState === "complete" ? still + 1 : 0;
      last = n;
      if (still >= 4 || performance.now() - t0 > 8000) return resolve();
      setTimeout(poll, 250);
    };
    setTimeout(poll, 400);
  });
}

// ---------- 화면 전체 비우기 ----------

function exhibitClearAll() {
  exhibitToken += 1;
  clearTimeout(exhibitTimer);
  exhibitTimer = null;
  clearTimeout(exhibitPhaseTimer);
  exhibitPhaseTimer = null;

  if (xrayMode) setXrayMode(false);
  clearAll();
  if (typeof setZoom === "function" && zoomScale !== 1) setZoom(1, false);
  followCamera = true;
}

// ---------- 자동 타이핑 ----------

function startDemo() {
  exhibitMode = "demo";
  clearTimeout(exhibitIdleTimer);
  if (typeof LANG !== "undefined" && LANG !== "en") setLang("en");
  exhibitClearAll();
  exhibitIndex = 0;
  const token = exhibitToken;
  setPhase("original", token);
  exhibitTimer = setTimeout(() => demoStep(token), EXHIBIT.START_DELAY_MS);
}

function demoStep(token) {
  if (token !== exhibitToken || exhibitMode !== "demo") return;

  if (exhibitIndex >= EXHIBIT.LETTERS.length) {
    postToStage("cycle-done");
    exhibitTimer = setTimeout(() => {
      if (token === exhibitToken && exhibitMode === "demo") startDemo();
    }, EXHIBIT.HOLD_AFTER_Z_MS);
    return;
  }

  const ch = EXHIBIT.LETTERS[exhibitIndex];
  exhibitIndex += 1;

  try { Sound.init(); } catch (e) {}
  // 실제 키 입력과 똑같은 경로 (조립 연출·접목·소리 모두 원래 기능 그대로)
  typeKey(ch);

  exhibitTimer = setTimeout(() => demoStep(token), nextDelay());
}

function nextDelay() {
  let d = EXHIBIT.BASE_MS + (Math.random() - 0.5) * 2 * EXHIBIT.JITTER_MS;
  if (Math.random() < EXHIBIT.HESITATE_CHANCE) {
    const [a, b] = EXHIBIT.HESITATE_MS;
    d += a + Math.random() * (b - a);
  }
  return Math.max(300, d);
}

// ---------- 오리지널 ↔ X-ray 번갈아 보이기 ----------

function setPhase(phase, token) {
  if (token !== exhibitToken || exhibitMode !== "demo") return;
  const original = phase === "original";
  if (xrayMode === original) setXrayMode(!original);
  const base = original ? EXHIBIT.ORIGINAL_MS : EXHIBIT.XRAY_MS;
  const wait = base + (Math.random() - 0.5) * 2 * EXHIBIT.PHASE_JITTER_MS;
  clearTimeout(exhibitPhaseTimer);
  exhibitPhaseTimer = setTimeout(() => setPhase(original ? "xray" : "original", token), wait);
}

// ---------- 관람자 입력 ----------

function isIgnoredKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return true; // 운영자용 단축키
  if (/^F\d+$/.test(e.key)) return true;
  return false;
}

function onVisitorKey(e) {
  if (!e.isTrusted || isIgnoredKey(e)) return;
  if (document.activeElement !== keyCapture) keyCapture.focus({ preventScroll: true });
  try { Sound.init(); } catch (err) {}
  enterUserMode();
  armIdleReturn();
  // 막지 않으므로 방금 누른 글자는 비워진 화면에서 그대로 첫 시계가 됨
}

function onVisitorPointer(e) {
  if (!e.isTrusted) return;
  try { Sound.init(); } catch (err) {}
  // 한글·사운드·확대 버튼과 메뉴는 원래 기능 그대로 → 화면을 지우지 않음
  if (e.target.closest && e.target.closest("#lang-toggle, #sound-toggle, #zoom-controls, #menu-btn, #drawer, #about, #scrim")) {
    if (exhibitMode === "user") armIdleReturn();
    return;
  }
  enterUserMode();
  armIdleReturn();
}

function enterUserMode() {
  if (exhibitMode === "user") return;
  exhibitMode = "user";
  exhibitClearAll();
  postToStage("visitor");
}

function armIdleReturn() {
  clearTimeout(exhibitIdleTimer);
  exhibitIdleTimer = setTimeout(() => {
    if (exhibitMode !== "user") return;
    postToStage("idle");
    startDemo();
  }, EXHIBIT.IDLE_RETURN_MS);
}

// ---------- 전시 페이지(여러 사물을 모은 화면)와 주고받는 신호 ----------
// 단독으로 열었을 때는 아무 영향 없음

function postToStage(type) {
  if (!exhibitInFrame) return;
  try { window.parent.postMessage({ source: "exhibit", type }, "*"); } catch (e) {}
}

function onStageMessage(e) {
  const d = e.data;
  if (!d || d.target !== "exhibit") return;
  if (d.type === "restart") startDemo();
}