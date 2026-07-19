# Lesson 8: DMA & HDMA Deep Dive

**Goal:** replace the CPU loops from Lessons [4](04-palettes-and-cgram.md)-[6](06-backgrounds-and-tilemaps.md)
with hardware DMA transfers, then use HDMA to do something a CPU loop
fundamentally can't: change a register in the middle of the screen, once per
scanline, for free.

## DMA: let the hardware do the loop

Every "set an address register, then loop writing to a data register" pattern
from Lessons 4-6 is exactly what DMA (Direct Memory Access) automates. You set
up a source, a destination, a count, and a transfer shape, flip one bit, and the
hardware moves the bytes — the CPU is paused for the duration, but no
instructions execute the copy.

There are 8 independent DMA channels, each controlled by a block of registers at
`$43x0`-`$43xA` (`x` = channel number 0-7):

| Register | Address | Purpose |
|---|---|---|
| `DMAPx` | `$43x0` | Direction, addressing mode, increment/fixed, transfer shape |
| `BBADx` | `$43x1` | Destination: low byte of the `$21xx` register to target |
| `A1TxL/H` | `$43x2`/`$43x3` | Source address, low/high byte |
| `A1Bx` | `$43x4` | Source address, bank byte |
| `DASxL/H` | `$43x5`/`$43x6` | Number of bytes to transfer |

`DMAPx`'s transfer-shape bits (`ttt`) matter a lot — they decide how source
bytes map onto destination registers per "unit" of the transfer. The three this
lesson uses:

```
000 = 1 register write once   (1 byte : p)
001 = 2 registers write once  (2 bytes: p, p+1)
010 = 1 register write twice  (2 bytes: p, p)
```

Mode `010` is a natural fit for CGDATA's low-then-high write pattern; mode `001`
is a natural fit for `VMDATAL`/`VMDATAH` (two adjacent single-byte registers).
You've already learned both of those write patterns by hand — DMA is the same
shape, executed by hardware.

## Rewriting the palette load

Lesson 4's `load_palette` loop becomes:

```asm
    stz $2121           ; CGADD: still need to set the starting index by hand

    lda #<palette_table
    sta $4302            ; A1T0L
    lda #>palette_table
    sta $4303            ; A1T0H
    lda #^palette_table
    sta $4304            ; A1B0 (bank byte)
    lda #(PALETTE_COUNT*2)
    sta $4305             ; DAS0L: byte count, low
    stz $4306              ; DAS0H: byte count, high (0 since count < 256)

    lda #%00000010         ; DMAP0: CPU->PPU, incrementing source, mode 010
    sta $4300
    lda #$22                ; BBAD0: target $2122 (CGDATA)
    sta $4301

    lda #$01                 ; MDMAEN: fire channel 0
    sta $420B
```

`^palette_table` is ca65 syntax for "the bank byte of this label's address" —
new here because DMA source addresses are full 24-bit addresses, unlike the
absolute addressing you've used up to now.

## Rewriting the tile load

Same shape, mode `001` this time, since `VMDATAL`/`VMDATAH` are two separate
adjacent registers rather than one write-twice register:

```asm
    lda #$80
    sta $2115            ; VMAIN (unchanged from Lesson 5)
    stz $2116
    stz $2117             ; VMADDL/H: word address 0 (unchanged)

    lda #<tile_stripe
    sta $4302
    lda #>tile_stripe
    sta $4303
    lda #^tile_stripe
    sta $4304
    lda #(tile_stripe_end - tile_stripe)
    sta $4305
    stz $4306

    lda #%00000001          ; DMAP0: CPU->PPU, incrementing source, mode 001
    sta $4300
    lda #$18                 ; BBAD0: target $2118 (VMDATAL, then VMDATAH)
    sta $4301

    lda #$01
    sta $420B
```

## A DMA trick: filling memory without a big table

Lesson 6's tilemap loop wrote the same value (`$0000`) 1024 times. Copying a
1024-entry source table would be wasteful when every entry is identical — and
DMA has a bit for exactly this case. `DMAPx` bit 4 (`f`, "fixed transfer") stops
the *source* address from advancing at all, so every byte transferred rereads
the same one source byte:

```asm
zero_byte:
    .byte 0

    ; ... (VMADDL/H already point at the tilemap's VRAM location)

    lda #<zero_byte
    sta $4302
    lda #>zero_byte
    sta $4303
    lda #^zero_byte
    sta $4304
    lda #<2048               ; 1024 words = 2048 bytes total
    sta $4305
    lda #>2048
    sta $4306

    lda #%00010001            ; DMAP0: fixed source (bit 4 set), mode 001
    sta $4300
    lda #$18                   ; BBAD0: $2118/$2119 again
    sta $4301

    lda #$01
    sta $420B
```

One byte of ROM, one DMA call, 2048 bytes written. This "DMA fill" idiom shows
up constantly in real SNES code for clearing VRAM, OAM, or WRAM buffers.

Swap all three loops in your ROM for their DMA equivalents, rebuild, and confirm
in Mesen that the screen looks exactly as it did at the end of Lesson 6 — same
visual result, far less CPU time spent producing it. If you want to see this
concretely rather than take it on faith, [Lesson 7](07-debugging-with-mesen.md)'s
Event Viewer will show the DMA transfers as a single tight burst instead of the
long scattered sequence of individual writes the CPU-loop versions produced.

## HDMA: a register write, once per scanline, automatically

DMA runs once and stops. **HDMA** (H-Blank DMA) is different: instead of
transferring a block once, it performs one small transfer *per scanline*,
automatically, for the whole frame, with zero CPU involvement once it's set up.
This is how the SNES achieves effects a CPU could never keep up with by hand —
per-scanline color changes, split scrolling, and gradients.

HDMA channels use the same register block as DMA (`$43x0`-`$43xA`), just
interpreted slightly differently, plus one new register:

| Register | Address | Purpose |
|---|---|---|
| `A2AxL/H` | `$43x8`/`$43x9` | Current position in the HDMA table (auto-managed) |
| `NLTRx` | `$43xA` | Line counter: how many scanlines until the next table entry loads |

An HDMA table is a sequence of `(line count byte, data bytes...)` groups,
terminated by a `$00` count byte. Each count byte's top bit is a "repeat" flag
(re-send the same data every line while counting down, rather than once); this
lesson uses it clear (`0`) for a simple **banded** effect — one write, held for
N scanlines, then the next entry.

### A brightness gradient

Let's fade the whole screen from bright to dark, top to bottom, by driving
`INIDISP` (`$2100` — the same brightness register from Lesson 1) with HDMA
instead of a fixed value. 16 bands of 14 scanlines each cover all 224 visible
lines:

```asm
hdma_gradient:
    .byte 14, $0F
    .byte 14, $0E
    .byte 14, $0D
    .byte 14, $0C
    .byte 14, $0B
    .byte 14, $0A
    .byte 14, $09
    .byte 14, $08
    .byte 14, $07
    .byte 14, $06
    .byte 14, $05
    .byte 14, $04
    .byte 14, $03
    .byte 14, $02
    .byte 14, $01
    .byte 14, $00
    .byte 0             ; terminator
```

Set up channel 1 (kept separate from the DMA channel 0 used above, to avoid any
confusion between the two) for a single-register, write-once transfer targeting
`INIDISP`:

```asm
    lda #<hdma_gradient
    sta $4312             ; A1T1L
    lda #>hdma_gradient
    sta $4313              ; A1T1H
    lda #^hdma_gradient
    sta $4314               ; A1B1

    lda #%00000000            ; DMAP1: direct table, mode 000 (1 byte)
    sta $4310
    lda #$00                   ; BBAD1: target $2100 (INIDISP)
    sta $4311

    lda #%00000010               ; HDMAEN: enable channel 1
    sta $420C
```

Do this *instead of* the final fixed `lda #$0F / sta $2100` from Lesson 1 —
HDMA will drive `INIDISP` for you, every scanline, from here on, automatically
re-reading the table from the top at the start of every frame. Build and run:
you should see the striped background fade from full brightness at the top of
the screen to black at the bottom, a clean 16-step gradient, with no CPU time
spent after the initial setup.

The exact scanline-by-scanline timing of when a table entry's data is
(re-)transferred relative to the line-counter reload has some genuinely
subtle edge cases — even the [authoritative register
reference](https://wiki.superfamicom.org/registers#dasxl-dma-sizehdma-indirect-address-low-byte-x0-7-1101)
hedges some of the fine print here. The banded-gradient recipe above is a
long-established, reliable pattern; if you start building effects with
per-scanline (rather than per-band) precision, budget time to test against real
hardware behavior in Mesen rather than trusting a mental model alone — and
revisit [Lesson 7](07-debugging-with-mesen.md)'s Event Viewer, which is the
right tool for watching exactly when each HDMA write actually lands.

## Exercises

1. Change the gradient table to fade in the *opposite* direction (dark at top,
   bright at bottom) by reversing the byte sequence.
2. `DASxL`/`DASxH` for a *DMA* channel count down as the transfer runs, ending
   at 0. What do those same registers mean for an *indirect* HDMA channel
   instead? (See the [DASx register
   entry](https://wiki.superfamicom.org/registers#dasxl-dma-sizehdma-indirect-address-low-byte-x0-7-1101) —
   this tutorial only uses direct HDMA, but it's worth knowing indirect mode
   exists.)
3. Using the DMA fill trick, write a routine that clears all 544 bytes of OAM
   (sprite memory) to zero in one DMA call, in preparation for [Lesson
   10](10-sprites-oam-basics.md).

---

[Home](docs/index.html) |
Previous: [Lesson 7 — Debugging with Mesen](07-debugging-with-mesen.md)
Next: [Lesson 9 — Background scrolling](09-background-scrolling.md)
