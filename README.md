# Building a Game for the SNES

**A step-by-step tutorial for writing a Super Nintendo game in 65816 assembly,
built to run on a real emulator at every stage.**
An HTML version of this tutorial can also be accessed
[here](https://jodevan.github.io/snes-programming-tutorial/).

## Goal & motivation

The goal is a working, playable SNES game — built by hand, in assembly,
understanding every piece along the way rather than starting from someone
else's engine. Getting there means learning a genuinely wide slate of SNES
hardware: the 65816 CPU, the PPU's backgrounds and sprites, DMA/HDMA, the
independent SPC700 sound processor, and the tooling to debug all of it when it
inevitably doesn't work the first time.

This tutorial exists because most SNES homebrew material assumes you'll piece
it together from scattered blog posts, wiki pages, and forum threads written
over the last two decades — all excellent individually (this project leans
heavily on them; see [Reference resources](#reference-resources) below), but
not written as one continuous path for a beginner. The lessons here are
sequenced so each one builds on a running codebase from the previous lesson,
not a pile of disconnected demos, and every claim about how the hardware
behaves has been cross-checked against primary references rather than
half-remembered folklore.

**Toolchain:** [`ca65`](https://cc65.github.io/) (part of the `cc65` suite) and
the [Mesen](https://www.mesen.ca/) emulator, on macOS. [Lesson
1](01-toolchain-setup-and-first-rom.md) covers setup and explains why this
tutorial picked `ca65` over `asar`.

## How to use this

Work through them in order — later lessons assume the
code from earlier ones. Every lesson that touches the ROM gives you exact
`ca65`/`ld65` build commands and describes what you should see in Mesen; if
what you see doesn't match, [Lesson 7](07-debugging-with-mesen.md) covers the
debugging tools to figure out why.

## Lessons

### Part 0 — Foundations
1. [Toolchain setup & your first ROM](01-toolchain-setup-and-first-rom.md) — install/verify ca65 and Mesen, the ROM header and reset vector, display a solid color.
2. [The 65816 CPU crash course](02-cpu-crash-course.md) — registers, 8/16-bit mode switching, addressing modes, 6502-vs-65816 gotchas.
3. [SNES memory map & hardware registers](03-memory-map-and-registers.md) — WRAM, VRAM, CGRAM, OAM, and the PPU/CPU register windows.

### Part 1 — Graphics fundamentals
4. [Palettes & CGRAM](04-palettes-and-cgram.md) — the 15-bit color format, loading a palette from ROM.
5. [Tiles & VRAM](05-tiles-and-vram.md) — tile bitplane formats, loading graphics data into VRAM.
6. [Backgrounds & tilemaps](06-backgrounds-and-tilemaps.md) — BG modes, the tilemap format, turning on a background layer.
7. [Debugging with Mesen](07-debugging-with-mesen.md) — breakpoints, PPU viewers, memory tools, the event viewer, trace logger.
8. [DMA & HDMA deep dive](08-dma-and-hdma.md) — hardware-driven transfers, the DMA fill trick, HDMA scanline effects.
9. [Background scrolling](09-background-scrolling.md) — `BGxHOFS`/`BGxVOFS`, a real per-frame game loop, seamless tilemap wrapping.

### Part 2 — Sprites & interaction
10. [Sprites (OAM) basics](10-sprites-oam-basics.md) — sprite graphics, the OAM table, size/priority attributes.
11. [Controller input & sprite animation](11-controller-input-and-animation.md) — NMI setup, reading the joypad, moving and animating a sprite.
12. [Collision detection](12-collision-detection.md) — sprite-vs-sprite (AABB boxes) and sprite-vs-world (a lookup table).

### Part 3 — Audio
13. [The SPC700 & audio basics](13-spc700-and-audio-basics.md) — the second CPU, the boot handshake, making a sound with no SPC700 code.
14. [Music & sound effects](14-music-and-sound-effects.md) — triggering sound effects from gameplay, and a realistic path to real music.

### Part 4 — Wrapping up
15. [Code organization & optimization](15-code-organization-and-optimization.md) — multi-file projects, macros, the V-Blank time budget, ROM banking.
16. [Capstone project](16-capstone.md) — a small playable game combining everything: scrolling background, animated/collidable player sprite, a collectible, and sound.

## Reference resources

- [65816 Reference](https://wiki.superfamicom.org/65816-reference) — full CPU instruction set.
- [SPC700 Reference](https://wiki.superfamicom.org/spc700-reference) — sound CPU instruction set.
- [Registers](https://wiki.superfamicom.org/registers) — every PPU/CPU hardware register, bit by bit.
- [Memory Mapping](https://wiki.superfamicom.org/memory-mapping) — LoROM/HiROM layout details.
- [nesdoug's SNES tutorial series](https://nesdoug.com/2020/03/19/snes-projects/) — a second explanation style for the same topics, also ca65-based.
- [SNESdev Wiki](https://snes.nesdev.org/wiki/SNESdev_Wiki) — the boot-handshake and debugging references this tutorial builds on.

## Status

All 16 lessons are written. Questions and corrections from actually building
this feed back into the lessons — this is a living document, not a fixed
snapshot.
