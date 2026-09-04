// ---- Level data ----
// '#' = floor, '.' = void, 'G' = goal (walkable, wins when standing on it),
// 'w' = fragile tile (breaks if stood on, safe if crossed lying down).
// Optional `switches`: [{ pos:{x,y}, bridge:[{x,y},...], open:bool }]
// A switch's bridge cells are void ('.') until the switch is touched, then
// they flip to floor. Touching the switch again toggles them back.
const levels = [
  { grid: ["######G"], start: { x: 0, y: 0 } },
  { grid: ["####", "...#", "...#", "...G"], start: { x: 0, y: 0 } },
  {
    grid: [
      "####...",
      "...#...",
      "...#...",
      "...####",
      "......#",
      "......#",
      "......G"
    ],
    start: { x: 0, y: 0 }
  },
  {
    grid: [
      "..####.",
      "#######",
      "#######",
      ".####G#"
    ],
    start: { x: 0, y: 1 }
  },
  {
    grid: [
      "..#####....",
      "#########..",
      ".########G#"
    ],
    start: { x: 0, y: 1 }
  },
  {
    grid: ["###..###wG"],
    start: { x: 0, y: 0 },
    switches: [
      { pos: { x: 2, y: 0 }, bridge: [{ x: 3, y: 0 }, { x: 4, y: 0 }], open: false }
    ]
  },
  {
    // The straight path looks safe, but rolling it blindly lands you standing on
    // the weak tile at x6 and breaks it. The real solution: the first roll happens
    // to trigger the switch at (2,0), opening a bypass one row down — detour onto
    // it before reaching the weak tile, and the goal is reachable safely from there.
    grid: ["######w###", "...######G"],
    start: { x: 0, y: 0 },
    switches: [
      { pos: { x: 2, y: 0 }, bridge: [{ x: 1, y: 1 }, { x: 2, y: 1 }], open: false }
    ]
  }
];
