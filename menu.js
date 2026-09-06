// ---- Screen management ----
const homeScreen = document.getElementById("homeScreen");
const levelSelectScreen = document.getElementById("levelSelectScreen");
const gameScreen = document.getElementById("app");
const editorScreen = document.getElementById("editorScreen");
const introOverlay = document.getElementById("introOverlay");

function showScreen(el) {
  [homeScreen, levelSelectScreen, gameScreen, editorScreen].forEach(s => s.classList.remove("active"));
  el.classList.add("active");
}

// ---- Saved progress (which level you were last on) ----
const PROGRESS_KEY = "bloxorz_progress";
const INTRO_SEEN_KEY = "bloxorz_seen_intro";

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || { lastLevel: 0 };
  } catch {
    return { lastLevel: 0 };
  }
}
function saveProgress(levelIdx) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ lastLevel: levelIdx }));
  } catch {
    // localStorage unavailable (private browsing etc.) — Continue just falls back to level 0
  }
}

// ---- One-time first-run controls overlay ----
function maybeShowIntro() {
  let seen = false;
  try { seen = !!localStorage.getItem(INTRO_SEEN_KEY); } catch {}
  if (!seen) introOverlay.classList.add("show");
}
document.getElementById("dismissIntroBtn").addEventListener("click", () => {
  introOverlay.classList.remove("show");
  try { localStorage.setItem(INTRO_SEEN_KEY, "1"); } catch {}
});

// ---- Level select grid ----
function buildLevelGrid() {
  const grid = document.getElementById("levelGrid");
  grid.innerHTML = "";
  levels.forEach((lvl, i) => {
    const btn = document.createElement("button");
    btn.textContent = i + 1;
    btn.addEventListener("click", () => {
      showScreen(gameScreen);
      startGame(i);
      maybeShowIntro();
    });
    grid.appendChild(btn);
  });
}

// ---- Home screen buttons ----
document.getElementById("newGameBtn").addEventListener("click", () => {
  showScreen(gameScreen);
  startGame(0);
  maybeShowIntro();
});

document.getElementById("continueBtn").addEventListener("click", () => {
  const progress = getProgress();
  showScreen(gameScreen);
  startGame(progress.lastLevel || 0);
  maybeShowIntro();
});

document.getElementById("levelsBtn").addEventListener("click", () => {
  buildLevelGrid();
  showScreen(levelSelectScreen);
});

document.getElementById("backFromLevelsBtn").addEventListener("click", () => {
  showScreen(homeScreen);
});
