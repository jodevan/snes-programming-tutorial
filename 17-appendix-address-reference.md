# Appendix: SNES Address & Register Map

A single-page reference for every hardware address this course actually touches,
organized the way the lessons introduced it rather than dumped alphabetically.
Cross-checked against the same code shown in each lesson, not transcribed from
memory — if a value here ever disagrees with a lesson's own code, the lesson's
code is correct and this page has a bug worth reporting.

## Three address spaces, not one

It's easy to assume "the address space" is one thing. This course actually works
across three separate ones, and mixing them up is a real source of confusion:

| Space | Who reads/writes it | Covered in |
|---|---|---|
| **65816 CPU space** | The main CPU — everything through [Lesson 12](12-collision-detection.md) | [Lesson 3](03-memory-map-and-registers.md) |
| **SPC700 / ARAM space** | The sound co-processor's own 64 KB RAM, reachable only through 4 mail-slot bytes | [Lesson 13](13-spc700-and-audio-basics.md) |
| **DSP register space** | The audio chip's 128 one-byte registers, reachable only through the SPC700 boot ROM's `$00F2` trick | [Lesson 13](13-spc700-and-audio-basics.md) |

Every table below is 65816 CPU space unless its heading says otherwise.

## ROM header & vectors — `$00:FFC0`–`$00:FFFF`

The exact byte layout [Lesson 1](01-toolchain-setup-and-first-rom.md)'s `lesson1.asm`
builds, field by field:

| Address | Field | Bytes | Notes |
|---|---|---|---|
| `$FFC0`-`$FFD4` | ROM title | 21 | Space-padded ASCII, cosmetic only |
| `$FFD5` | Map mode | 1 | LoROM/HiROM + fast/slow ROM bit |
| `$FFD6` | Cartridge type | 1 | `$00` = ROM only, this course's ROMs |
| `$FFD7` | ROM size | 1 | `2^n` KB |
| `$FFD8` | RAM size | 1 | `$00` here — no cartridge RAM used |
| `$FFD9` | Region / destination code | 1 | Cosmetic in an emulator |
| `$FFDA` | Fixed / licensee byte | 1 | |
| `$FFDB` | ROM version | 1 | |
| `$FFDC`-`$FFDD` | Checksum complement | 2 | Placeholder (`$0000`) throughout this course |
| `$FFDE`-`$FFDF` | Checksum | 2 | Placeholder (`$0000`) throughout this course |
| `$FFE0`-`$FFE1` | unused (native) | 2 | |
| `$FFE2`-`$FFE3` | unused (native) | 2 | |
| `$FFE4`-`$FFE5` | COP vector (native) | 2 | → `trap` |
| `$FFE6`-`$FFE7` | BRK vector (native) | 2 | → `trap` |
| `$FFE8`-`$FFE9` | ABORT vector (native) | 2 | → `trap` |
| `$FFEA`-`$FFEB` | NMI vector (native) | 2 | → `trap` until [Lesson 11](11-controller-input-and-animation.md) wires up `nmi_handler` |
| `$FFEC`-`$FFED` | unused (reserved) | 2 | |
| `$FFEE`-`$FFEF` | IRQ vector (native) | 2 | → `trap` |
| `$FFF0`-`$FFF1` | unused (emulation) | 2 | |
| `$FFF2`-`$FFF3` | unused (emulation) | 2 | |
| `$FFF4`-`$FFF5` | COP vector (emulation) | 2 | → `trap` |
| `$FFF6`-`$FFF7` | unused (reserved) | 2 | |
| `$FFF8`-`$FFF9` | ABORT vector (emulation) | 2 | → `trap` |
| `$FFFA`-`$FFFB` | NMI vector (emulation) | 2 | → `trap` |
| `$FFFC`-`$FFFD` | **RESET vector (emulation)** | 2 | → `reset` — the only vector every ROM in this course actually depends on at power-on, and the 65816's well-known real hardware RESET location |
| `$FFFE`-`$FFFF` | IRQ/BRK vector (emulation) | 2 | → `trap` |

## WRAM — general-purpose RAM

| Address | Purpose | Lesson |
|---|---|---|
| `$0000`-`$1FFF` | First 8 KB of WRAM, mirrored into every bank's low page (`$00`-`$3F`, `$80`-`$BF`) — where direct-page variables and the stack live | [Lesson 3](03-memory-map-and-registers.md) |
| `$7E0000`-`$7FFFFF` | The full 128 KB WRAM chip, reachable by long address from any bank | [Lesson 3](03-memory-map-and-registers.md) |
| `$2180` `WMDATA` | Indirect WRAM data port — read/write one byte at the address below, auto-incrementing | [Lesson 3](03-memory-map-and-registers.md) |
| `$2181`-`$2183` `WMADDL`/`WMADDM`/`WMADDH` | 17-bit WRAM address for the port above | [Lesson 3](03-memory-map-and-registers.md) |

## VRAM — tile & tilemap data (`$2115`-`$2119`)

| Address | Register | Purpose | Lesson |
|---|---|---|---|
| `$2115` | `VMAIN` | Address-increment mode (after low or high byte, step size) | [Lesson 5](05-tiles-and-vram.md) |
| `$2116` | `VMADDL` | VRAM word address, low byte | [Lesson 5](05-tiles-and-vram.md) |
| `$2117` | `VMADDH` | VRAM word address, high byte | [Lesson 5](05-tiles-and-vram.md) |
| `$2118` | `VMDATAL` | VRAM data, low byte — write triggers the transfer for `VMAIN`'s "low" mode | [Lesson 5](05-tiles-and-vram.md) |
| `$2119` | `VMDATAH` | VRAM data, high byte — write triggers the transfer for `VMAIN`'s default "high" mode | [Lesson 5](05-tiles-and-vram.md) |

## CGRAM — the color palette (`$2121`-`$2122`)

| Address | Register | Purpose | Lesson |
|---|---|---|---|
| `$2121` | `CGADD` | CGRAM color index (0-255) to point at | [Lesson 1](01-toolchain-setup-and-first-rom.md), [Lesson 4](04-palettes-and-cgram.md) |
| `$2122` | `CGDATA` | Color data — write-twice register, low byte then high byte | [Lesson 1](01-toolchain-setup-and-first-rom.md), [Lesson 4](04-palettes-and-cgram.md) |

## OAM — sprite attributes (`$2101`-`$2104`)

| Address | Register | Purpose | Lesson |
|---|---|---|---|
| `$2101` | `OBSEL` | Sprite size selection + VRAM base address for sprite tiles | [Lesson 10](10-sprites-oam-basics.md) |
| `$2102` | `OAMADDL` | OAM address, low byte | [Lesson 10](10-sprites-oam-basics.md) |
| `$2103` | `OAMADDH` | OAM address high bit + priority-rotation flag | [Lesson 10](10-sprites-oam-basics.md) |
| `$2104` | `OAMDATA` | OAM data — auto-increments; low table then high table roll together in one write stream | [Lesson 10](10-sprites-oam-basics.md) |

## PPU control registers actually used (within `$2100`-`$2133`)

| Address | Register | Purpose | Lesson |
|---|---|---|---|
| `$2100` | `INIDISP` | Forced blank (bit 7) + screen brightness (low nibble) | [Lesson 1](01-toolchain-setup-and-first-rom.md) |
| `$2105` | `BGMODE` | Background mode selection (this course uses Mode 1) | [Lesson 6](06-backgrounds-and-tilemaps.md) |
| `$2109` | `BG3SC` | BG3 tilemap base address + map size | [Lesson 6](06-backgrounds-and-tilemaps.md) |
| `$210C` | `BG34NBA` | BG3/BG4 character (tile) data base address | [Lesson 6](06-backgrounds-and-tilemaps.md) |
| `$2111` | `BG3HOFS` | BG3 horizontal scroll — write-twice register | [Lesson 9](09-background-scrolling.md) |
| `$2112` | `BG3VOFS` | BG3 vertical scroll — write-twice register | [Lesson 9](09-background-scrolling.md) |
| `$212C` | `TM` | Enable background/sprite layers on the main screen | [Lesson 6](06-backgrounds-and-tilemaps.md) |
| `$212D` | `TS` | Same bit layout as `TM`, for the subscreen (color-math, not used in this course) | [Lesson 6](06-backgrounds-and-tilemaps.md) exercises |

The full `$2100`-`$2133` block covers many more registers this course doesn't
use directly (mode 7, windowing, color math) — see [Lesson 3](03-memory-map-and-registers.md)
for the general map and the [register reference](https://wiki.superfamicom.org/registers)
for all of them.

## CPU control, status & joypad (`$4200`-`$421F`)

| Address | Register | Purpose | Lesson |
|---|---|---|---|
| `$4200` | `NMITIMEN` | Enable NMI + enable auto-joypad read | [Lesson 11](11-controller-input-and-animation.md) |
| `$420B` | `MDMAEN` | Fire one or more general-purpose DMA channels | [Lesson 8](08-dma-and-hdma.md) |
| `$420C` | `HDMAEN` | Enable one or more HDMA channels | [Lesson 8](08-dma-and-hdma.md) |
| `$4210` | `RDNMI` | NMI flag — must be read inside every NMI handler to acknowledge it | [Lesson 11](11-controller-input-and-animation.md) |
| `$4212` | `HVBJOY` | V-Blank/H-Blank status, polled by the pre-NMI frame loop | [Lesson 9](09-background-scrolling.md) |
| `$4218` | `JOY1L` | Latched controller 1 buttons, low byte (A/X/L/R) | [Lesson 11](11-controller-input-and-animation.md) |
| `$4219` | `JOY1H` | Latched controller 1 buttons, high byte (B/Y/Select/Start/D-pad) | [Lesson 11](11-controller-input-and-animation.md) |
| `$4016`-`$4017` | old-style joypad ports | NES-compatible manual polling; mentioned but not used — auto-joypad read replaces this | [Lesson 3](03-memory-map-and-registers.md) |

## DMA & HDMA channel registers (`$43x0`-`$43xA`, one block per channel `x` = 0-7)

| Address | Register | Purpose | Lesson |
|---|---|---|---|
| `$43x0` | `DMAPx` | Direction, addressing mode, transfer-unit shape, fixed-source bit | [Lesson 8](08-dma-and-hdma.md) |
| `$43x1` | `BBADx` | Destination: low byte of the `$21xx` PPU register to target | [Lesson 8](08-dma-and-hdma.md) |
| `$43x2`-`$43x3` | `A1TxL`/`A1TxH` | Source address, low/high byte | [Lesson 8](08-dma-and-hdma.md) |
| `$43x4` | `A1Bx` | Source address, bank byte | [Lesson 8](08-dma-and-hdma.md) |
| `$43x5`-`$43x6` | `DASxL`/`DASxH` | DMA byte count — or, for *indirect* HDMA, the current indirect-data address | [Lesson 8](08-dma-and-hdma.md) |
| `$43x7` | `DASBx` | Indirect HDMA address bank byte (indirect mode only, not used in this course) | [Lesson 8](08-dma-and-hdma.md) exercises |
| `$43x8`-`$43x9` | `A2AxL`/`A2AxH` | HDMA's current position in its table — hardware-managed, not written directly | [Lesson 8](08-dma-and-hdma.md) |
| `$43xA` | `NLTRx` | HDMA line counter: scanlines remaining until the next table entry loads | [Lesson 8](08-dma-and-hdma.md) |

## Audio: APU ports (65816 side) — `$2140`-`$2143`

| Address | Register | Purpose | Lesson |
|---|---|---|---|
| `$2140`-`$2143` | `APUIO0`-`APUIO3` | Four one-byte mail-slot ports to the SPC700 — the *only* connection between the two CPUs | [Lesson 13](13-spc700-and-audio-basics.md) |

The SPC700 sees the same four ports at `$00F4`-`$00F7` on its own side — same
bytes, different address, because it's a different CPU with a different memory
map entirely.

## Audio: DSP registers (a separate 128-register space, reached via `$00F2`)

Not part of the 65816's memory map at all — these are written by targeting SPC
upload address `$00F2` with the boot ROM's manual-DSP trick, one `(register,
value)` pair per `write_dsp` call. Register numbers below are for voice 0;
[Lesson 14](14-music-and-sound-effects.md) reaches voice *n* by adding `n * $10`
to each per-voice register number.

| Register | Name | Purpose | Lesson |
|---|---|---|---|
| `$4C` | `KON` | Key-on — one bit per voice (0-7) | [Lesson 13](13-spc700-and-audio-basics.md) |
| `$5C` | `KOFF` | Key-off — one bit per voice; needed before a fresh `KON` to *restart* an already-playing voice | [Lesson 13](13-spc700-and-audio-basics.md), [Lesson 14](14-music-and-sound-effects.md) |
| `$6C` | `FLG` | Global flags (echo-buffer write protect, etc.) | [Lesson 13](13-spc700-and-audio-basics.md) |
| `$5D` | `DIR` | Sample directory's ARAM page | [Lesson 13](13-spc700-and-audio-basics.md) |
| `$0C`/`$1C` | `MVOLL`/`MVOLR` | Master volume, left/right | [Lesson 13](13-spc700-and-audio-basics.md) |
| `$00`/`$01` | `VOLL`/`VOLR` (voice 0) | Per-voice volume, left/right | [Lesson 13](13-spc700-and-audio-basics.md) |
| `$02`/`$03` | `PITCHL`/`PITCHH` (voice 0) | Playback rate — `$1000` plays a sample at its recorded pitch | [Lesson 13](13-spc700-and-audio-basics.md) |
| `$04` | `SRCN` (voice 0) | Which sample-directory entry this voice plays | [Lesson 13](13-spc700-and-audio-basics.md) |
| `$05`/`$06` | `ADSR1`/`ADSR2` (voice 0) | Volume envelope: attack/decay (ADSR1), sustain level/rate (ADSR2) | [Lesson 13](13-spc700-and-audio-basics.md), [Lesson 14](14-music-and-sound-effects.md) exercises |

## Sources & further reading

This course's claims about hardware behavior are checked against primary
references, not half-remembered folklore. Every external source cited across
the 16 lessons, and where each one comes up:

### Super Famicom Development Wiki

The main hardware reference this course leans on hardest.

| Page | Covers | Cited in |
|---|---|---|
| [Registers](https://wiki.superfamicom.org/registers) | Every PPU/CPU hardware register, bit by bit — this tutorial's register explanations are all cross-checked against it, and it's the single most useful tab to keep open while working through the course | [Lesson 3](03-memory-map-and-registers.md) (general), [4](04-palettes-and-cgram.md), [6](06-backgrounds-and-tilemaps.md), [8](08-dma-and-hdma.md), [10](10-sprites-oam-basics.md), [11](11-controller-input-and-animation.md) |
| [Backgrounds](https://wiki.superfamicom.org/backgrounds) | BG modes, tilemap format, scrolling behavior | [Lesson 5](05-tiles-and-vram.md), [6](06-backgrounds-and-tilemaps.md), [9](09-background-scrolling.md) |
| [Sprites](https://wiki.superfamicom.org/sprites) | OAM layout, the character-table wrapping rules for multi-tile sprites | [Lesson 10](10-sprites-oam-basics.md) |
| [65816 Reference](https://wiki.superfamicom.org/65816-reference) | Full CPU instruction set | [Lesson 2](02-cpu-crash-course.md) |
| [SPC700 Reference](https://wiki.superfamicom.org/spc700-reference) | Sound CPU instruction set, ADSR envelope bit layout | [Lesson 13](13-spc700-and-audio-basics.md), [14](14-music-and-sound-effects.md) |
| [Memory Mapping](https://wiki.superfamicom.org/memory-mapping) | LoROM/HiROM layout details | [Lesson 3](03-memory-map-and-registers.md) |
| ["Writing to DSP Registers Without any SPC-700 Code"](https://wiki.superfamicom.org/how-to-write-to-dsp-registers-without-any-spc-700-code) | The manual-DSP-write trick [Lesson 13](13-spc700-and-audio-basics.md)'s `write_dsp` code is directly based on | [Lesson 13](13-spc700-and-audio-basics.md) |

### SNESdev Wiki

| Page | Covers | Cited in |
|---|---|---|
| [Booting the SPC700](https://snes.nesdev.org/wiki/Booting_the_SPC700) | The boot handshake protocol `spc_wait_boot`/`spc_begin_upload` follow | [Lesson 13](13-spc700-and-audio-basics.md) |
| [SNESdev Wiki](https://snes.nesdev.org/wiki/SNESdev_Wiki) (general) | Broader hardware/debugging reference — Mode 7, save-data chips, multiplayer, well beyond this course's scope | [Lesson 16](16-capstone.md) |

### Other references

| Source | Covers | Cited in |
|---|---|---|
| [nesdoug's SNES tutorial series](https://nesdoug.com/2020/03/19/snes-projects/) | A second explanation style for the same topics, also ca65-based | Course outline, [Lesson 15](15-code-organization-and-optimization.md) |
| [Mesen debugging docs](https://www.mesen.ca/snes/docs/debugging.md) | Official reference for every tool covered — Debugger, PPU Viewers, Memory Tools, Event Viewer, Trace Logger | [Lesson 7](07-debugging-with-mesen.md) |
| [Terrific Audio Driver](https://github.com/undisbeliever/terrific-audio-driver) | ca65-compatible music/SFX driver, MML-based | [Lesson 14](14-music-and-sound-effects.md) |
| [SNESGSS Extended](https://github.com/NovaSquirrel/snesgss-extended) | ca65-macro-pack-based audio driver, tracker-style editor | [Lesson 14](14-music-and-sound-effects.md) |
| [SNESMOD](https://nesdoug.com/2022/03/02/snesmod/) | ca65-compatible audio driver, `.it` module files | [Lesson 14](14-music-and-sound-effects.md) |

## What's deliberately not here

This page is hardware facts — SNES-defined registers and memory regions that
stay the same no matter what ROM you write. It doesn't include this course's
own direct-page variable choices (`sprite_x`, `scroll_lo`, `wall_x`, and so on,
first assigned in [Lesson 9](09-background-scrolling.md) and
[Lesson 11](11-controller-input-and-animation.md)) — those are this tutorial's
own example code, not SNES architecture, and a different project is free to
lay them out differently.

---

[Home](docs/index.html) |
Previous: [Lesson 16 — Capstone project](16-capstone.md)
