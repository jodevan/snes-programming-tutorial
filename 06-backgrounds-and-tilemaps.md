# Lesson 6: Backgrounds & Tilemaps

**Goal:** the payoff lesson. You have a palette (Lesson 4) and a tile (Lesson 5)
sitting in memory doing nothing — this lesson builds the tilemap that finally
puts them on screen, and turns on the background layer that displays it.

## Two more pieces: BG modes and tilemaps

A background layer needs three things, two of which you already have:

1. **Character data** — the tile bitmaps (built in [Lesson
   5](05-tiles-and-vram.md)).
2. **A tilemap** — a grid that says *which* tile (and which palette) goes in
   each screen cell. This is new in this lesson.
3. **A BG mode** — a global setting (`BGMODE`, `$2105`) that decides how many
   background layers exist and how many colors each one gets.

### BG modes, briefly

The SNES has 8 background modes, selected by the low 3 bits of `$2105`. Modes
trade off "how many layers" against "how many colors per layer" — see the full
[BG Modes table](https://wiki.superfamicom.org/backgrounds#bg-modes) for all
eight. This tutorial uses **Mode 1**: two 16-color (4bpp) layers plus one
4-color (2bpp) layer. We'll only turn on the 2bpp layer, `BG3`, since it matches
the tile you already built in Lesson 5.

```
$2105  wb+++-
        DCBAemmm
        mmm = 001           -> Mode 1
        e   = 0             -> BG3 priority bit, default behavior
        A/B/C/D = 0         -> all BGs use 8x8 tiles, not 16x16
```

### The tilemap entry format

A tilemap is a grid of 16-bit entries, one per 8×8 (or 16×16) screen cell. Per
the [background reference](https://wiki.superfamicom.org/backgrounds#tile-maps--character-maps):

```
vhopppcc cccccccc
v/h  = vertical/horizontal flip this tile
o    = tile priority
ppp  = palette number for this tile
cccccccccc = tile number (10 bits)
```

The default "empty" entry `$0000` means: no flip, priority 0, palette 0, tile 0
— which is exactly the tile you built in Lesson 5, in the palette you built in
Lesson 4. A tilemap filled entirely with `$0000` will show that same striped
tile, repeated, across the whole screen. That's what we're about to build.

Tilemaps are always 32×32 tiles internally (more on larger maps in [Lesson
9](09-background-scrolling.md)), which is exactly 256×256 pixels — bigger
than the visible 256×224 screen, so a single 32×32 map already fills the
display with room to spare.

## A crucial gotcha: word addresses vs. byte addresses

This trips up nearly everyone the first time. `VMADDL`/`VMADDH` (which you used
directly in Lesson 5) always take a **word address** — VRAM is fundamentally
16-bit-addressed from the CPU's side. But the *base address* fields inside
`BG34NBA` (character data location) and `BG3SC` (tilemap location) describe
positions in VRAM's 64 KB **byte** address space, pre-shifted:

```
BG34NBA:  aaaa = BG3 character base, as (byte address) >> 12
BG3SC:    aaaaaa = BG3 tilemap base, as (byte address) >> 10
```

The conversion you need to remember: **word address = byte address ÷ 2**. Since
Lesson 5 put the tile at VRAM word address `$0000` (byte address `$0000` too,
conveniently), `BG34NBA`'s BG3 field is just `0`. For the tilemap, we'll pick
byte address `$1000` (well clear of the 16-byte tile) — that's word address
`$0800` when we write it with `VMADDL`/`VMADDH`, but `$1000 >> 10 = 4` when we
write it into `BG3SC`. Two different registers, two different units, same
physical location. Getting this wrong (writing a word address into `BG3SC`, or
vice versa) produces a classic symptom: your tile data looks fine in a VRAM
viewer, but the screen shows garbage or nothing — worth remembering when
[Lesson 7](07-debugging-with-mesen.md) covers debugging techniques.

## Extending your ROM

Add this after the VRAM tile-loading loop from Lesson 5:

```asm
    ; --- Fill a 32x32 tilemap at VRAM byte $1000 (word $0800) with
    ;     zeros: tile 0, palette 0, no flip, priority 0, everywhere. ---
    lda #$08
    sta $2117           ; VMADDH: word address $0800, high byte
    stz $2116           ; VMADDL: word address $0800, low byte

    ldx #0
@map_loop:
    stz $2118            ; VMDATAL: tile number low byte = 0
    stz $2119             ; VMDATAH: rest of the entry = 0
    inx
    cpx #1024             ; 32*32 = 1024 tilemap entries
    bne @map_loop

    ; --- Point BG3 at that character data and tilemap. ---
    lda #$00
    sta $210C            ; BG34NBA: BG3 character base = byte $0000 (>>12 = 0)
    lda #$10
    sta $2109            ; BG3SC: BG3 tilemap base = byte $1000 (>>10 = 4), 32x32

    ; --- Select BG Mode 1. ---
    lda #$01
    sta $2105            ; BGMODE: mode 1, all BGs 8x8 tiles

    ; --- Enable BG3 on the main screen. ---
    lda #$04
    sta $212C            ; TM: bit 2 = BG3
```

This all needs to happen *before* the `INIDISP` write that turns on the screen
(the last few lines of Lesson 1's `reset:`) — everything here writes to PPU
registers that are only safe to touch during forced blank or V-Blank, and
forced blank is exactly the state the CPU is in for this whole `reset:`
routine, right up until that final brightness write.

## Build and run

Assemble and run it. This time the screen changes: instead of a flat backdrop
color, you should see the entire visible area filled with horizontal red and
green stripes — the Lesson 5 tile, repeated across a 32×32 tilemap, rendered
through the Lesson 4 palette. This is the first lesson where every earlier
piece of the tutorial visibly comes together.

## Exercises

1. Change `BG3SC` to place the tilemap at a different (still non-overlapping)
   VRAM location, recomputing both the byte-address shift for `BG3SC` and the
   word address for the `VMADDL`/`VMADDH` write. Confirm the display is
   unchanged — the exact address doesn't matter as long as it's consistent and
   doesn't collide with the tile data.
2. Write a *different* tilemap value for just one entry (say, tilemap index 5)
   that sets the priority bit or flips the tile, and figure out which one 8×8
   square on screen changed as a result. (Hint: tilemap entries fill in
   row-major order — entry 0 is the top-left cell, entry 1 is the cell to its
   right.)
3. `TM` (`$212C`) enables layers on the *main* screen; `TS` (`$212D`) is the
   identical register for the *sub*screen, used for color-math effects this
   tutorial doesn't cover. Skim its entry in the [register
   reference](https://wiki.superfamicom.org/registers#tm-main-screen-designation-567)
   just enough to confirm it uses the exact same bit layout as `TM`.

---

[Home](docs/index.html) |
Previous: [Lesson 5 — Tiles & VRAM](05-tiles-and-vram.md)
Next: [Lesson 7 — Debugging with Mesen](07-debugging-with-mesen.md)
