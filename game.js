let levelIndex = 0;
let grid, gridRows, gridCols, cells, moves, locked, animating, switchState;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const levelLabel = document.getElementById("levelLabel");
const movesLabel = document.getElementById("movesLabel");
const message = document.getElementById("message");
const skipBtn = document.getElementById("skipBtn");
const restartBtn = document.getElementById("restartBtn");

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

let testMode = false;
let testLevelObj = null;
let levelGeneration = 0; // bumped on every level load, so stale animation loops can detect a level change and bail out

function applyLevel(lvl) {
  levelGeneration++;
  grid = lvl.grid;
  gridRows = grid.length;
  gridCols = Math.max(...grid.map(r => r.length));
  switchState = JSON.parse(JSON.stringify(lvl.switches || []));
  cells = [{ x: lvl.start.x, y: lvl.start.y }];
  moves = 0;
  locked = false;
  animating = false;
  movesLabel.textContent = `Moves: 0`;
  message.textContent = "";
  message.className = "";
  const fbBtn = document.getElementById("feedbackPromptBtn");
  if (fbBtn) fbBtn.style.display = "none";
  document.getElementById("winModal").classList.remove("show");
  sizeCanvas();
  renderStatic();
}

function loadLevel(i) {
  testMode = false;
  levelIndex = i;
  applyLevel(levels[i]);
  levelLabel.textContent = `Level ${i + 1} / ${levels.length}`;
  skipBtn.disabled = i >= levels.length - 1;
  if (typeof saveProgress === "function") saveProgress(i);
}

// Used by the level editor's "Test Play" — plays an arbitrary level object
// that isn't part of the real level list, without touching saved progress.
function loadCustomLevel(lvl) {
  testMode = true;
  testLevelObj = lvl;
  applyLevel(lvl);
  levelLabel.textContent = "Test Level";
  skipBtn.disabled = true;
}

function reloadCurrent() {
  if (testMode) loadCustomLevel(testLevelObj);
  else loadLevel(levelIndex);
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
  fitCanvasDisplay();
}

// Scales the canvas's on-screen SIZE (not its drawing resolution) up or down to
// fill whatever space is actually available, preserving aspect ratio — this is
// what makes small levels fill the screen instead of sitting in empty space.
function fitCanvasDisplay() {
  const container = document.getElementById("playArea");
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h || !canvas.width || !canvas.height) return;
  const scale = Math.min(w / canvas.width, h / canvas.height);
  canvas.style.width = (canvas.width * scale) + "px";
  canvas.style.height = (canvas.height * scale) + "px";
}
window.addEventListener("resize", fitCanvasDisplay);

function fillPoly(pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

// Same as fillPoly but shades from colorA (near pts[0]) to colorB (near the
// opposite corner) — used on top faces to fake a soft light source instead of
// flat color, which is what actually gives the board a sense of depth.
function fillPolyGradient(pts, colorA, colorB) {
  const opp = pts[Math.floor(pts.length / 2)];
  const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, opp.x, opp.y);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle = grad;
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

function tileList() {
  const list = [];
  for (let y = 0; y < gridRows; y++)
    for (let x = 0; x < gridCols; x++)
      if (charAt(x, y) !== ".") list.push({ x, y });
  return list;
}

function paintTile(x, y) {
  const ch = charAt(x, y);
  const sw = switchState.find(s => s.pos.x === x && s.pos.y === y);
  const cx = x + 0.5, cy = y + 0.5;
  const N = proj(cx - 0.5, cy - 0.5), E = proj(cx + 0.5, cy - 0.5);
  const S = proj(cx + 0.5, cy + 0.5), W = proj(cx - 0.5, cy + 0.5);
  const Sb = { x: S.x, y: S.y + THICK };
  const Eb = { x: E.x, y: E.y + THICK };
  const Wb = { x: W.x, y: W.y + THICK };
  if (ch === "G") {
    fillPoly([W, S, Sb, Wb], "#000000");
    fillPoly([E, S, Sb, Eb], "#000000");
    fillPolyGradient([N, E, S, W], "#1a1a1a", "#000000");
    strokePoly([N, E, S, W], "#d97757");
  } else {
    const weak = ch === "w";
    fillPoly([W, S, Sb, Wb], weak ? "#3d2418" : "#23262c");
    fillPoly([E, S, Sb, Eb], weak ? "#301b12" : "#191c20");
    fillPolyGradient([N, E, S, W], weak ? "#a5613a" : "#52565f", weak ? "#733c20" : "#383c44");
    if (weak) strokePoly([N, E, S, W], "#d9855b");
    if (sw) {
      const mid = { x: (N.x + S.x) / 2, y: (N.y + S.y) / 2 };
      ctx.strokeStyle = "#e0a458";
      ctx.lineWidth = 2.5;
      if (sw.action === "open") {
        // + mark — one-way: only ever opens the bridge, never closes it
        ctx.beginPath();
        ctx.moveTo(mid.x - 6, mid.y); ctx.lineTo(mid.x + 6, mid.y);
        ctx.moveTo(mid.x, mid.y - 6); ctx.lineTo(mid.x, mid.y + 6);
        ctx.stroke();
      } else if (sw.action === "close") {
        // − mark — one-way: only ever closes the bridge, never opens it
        ctx.beginPath();
        ctx.moveTo(mid.x - 6, mid.y); ctx.lineTo(mid.x + 6, mid.y);
        ctx.stroke();
      } else if (sw.type === "hard") {
        // X mark — only triggers when the block is standing upright on it
        ctx.beginPath();
        ctx.moveTo(mid.x - 6, mid.y - 6); ctx.lineTo(mid.x + 6, mid.y + 6);
        ctx.moveTo(mid.x + 6, mid.y - 6); ctx.lineTo(mid.x - 6, mid.y + 6);
        ctx.stroke();
      } else {
        // O mark — triggers on any touch, standing or lying
        ctx.fillStyle = "#e0a458";
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawTiles() {
  const order = tileList();
  order.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  order.forEach(({ x, y }) => paintTile(x, y));
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
    zTop: standing ? 1.8 : 0.9
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
  fillPolyGradient(top, "#5f95ec", "#2f5cc4");
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
let fallBuffer = null;
function loadFallBuffer() {
  if (fallBuffer || !audioCtx) return;
  fetch("faaah.mp3")
    .then(r => r.arrayBuffer())
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => { fallBuffer = decoded; })
    .catch(() => {}); // if it can't load/decode, playFallSound just stays silent rather than erroring
}
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    loadFallBuffer();
  }
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
  if (!fallBuffer) return; // recording hasn't finished loading yet — skip silently
  const src = audioCtx.createBufferSource();
  src.buffer = fallBuffer;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.9;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}
function playSwitchSound(opening) {
  ensureAudio();
  const now = audioCtx.currentTime;

  // short mechanical click
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = "square";
  click.frequency.value = 900;
  clickGain.gain.setValueAtTime(0.08, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  click.connect(clickGain); clickGain.connect(audioCtx.destination);
  click.start(now); click.stop(now + 0.04);

  // rising sweep when opening, falling sweep when closing
  const sweep = audioCtx.createOscillator();
  const sweepGain = audioCtx.createGain();
  sweep.type = "triangle";
  const startFreq = opening ? 220 : 420;
  const endFreq = opening ? 520 : 180;
  sweep.frequency.setValueAtTime(startFreq, now + 0.03);
  sweep.frequency.exponentialRampToValueAtTime(endFreq, now + 0.22);
  sweepGain.gain.setValueAtTime(0.0001, now + 0.03);
  sweepGain.gain.exponentialRampToValueAtTime(0.12, now + 0.06);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
  sweep.connect(sweepGain); sweepGain.connect(audioCtx.destination);
  sweep.start(now + 0.03); sweep.stop(now + 0.25);
}

function playWinSound() {
  // low impact thump for weight, right as the celebration starts
  ensureAudio();
  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(160, audioCtx.currentTime);
  thump.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.15);
  thumpGain.gain.setValueAtTime(0.22, audioCtx.currentTime);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
  thump.connect(thumpGain); thumpGain.connect(audioCtx.destination);
  thump.start(); thump.stop(audioCtx.currentTime + 0.18);

  // triumphant ascending flourish
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    setTimeout(() => playTone(f, i === 3 ? 0.4 : 0.28, "sine", i === 3 ? 0.16 : 0.13), i * 85)
  );
}

function playMetalRollSound() {
  ensureAudio();
  const now = audioCtx.currentTime;
  // inharmonic frequencies (not simple integer ratios) — this is what gives
  // it a metallic "clank" character instead of a musical, resonant tone
  [380, 540, 710].forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.06 - i * 0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.13);
  });
}

function roll(dir) {
  if (locked || animating) return;
  const next = computeRoll(dir, cells);
  if (!next) return;

  const willFall = next.some(c => charAt(c.x, c.y) === ".");
  const breaksWeak = !willFall && next.length === 1 && charAt(next[0].x, next[0].y) === "w";
  const failing = willFall || breaksWeak;
  const safeOnWeak = !failing && next.some(c => charAt(c.x, c.y) === "w");

  // Trigger the sound the instant the move starts, not after the tip animation
  // finishes — we already know the outcome, no need to wait to reveal it.
  if (failing) playFallSound();
  else if (safeOnWeak) playMetalRollSound();
  else playRollSound();

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
      if (failing) {
        locked = true;
        message.textContent = breaksWeak ? "The tile crumbled — resetting level" : "Fell off — resetting level";
        message.className = "lose";
        fallAndReset(boxFromCells(next), dir);
      } else {
        cells = next;
        moves++;
        movesLabel.textContent = `Moves: ${moves}`;
        for (const sw of switchState) {
          const touching = cells.some(c => c.x === sw.pos.x && c.y === sw.pos.y);
          const standingOnIt = cells.length === 1 && cells[0].x === sw.pos.x && cells[0].y === sw.pos.y;
          const triggers = sw.type === "hard" ? standingOnIt : touching;
          if (!triggers) continue;
          let newOpen;
          if (sw.action === "open") newOpen = true;
          else if (sw.action === "close") newOpen = false;
          else newOpen = !sw.open; // default: toggle, same as before
          if (newOpen !== sw.open) {
            sw.open = newOpen;
            playSwitchSound(sw.open);
          }
        }
        renderStatic();
        checkWin();
      }
    }
  }
  requestAnimationFrame(frame);
}

// After the block has fallen out of view, the whole board shatters into individual
// tiles that scatter and fade to black, pauses, then flies back together before
// the level actually resets.
function shatterBoard(done) {
  const tiles = tileList();
  const cx0 = canvas.width / 2, cy0 = canvas.height / 2;
  const frags = tiles.map(({ x, y }) => {
    const c = proj(x + 0.5, y + 0.5);
    let dirX = c.x - cx0, dirY = c.y - cy0;
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len; dirY /= len;
    dirX += (Math.random() - 0.5) * 0.6;
    dirY += (Math.random() - 0.5) * 0.6;
    return {
      x, y, dirX, dirY,
      dist: 70 + Math.random() * 90,
      spin: (Math.random() - 0.5) * 7,
      gravity: 40 + Math.random() * 40
    };
  });

  function paintFrag(f, t) {
    const pivot = proj(f.x + 0.5, f.y + 0.5);
    const dx = f.dirX * f.dist * t * t;
    const dy = f.dirY * f.dist * t * t + f.gravity * t * t;
    const rot = f.spin * t;
    const scale = Math.max(0.05, 1 - 0.8 * t);
    const alpha = Math.max(0, 1 - t);
    ctx.save();
    ctx.translate(pivot.x + dx, pivot.y + dy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.translate(-pivot.x, -pivot.y);
    ctx.globalAlpha = alpha;
    paintTile(f.x, f.y);
    ctx.restore();
  }

  const SHATTER_DUR = 650, BLACK_DUR = 300, REASSEMBLE_DUR = 520;

  function runPhase(duration, tFrom, tTo, onDone) {
    const t0 = performance.now();
    function frame(now) {
      const raw = Math.min(1, (now - t0) / duration);
      const t = tFrom + (tTo - tFrom) * raw;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frags.forEach(f => paintFrag(f, t));
      if (raw < 1) requestAnimationFrame(frame);
      else onDone();
    }
    requestAnimationFrame(frame);
  }

  runPhase(SHATTER_DUR, 0, 1, () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // black pause
    setTimeout(() => runPhase(REASSEMBLE_DUR, 1, 0, done), BLACK_DUR);
  });
}

// The block keeps tumbling — spinning the same direction it was already tipping,
// drifting forward off the ledge, and accelerating downward — until it's genuinely
// off the bottom of the screen, then the level resets.
function fallAndReset(box, dir) {
  const t0 = performance.now();
  const travelVec = {
    x: dir === "right" ? 1 : dir === "left" ? -1 : 0,
    y: dir === "down" ? 1 : dir === "up" ? -1 : 0
  };
  const spinSpeed = 5.2;   // rad/s — continues the same rotational sense as the roll
  const MAX_DURATION = 1500;

  function frame(now) {
    const el = (now - t0) / 1000;
    const phi = Math.PI / 2 + spinSpeed * el;
    const travel = 3.2 * el * el;       // accelerating drift off the ledge
    const gravityDrop = 150 * el * el;  // accelerating fall (px)
    const alpha = Math.max(0, 1 - el / 1.3);

    const shiftedBox = {
      ...box,
      cx: box.cx + travelVec.x * travel,
      cy: box.cy + travelVec.y * travel
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTiles();
    ctx.save();
    ctx.globalAlpha = alpha;
    drawBlock(shiftedBox, dir, phi, gravityDrop);
    ctx.restore();

    const centerScreen = proj(shiftedBox.cx, shiftedBox.cy, -gravityDrop);
    const offScreen = centerScreen.y > canvas.height + 60;
    if (!offScreen && now - t0 < MAX_DURATION) requestAnimationFrame(frame);
    else shatterBoard(() => reloadCurrent());
  }
  requestAnimationFrame(frame);
}

function flashScreen() {
  const flash = document.getElementById("winFlash");
  flash.classList.remove("show");
  void flash.offsetWidth;
  flash.classList.add("show");
}

// Sinks the winning block down into the hole, clipped at the opening line so it
// visibly disappears from the bottom up as it drops below — not a fade.
function playSinkAnimation(winCells) {
  const myGen = levelGeneration;
  const box = boxFromCells(winCells);
  const holeY = proj(box.cx, box.cy, 0).y;
  const t0 = performance.now();
  const SINK_DUR = 550;

  function frame(now) {
    if (levelGeneration !== myGen) return; // a new level already loaded — stop, don't overwrite it
    const dt = now - t0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTiles();
    if (dt < SINK_DUR) {
      const sinkRaw = dt / SINK_DUR;
      const zDrop = sinkRaw * sinkRaw * 2.6;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, holeY);
      ctx.clip();
      drawBlock(box, null, 0, zDrop);
      ctx.restore();
      requestAnimationFrame(frame);
    }
  }
  requestAnimationFrame(frame);
}

// ---- Best-moves-per-level tracking (localStorage) ----
const BEST_MOVES_KEY = "bloxorz_best_moves";
function getBestMoves(idx) {
  try { return (JSON.parse(localStorage.getItem(BEST_MOVES_KEY)) || {})[idx]; }
  catch { return undefined; }
}
function saveBestMovesIfBetter(idx, movesTaken) {
  try {
    const data = JSON.parse(localStorage.getItem(BEST_MOVES_KEY)) || {};
    if (data[idx] === undefined || movesTaken < data[idx]) {
      data[idx] = movesTaken;
      localStorage.setItem(BEST_MOVES_KEY, JSON.stringify(data));
    }
  } catch { /* localStorage unavailable — best-moves just won't persist */ }
}

function starsForMoves(movesTaken, par) {
  if (movesTaken <= par) return 3;
  if (movesTaken <= par + 3) return 2;
  return 1;
}

function showWinModal({ title, stars, movesTaken, best, nextLabel, onNext }) {
  document.querySelector(".winModalTitle").textContent = title;
  document.querySelectorAll(".winModalStars .star").forEach((el, i) => {
    el.classList.toggle("earned", i < stars);
  });
  document.querySelector(".winModalMoves").textContent = movesTaken;
  document.querySelector(".winModalBest").textContent =
    best !== undefined ? `Best: ${best} moves` : "";

  const nextBtn = document.getElementById("winNextBtn");
  nextBtn.textContent = nextLabel;
  nextBtn.onclick = () => {
    document.getElementById("winModal").classList.remove("show");
    onNext();
  };
  document.getElementById("winRestartBtn").onclick = () => {
    document.getElementById("winModal").classList.remove("show");
    reloadCurrent();
  };

  document.getElementById("winModal").classList.add("show");
}

function checkWin() {
  if (cells.length === 1 && charAt(cells[0].x, cells[0].y) === "G") {
    locked = true;
    playWinSound();
    flashScreen();
    playSinkAnimation(cells);

    const lvl = testMode ? testLevelObj : levels[levelIndex];
    const par = (lvl && lvl.par) || 8;
    const stars = starsForMoves(moves, par);

    if (!testMode) saveBestMovesIfBetter(levelIndex, moves);
    const best = testMode ? undefined : getBestMoves(levelIndex);

    setTimeout(() => {
      if (testMode) {
        showWinModal({
          title: "Test Level — Solved", stars, movesTaken: moves, best,
          nextLabel: "↺", onNext: () => reloadCurrent()
        });
      } else if (levelIndex < levels.length - 1) {
        showWinModal({
          title: `Level ${levelIndex + 1} Complete`, stars, movesTaken: moves, best,
          nextLabel: "▶", onNext: () => loadLevel(levelIndex + 1)
        });
      } else {
        showWinModal({
          title: "All Levels Complete", stars, movesTaken: moves, best,
          nextLabel: "★", onNext: () => {
            if (typeof showScreen === "function") {
              showScreen(document.getElementById("feedbackScreen"));
            }
          }
        });
      }
    }, 650);
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

skipBtn.addEventListener("click", () => {
  if (animating || testMode) return; // avoid racing an in-flight roll/fall animation
  if (levelIndex < levels.length - 1) loadLevel(levelIndex + 1);
});

restartBtn.addEventListener("click", () => {
  if (animating) return;
  reloadCurrent();
});

document.getElementById("menuBtn").addEventListener("click", () => {
  if (typeof showScreen === "function") showScreen(document.getElementById("homeScreen"));
});

const playArea = document.getElementById("playArea");
let touchStartX, touchStartY, touchHandled;
playArea.addEventListener("touchstart", e => {
  const t = e.touches[0];
  touchStartX = t.clientX; touchStartY = t.clientY;
  touchHandled = false;
}, { passive: true });
playArea.addEventListener("touchmove", e => {
  e.preventDefault();
  if (touchHandled || touchStartX === undefined) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  const mag = Math.max(absX, absY);
  if (mag < 18) return; // still too small to tell — keep waiting
  // Our camera is isometric, so each roll direction visually moves the block
  // along a screen DIAGONAL, not a cardinal direction — a near-horizontal or
  // near-vertical swipe is the ambiguous case here (the opposite of a cardinal
  // control scheme), so wait for the swipe to clearly commit to one diagonal.
  const smaller = Math.min(absX, absY);
  if (smaller / mag < 0.4) return;
  touchHandled = true;
  let dir;
  if (dx > 0 && dy < 0) dir = "up";       // screen up-right
  else if (dx > 0 && dy > 0) dir = "right"; // screen down-right
  else if (dx < 0 && dy > 0) dir = "down";  // screen down-left
  else dir = "left";                        // screen up-left
  roll(dir);
}, { passive: false });
playArea.addEventListener("touchend", () => {
  touchStartX = undefined;
});

// Called by menu.js once the player picks New Game / Continue / a specific level —
// the game no longer auto-starts on page load, since there's a home screen first.
function startGame(levelIdx) {
  loadLevel(levelIdx);
}
