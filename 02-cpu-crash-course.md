# Lesson 2: The 65816 CPU Crash Course

**Goal:** understand the CPU well enough that the rest of the tutorial's code stops
looking like magic incantations. You don't need to memorize every opcode — you
need a mental model of the registers, the two operating modes, and the addressing
modes you'll actually use.

If you've never touched 6502/65816 assembly before, read this lesson slowly and
try the exercises. If you *have* written 6502 code before, skim the register table
and go straight to [6502 → 65816: what's actually new](#6502--65816-whats-actually-new)
— that's the section that will save you from the bugs experienced 6502 programmers
tend to hit.

## The registers

| Register | Name | What it's for |
|---|---|---|
| `A` | Accumulator | The math register — one operand and the result of most arithmetic/logic. |
| `X`, `Y` | Index registers | Loop counters, and offsets for indexed addressing (`LDA table,X`). |
| `S` | Stack pointer | Points at the next free stack byte. Always 16-bit. |
| `D` (or `DP`) | Direct page register | See [Direct page](#direct-page-addressing) below. |
| `DBR` (or `DB`) | Data bank register | The default bank for absolute (non-long) memory access. |
| `PBR` (or `PB`) | Program bank register | The bank instructions are fetched from. |
| `P` | Processor status | Flag bits — see next table. |
| `PC` | Program counter | Address of the current instruction, within `PBR`. |

`A`, `X`, and `Y` are the ones you'll touch constantly. `D`, `DBR`, and `PBR` you
set up once during init (Lesson 1's `reset` routine already touches `D` implicitly
by leaving it at its power-on value of `$0000`, which is why direct-page addresses
in that code map straight onto low RAM).

### Flags in the `P` register

| Flag | Bit | Meaning |
|---|---|---|
| N | `$80` | Negative |
| V | `$40` | Overflow |
| **M** | `$20` | **Accumulator width** (native mode only): 0 = 16-bit, 1 = 8-bit |
| **X** | `$10` | **Index register width** (native mode only): 0 = 16-bit, 1 = 8-bit |
| D | `$08` | Decimal mode (BCD arithmetic — SNES code essentially never uses this) |
| I | `$04` | IRQ disable |
| Z | `$02` | Zero |
| C | `$01` | Carry |
| E | — | Emulation mode (not part of the visible flag byte, but conceptually here) |

The two flags that matter most for day-to-day SNES coding are **M** and **X** —
they're not just status, they *change what the CPU physically does* with `A`, `X`,
and `Y`. That's the next section.

## Two CPUs in one: emulation vs. native mode

The 65816 is a 65C02 (an enhanced 6502) that can switch into a genuinely different
16-bit-capable mode. On power-on, it's always in **emulation mode** — behaves like
a 6502, `A`/`X`/`Y` are 8-bit, stack is fixed to page `$01xx`. Lesson 1's reset
code switches to **native mode** in its first few instructions:

```asm
    clc
    xce             ; the standard idiom: swap carry with the emulation flag.
                     ; carry was cleared above, so this clears E — native mode.
```

Once in native mode, `A`, `X`, and `Y` *still start out 8-bit* — native mode
doesn't automatically mean 16-bit, it means the CPU now lets you *choose*, via the
M and X flags. That's what `REP`/`SEP` are for:

```asm
    rep #$10        ; REP = clear these bits in P. #$10 = the X flag → X/Y become 16-bit.
    sep #$20        ; SEP = set these bits in P.   #$20 = the M flag → A becomes 8-bit.
```

You can mix widths — 8-bit `A` with 16-bit `X`/`Y` (as in Lesson 1) is the single
most common configuration in SNES code, because palette/tile data is naturally
byte-sized while indices into large tables benefit from 16-bit range. But you can
just as easily run `rep #$30` to make *both* `A` and `X`/`Y` 16-bit — you'll do
that whenever you're working with 16-bit values directly, like writing a 16-bit
VRAM address or a word-sized game variable.

### Why this is the #1 source of 65816 bugs

The assembler doesn't know the CPU's actual register width — it only knows what
*you* told it via `.a8`/`.a16` and `.i8`/`.i16` directives. If those directives
say one thing and the CPU is actually in a different mode, `ca65` will happily
assemble a 1-byte immediate load when you meant 2 bytes (or vice versa), and every
instruction after it reads misaligned operands. This produces bugs that look
utterly unrelated to the actual mistake — a value three lines later is garbage,
or the program jumps into the middle of an instruction.

```asm
    sep #$20        ; A is now 8-bit at runtime
    .a16            ; ...but we forgot to tell the assembler! BUG.
    lda #$1234      ; ca65 assembles this as a 16-bit immediate load (3 bytes:
                     ; A9 34 12). At runtime the CPU is in 8-bit A mode, so it
                     ; reads only A9 34 as "LDA #$34", and the next instruction
                     ; starts at the byte 12 — which is probably not a valid
                     ; opcode, or worse, a valid-but-wrong one.
```

The fix is discipline: every `REP`/`SEP` that changes M or X gets a matching
`.a8`/`.a16`/`.i8`/`.i16` directive immediately after, every time, no exceptions.
Lesson 1's code does this. Keep doing it.

### The `.smart` directive

ca65 has a directive, `.smart`, that tracks `REP`/`SEP` automatically and adjusts
its own assumptions about register width — you'll see it at the top of most
nesdoug example files. It removes the need for manual `.a8`/`.i16` bookkeeping in
straight-line code.

This tutorial does **not** use `.smart`, on purpose: while you're still building
intuition for widths, having to write the directive yourself forces you to
consciously track what width each register is in at every point in the code —
which is the actual skill you're building here. `.smart` is genuinely useful once
that intuition is second nature (it eliminates a whole category of copy-paste
errors in larger codebases), and you'll likely want to turn it on for your own
projects later. Just know that when you read other people's ca65 code and see
`.smart` at the top with no `.a8`/`.i16` directives scattered through it, that's
why — the assembler is inferring what you're doing here by hand.

## Addressing modes

An addressing mode is *how* an instruction's operand tells the CPU where to find
data. The 65816 has a lot of them — more than the plain 6502 — because the extra
modes are what make 16-bit, multi-bank programming tractable. You won't use all of
them constantly, but you'll recognize them in other people's code, so it's worth
seeing each one at least once.

### Immediate — the value is the operand

```asm
    lda #$0F        ; A = $0F. The value is baked into the instruction itself.
```

### Direct page addressing

```asm
    lda $10         ; A = the byte at address (D + $10)
```

"Direct page" is the 65816's evolution of 6502 zero page. Instead of always
meaning literal address `$0000`–`$00FF`, it means "the `D` register's value, plus
this one-byte offset." Since Lesson 1 never touches `D`, it stays at its power-on
value of `$0000`, so direct-page addressing there behaves exactly like classic
6502 zero page. Later, when working with variables tied to a specific memory
region, you'll sometimes set `D` on purpose (via `TCD`, Transfer Accumulator to
Direct Page) to make a whole block of variables addressable with cheap one-byte
offsets instead of two-byte absolute addresses. That's a size and speed
optimization you'll meet again once code size starts to matter.

### Absolute — a full 16-bit address in the current data bank

```asm
    lda $2122       ; A = the byte at (DBR : $2122)
```

This is what Lesson 1 used to hit PPU registers — `$2100`–`$21FF` live in bank 0,
and `DBR` is left at `$00` by our init code, so `$2122` unambiguously means
`$002122`.

### Absolute long — address plus explicit bank

```asm
    lda $7F0000     ; A = the byte at literal address $7F0000, regardless of DBR
```

Use this when you need to read/write a specific bank regardless of what `DBR`
currently holds — most often when touching SNES work RAM banks beyond bank 0
(`$7E`/`$7F`) from code whose `DBR` is pointed elsewhere.

### Indexed addressing — direct page, absolute, or long, plus X or Y

```asm
    lda $2100,x     ; absolute indexed: A = byte at (DBR:$2100 + X)
    lda table,y     ; same idea against a label
```

This is how Lesson 1's register-clearing loop worked: `stz $2100,x` with `X`
counting down hits every register in the block, one per loop iteration.

### Indirect modes — the operand points at a pointer

```asm
    lda ($10)       ; direct page indirect: read a 2-byte pointer from
                     ;   (D+$10, D+$11), then A = byte at that address (in DBR)

    lda [$10]       ; direct page indirect LONG: read a 3-byte pointer from
                     ;   (D+$10..D+$12) — includes the bank byte, so this can
                     ;   reach any bank, not just DBR's.

    lda ($10),y     ; indirect indexed: read the 2-byte pointer at (D+$10),
                     ;   THEN add Y to it. This is the classic "iterate a
                     ;   table of structures" pattern — Y walks fields within
                     ;   one entry while the pointer itself picks the entry.
```

You'll use `lda [dp],y` constantly once you're copying graphics data around,
because it's one of the few ways to address across bank boundaries using a
runtime-computed pointer instead of a compile-time-fixed long address.

### Stack relative — reading arguments passed on the stack

```asm
    lda $03,s       ; A = the byte at (S + 3)
```

Useful once you start writing subroutines that receive arguments by pushing them
before a `JSR`/`JSL` — a pattern you'll see more in later lessons once code gets
organized into reusable routines instead of one long `reset:` block.

## 6502 → 65816: what's actually new

If you've written NES/6502 code before, most of the above will feel familiar with
extra flavors added. These are the differences that actually bite:

**Long jumps and calls.** Because code can live in any of many banks, a plain
`JMP`/`JSR` (3 bytes: opcode + 16-bit address) can only reach addresses *within
the current program bank*. To call code in a different bank, you need the long
forms:

```asm
    jsl $818000     ; JSL: jump to subroutine, long — pushes PBR too, so...
    ...
    rtl             ; ...RTL (return long) can restore it correctly.

    jml $818000     ; JML: jump long, no return expected.
```

Mixing these up — `JSR`ing across a bank boundary, or `RTS`ing out of a routine
that was entered with `JSL` — is a classic way to crash. `JSR`/`RTS` and
`JSL`/`RTL` must be paired consistently.

**The direct page register is relocatable.** On 6502, zero page is always
`$0000`–`$00FF`. On 65816, `D` can point anywhere, via `TCD`
(Transfer-C-to-D — load a 16-bit value into `A`, then `TCD` moves it into `D`).
This is a deliberate feature, not a gotcha, but it means you can't assume
"direct-page addressing = the literal first 256 bytes of RAM" the way you could
on 6502 — always check what `D` was last set to.

**Register width is dynamic, per the M/X flags above** — on 6502 everything is
just 8-bit, always. This is the single biggest adjustment, and it's why the whole
[emulation vs native mode](#two-cpus-in-one-emulation-vs-native-mode) section
exists.

**`DBR` matters for absolute addressing.** On 6502 there's no bank concept at all.
On 65816, a plain `LDA $2122` resolves against whatever `DBR` currently holds —
almost always what you want once it's set up correctly at init, but worth knowing
it's there, especially once you start writing code that runs from a different
bank than bank 0.

**New useful instructions that don't exist on 6502**, worth knowing by name even
before you need them: `PHX`/`PHY`/`PLX`/`PLY` (push/pull X and Y — 6502 can only
push/pull A), `PEA`/`PEI` (push effective address, useful for setting up far
calls), `MVN`/`MVP` (block move — copy a whole range of memory in one
instruction, extremely handy for clearing or copying large buffers), and `WAI`
(wait for interrupt — sleeps the CPU until the next IRQ/NMI, useful once you're
synchronizing to vblank instead of just spin-looping).

## Worked example: a small subroutine

Here's a self-contained routine that fills 32 bytes of direct-page RAM with a
value, using a few of the modes above together. It's not part of the running ROM
yet — treat it as a reading exercise, and try tracing through it by hand before
reading the explanation.

```asm
; Fills direct-page addresses $00-$1F with the value in A.
; Assumes: 8-bit A, 16-bit X (the same convention as Lesson 1's reset code).
.a8
.i16
fill_zeropage:
    pha             ; save the fill value — X is about to clobber nothing,
                     ;   but we're about to use A as a loop variable via TDC/TAX
                     ;   in a fancier version of this; for now we just keep A
                     ;   as-is and use X purely as the index.
    ldx #$0000
@loop:
    pla             ; restore the fill value into A...
    pha             ; ...and push it right back (a cheap way to "peek" the
                     ;   stack without a dedicated stack-relative read, since
                     ;   we already have it sitting there from the first PHA)
    sta $00,x       ; direct page indexed: write A to (D + $00 + X)
    inx
    cpx #$0020      ; compare 16-bit X against 32
    bne @loop
    pla             ; balance the stack — pull the value we've been peeking
    rts
```

Walking through it: `pha` at the top saves the fill value on the stack so the
routine doesn't depend on it staying in a fixed memory location or a register we
might want for something else. The loop uses `X` as a 16-bit counter (indexed
addressing needs an index register, and `X` is the conventional choice), and
`sta $00,x` is direct-page indexed addressing — exactly the mode from the table
above, just applied to a write instead of a read. The `pla`/`pha` pair inside the
loop is a slightly clunky way to reuse a stack-stored value repeatedly without a
dedicated variable; once you've seen `stack relative` addressing in real use later
you'll recognize this as the kind of thing `lda $01,s` exists to simplify.

This is intentionally a little inefficient — the point is to see indexed
addressing, the stack, and a loop bounded by a 16-bit compare all doing real work
together, not to write the fastest possible fill routine.

## Exercises

1. In Lesson 1's `reset:` routine, find every `REP`/`SEP` and confirm each one has
   a matching `.a8`/`.a16`/`.i8`/`.i16` directive right after it. There's exactly
   one pair — but get in the habit of checking, because later lessons add more.
2. Rewrite the register-clearing loop from Lesson 1
   (`ldx #$33` / `stz $2100,x` / `stz $4200,x` / `dex` / `bpl`) using words
   instead: what would change if you wanted to clear 16-bit values two bytes at a
   time instead of one byte at a time? (You don't need to actually implement this
   — reasoning through *what would have to change* — the STZ addressing mode, the
   loop bound, the step size — is the exercise.)
3. Predict what goes wrong if you delete the `.i16` directive right after
   `rep #$10` in Lesson 1's reset code, while leaving the actual `rep #$10`
   instruction in place. Then, once your toolchain is confirmed working from
   Lesson 1, actually try it and see if the assembled output matches your
   prediction (hint: compare the byte count of `ldx #$1FFF` before and after your
   change — you can check this with `ca65 -l` to produce a listing file, or by
   inspecting `lesson1.o` with a hex viewer).

---

[Home](docs/index.html) |
Previous: [Lesson 1 — Toolchain setup & your first ROM](01-toolchain-setup-and-first-rom.md)
Next: [Lesson 3 — SNES memory map & hardware registers](03-memory-map-and-registers.md)
