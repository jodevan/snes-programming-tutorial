# Lesson 10: Sprites (OAM) Basics

**Goal:** put an independently-movable object on screen, on top of the
scrolling background from [Lesson 9](09-background-scrolling.md). Sprites
(the SNES calls them "objects," hence `OBJ`/`OAM`) are a genuinely different
system from backgrounds — separate memory, separate palette range, separate
tile format rules — so this lesson treats them from scratch rather than as a
variation on Lessons 5-6.

## OAM: 128 sprites, two tables

Object Attribute Memory holds all 128 sprites' data, split into a **low table**
(512 bytes, 4 bytes per sprite) and a **high table** (32 bytes, 2 bits per
sprite). Per the [sprites
reference](https://wiki.superfamicom.org/sprites#oam):

```
Low table, 4 bytes per sprite:
  byte 0: xxxxxxxx   X position (low 8 bits)
  byte 1: yyyyyyyy   Y position
  byte 2: cccccccc   Starting tile number
  byte 3: vhoopppN   flip/priority/palette/name-table bits

High table, 2 bits per sprite:
  bit 0: X position, bit 8 (sprites can be positioned up to X=511)
  bit 1: size flag (0 = small, 1 = large, per OBSEL's two configured sizes)
```

Both tables share the same "address register, data register" access pattern
you already know: `OAMADDL`/`OAMADDH` (`$2102`/`$2103`) set the address,
`OAMDATA` (`$2104`) writes to it and auto-advances — and the internal 10-bit
address naturally rolls from the low table straight into the high table once
you pass byte 511, so **one continuous write loop can fill both tables**
without resetting the address in between.

One quirk worth knowing before it confuses you: OAM low-table writes are
buffered exactly like `CGDATA` was in [Lesson 4](04-palettes-and-cgram.md#cgadd-and-cgdata-precisely) —
a sprite's byte pair doesn't actually land until you've written both halves of
the relevant word in sequence. In practice, writing all 4 bytes of a sprite
record in order, one after another, is exactly right and this never becomes an
issue.

## OBSEL: sizes and where sprite tiles live in VRAM

```
$2101  wb++?-
        sssnnbbb
        sss = size selection (000 = 8x8 and 16x16; this lesson uses 8x8)
        nn  = Name Select (offset to the second tile table, for N=1 sprites)
        bbb = Name Base Select, as (VRAM byte address) >> 14
```

Note the shift is `>>14` here, not the `>>12` you used for `BG34NBA` in Lesson
6 — sprite tile memory is addressed in 16 KB pages, not 4 KB ones. Mixing these
up (using the BG's `>>12` convention for a sprite base, or vice versa) is a very
easy mistake with a confusing symptom: your sprite renders, but shows the wrong
tile data, offset into whatever actually lives at the miscalculated address.

Sprite tiles need their own space, separate from `BG3`'s tile data (Lesson 5,
VRAM byte `$0000`) and tilemap (Lesson 6, VRAM byte `$1000`). This lesson uses
byte address `$4000` — clear of both — so `bbb = $4000 >> 14 = 1`.

## Sprites are always 4bpp

Unlike backgrounds, whose color depth depends on the BG mode (Lesson 6 used
`BG3`'s 2bpp), **sprite tiles are always 4bpp** (16 colors) — this is a fixed
hardware rule, not a setting. A 4bpp tile is 32 bytes: the same bitplane-0/1
interleaved format from Lesson 5, for 16 bytes, followed immediately by
bitplanes 2/3 in the same format, for another 16 bytes. A single solid-color
8x8 sprite tile using color index 1 (bitplane0 set, bitplanes 1-3 clear) looks
like this:

```asm
sprite_tile:
    .byte $FF, $00     ; row 0: bitplane0, bitplane1
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00     ; 16 bytes so far (bitplanes 0/1)
    .byte $00, $00     ; row 0: bitplane2, bitplane3
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00     ; 16 more bytes (bitplanes 2/3) = 32 total
sprite_tile_end:
```

## Sprite palettes

Sprites draw from CGRAM indices **128-255**, split into 8 palettes of 16 colors
each (`ppp` in the OAM attribute byte selects which). Palette entry 0 of each
16-color block is transparent, same rule as backgrounds. For palette 0
(`ppp=000`), color index 1 lives at CGRAM index 129. Load it the same way you
loaded BG colors in Lesson 4:

```asm
    lda #129
    sta $2121         ; CGADD: sprite palette 0, index 1
    lda #$FF
    sta $2122          ; low byte
    lda #$03
    sta $2122           ; high byte -> color $03FF (yellow)
```

## Extending your ROM

Load the tile data and palette above (via a CPU loop or the DMA techniques from
[Lesson 8](08-dma-and-hdma.md) — your choice), set `OBSEL`, then fill OAM:
one visible sprite, everything else pushed off-screen so it doesn't render as a
stray tile at the top-left corner (the default position if left at all zeros):

```asm
    lda #$01
    sta $2101          ; OBSEL: 8x8/16x16 sizes, name base = VRAM byte $4000

    stz $2102
    stz $2103           ; OAMADDL/H: start at OAM address 0

    ; --- Sprite 0: our one visible sprite ---
    lda #120
    sta $2104           ; X = 120
    lda #100
    sta $2104            ; Y = 100
    stz $2104             ; tile number = 0
    stz $2104              ; attributes = 0 (no flip, priority 0, palette 0)

    ; --- Sprites 1-127: push off-screen (Y = -16, i.e. $F0) ---
    ldx #127
@hide_loop:
    stz $2104
    lda #$F0
    sta $2104
    stz $2104
    stz $2104
    dex
    bne @hide_loop

    ; --- High table: 32 bytes, all zero (small size, X < 256 for everyone) ---
    ldx #32
@hightable_loop:
    stz $2104
    dex
    bne @hightable_loop

    ; --- Enable OBJ on the main screen, alongside BG3 from Lesson 6 ---
    lda #$14             ; TM: bit 2 (BG3) | bit 4 (OBJ)
    sta $212C
```

## Build and run

You should now see a solid yellow 8×8 square sitting at a fixed position, on
top of the scrolling striped background from Lesson 9. It doesn't move yet —
[Lesson 11](11-controller-input-and-animation.md) reads the controller and
gives you control of it.

## Exercises

1. Change `OBSEL`'s `sss` bits to `011` (16x16 and 32x32) and set the OAM
   attribute/high-table size bit for sprite 0 to select the larger of the two.
   You'll need a bigger tile (or four 8x8 tiles arranged as one 16x16 block —
   see the [character table wrapping
   rules](https://wiki.superfamicom.org/sprites#character-table-in-vram)) to
   fill it correctly.
2. Add a second visible sprite using a different palette (`ppp=1`, colors
   144-159) elsewhere on screen, without disturbing the off-screen loop for the
   remaining 126 sprites.
3. Using [Lesson 7](07-debugging-with-mesen.md)'s PPU Viewers, open the
   sprite viewer and confirm sprites 1-127 really do show `Y = -16` and are
   excluded from the visible list — a good way to build trust in code like the
   hide-loop above before you need to debug a sprite that mysteriously won't
   disappear.

---

[Home](README.md) |
Previous: [Lesson 9 — Background scrolling](09-background-scrolling.md)
Next: [Lesson 11 — Controller input & sprite animation](11-controller-input-and-animation.md)
