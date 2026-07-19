# Lesson 16: Capstone Project

**Goal:** wire together everything from Lessons 1-15 into one small, coherent,
playable scene — not new material, but the first time all of it runs as a
single program instead of fifteen separate demos.

## What you're building

A player-controlled sprite that: moves around a scrolling background, stays
inside the play area via tile-based collision, can touch a collectible sprite
that disappears and plays a sound when collected, and is built from files
organized the way [Lesson 15](15-code-organization-and-optimization.md)
described rather than one monolithic file. Concretely, every piece maps to a
lesson you've already built:

| Piece | From |
|---|---|
| ROM skeleton, header, reset routine | [Lesson 1](01-toolchain-setup-and-first-rom.md) |
| Palette | [Lesson 4](04-palettes-and-cgram.md) |
| Background tile + tilemap | [Lessons 5](05-tiles-and-vram.md)-[6](06-backgrounds-and-tilemaps.md) |
| Fast loading via DMA | [Lesson 8](08-dma-and-hdma.md) |
| Background scrolling | [Lesson 9](09-background-scrolling.md) |
| Player sprite + animation | [Lesson 10](10-sprites-oam-basics.md)-[11](11-controller-input-and-animation.md) |
| Movement bounds + collectible detection | [Lesson 12](12-collision-detection.md) |
| Collection sound effect | [Lessons 13](13-spc700-and-audio-basics.md)-[14](14-music-and-sound-effects.md) |
| File layout | [Lesson 15](15-code-organization-and-optimization.md) |

## Suggested file layout

```
main.s          ; .includes everything below, HEADER/ROMINFO/VECTORS segments
regs.s          ; hardware register address constants
variables.s     ; direct-page variable definitions
macros.s        ; write_dsp_reg and any other macros you've written
reset.s         ; reset: — CPU init, palette/tile/tilemap/sprite loading (DMA)
gameplay.s       ; nmi_handler: — scroll, input, movement, collision, sound
audio.s           ; spc_wait_boot, spc_begin_upload, spc_upload_byte, write_dsp
lorom128.cfg       ; the 4-bank linker config from Lesson 15
```

## The collectible mechanic

This is the one genuinely new piece — everything else is direct reuse. Extend
Lesson 12's `wall_x`/`wall_y` sprite into a real collectible: when
`check_collision` reports a hit, hide it (move it off-screen, the same
technique Lesson 10 used for unused sprites) and trigger Lesson 14's sound,
guarded so it only fires once:

```asm
; --- new variable ---
collected := $06     ; 0 = not yet collected, 1 = collected

; --- inside nmi_handler, after the existing check_collision call ---
    lda collected
    bne @already_done       ; skip entirely once collected

    jsr check_collision
    bcc @no_hit
    lda #1
    sta collected

    ; hide the collectible sprite (same technique as Lesson 10's off-screen sprites)
    stz $2102
    lda #4                    ; OAMADDL: sprite 1's record starts at byte 4
    sta $2102
    stz $2103
    lda #$F0
    sta $2104                  ; overwrite its Y with an off-screen value
                                 ; (X/tile/attr bytes stay as previously set;
                                 ; only Y needs to change to hide it)

    jsr play_hit_sfx             ; from Lesson 14
@no_hit:
@already_done:
```

## Build, run, and verify

This is the point where [Lesson 7](07-debugging-with-mesen.md)'s tools stop
being optional. Before considering the capstone finished, use them
deliberately:

1. **Palette and tile viewers** — confirm the collectible sprite and player
   sprite both render with the colors and tile data you expect.
2. **A breakpoint on `collected`** (write access) — confirm it's set exactly
   once, not repeatedly, when the sprites overlap.
3. **The Event Viewer** — confirm the extra OAM/DMA work this lesson added
   still completes inside V-Blank, per [Lesson 15](15-code-organization-and-optimization.md#respecting-the-v-blank-time-budget)'s
   budget discussion. A capstone that works but silently blows the timing
   budget is a good habit to catch now, before a bigger project makes it much
   harder to find.

## Where to go from here

This tutorial stops here on purpose — not because there's nothing left, but
because everything past this point is variation and depth on the same
foundations, better explored by building something you actually want to make.
Some directions, each a natural extension of a specific lesson:

- **A real level** instead of a repeating stripe: multiple tile designs, a
  hand-authored tilemap (Lesson 6), and collision data derived from it
  (Lesson 12's third exercise sketched exactly this).
- **More background layers**: Mode 1 leaves `BG1`/`BG2` unused in this
  tutorial — a parallax layer or a HUD layer is a direct extension of Lesson 6,
  mindful of the shared-scroll-latch gotcha from Lesson 9.
- **Real music**, via one of the drivers Lesson 14 pointed to, replacing the
  single hand-tuned tone with an actual composed track.
- **HDMA effects** beyond the brightness gradient — per-scanline color changes
  or a split-scroll effect, building on Lesson 8.
- **Graphics tooling** — hand-encoding tiles byte-by-byte (as every lesson
  here did) doesn't scale; look into tools that convert a PNG into SNES tile
  format directly.
- The [Super Famicom Development Wiki](https://wiki.superfamicom.org) and the
  [SNESdev Wiki](https://snes.nesdev.org/wiki/SNESdev_Wiki) — both cited
  throughout this tutorial — cover everything from Mode 7 to save-data chips to
  multiplayer, well beyond this course's scope.

If you get stuck on any of these, or on anything in Lessons 1-16, that's
exactly the situation this tutorial's format was built for — bring the
question back, and the relevant lesson gets corrected or extended based on it.

---

[Home](README.md) |
Previous: [Lesson 15 — Code organization & optimization](15-code-organization-and-optimization.md)
