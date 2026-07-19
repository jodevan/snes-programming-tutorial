# Lesson 4: Palettes & CGRAM

**Goal:** go from "write one color to CGRAM" (Lesson 1) to "load a whole palette
from ROM in a loop" — the technique every later lesson's graphics depend on.

## A quick recap of the color format

Every SNES color is 15 bits, packed into a 16-bit word, laid out
`-bbbbbgg gggrrrrr`: 5 bits each for blue, green, and red, high bit unused.

| Color | Value |
|---|---|
| Black | `$0000` |
| Red | `$001F` |
| Green | `$03E0` |
| Blue | `$7C00` |
| White | `$7FFF` |

CGRAM holds 256 of these — 512 bytes total. It's addressed as a flat array of
color *indices* 0-255, not as separate "palettes"; the idea of it being split
into sixteen 16-color palettes (or more finely, for lower bit-depth tiles) is a
convention that background and sprite tiles impose on top of that flat array —
Lessons [6](06-backgrounds-and-tilemaps.md) and [9](10-sprites-oam-basics.md)
cover how a tile's palette number picks which slice of CGRAM it draws from.

Palette entry 0 (color index 0) is special: with no background layers or sprites
enabled, it's the only thing visible — the plain background color you've been
looking at since Lesson 1.

## CGADD and CGDATA, precisely

From the [register reference](https://wiki.superfamicom.org/registers#cgadd-cgram-address-487):

```
$2121  wb+++-
        cccccccc        <- CGADD: sets the color INDEX (0-255)

$2122  ww+++-
        -bbbbbgg gggrrrrr   <- CGDATA: writes the color at that index
```

`CGDATA` is a "write-twice" register: the first write after setting `CGADD`
supplies the low byte, the second supplies the high byte, and *only after the
high byte lands* does the actual color update and the index auto-increment.
This matters because of a subtlety the register docs point out explicitly:
CGRAM writes are buffered exactly like OAM's low-table writes (Lesson 10 revisits
this comparison) — if you write low-byte, low-byte, high-byte in sequence
without the expected alternation, you will not get the color you expect. In
practice, the fix is simple and this tutorial follows it everywhere: always
write CGDATA in strict low-byte-then-high-byte pairs, one full color at a time,
never interleaved with anything else.

## Loading a palette from ROM

Here's the general pattern for writing N colors starting at some CGRAM index,
from a table stored in ROM:

```asm
; Writes (count) colors from (table) into CGRAM starting at (start_index).
; Assumes: 8-bit A, 16-bit X/Y (the Lesson 1 convention).
.a8
.i16
load_palette:
    lda #start_index
    sta $2121           ; CGADD: point CGRAM at the first entry we'll touch

    ldx #0
@loop:
    lda table,x          ; low byte of this color
    sta $2122
    inx
    lda table,x           ; high byte of this color
    sta $2122
    inx
    cpx #(count*2)
    bne @loop
    rts
```

This is a CPU-driven loop — the 65816 touches every single byte itself. It
works fine for a handful of colors, but it's the slow way: [Lesson
7](08-dma-and-hdma.md) replaces this exact loop with one DMA transfer that
copies the whole table in a single hardware operation, no loop needed. Learning
the manual version first is worth it, though, because it's what makes the DMA
version make sense — DMA is really just "the PPU port write loop, but the
hardware does the looping."

## Extending your Lesson 1 ROM

Add a small palette table and a call to `load_palette` right after the CPU/PPU
setup, replacing the two-instruction single-color write from Lesson 1:

```asm
; --- add near the top of the CODE segment, alongside reset: ---

palette_table:
    .word $0000     ; index 0: black (backdrop)
    .word $001F     ; index 1: red
    .word $03E0     ; index 2: green
    .word $7C00     ; index 3: blue
palette_table_end:

.define PALETTE_COUNT ((palette_table_end - palette_table) / 2)
```

And inside `reset:`, replace the old CGRAM-writing lines with:

```asm
    ; --- Load our 4-color palette into CGRAM, starting at index 0. ---
    stz $2121
    ldx #0
@pal_loop:
    lda palette_table,x
    sta $2122
    inx
    lda palette_table,x
    sta $2122
    inx
    cpx #(PALETTE_COUNT*2)
    bne @pal_loop
```

Build and run it exactly like Lesson 1. **The screen will still look identical**
— solid black now, since palette index 0 is black in this table, and nothing
yet displays indices 1-3. That's expected and worth sitting with for a second:
you've built real infrastructure (a reusable, table-driven palette loader) that
produces *no visible change*, because nothing is asking to use colors 1-3 yet.
[Lesson 5](05-tiles-and-vram.md) creates a tile, and [Lesson
6](06-backgrounds-and-tilemaps.md) is where those other three colors finally
show up on screen. Programming graphics hardware often works this way — you
lay pipes before water flows through them.

## Exercises

1. Change `palette_table` to use index 0 = blue instead of black, rebuild, and
   confirm the backdrop color changes — this is the one part of this lesson's
   work you *can* see immediately.
2. `load_palette` above hardcodes writing to CGRAM index 0. Modify it (or write
   a second call) to load a *second* 4-color palette starting at CGRAM index 4,
   without duplicating the whole loop — think about what would need to become a
   parameter.
3. The [Registers page's CGWSEL/CGADSUB/COLDATA
   entries](https://wiki.superfamicom.org/registers#cgwsel-color-addition-select-588)
   describe "color math" — blending two colors together in hardware. Skim just
   enough to answer: does color math change what's stored in CGRAM, or does it
   change what's computed at render time? This tutorial doesn't implement color
   math, but knowing the answer will save you confusion if you see it in other
   people's code.

---

[Home](docs/index.html) |
Previous: [Lesson 3 — SNES memory map & hardware registers](03-memory-map-and-registers.md)
Next: [Lesson 5 — Tiles & VRAM](05-tiles-and-vram.md)
