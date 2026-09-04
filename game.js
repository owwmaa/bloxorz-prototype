let levelIndex = 0;
let grid, gridRows, gridCols, cells, moves, locked, animating, switchState;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const levelLabel = document.getElementById("levelLabel");
const movesLabel = document.getElementById("movesLabel");
const message = document.getElementById("message");

// ---- Isometric constants ----
// HW/HH define the X and Y basis vectors on screen; ZS defines the height basis.
// All three are set so a 1-tile-unit edge projects to the SAME on-screen length
// in any direction — this is what keeps a rigid rotation looking rigid (no stretch).
const HW = 36, HH = 18, ZS = 40; // sqrt(HW^2+HH^2) ≈ ZS
const THICK = 12; // static floor platform thickness (px), independent of the above
let originX = 0, originY = 0;

// Bridge cells are void by default in the grid string and only become solid
// once their switch is toggled open — this looks them up dynamically.
function bridgeAt(x, y) {
  for (const sw of switchState) {
    for (const b of sw.bridge) if (b.x === x && b.y === y) return sw;
  }
  return null;
}

function charAt(x, y) {
  const br = bridgeAt(x, y);
  if (br) return br.open ? "#" : ".";
  if (y < 0 || y >= gridRows) return ".";
  const row = grid[y];
  if (x < 0 || x >= row.length) return ".";
  return row[x];
}

function proj(X, Y, Z = 0) {
  return { x: originX + (X - Y) * HW, y: originY + (X + Y) * HH - Z * ZS };
}

function loadLevel(i) {
  levelIndex = i;
  const lvl = levels[i];
  grid = lvl.grid;
  gridRows = grid.length;
  gridCols = Math.max(...grid.map(r => r.length));
  switchState = JSON.parse(JSON.stringify(lvl.switches || []));
  cells = [{ x: lvl.start.x, y: lvl.start.y }];
  moves = 0;
  locked = false;
  animating = false;
  levelLabel.textContent = `Level ${i + 1} / ${levels.length}`;
  movesLabel.textContent = `Moves: 0`;
  message.textContent = "";
  message.className = "";
  sizeCanvas();
  renderStatic();
}

function sizeCanvas() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const consider = (x, y) => {
    const px = (x - y) * HW, py = (x + y) * HH;
    minX = Math.min(minX, px - HW); maxX = Math.max(maxX, px + HW);
    minY = Math.min(minY, py - HH - 100); maxY = Math.max(maxY, py + HH + THICK + 10);
  };
  for (let y = 0; y < gridRows; y++)
    for (let x = 0; x < gridCols; x++)
      if (grid[y] && grid[y][x] && grid[y][x] !== ".") consider(x, y);
  for (const sw of switchState) for (const b of sw.bridge) consider(b.x, b.y);
  const pad = 30;
  canvas.width = (maxX - minX) + pad * 2;
  canvas.height = (maxY - minY) + pad * 2;
  originX = -minX + pad;
  originY = -minY + pad;
}

function fillPoly(pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function strokePoly(pts, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();
}

function drawTiles() {
  const order = [];
  for (let y = 0; y < gridRows; y++)
    for (let x = 0; x < gridCols; x++)
      if (charAt(x, y) !== ".") order.push({ x, y });
  order.sort((a, b) => (a.x + a.y) - (b.x + b.y));

  order.forEach(({ x, y }) => {
    const ch = charAt(x, y);
    const isSwitch = switchState.some(sw => sw.pos.x === x && sw.pos.y === y);
    const cx = x + 0.5, cy = y + 0.5;
    const N = proj(cx - 0.5, cy - 0.5), E = proj(cx + 0.5, cy - 0.5);
    const S = proj(cx + 0.5, cy + 0.5), W = proj(cx - 0.5, cy + 0.5);
    if (ch === "G") {
      fillPoly([N, E, S, W], "#3a2a22");
      strokePoly([N, E, S, W], "#d97757");
    } else {
      const Sb = { x: S.x, y: S.y + THICK };
      const Eb = { x: E.x, y: E.y + THICK };
      const Wb = { x: W.x, y: W.y + THICK };
      const weak = ch === "w";
      fillPoly([W, S, Sb, Wb], weak ? "#3d2418" : "#23262c");
      fillPoly([E, S, Sb, Eb], weak ? "#301b12" : "#191c20");
      fillPoly([N, E, S, W], weak ? "#8a4a2c" : "#42464f");
      if (weak) strokePoly([N, E, S, W], "#d9855b");
      if (isSwitch) {
        const mid = { x: (N.x + S.x) / 2, y: (N.y + S.y) / 2 };
        ctx.fillStyle = "#e0a458";
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

// ---- Block geometry: a rigid box in tile-units, corners labeled by role ----
function boxFromCells(cellsArr) {
  const minX = Math.min(...cellsArr.map(c => c.x));
  const maxX = Math.max(...cellsArr.map(c => c.x)) + 1;
  const minY = Math.min(...cellsArr.map(c => c.y));
  const maxY = Math.max(...cellsArr.map(c => c.y)) + 1;
  const inset = 0.05;
  const standing = cellsArr.length === 1;
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    hx: (maxX - minX) / 2 - inset,
    hy: (maxY - minY) / 2 - inset,
    zTop: standing ? 2 : 1
  };
}

function cornersOf(box) {
  const { cx, cy, hx, hy, zTop } = box;
  return {
    A: { X: cx - hx, Y: cy - hy, Z: 0 }, B: { X: cx + hx, Y: cy - hy, Z: 0 },
    C: { X: cx + hx, Y: cy + hy, Z: 0 }, D: { X: cx - hx, Y: cy + hy, Z: 0 },
    A2: { X: cx - hx, Y: cy - hy, Z: zTop }, B2: { X: cx + hx, Y: cy - hy, Z: zTop },
    C2: { X: cx + hx, Y: cy + hy, Z: zTop }, D2: { X: cx - hx, Y: cy + hy, Z: zTop }
  };
}

// Rotate a point rigidly around the block's pivot edge for the given roll direction.
function rotatePoint(pt, dir, pivotX, pivotY, phi) {
  const cos = Math.cos(phi), sin = Math.sin(phi);
  if (dir === "left" || dir === "right") {
    const x = pt.X - pivotX, z = pt.Z;
    let x2, z2;
    if (dir === "right") { x2 = x * cos + z * sin; z2 = -x * sin + z * cos; }
    else { x2 = x * cos - z * sin; z2 = x * sin + z * cos; }
    return { X: pivotX + x2, Y: pt.Y, Z: Math.max(0, z2) };
  } else {
    const y = pt.Y - pivotY, z = pt.Z;
    let y2, z2;
    if (dir === "down") { y2 = y * cos + z * sin; z2 = -y * sin + z * cos; }
    else { y2 = y * cos - z * sin; z2 = y * sin + z * cos; }
    return { X: pt.X, Y: pivotY + y2, Z: Math.max(0, z2) };
  }
}

function drawBlock(box, dir, phi, zDrop = 0) {
  const c = cornersOf(box);
  let pivotX, pivotY;
  if (dir === "right") pivotX = box.cx + box.hx;
  if (dir === "left") pivotX = box.cx - box.hx;
  if (dir === "down") pivotY = box.cy + box.hy;
  if (dir === "up") pivotY = box.cy - box.hy;

  const rc = {};
  for (const k in c) rc[k] = (dir && phi) ? rotatePoint(c[k], dir, pivotX, pivotY, phi) : c[k];
  const P = k => proj(rc[k].X, rc[k].Y, rc[k].Z - zDrop);

  const top = [P("A2"), P("B2"), P("C2"), P("D2")];
  const right = [P("B2"), P("C2"), P("C"), P("B")];
  const left = [P("D2"), P("C2"), P("C"), P("D")];

  fillPoly(left, "#2a4fa0");
  fillPoly(right, "#1f3a80");
  fillPoly(top, "#3b6fd9");
  strokePoly(top, "#7fa8f5");
}

function renderStatic() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTiles();
  drawBlock(boxFromCells(cells), null, 0);
}

function renderAnimFrame(startBox, dir, phi) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTiles();
  drawBlock(startBox, dir, phi);
}

// ---- Discrete roll result (used for board rules: bounds/goal checks) ----
function computeRoll(dir, fromCells) {
  if (fromCells.length === 1) {
    const { x, y } = fromCells[0];
    if (dir === "left") return [{ x: x - 2, y }, { x: x - 1, y }];
    if (dir === "right") return [{ x: x + 1, y }, { x: x + 2, y }];
    if (dir === "up") return [{ x, y: y - 2 }, { x, y: y - 1 }];
    if (dir === "down") return [{ x, y: y + 1 }, { x, y: y + 2 }];
  } else if (fromCells[0].y === fromCells[1].y) {
    const y = fromCells[0].y;
    const xa = Math.min(fromCells[0].x, fromCells[1].x);
    const xb = Math.max(fromCells[0].x, fromCells[1].x);
    if (dir === "left") return [{ x: xa - 1, y }];
    if (dir === "right") return [{ x: xb + 1, y }];
    if (dir === "up") return [{ x: xa, y: y - 1 }, { x: xb, y: y - 1 }];
    if (dir === "down") return [{ x: xa, y: y + 1 }, { x: xb, y: y + 1 }];
  } else {
    const x = fromCells[0].x;
    const ya = Math.min(fromCells[0].y, fromCells[1].y);
    const yb = Math.max(fromCells[0].y, fromCells[1].y);
    if (dir === "up") return [{ x, y: ya - 1 }];
    if (dir === "down") return [{ x, y: yb + 1 }];
    if (dir === "left") return [{ x: x - 1, y: ya }, { x: x - 1, y: yb }];
    if (dir === "right") return [{ x: x + 1, y: ya }, { x: x + 1, y: yb }];
  }
  return null;
}

const DURATION = 190;
function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// ---- Sound (synthesized, no audio files needed) ----
let audioCtx;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function playTone(freq, dur, type, gainAmt) {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainAmt, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + dur);
}
function playRollSound() { playTone(140, 0.09, "square", 0.10); }
function playFallSound() {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(320, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 0.45);
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.45);
}
function playWinSound() {
  [523.25, 659.25, 783.99].forEach((f, i) =>
    setTimeout(() => playTone(f, 0.28, "sine", 0.13), i * 90)
  );
}

function roll(dir) {
  if (locked || animating) return;
  const next = computeRoll(dir, cells);
  if (!next) return;

  playRollSound();
  const startBox = boxFromCells(cells);
  animating = true;
  const t0 = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - t0) / DURATION);
    const phi = easeInOutQuad(t) * (Math.PI / 2);
    renderAnimFrame(startBox, dir, phi);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      animating = false;
      const willFall = next.some(c => charAt(c.x, c.y) === ".");
      const breaksWeak = !willFall && next.length === 1 && charAt(next[0].x, next[0].y) === "w";
      if (willFall || breaksWeak) {
        locked = true;
        message.textContent = breaksWeak ? "The tile crumbled — resetting level" : "Fell off — resetting level";
        message.className = "lose";
        fallAndReset(boxFromCells(next));
      } else {
        cells = next;
        moves++;
        movesLabel.textContent = `Moves: ${moves}`;
        for (const sw of switchState) {
          if (cells.some(c => c.x === sw.pos.x && c.y === sw.pos.y)) sw.open = !sw.open;
        }
        renderStatic();
        checkWin();
      }
    }
  }
  requestAnimationFrame(frame);
}

// The block keeps falling through the gap (accelerating, fading out) before the level resets.
function fallAndReset(box) {
  playFallSound();
  const t0 = performance.now();
  const FALL_DURATION = 480;

  function frame(now) {
    const t = Math.min(1, (now - t0) / FALL_DURATION);
    const zDrop = t * t * 3.5;   // accelerating descent, in tile-units
    const alpha = 1 - t * 0.95;  // fades out as it drops
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTiles();
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    drawBlock(box, null, 0, zDrop);
    ctx.restore();
    if (t < 1) requestAnimationFrame(frame);
    else loadLevel(levelIndex);
  }
  requestAnimationFrame(frame);
}

function checkWin() {
  if (cells.length === 1 && charAt(cells[0].x, cells[0].y) === "G") {
    locked = true;
    playWinSound();
    if (levelIndex < levels.length - 1) {
      message.textContent = `Solved in ${moves} moves! Next level…`;
      message.className = "win";
      setTimeout(() => loadLevel(levelIndex + 1), 900);
    } else {
      message.textContent = `All levels solved — ${moves} moves on this one. Nice.`;
      message.className = "win";
    }
  }
}

window.addEventListener("keydown", e => {
  const map = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down"
  };
  const dir = map[e.key];
  if (dir) { e.preventDefault(); roll(dir); }
});

document.querySelectorAll("#dpad button").forEach(b =>
  b.addEventListener("click", () => roll(b.dataset.dir))
);

let touchStartX, touchStartY;
canvas.addEventListener("touchstart", e => {
  const t = e.touches[0];
  touchStartX = t.clientX; touchStartY = t.clientY;
}, { passive: true });
canvas.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
canvas.addEventListener("touchend", e => {
  if (touchStartX === undefined) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  touchStartX = undefined;
  if (Math.max(absX, absY) < 24) return; // too small — treat as a tap, ignore
  roll(absX > absY ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
});

loadLevel(0);

if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock("landscape").catch(() => {});
}
