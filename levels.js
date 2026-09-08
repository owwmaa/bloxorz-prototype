// ---- Level data ----
// '#' = floor, '.' = void, 'G' = goal (walkable, wins when standing on it),
// 'w' = fragile tile (breaks if stood on, safe if crossed lying down).
// Optional `switches`: [{ pos:{x,y}, bridge:[{x,y},...], open:bool }]
// A switch's bridge cells are void ('.') until the switch is touched, then
// they flip to floor. Touching the switch again toggles them back.
const levels = [
  { grid: ["######G"], start: { x: 0, y: 0 } },
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
      "######.",
      "#.##.#.",
      "#.#####",
      "#...#G#",
      "....###"
    ],
    start: { x: 0, y: 3 }
  },
  {
    grid: [
      ".....#####",
      ".....#####",
      "########.G",
      "########..",
      "..##......",
      "..##......"
    ],
    start: { x: 0, y: 3 }
  },
  {
    grid: [
      ".###.",
      "####.",
      "#..#.",
      "#.###",
      "###G#",
      "..###"
    ],
    start: { x: 3, y: 3 }
  },
  {
    // Two open "islands" separated by a gap. The bridge across is gated by a
    // HARD switch sitting right on the natural path through island A — you
    // have to be standing on it, not just rolling past, for it to trigger.
    grid: [
      "#####....#####",
      "#####....###G#",
      "#####....#####",
      "#####....#####"
    ],
    start: { x: 0, y: 1 },
    switches: [
      { pos: { x: 3, y: 1 }, type: "hard", bridge: [{ x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }], open: false }
    ]
  },
  {
    // Same lesson as level 6, chained twice: the obvious straight path breaks a
    // weak tile on row 0, the detour to row 1 has ANOTHER weak tile waiting if
    // you get complacent and skip the second detour down to row 2.
    grid: [
      "######w",
      "...######w",
      ".........G"
    ],
    start: { x: 0, y: 0 },
    switches: [
      { pos: { x: 2, y: 0 }, type: "soft", bridge: [{ x: 1, y: 1 }, { x: 2, y: 1 }], open: false },
      { pos: { x: 8, y: 1 }, type: "soft", bridge: [{ x: 7, y: 2 }, { x: 8, y: 2 }], open: false }
    ]
  },
  {
    grid: [
      "###.......",
      "######....",
      "#########.",
      ".#########",
      ".....##G##",
      "......###."
    ],
    start: { x: 1, y: 1 }
  },
  {
    grid: [
      "####..####..###",
      "####..####..#G#",
      "####..####..###",
      "####..####..###",
      "####..####..###"
    ],
    start: { x: 1, y: 3 },
    switches: [
      { pos: { x: 2, y: 1 }, type: "soft", bridge: [{ x: 4, y: 3 }, { x: 5, y: 3 }], open: false },
      { pos: { x: 8, y: 1 }, type: "hard", bridge: [{ x: 10, y: 3 }, { x: 11, y: 3 }], open: false }
    ]
  },
  {
    grid: [
      "......#######..",
      "####..###..##..",
      "#########..####",
      "####.......##G#",
      "...........####",
      "............###"
    ],
    start: { x: 1, y: 2 }
  },
  {
    grid: [
      "...wwwwwww....",
      "...wwwwwww....",
      "####.....###..",
      "###.......##..",
      "###.......##..",
      "###..####wwwww",
      "###..####wwwww",
      ".....#G#..ww#w",
      ".....###..wwww"
    ],
    start: { x: 1, y: 5 }
  },
  {
    grid: [
      "#ww##ww#",
      "w..wwww#",
      "w..wwwww",
      ".###.wwG"
    ],
    start: { x: 0, y: 0 }
  },
  {
    grid: [
      "..#....##G#",
      ".###...####",
      "###w#######",
      ".###.......",
      "..#........"
    ],
    start: { x: 2, y: 4 }
  },
  {
    grid: [
      "...#..G",
      "...#.##",
      ".###.##",
      "####.##",
      "####.#.",
      "###..##",
      "#######",
      "....#w#"
    ],
    start: { x: 5, y: 4 },
    switches: [
      { pos: { x: 4, y: 7 }, type: "soft", bridge: [{ x: 4, y: 0 }, { x: 5, y: 0 }], open: false }
    ]
  },
  {
    grid: [
      "####.......",
      "##.##......",
      "##.##......",
      "....###.###",
      ".....####G#",
      "........###",
      ".........##"
    ],
    start: { x: 1, y: 0 }
  },
  {
    grid: [
      "....##..",
      "....###.",
      "....####",
      "....##..",
      "######..",
      "#G#.....",
      "###....."
    ],
    start: { x: 5, y: 2 },
    switches: [
      { pos: { x: 2, y: 4 }, type: "hard", bridge: [{ x: 3, y: 5 }, { x: 4, y: 5 }], open: false }
    ]
  },
  {
    grid: [
      ".#wwww###",
      ".#wwwwG##",
      ".###..###",
      ".#.......",
      ".#.......",
      ".#.......",
      ".#....##.",
      "###...##.",
      "########."
    ],
    start: { x: 0, y: 8 }
  },
  {
    grid: [
      "##..#www###",
      "##..#www###",
      "#.......###",
      "#........#.",
      "#...###..#.",
      "####G##..#.",
      "....###..#."
    ],
    start: { x: 8, y: 1 },
    switches: [
      { pos: { x: 9, y: 6 }, type: "hard", bridge: [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }], open: false }
    ]
  },
  {
    grid: [
      ".........#.....",
      ".........#.....",
      "........#######",
      "........##...##",
      "........##...##",
      "........ww...##",
      ".#########...##",
      "##.....###...##",
      "G#.....########",
      "##............."
    ],
    start: { x: 7, y: 7 },
    switches: [
      { pos: { x: 9, y: 0 }, type: "soft", bridge: [{ x: 2, y: 8 }, { x: 2, y: 9 }], open: false }
    ]
  }
];
