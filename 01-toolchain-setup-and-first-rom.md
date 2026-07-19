# Lesson 1: Toolchain Setup & Your First ROM

**Goal:** get `ca65`/`ld65` and Mesen working together, understand what a minimal
SNES ROM file actually contains, and produce a ROM that paints the screen a solid
color. That's it — no graphics engine yet. The point is to prove the whole
write → assemble → link → run loop works before anything else gets layered on top.

## 1. Install the toolchain

You said you already have `asar`, `ca65`, and Mesen installed. Quick way to confirm:

```sh
ca65 --version
ld65 --version
```

If either command isn't found, install (or reinstall) `cc65` via Homebrew:

```sh
brew install cc65
```

That gives you both `ca65` (the assembler) and `ld65` (the linker) — cc65 is a
whole suite (assembler, linker, and a C compiler you won't need for this).

For Mesen, confirm it opens and can load a ROM. Recent Mesen builds are a single
app bundle; if you installed it standalone, the emulator core that matters here is
the SNES core (sometimes labeled Mesen-S in older releases, merged into plain
"Mesen" in current ones).

## 2. What's actually in a SNES ROM file

Before writing code, know what you're building. A `.sfc` file is just a flat
binary blob that gets mapped into the SNES's address space in a specific pattern.
There are two common mapping schemes, **LoROM** and **HiROM** — this tutorial uses
LoROM throughout because it's simpler to reason about and is what most beginner
material (including nesdoug's series) uses.

In LoROM, the cartridge is split into 32 KB chunks, and each chunk is mapped into
the upper half (`$8000`–`$FFFF`) of a CPU bank. So ROM offset `$0000` ends up at
CPU address `$808000`, offset `$8000` at `$818000`, and so on.

Three fixed locations near the end of the first 32 KB chunk matter immediately:

| CPU address | Contents |
|---|---|
| `$80FFC0`–`$80FFD4` | **Header**: 21-byte ROM name (padded with spaces), used by emulators/flash carts for display. |
| `$80FFD5`–`$80FFDF` | **ROM info**: mapping mode, cartridge type, ROM size, RAM size, region, etc. |
| `$80FFE0`–`$80FFFF` | **Vectors**: addresses the CPU jumps to for interrupts and reset, for both native and emulation mode. |

The only vector we care about right now is the **native-mode reset vector**
(the last word in that table). When you power on the SNES, the 65816 starts in
6502-compatible "emulation mode" and immediately reads the *emulation-mode* reset
vector at `$80FFFC`. Our reset code switches the CPU into native mode within its
first few instructions, so from then on the *native* vectors apply — but the
initial jump-in point is always emulation-mode reset. We'll write our reset
routine there and it will handle the mode switch itself.

You don't need to memorize this table — you'll come back to it. The point is: a
SNES ROM isn't "code that starts at address 0." It's a binary with specific bytes
at specific offsets that the hardware reads before your code ever runs.

## 3. The linker config

`ld65` needs to know how to lay out those regions. Create `lorom128.cfg`:

```
# lorom128.cfg — ca65 linker config for a 128KB LoROM SNES ROM.

MEMORY {
    ZEROPAGE:   start =      0, size =  $100;
    BSS:        start =   $200, size = $1800;
    ROM:        start =  $8000, size = $8000, fill = yes;
}

SEGMENTS {
    ZEROPAGE:   load = ZEROPAGE,    type = zp;
    BSS:        load = BSS,         type = bss, align = $100;

    CODE:       load = ROM,         align = $8000;
    RODATA:     load = ROM;
    HEADER:     load = ROM,         start = $FFC0;
    ROMINFO:    load = ROM,         start = $FFD5, optional = yes;
    VECTORS:    load = ROM,         start = $FFE0;
}
```

Read this as: "here are the physical memory regions (`MEMORY`), and here are the
named buckets of code/data (`SEGMENTS`) that get poured into them." `ZEROPAGE` and
`BSS` are RAM (they don't end up *in* the ROM file — they're just reserved
addresses for variables). `HEADER`, `ROMINFO`, and `VECTORS` are pinned to the
exact offsets from the table above. We're keeping this to a single 32 KB bank for
now; later lessons extend it to more banks once we need more room for graphics
data.

## 4. The ROM itself

Create `lesson1.asm`:

```asm
; ============================================================
; Lesson 1: minimal SNES ROM — fills the screen with one color.
;
; Build:
;   ca65 lesson1.asm -o lesson1.o
;   ld65 -C lorom128.cfg -o lesson1.sfc lesson1.o
; ============================================================

.p816                   ; assemble for the 65816 instruction set
.i16                    ; reminder: X/Y start out 16-bit after our init code
.a8                     ; reminder: A will be 8-bit after our init code

; ------------------------------------------------------------
; Header: 21-byte ROM title, space-padded. Purely cosmetic —
; shown by emulators/flash carts, ignored by the hardware.
; ------------------------------------------------------------
.segment "HEADER"
    .byte "LESSON 1 TUTORIAL    "  ; must be exactly 21 bytes

; ------------------------------------------------------------
; ROM info block. Byte-by-byte:
; ------------------------------------------------------------
.segment "ROMINFO"
    .byte $20      ; map mode: LoROM, slow ROM (bit4 set = fast; we leave it slow/safe)
    .byte $00      ; cartridge type: $00 = ROM only, no extra chips
    .byte $07      ; ROM size: 2^$07 KB = 128 KB
    .byte $00      ; RAM size: none
    .byte $01      ; destination/region code: $01 = USA/NTSC (cosmetic here)
    .byte $00      ; fixed / licensee byte
    .byte $00      ; ROM version / revision
    .word $0000    ; checksum complement (placeholder — real carts need this
                    ;   computed correctly; emulators don't care)
    .word $0000    ; checksum (placeholder, same note as above)

; ------------------------------------------------------------
; Interrupt/reset vectors. We only fill in what we use; the
; rest point at a "do nothing forever" trap for safety, so
; that if the CPU ever jumps somewhere we didn't expect, it
; halts visibly instead of running garbage.
; ------------------------------------------------------------
.segment "VECTORS"
    ; --- Native mode vectors (used once we've switched out of
    ;     emulation mode, which our reset code does immediately) ---
    .word $0000    ; unused
    .word $0000    ; unused
    .word trap     ; COP
    .word trap     ; BRK
    .word trap     ; ABORT
    .word trap     ; NMI  (vertical blank interrupt — unused for now)
    .word $0000    ; unused (reserved)
    .word trap     ; IRQ

    ; --- Emulation mode vectors (this is what the CPU actually
    ;     reads on power-on / reset, before our code runs) ---
    .word $0000    ; unused
    .word $0000    ; unused
    .word trap     ; COP (emulation)
    .word $0000    ; unused (reserved)
    .word trap     ; ABORT (emulation)
    .word trap     ; NMI (emulation)
    .word reset    ; RESET — this is the one that matters at power-on
    .word trap     ; IRQ/BRK (emulation)

; ------------------------------------------------------------
; Code
; ------------------------------------------------------------
.segment "CODE"

reset:
    sei             ; disable interrupts while we set things up
    clc             ; clear carry...
    xce             ; ...then exchange carry with emulation flag:
                     ;   this is the standard idiom that switches the
                     ;   65816 from 6502-compatible emulation mode
                     ;   into full native 16-bit-capable mode.

    rep #$10        ; REP = "reset processor status bits" — clears bits
                     ;   in the flag register. Bit 4 (X) controls
                     ;   X/Y register width; clearing it makes X/Y 16-bit.
    sep #$20        ; SEP = "set processor status bits". Bit 5 (M)
                     ;   controls the A register width; setting it makes
                     ;   A 8-bit. Mixed 16-bit index / 8-bit accumulator
                     ;   is the most common working mode for SNES code.
    .a8
    .i16

    ldx #$1FFF      ; set up the stack pointer — SNES RAM is $0000-$1FFF
    txs             ;   in bank 0, so $1FFF is the top of low RAM.

    ; --- Reset every PPU and DMA register to a known state. ---
    ; On power-on these registers can contain garbage. Rather than
    ; hand-initialize the ones we care about and hope the rest don't
    ; matter, we zero the whole block. $2100-$2133 is  the PPU/CGRAM
    ; register window; $4200-$421F is CPU/DMA control.
    ldx #$33
clear_regs:
    stz $2100,x
    stz $4200,x
    dex
    bpl clear_regs

    ; --- Set the background color (CGRAM entry 0) to blue. ---
    ; CGRAM holds the SNES's palette memory: 256 entries, each a
    ; 15-bit BGR color (5 bits per channel, top bit unused).
    ; With no background layers or sprites turned on (which we
    ; haven't touched yet), the screen just shows palette entry 0
    ; directly — it's the simplest possible visual proof that code
    ; is running.
    stz $2121       ; CGADD: set the CGRAM write address to entry 0
    lda #$00        ; low byte of color $7C00 (blue): gggrrrrr = 00000000
    sta $2122       ; CGDATA — first write is the low byte
    lda #$7C        ; high byte: -bbbbbgg = 01111100 (blue = 11111, top bit 0)
    sta $2122       ; CGDATA — second write is the high byte

    ; --- Turn the screen on. ---
    ; $2100 (INIDISP): bit 7 = forced blank (1 = screen off, ignore
    ; everything else). Low nibble = brightness, 0-$0F.
    lda #$0F        ; forced blank OFF, full brightness
    sta $2100

forever:
    jmp forever     ; nothing left to do — spin here.

; A landing pad for any vector we didn't wire up to real code.
; If you ever see the screen do something unexpected and suspect
; a stray interrupt, this is what lets you notice: put a break-
; point on `trap` in Mesen's debugger and see if it gets hit.
trap:
    jmp trap
```

A few things worth pausing on, since they're easy to skim past:

- **`rep`/`sep` and the `.a8`/`.i16` directives are two different things.**
  `rep #$10` / `sep #$20` are real 65816 instructions — they change the CPU's
  actual register widths at runtime. `.a8` / `.i16` are assembler directives that
  tell *ca65* what width to assume when it encodes instructions after that point
  (so `lda #$0F` gets assembled as an 8-bit immediate load, not a 16-bit one).
  Get these out of sync — tell the assembler `.a16` while the CPU is actually in
  8-bit mode — and you'll get corrupted, hard-to-diagnose bugs. Lesson 2 covers
  this in depth; for now, just notice the pattern: change the CPU, then
  immediately tell the assembler to match.

- **Why $001F vs $7C00 for colors** — a SNES color is 15 bits, laid out
  `-bbbbbgg gggrrrrr` across two bytes. Pure red is `$001F` (all 5 red bits set),
  pure green is `$03E0`, pure blue is `$7C00`. We used blue here — try changing it
  and re-assembling once you're set up.

- **The placeholder checksum.** Real cartridges need a correct checksum/
  complement pair or some hardware (and picky emulators) will refuse to boot.
  Mesen doesn't care, so we're leaving it as `$0000`/`$0000` for now.
  You'll fix this properly once you're closer to a real release — it's not worth
  the complexity this early.

## 5. Build and run

```sh
ca65 lesson1.asm -o lesson1.o
ld65 -C lorom128.cfg -o lesson1.sfc lesson1.o
```

If both commands complete with no output, it worked — `ca65`/`ld65` are silent on
success. Open `lesson1.sfc` in Mesen. You should see a solid blue screen.

**Troubleshooting:**

- *Mesen shows black, or shows nothing:* Use File → Open (or Reload from file) —
  not double-clicking the ROM again while Mesen is already open, which can reload
  a cached save state instead of the fresh binary. This trips people up
  constantly and is worth remembering for every lesson from here on.
- *`ca65` reports a segment or range error:* almost always means a segment in the
  `.asm` file doesn't match `lorom128.cfg`, or the total code overflowed 32 KB
  (won't happen here, but will eventually — that's what the multi-bank config in
  later lessons is for).
- *Screen shows a color, but the wrong one:* double check the byte order — CGDATA
  writes are low byte first, then high byte, and it's easy to swap them.

## What you just built

A ROM with a correct header, a reset vector the hardware can actually find, a CPU
mode switch, cleared hardware state, and one visible side effect. That's the
skeleton every later lesson builds on — Lesson 3 onward will replace the "solid
color" step with real backgrounds and sprites, but the setup code above barely
changes.

## Exercises

1. Change the background color to something else using the BGR table in the
   comments above. Re-assemble, reload in Mesen, confirm it changed.
2. Try setting `$2100` brightness to `$00` instead of `$0F` — confirm the screen
   goes dark even though the color is still set in CGRAM. This previews why
   "forced blank" exists: it lets you update VRAM/CGRAM/OAM safely without the PPU
   reading them mid-update, which matters a lot once real graphics are involved.
3. Deliberately break something — comment out the `xce` line and try to
   re-assemble/run. Note what happens (or doesn't) so you have a feel for what a
   "stuck in emulation mode" failure looks like before it happens by accident
   later.

## Appendix A: the same ROM in asar (for comparison)

Since you have asar installed too, here's the equivalent in asar's syntax — note
it's a single file, no separate linker config, because asar infers the layout
from `lorom` and directive-based placement:

```asm
; lesson1_asar.asm
lorom

org $00FFC0
db "LESSON 1 TUTORIAL   "     ; 21-byte header

org $00FFD5
db $20, $00, $07, $00, $01, $00, $00
dw $0000, $0000               ; checksum placeholders

org $00FFE0
dw $0000, $0000, trap, trap, trap, trap, $0000, trap   ; native vectors
dw $0000, $0000, trap, $0000, trap, trap, reset, trap  ; emulation vectors

org $008000
reset:
    sei
    clc
    xce
    rep #$10
    sep #$20
    ldx #$1FFF
    txs
    ldx #$33
.clear_regs:
    stz $2100,x
    stz $4200,x
    dex
    bpl .clear_regs
    stz $2121
    lda #$00
    sta $2122
    lda #$7C
    sta $2122
    lda #$0F
    sta $2100
forever:
    jmp forever
trap:
    jmp trap
```

Build with a single command: `asar lesson1_asar.asm lesson1_asar.sfc`. We won't
maintain this asar version past Lesson 1 — it's here purely so you can see how the
same concepts map onto the other toolchain if you're curious.

---

[Home](docs/index.html) |
Next: [Lesson 2 — The 65816 CPU crash course](02-cpu-crash-course.md)
