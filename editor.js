// ---- Editor state ----
let editorRows = 8, editorCols = 12;
let editorGridData = makeEmptyGrid(editorRows, editorCols);
let editorStart = null; // { x, y } | null
let editorSwitches = []; // [{ pos:{x,y}, type:'soft'|'hard', bridge:[{x,y},...] }]
let linkingIndex = null; // index into editorSwitches currently in "link the bridge" mode
let currentTool = "floor";

function makeEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill("."));
}

const editorGridEl = document.getElementById("editorGrid");
const editorMessage = document.getElementById("editorMessage");
const editorHint = document.getElementById("editorHint");
const exportOutput = document.getElementById("editorExportOutput");

function updateHint() {
  if (linkingIndex !== null) {
    editorHint.textContent = "Click cells to link as this switch's bridge — click the switch's own tile again to finish.";
  } else if (currentTool === "switchO" || currentTool === "switchX") {
    editorHint.textContent = "Click a cell to place a switch, or click an existing switch to edit its links.";
  } else {
    editorHint.textContent = "";
  }
}

function switchAt(x, y) {
  return editorSwitches.find(s => s.pos.x === x && s.pos.y === y);
}
function bridgeOwnerAt(x, y) {
  return editorSwitches.find(s => s.bridge.some(b => b.x === x && b.y === y));
}

function renderEditorGrid() {
  editorGridEl.style.gridTemplateColumns = `repeat(${editorCols}, 26px)`;
  editorGridEl.style.gridTemplateRows = `repeat(${editorRows}, 26px)`;
  editorGridEl.innerHTML = "";
  for (let y = 0; y < editorRows; y++) {
    for (let x = 0; x < editorCols; x++) {
      const ch = editorGridData[y][x];
      const sw = switchAt(x, y);
      const bridgeOwner = bridgeOwnerAt(x, y);
      const cell = document.createElement("div");
      cell.className = "editorCell";
      if (ch === "#") cell.classList.add("floor");
      if (ch === "w") cell.classList.add("weak");
      if (ch === "G") cell.classList.add("goal");
      if (bridgeOwner) {
        cell.classList.add("bridge");
        if (editorSwitches.indexOf(bridgeOwner) === linkingIndex) cell.classList.add("linking");
      }
      if (sw) {
        cell.classList.add("switchMark");
        if (sw.type === "hard") cell.classList.add("hard");
      }
      if (editorStart && editorStart.x === x && editorStart.y === y) cell.classList.add("isStart");
      cell.addEventListener("click", () => handleCellClick(x, y));
      editorGridEl.appendChild(cell);
    }
  }
}

function handleCellClick(x, y) {
  editorMessage.textContent = "";
  exportOutput.style.display = "none";

  // ---- Linking mode: every click toggles bridge membership until you click the switch itself ----
  if (linkingIndex !== null) {
    const sw = editorSwitches[linkingIndex];
    if (x === sw.pos.x && y === sw.pos.y) {
      linkingIndex = null;
      updateHint();
      renderEditorGrid();
      return;
    }
    const idx = sw.bridge.findIndex(b => b.x === x && b.y === y);
    if (idx >= 0) {
      sw.bridge.splice(idx, 1);
    } else if (!switchAt(x, y)) {
      // a bridge cell is void-by-default until triggered, so clear any painted tile here,
      // and make sure it isn't already claimed by a different switch
      editorSwitches.forEach((other, i) => {
        if (i !== linkingIndex) other.bridge = other.bridge.filter(b => !(b.x === x && b.y === y));
      });
      editorGridData[y][x] = ".";
      sw.bridge.push({ x, y });
    }
    renderEditorGrid();
    return;
  }

  // ---- Placing / re-opening a switch ----
  if (currentTool === "switchO" || currentTool === "switchX") {
    const existing = switchAt(x, y);
    if (existing) {
      linkingIndex = editorSwitches.indexOf(existing);
    } else {
      editorGridData[y][x] = "#";
      editorSwitches.push({ pos: { x, y }, type: currentTool === "switchO" ? "soft" : "hard", bridge: [] });
      linkingIndex = editorSwitches.length - 1;
    }
    updateHint();
    renderEditorGrid();
    return;
  }

  // ---- Normal tile painting ----
  removeSwitchAt(x, y); // painting over a switch's tile removes that switch entirely
  if (currentTool === "void") {
    editorGridData[y][x] = ".";
    if (editorStart && editorStart.x === x && editorStart.y === y) editorStart = null;
    removeFromAnyBridge(x, y);
  } else if (currentTool === "floor") {
    editorGridData[y][x] = "#";
  } else if (currentTool === "weak") {
    editorGridData[y][x] = "w";
    removeFromAnyBridge(x, y);
  } else if (currentTool === "goal") {
    editorGridData[y][x] = "G";
    removeFromAnyBridge(x, y);
  } else if (currentTool === "start") {
    editorGridData[y][x] = "#";
    editorStart = { x, y };
    removeFromAnyBridge(x, y);
  }
  renderEditorGrid();
}

function removeSwitchAt(x, y) {
  const i = editorSwitches.findIndex(s => s.pos.x === x && s.pos.y === y);
  if (i >= 0) {
    if (linkingIndex === i) linkingIndex = null;
    editorSwitches.splice(i, 1);
  }
}
function removeFromAnyBridge(x, y) {
  editorSwitches.forEach(s => { s.bridge = s.bridge.filter(b => !(b.x === x && b.y === y)); });
}

document.querySelectorAll(".toolBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".toolBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentTool = btn.dataset.tool;
    updateHint();
  });
});

document.getElementById("editorResizeBtn").addEventListener("click", () => {
  const newRows = Math.max(1, Math.min(20, Number(document.getElementById("editorRowsInput").value) || 1));
  const newCols = Math.max(1, Math.min(20, Number(document.getElementById("editorColsInput").value) || 1));
  const newGrid = makeEmptyGrid(newRows, newCols);
  for (let y = 0; y < Math.min(editorRows, newRows); y++) {
    for (let x = 0; x < Math.min(editorCols, newCols); x++) {
      newGrid[y][x] = editorGridData[y][x];
    }
  }
  editorGridData = newGrid;
  editorRows = newRows;
  editorCols = newCols;
  if (editorStart && (editorStart.x >= newCols || editorStart.y >= newRows)) editorStart = null;
  editorSwitches = editorSwitches
    .filter(s => s.pos.x < newCols && s.pos.y < newRows)
    .map(s => ({ ...s, bridge: s.bridge.filter(b => b.x < newCols && b.y < newRows) }));
  linkingIndex = null;
  renderEditorGrid();
});

document.getElementById("editorClearBtn").addEventListener("click", () => {
  editorGridData = makeEmptyGrid(editorRows, editorCols);
  editorStart = null;
  editorSwitches = [];
  linkingIndex = null;
  editorMessage.textContent = "";
  exportOutput.style.display = "none";
  renderEditorGrid();
});

// Trims the grid down to the smallest bounding box around drawn tiles + switch
// bridges, and re-bases all coordinates to match — keeps exported levels clean.
function computeTrimmedLevel() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const consider = (x, y) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  for (let y = 0; y < editorRows; y++)
    for (let x = 0; x < editorCols; x++)
      if (editorGridData[y][x] !== ".") consider(x, y);
  editorSwitches.forEach(s => s.bridge.forEach(b => consider(b.x, b.y)));

  if (minX === Infinity) return { error: "Nothing drawn yet." };
  if (!editorStart) return { error: "Place a Start tile first." };

  const rows = [];
  for (let y = minY; y <= maxY; y++) {
    let row = "";
    for (let x = minX; x <= maxX; x++) row += editorGridData[y][x];
    rows.push(row);
  }
  const result = { grid: rows, start: { x: editorStart.x - minX, y: editorStart.y - minY } };
  if (editorSwitches.length > 0) {
    result.switches = editorSwitches.map(s => ({
      pos: { x: s.pos.x - minX, y: s.pos.y - minY },
      type: s.type,
      bridge: s.bridge.map(b => ({ x: b.x - minX, y: b.y - minY })),
      open: false
    }));
  }
  return result;
}

document.getElementById("editorTestBtn").addEventListener("click", () => {
  const lvl = computeTrimmedLevel();
  if (lvl.error) { editorMessage.textContent = lvl.error; return; }
  showScreen(gameScreen);
  loadCustomLevel(lvl);
  maybeShowIntro();
});

document.getElementById("editorExportBtn").addEventListener("click", () => {
  const lvl = computeTrimmedLevel();
  if (lvl.error) { editorMessage.textContent = lvl.error; exportOutput.style.display = "none"; return; }
  editorMessage.textContent = "";
  const gridLines = lvl.grid.map(r => `      "${r}"`).join(",\n");
  let switchesBlock = "";
  if (lvl.switches) {
    const swLines = lvl.switches.map(s =>
      `      { pos: { x: ${s.pos.x}, y: ${s.pos.y} }, type: "${s.type}", bridge: [${s.bridge.map(b => `{ x: ${b.x}, y: ${b.y} }`).join(", ")}], open: false }`
    ).join(",\n");
    switchesBlock = `,\n    switches: [\n${swLines}\n    ]`;
  }
  exportOutput.value =
    `  {\n    grid: [\n${gridLines}\n    ],\n    start: { x: ${lvl.start.x}, y: ${lvl.start.y} }${switchesBlock}\n  },`;
  exportOutput.style.display = "block";
  exportOutput.select();
});

document.getElementById("editorBtn").addEventListener("click", () => {
  showScreen(document.getElementById("editorScreen"));
});

document.getElementById("backFromEditorBtn").addEventListener("click", () => {
  showScreen(homeScreen);
});

renderEditorGrid();
