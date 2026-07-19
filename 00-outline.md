# Building a Game for the SNES: A Step-by-Step Tutorial

Welcome. This tutorial takes you from "empty folder" to a small, playable SNES game,
one concept at a time. Every lesson assembles into a real `.sfc` ROM you run in an
emulator, so you're never just reading — you're building.

## Who this is for

You're comfortable programming and you've installed `asar`, `ca65` (part of the
`cc65` suite), and the **Mesen** emulator on a Mac. You don't need prior 6502/65816
or SNES experience — Lesson 2 covers the CPU from scratch.

## Toolchain choice

This tutorial standardizes on **ca65** (from cc65), not asar. Reasoning:

- **Mesen's debugger has full, first-class support for ca65** (breakpoints tied to
  source lines, symbol names in the disassembly, watch expressions). asar's debug
  symbol support is partial in comparison, and debugging is where most of the
  learning-by-doing actually happens.
- The two resources this tutorial leans on most heavily — [nesdoug's SNES
  series](https://nesdoug.com/2020/03/19/snes-projects/) and the [Super Famicom
  Development Wiki](https://wiki.superfamicom.org) — both use ca65 in their
  canonical examples, so you'll be able to read outside material without a mental
  translation step.
- ca65 forces you to write an explicit linker config (`.cfg`) and segment layout.
  That's slightly more typing on day one, but it makes the SNES's memory mapping —
  the thing that trips up most beginners — visible instead of hidden behind magic.

asar isn't a bad choice (single-file ROMs, gentler syntax), and you already have it
installed if you ever want to compare. Appendix A briefly shows the same Lesson 1
ROM in asar for reference. Everything else in this tutorial is ca65 only.

## How each lesson works

Every lesson has: a short concept explanation, one fully-commented `.asm` file (or
a diff against the previous lesson's file), the exact `ca65`/`ld65` commands to
build it, and what you should see when you load the ROM in Mesen. Lessons build on
each other — by the end you'll have a running codebase, not sixteen disconnected
demos.

If something in a lesson confuses you or breaks on your machine, ask — this
tutorial gets corrected and expanded based on those questions.

## Table of contents

### Part 0 — Foundations
- [Lesson 1: Toolchain setup & your first ROM](01-toolchain-setup-and-first-rom.md) — install/verify ca65 and Mesen, understand the ROM header and reset vector, display a solid color.
- [Lesson 2: The 65816 CPU crash course](02-cpu-crash-course.md) — registers, 8/16-bit mode switching, addressing modes, the `.smart` directive, and 6502-vs-65816 gotchas.
- [Lesson 3: SNES memory map & hardware registers](03-memory-map-and-registers.md) — WRAM, VRAM, CGRAM, OAM, the PPU/CPU register windows, and how to read the reference wiki.

### Part 1 — Graphics fundamentals
- [Lesson 4: Palettes & CGRAM](04-palettes-and-cgram.md) — SNES color format (15-bit BGR), writing a palette from ROM in a loop.
- [Lesson 5: Tiles & VRAM](05-tiles-and-vram.md) — tile bitplane formats (2bpp/4bpp/8bpp), loading graphics data into VRAM.
- [Lesson 6: Backgrounds & tilemaps](06-backgrounds-and-tilemaps.md) — BG modes, tilemap format, turning on a background layer.
- [Lesson 7: Debugging with Mesen](07-debugging-with-mesen.md) — breakpoints, PPU viewers, memory tools, the event viewer, and trace logger.
- [Lesson 8: DMA & HDMA deep dive](08-dma-and-hdma.md) — general-purpose DMA channels, the DMA fill trick, HDMA for scanline effects.
- [Lesson 9: Background scrolling](09-background-scrolling.md) — `BGxHOFS`/`BGxVOFS`, a real per-frame game loop, seamless tilemap wrapping.

### Part 2 — Sprites & interaction
- [Lesson 10: Sprites (OAM) basics](10-sprites-oam-basics.md) — sprite graphics, the OAM table, size/priority attributes.
- [Lesson 11: Controller input & sprite animation](11-controller-input-and-animation.md) — NMI setup, joypad reading, moving and animating a sprite.
- [Lesson 12: Collision detection](12-collision-detection.md) — sprite-vs-sprite (AABB boxes) and sprite-vs-world (a lookup table).

### Part 3 — Audio
- [Lesson 13: The SPC700 & audio basics](13-spc700-and-audio-basics.md) — the second CPU, the boot handshake, making a sound with no SPC700 code.
- [Lesson 14: Music & sound effects](14-music-and-sound-effects.md) — triggering sound effects from gameplay, and a realistic path to real music.

### Part 4 — Wrapping up
- [Lesson 15: Code organization & optimization](15-code-organization-and-optimization.md) — multi-file projects, macros, the V-Blank time budget, ROM banking.
- [Lesson 16: Capstone project](16-capstone.md) — a small playable game combining everything: scrolling background, animated/collidable player sprite, a collectible, and sound.

## Reference resources

- [65816 Reference](https://wiki.superfamicom.org/65816-reference) — full instruction set.
- [SPC700 Reference](https://wiki.superfamicom.org/spc700-reference) — sound CPU instruction set.
- [Registers](https://wiki.superfamicom.org/registers) — every PPU/CPU hardware register, bit by bit.
- [Memory Mapping](https://wiki.superfamicom.org/memory-mapping) — LoROM/HiROM layout details.
- [nesdoug's SNES tutorial series](https://nesdoug.com/2020/03/19/snes-projects/) — a second explanation style for the same topics, ca65-based.
- [nesdoug's SNES example code](https://github.com/nesdoug) — companion repos per lesson.

## Status

All 16 lessons are written. See the [homepage](html/index.html) for the full course
index.
