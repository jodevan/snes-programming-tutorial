# Lesson 7: Debugging with Mesen

**Goal:** stop guessing and start looking. You now have a ROM with real state —
a palette, a tile, a tilemap — which makes this the right moment to learn
Mesen's debugging tools properly, before projects get complex enough that
guessing stops working. This is also, incidentally, *why* this tutorial picked
[ca65 over asar back in the outline](docs/index.html#lessons): Mesen's debugger has
first-class support for ca65's debug symbols, so breakpoints and the
disassembly view show your actual source labels, not just raw addresses.

## The toolkit

Everything below lives under Mesen's **Debug** menu. The [official
documentation](https://www.mesen.ca/snes/docs/debugging.md) covers each tool
in full detail; this lesson is a guided tour of the ones you'll reach for
constantly, using bugs deliberately planted in your own Lesson 6 code as
practice targets.

| Tool | What it's for |
|---|---|
| **Debugger** | Source-mapped disassembly, breakpoints, a watch window, and register state — the main window you'll live in. |
| **PPU Viewers** | Live views of tiles, tilemaps, sprites, and palettes, read directly out of VRAM/CGRAM/OAM. |
| **Memory Tools** | A hex editor plus read/write/execute access counters for every memory type. |
| **Event Viewer** | A per-scanline timeline of register accesses, NMI, and IRQ. |
| **Trace Logger** | A scrollable (or file-logged) instruction-by-instruction execution trace. |

### The Debugger window and breakpoints

Open **Debug → Debugger** while your ROM is running. You'll see disassembly
with your ca65 labels intact (`reset:`, `@pal_loop:`, and so on) — this is the
payoff of the toolchain choice made all the way back in the outline. Breakpoints
can trigger on **read**, **write**, or **execute** access to a given address or
address range, in any of the SNES's memory types (CPU address space, VRAM,
CGRAM, OAM, and more), optionally gated by a condition expression.

Try this concretely: set a **write** breakpoint on `$2122` (CGDATA) and
re-run your Lesson 4/5/6 ROM from the start. Execution will pause on every
single palette write, letting you step through and confirm — byte by byte —
that `load_palette`'s loop is writing what you think it's writing. Do the same
for `$2118`/`$2119` to watch the VRAM tile upload. This is a far more reliable
way to answer "is my loop doing what I think it's doing?" than staring at
source code.

### PPU Viewers: seeing the data, not just the writes

Open **Debug → PPU Viewers**. Three views matter most for what you've built so
far:

- **Palette viewer** — shows all 256 CGRAM entries as color swatches. Confirm
  entries 0-3 are black/red/green/blue, exactly as Lesson 4's table specified.
- **Tile viewer** — renders raw VRAM bytes as tiles, with presets for "tiles
  currently used by BG3" and similar. Confirm your Lesson 5 tile actually shows
  a red-over-green stripe, using the palette you just confirmed above. You can
  even right-click a tile here and set a breakpoint on it directly, jumping
  straight to the code that last wrote it — much faster than hunting through
  source for the right `VMDATAL` write by hand.
- **Tilemap viewer** — shows the assembled tilemap (tile choice, palette,
  flip, priority per cell) as a grid. This is where Lesson 6's "word address vs.
  byte address" gotcha becomes visible instantly: if `BG3SC` were pointed at the
  wrong VRAM location, this view would show garbage tiles pulled from whatever
  random data happens to live there, even though the tile viewer and palette
  viewer both look correct in isolation.

### Memory Tools: catching uninitialized reads

**Debug → Memory Tools** gives you a hex editor over any memory type, plus
access counters — Mesen tracks every read, write, and execute per address while
the debugger is active. This is the tool for a specific, very common bug
category: reading a variable before anything has written to it. If an address
shows reads but zero writes in the counter view, you've found a variable your
code assumes is initialized but never actually set.

### Event Viewer: catching timing violations

Recall [Lesson 3](03-memory-map-and-registers.md#reading-a-register-diagram)'s
register-diagram notation — `wb+++-` and similar — which encodes exactly when a
register is safe to write (forced blank, V-Blank, H-Blank, or any time).
**Debug → Event Viewer** draws a visual timeline, one row per scanline, marking
every register access as a colored dot at the horizontal position it happened.
It's the empirical way to confirm you're respecting those timing windows: PPU
register writes should cluster tightly around the forced-blank/V-Blank period
at the top of the timeline. A write scattered into the middle of active
rendering is exactly the kind of bug that produces the "glitched for a few
tiles" symptom mentioned back in Lesson 3's `INIDISP` notes — and it's very
hard to spot from source code alone, but immediately obvious as a stray dot in
the wrong place on this timeline.

### Trace Logger: the last resort that always works

**Debug → Trace Logger** records (or displays live) every instruction executed,
in order, with register state at each step. It's verbose — you generally don't
read a full trace top to bottom — but it's invaluable when you know *roughly*
when something went wrong (say, "sometime after the third palette write") and
need to see the exact instruction-by-instruction path the CPU took, including
any branches that didn't go the way you expected.

## A practice bug

Deliberately break your Lesson 6 code to get real practice: swap the order of
the `VMADDL`/`VMADDH` writes in the tilemap-loading loop (write the high byte
first, low byte second). Rebuild, run, and use the tools above in this order to
find it without looking at the diff:

1. **Tile viewer** — the striped tile itself still looks correct, since Lesson
   5's tile-loading loop wasn't touched. This tells you the bug is downstream
   of tile loading.
2. **Tilemap viewer** — now shows the tilemap reading from the wrong VRAM
   region entirely, because the address it landed on isn't what `BG3SC` expects.
3. **Debugger breakpoint** on write to `$2117` (VMADDH) — step through and
   watch the actual address bytes land in the wrong order relative to `$2116`.

This workflow — narrow down *which* stage is wrong using the viewers, then
pinpoint *why* using breakpoints — is the general pattern you'll use for the
rest of this tutorial, and for any SNES project after it.

## Exercises

1. Set a breakpoint that triggers only when `X` equals a specific value inside
   the tilemap-filling loop from Lesson 6, using a condition expression rather
   than stepping through all 1024 iterations by hand.
2. Open the Event Viewer on your working (unbroken) Lesson 6 ROM and confirm
   for yourself that every PPU register write happens before the `INIDISP`
   brightness write — i.e., entirely within forced blank.
3. Undo the practice bug above, then introduce a different one on purpose (for
   example, load Lesson 4's palette into CGRAM index 4 instead of index 0) and
   use the Palette Viewer to confirm your prediction of what would go wrong
   before fixing it.

---

[Home](docs/index.html) |
Previous: [Lesson 6 — Backgrounds & tilemaps](06-backgrounds-and-tilemaps.md)
Next: [Lesson 8 — DMA & HDMA deep dive](08-dma-and-hdma.md)
