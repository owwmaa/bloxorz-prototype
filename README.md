# Bloxorz Prototype

A browser-based prototype of a Bloxorz-style tilt/roll puzzle game — isometric
board, a rigid block that physically rotates over its pivot edge (real 3D
rotation math, not a faked animation), weak tiles, switches/bridges, touch +
keyboard controls, and synthesized sound effects. No build step, no
dependencies — just static HTML/CSS/JS.

## Running it locally

Just open `index.html` in a browser. If your browser blocks local file
access for scripts, serve it instead:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project structure

- `index.html` — page structure only
- `style.css` — all styling, including the portrait/landscape layout switch
- `levels.js` — level data (grids, start position, switches). Edit this to
  add or change levels without touching any game logic.
- `game.js` — rendering (isometric projection, tile/block drawing), the roll
  physics, win/lose rules, animation, sound, and input handling (keyboard,
  touch swipe, on-screen d-pad)

## Level format

Each level is a grid of characters plus a start position:

- `#` floor
- `.` void (falling off resets the level)
- `G` goal — win by landing here **standing upright**
- `w` fragile tile — breaks if stood on, safe to cross while lying flat

Optional `switches` array — each switch has a `pos`, a list of `bridge`
cells that start closed (void) and flip to floor when the switch is
touched (touching it again toggles back), and an initial `open` state.

```js
{
  grid: ["###..###wG"],
  start: { x: 0, y: 0 },
  switches: [
    { pos: { x: 2, y: 0 }, bridge: [{ x: 3, y: 0 }, { x: 4, y: 0 }], open: false }
  ]
}
```

## Status / known gaps

This is a prototype for testing whether the core mechanic feels good, not a
finished game. Not yet built: procedural/arcade mode, skins, a real
difficulty-tuned level set, mobile app packaging.

## Contributing (for the two of us)

- Create a branch per feature/fix (`git checkout -b your-name/thing`), open
  a PR into `main` rather than pushing straight to `main`, so we both see
  what changed before it lands.
- Keep level data changes in `levels.js` and logic changes in `game.js`
  separate where possible — makes diffs much easier to review.
