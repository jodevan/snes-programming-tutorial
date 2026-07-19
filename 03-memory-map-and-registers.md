# Lesson 3: SNES Memory Map & Hardware Registers

**Goal:** build a mental map of where everything lives — WRAM, VRAM, CGRAM, OAM,
and the register windows that control them — before touching graphics. Every
lesson from here on points back at this one, so it's worth reading slowly even
though there's no new ROM to assemble yet.

## Four kinds of memory, four different doors

The SNES doesn't have one flat memory space the CPU can freely read and write.
It has several physically separate memory chips, and the 65816 can only reach
most of them indirectly, through small "porthole" registers. Getting this
straight now saves a lot of confusion later — "why can't I just `LDA` a VRAM
address?" is one of the most common beginner questions, and the answer is simply
that VRAM isn't wired to the CPU's address bus at all.

| Memory | Size | Holds | How the CPU reaches it |
|---|---|---|---|
| **WRAM** | 128 KB | General-purpose RAM — variables, stacks, buffers | Directly, as real addresses (see below) |
| **VRAM** | 64 KB | Tile graphics data and tilemaps | Indirectly, through `$2115`-`$2119` |
| **CGRAM** | 512 bytes | The color palette (256 entries × 15-bit color) | Indirectly, through `$2121`-`$2122` |
| **OAM** | 544 bytes | Sprite attributes (position, tile, palette, flags) | Indirectly, through `$2102`-`$2104` |

WRAM is the odd one out — it's the only one of the four the CPU can address like
normal memory. VRAM, CGRAM, and OAM are only reachable by writing an address into
one register and a value into another, one step removed from the CPU. This
lesson introduces where each one is and what its register window looks like;
Lessons [4](04-palettes-and-cgram.md), [5](05-tiles-and-vram.md), and
[9](10-sprites-oam-basics.md) each come back and go deep on one of them.

## WRAM: the CPU's real address space

WRAM is 128 KB, mapped at `$7E0000`-`$7FFFFF`. But you'll rarely write a long
address like `$7E1234` in practice, because the *first 8 KB* of that space —
`$7E0000`-`$7E1FFF` — is additionally **mirrored** at `$0000`-`$1FFF` in banks
`$00`-`$3F` and `$80`-`$BF`. That's why Lesson 1's stack setup worked with a
short address:

```asm
    ldx #$1FFF      ; top of the WRAM mirror visible in bank 0
    txs
```

Bank 0's `$0000`-`$1FFF` and the "real" WRAM at `$7E0000`-`$7E1FFF` are the exact
same physical bytes — writing one changes what you'd read from the other. This
mirroring is why direct-page addressing (see [Lesson 2](02-cpu-crash-course.md#direct-page-addressing))
works so naturally for variables: as long as your data fits in that first 8 KB,
you never need a long address to reach it.

If you need WRAM beyond that first 8 KB — the rest of the 128 KB chip — there's
a second path: registers `$2180`-`$2183` (`WMDATA`/`WMADDL`/`WMADDM`/`WMADDH`) let
you set a 17-bit WRAM address and then read/write it one byte at a time through
`$2180`, auto-incrementing after each access. This is slower than direct
addressing (and, notably, it's how Lesson 8's DMA engine reaches WRAM beyond
`$1FFF` without needing `DBR` pointed anywhere unusual), but it works from any
bank without touching `DBR`.

## VRAM, CGRAM, and OAM: three "porthole" devices

These three all follow the same pattern: an **address register**, a **data
register**, and (usually) auto-increment on write. You'll recognize this pattern
immediately because Lesson 1 already used it for CGRAM:

```asm
    stz $2121       ; CGADD:  "point at palette entry 0"
    lda #$00
    sta $2122       ; CGDATA: "write this byte, then advance"
    lda #$7C
    sta $2122       ; CGDATA: second byte of the same color, advances again
```

VRAM (`$2115`-`$2119`) and OAM (`$2102`-`$2104`) work the same way, just with
different register names and slightly different quirks — OAM in particular
has an odd "buffered pair" write behavior that Lesson 10 covers in detail. The
important thing to internalize now: **whenever you see code repeatedly writing
to one "data" register in a loop, it's almost always streaming bytes into one of
these three memories**, with the matching "address" register set up once
beforehand.

## The register windows

Address Bus B — the window the CPU uses to reach the PPU, the APU communication
ports, and DMA — lives entirely inside `$2100`-`$21FF` and `$4200`-`$43FF` of bank
0 (mirrored into bank `$80` too, since `DBR` is usually `$00` or `$80` in this
tutorial's code). Here's the map worth bookmarking:

| Range | What's there | Covered in |
|---|---|---|
| `$2100`-`$2133` | PPU control: screen, backgrounds, VRAM/CGRAM ports, scrolling | Lessons [4](04-palettes-and-cgram.md), [5](05-tiles-and-vram.md), [6](06-backgrounds-and-tilemaps.md), [8](09-background-scrolling.md) |
| `$2134`-`$213F` | PPU status/results: multiplication result, OAM/VRAM/CGRAM readback, scanline position | as needed |
| `$2140`-`$2143` | APU (SPC700) communication ports | Lessons [12](13-spc700-and-audio-basics.md)-[13](14-music-and-sound-effects.md) |
| `$2180`-`$2183` | Indirect WRAM access port | this lesson, and DMA in Lesson [7](08-dma-and-hdma.md) |
| `$4016`-`$4017` | Old-style (NES-compatible) joypad access | rarely used directly — see Lesson [10](11-controller-input-and-animation.md) |
| `$4200`-`$420D` | CPU control: NMI/IRQ enable, math unit, DMA enable, ROM speed | Lessons [7](08-dma-and-hdma.md), [10](11-controller-input-and-animation.md) |
| `$4210`-`$4213` | CPU status: NMI/IRQ flags, auto-joypad status | Lesson [10](11-controller-input-and-animation.md) |
| `$4214`-`$4217` | Hardware multiply/divide results | not covered in depth in this tutorial |
| `$4218`-`$421F` | Latched joypad button states (auto-read) | Lesson [10](11-controller-input-and-animation.md) |
| `$4300`-`$437F` | DMA/HDMA channel registers (8 channels × 16 bytes each) | Lesson [7](08-dma-and-hdma.md) |

This table is deliberately dense — you're not meant to memorize it, you're meant
to recognize it later. When a future lesson introduces `$210D` out of nowhere,
you'll know to think "that's in the PPU control block, probably a background
register" before even reading what it does.

The full bit-level breakdown of every register here lives on the [Super Famicom
Development Wiki's Registers page](https://wiki.superfamicom.org/registers) —
this tutorial's register explanations are all cross-checked against it, and it's
the single most useful tab to keep open while you work through the rest of this
course.

### Reading a register diagram

The reference wiki (and this tutorial) describes registers with compact bit
diagrams like this one, for `BGMODE`:

```
$2105  wb+++-
        DCBAemmm
```

The first line is metadata: `w` means writable, `b` means it's a plain byte
register (as opposed to a word split across two addresses), and the four
symbols after that (`+++-`) indicate whether it's safe to write during
h-blank/v-blank/forced-blank/any-time. The second line is the bit layout,
read left to right from bit 7 down to bit 0. So `DCBAemmm` means: bits 7-4 are
individual flags D, C, B, A; bit 3 is `e`; bits 2-0 together form `mmm`. Once
this notation clicks, the entire register reference becomes readable at a
glance — you'll see this exact format constantly starting in Lesson 4.

## Why DBR matters here

Recall from [Lesson 2](02-cpu-crash-course.md#absolute-a-full-16-bit-address-in-the-current-data-bank)
that plain absolute addressing (`lda $2122`) resolves against whatever `DBR`
currently holds. Every register access in this tutorial works because Lesson 1's
reset code leaves `DBR` at `$00`, and `$2100`-`$21FF`/`$4200`-`$43FF` are
identically mirrored in bank `$00` and bank `$80`. If you ever write code that
runs from a different bank with `DBR` pointed elsewhere, register writes like
`sta $2122` will silently go to the wrong place — this is a real bug that
shows up once projects grow past a single bank, so it's worth remembering this
dependency exists even though it won't bite you yet.

## Exercises

1. Without looking it up, guess which memory (WRAM, VRAM, CGRAM, or OAM) each of
   these would live in: a player's health value; a background tilemap; the color
   of palette entry 5; a sprite's X position. Check your answers against the
   table at the top of this lesson.
2. Read the `OAMADDL`/`OAMADDH` entry on the [Registers
   page](https://wiki.superfamicom.org/registers#oamaddl-oam-address-low-byte-214)
   and, using only the reading-a-register-diagram technique above, figure out
   which bit of `$2103` is the "OAM priority rotation" bit before reading the
   prose explanation underneath. (Lesson 10 uses this.)
3. Explain in your own words why `lda $7E1234` and `lda $1234` (executed from
   bank `$00`) read the same byte, but `lda $7E2000` and `lda $2000` do not.

---

[Home](README.md) |
Previous: [Lesson 2 — The 65816 CPU crash course](02-cpu-crash-course.md)
Next: [Lesson 4 — Palettes & CGRAM](04-palettes-and-cgram.md)
