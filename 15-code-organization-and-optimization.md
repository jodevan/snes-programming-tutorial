# Lesson 15: Code Organization & Optimization

**Goal:** everything up to this point has lived in one file with generous
comments — reasonable for a tutorial, unrealistic for a growing project. This
lesson covers splitting code up, reusing patterns with macros, respecting the
hardware's real time budget, and finally using the ROM banks Lesson 1's linker
config reserved but never explained.

## Splitting one file into several

`ca65` supports `.include "filename.s"`, which works exactly like pasting the
named file's contents in place — the assembler still treats everything as one
compilation unit. This is the approach [nesdoug's example
projects](https://nesdoug.com/2020/03/19/snes-projects/) use, and it's the
natural next step once one file starts feeling unwieldy:

```asm
; main.s
.include "regs.s"          ; hardware register address constants
.include "variables.s"     ; direct-page variable definitions
.include "macros.s"        ; reusable macros (see below)
.include "reset.s"         ; reset: and the setup code from Lessons 1-11
.include "gameplay.s"      ; nmi_handler: and the per-frame logic

.segment "VECTORS"
    ; ... unchanged from Lesson 1 ...
```

Each `.s` file can freely reference labels defined in another, as long as
`ca65` sees them all before linking — `.include` guarantees that, since it's
resolved before assembly even starts. (A separate technique — assembling each
file independently with `ca65` and linking multiple `.o` files with `ld65` —
also works, and is closer to how large C/C++ projects are organized, but
requires `.import`/`.export` declarations between files. For a project this
size, `.include` is simpler and is what this tutorial recommends.)

## Macros: naming a pattern instead of repeating it

You've hand-written the same "set an address register, then loop into a data
register" shape at least four times now — CGRAM (Lesson 4), VRAM (Lesson 5),
the tilemap fill (Lesson 6), OAM (Lesson 10). A `.macro` turns a pattern like
that into something you invoke by name:

```asm
.macro write_dsp_reg reg, value
    ldx #(value << 8) | reg
    jsr write_dsp
.endmacro
```

Every `write_dsp` call table from [Lesson 13](13-spc700-and-audio-basics.md)
becomes one line instead of a `ldx`/`jsr` pair:

```asm
    write_dsp_reg $6C, $20    ; FLG
    write_dsp_reg $4C, $00    ; KON
    write_dsp_reg $5C, $FF    ; KOFF
```

Macros cost nothing at runtime — `ca65` expands them inline at assembly time,
identical to writing the `ldx`/`jsr` pair by hand. Use them wherever a pattern
repeats often enough that naming it improves readability; resist the urge to
macro-ize something used only once or twice, where a plain comment does the
job with less indirection to mentally unwind while reading.

## Respecting the V-Blank time budget

Recall [Lesson 3](03-memory-map-and-registers.md#reading-a-register-diagram)'s
register-diagram timing flags — most PPU registers are only safe to write
during forced blank or V-Blank. That window is not infinite. NTSC gives you 38
blanked scanlines out of 262 total, each 1364 master cycles long — about 51,800
master cycles of V-Blank per frame. At the default slowROM CPU speed (8 master
cycles per CPU cycle), that's roughly **6,500 CPU cycles** — before subtracting
the auto-joypad read and your NMI handler's own overhead. Compare that to a
single instruction like `lda $2122` costing 3-4 cycles, and it's clear why
large VRAM/CGRAM/OAM updates lean on DMA (Lesson 8) rather than CPU loops:
DMA's per-byte cost is a fraction of a hand-written loop's, and it's the
difference between an update comfortably fitting in one V-Blank and one that
doesn't, causing visibly torn or delayed graphics.

The practical habits worth building now: do all PPU-touching work at the very
top of `nmi_handler`, before other logic; prefer DMA over CPU loops for
anything more than a handful of bytes; and if you're ever unsure whether an
update is safely finishing inside the window, [Lesson 7](07-debugging-with-mesen.md)'s
Event Viewer shows you directly rather than leaving it to arithmetic.

## Using more than one bank

Lesson 1's linker config deliberately kept things simple: one 32 KB ROM region,
even though the ROM header (`romsize = $07`) claims a full 128 KB. That white
lie was harmless while every lesson's code and data fit comfortably in 32 KB —
but it's worth fixing now, both for correctness and to actually use the
capacity the header claims. Extend `lorom128.cfg` to the full four banks:

```
MEMORY {
    ZEROPAGE:   start =      0, size =  $100;
    BSS:        start =   $200, size = $1800;
    ROM:        start =  $8000, size = $8000, fill = yes;
    BANK1:      start = $18000, size = $8000, fill = yes;
    BANK2:      start = $28000, size = $8000, fill = yes;
    BANK3:      start = $38000, size = $8000, fill = yes;
}

SEGMENTS {
    ZEROPAGE:   load = ZEROPAGE,    type = zp;
    BSS:        load = BSS,         type = bss, align = $100;
    CODE:       load = ROM,         align = $8000;
    RODATA:     load = ROM;
    HEADER:     load = ROM,         start =  $FFC0;
    ROMINFO:    load = ROM,         start =  $FFD5, optional = yes;
    VECTORS:    load = ROM,         start =  $FFE0;

    BANK1:      load = BANK1,       align = $8000, optional = yes;
    BANK2:      load = BANK2,       align = $8000, optional = yes;
    BANK3:      load = BANK3,       align = $8000, optional = yes;
}
```

Anything placed in `.segment "BANK1"` lives in a different physical bank than
your main `CODE` segment — which means [Lesson 2](02-cpu-crash-course.md#6502--65816-whats-actually-new)'s
`JSL`/`RTL` (long call/return) are required to reach it, not the plain
`JSR`/`RTS` you've used everywhere so far:

```asm
.segment "BANK1"
big_table:
    .byte ...     ; a large data table that doesn't need to fit in bank 0

.segment "CODE"
    jsl big_table_lookup   ; must be JSL: big_table_lookup lives in a
                             ; different bank than this call site
```

This is exactly the mistake [Lesson 2](02-cpu-crash-course.md#6502--65816-whats-actually-new)
warned about in the abstract — mixing `JSR`/`RTS` with `JSL`/`RTL` — now with a
concrete reason it happens: code and data spread across banks as a project
grows past 32 KB, and every cross-bank call needs the long form.

## Exercises

1. Split your current single-file ROM into `regs.s`, `variables.s`,
   `reset.s`, and `gameplay.s`, wired together with `.include` from a small
   `main.s`. Confirm it still assembles and runs identically.
2. Write a macro for the "set OAMADD, then write 4 bytes" sprite-record
   pattern from [Lesson 10](10-sprites-oam-basics.md), and use it to
   shorten the hide-loop from that lesson.
3. Using the extended 4-bank config above, move `collision_map` from [Lesson
   12](12-collision-detection.md) into `BANK1`, and update whatever reads it
   to use long addressing. Since `collision_map` is only read, not called as a
   subroutine, think about whether it needs `JSL` or whether a plain long
   address (`lda $18xxxx,x`) is enough — these are not the same requirement.

---

[Home](README.md) |
Previous: [Lesson 14 — Music & sound effects](14-music-and-sound-effects.md)
Next: [Lesson 16 — Capstone project](16-capstone.md)
