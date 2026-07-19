# Lesson 9: Background Scrolling

**Goal:** turn the static striped background from Lessons 4-8 into a moving
one, and along the way replace the `forever: jmp forever` spin-loop every
earlier lesson ended with, with a real per-frame game loop.

## BGxHOFS / BGxVOFS

Each background layer has a horizontal and vertical scroll register:
`BG3HOFS` (`$2111`) and `BG3VOFS` (`$2112`) for the layer you've been building.
Both are "write-twice" registers, same idea as `CGDATA` in Lesson 4 — write the
low byte, then the high byte, to the *same* address:

```asm
    lda scroll_lo
    sta $2111        ; BG3HOFS: first write = low byte
    lda scroll_hi
    sta $2111         ; BG3HOFS: second write = high byte
```

### A shared-latch gotcha worth knowing before you hit it

Per the [background scrolling
reference](https://wiki.superfamicom.org/backgrounds#bg-scrolling), all eight
`BGnHOFS`/`BGnVOFS` registers share a *single* internal "previous byte written"
latch, not one latch per register. If you write BG3's low byte, then write
BG1's low byte before coming back to finish BG3's high byte, the hardware
combines your BG3 high-byte write with the *wrong* leftover latch data,
corrupting the result. The rule that keeps you safe: **always write a scroll
register's low byte immediately followed by its high byte, with no other
scroll-register write in between.** This tutorial only scrolls one layer, so it
can't bite you yet — but the moment you scroll two layers independently (a
parallax effect, for instance), this is the bug waiting for you.

## Building a per-frame loop

Every ROM so far has ended in an infinite spin — nothing happened after setup.
Real games update state once per frame, synchronized to the screen refresh.
Without proper interrupts (which [Lesson 11](11-controller-input-and-animation.md)
introduces), the simplest correct way to do this is to **poll `HVBJOY`**
(`$4212`) — bit 7 is set for the entire duration of V-Blank, and clear
otherwise:

```asm
frame_loop:
@wait_vblank_start:
    lda $4212
    bpl @wait_vblank_start   ; loop while bit 7 (N) is clear = not yet in vblank

    ; --- game logic goes here, once per frame ---

@wait_vblank_end:
    lda $4212
    bmi @wait_vblank_end      ; loop while bit 7 is still set = still in vblank

    jmp frame_loop
```

The second wait matters as much as the first: without it, your "once per frame"
code would actually run dozens of times during a single ~40-scanline V-Blank
period, since the poll loop would keep passing the first check the whole time
V-Blank stays active. Waiting for V-Blank to *end* before looping back
guarantees exactly one update per frame. [Lesson 11](11-controller-input-and-animation.md)
replaces this whole polling pattern with an NMI handler, which is both more
precise and frees the CPU to do other work while waiting — but polling is
worth understanding first, since it makes the underlying timing explicit
instead of hiding it inside an interrupt.

## Extending your ROM

Reserve two direct-page bytes for a 16-bit scroll counter, replace your ROM's
final `forever:` loop with the frame loop above, and increment the scroll value
once per frame using the classic 8-bit "increment low byte, propagate carry to
high byte" idiom:

```asm
; --- direct-page variables, reserved once near the top of your code ---
scroll_lo := $00
scroll_hi := $01

; --- inside the frame loop, replacing the "game logic" comment above ---
    inc scroll_lo
    bne @no_carry
    inc scroll_hi
@no_carry:
    lda scroll_lo
    sta $2111        ; BG3HOFS low byte
    lda scroll_hi
    sta $2111         ; BG3HOFS high byte
```

A tempting shortcut to avoid: don't reach for a single 16-bit `sta $2111` here
even though `scroll_lo`/`scroll_hi` sit in consecutive memory as a natural
16-bit value. A 16-bit store writes its low byte to `$2111` and its high byte
to `$2113` — sorry, to `$2112`, the *next* address, which is `BG3VOFS`, not the
second half of `BG3HOFS`. Two deliberate 8-bit writes to the same address is
the correct pattern here, not one 16-bit write to two addresses — a mistake
easy enough to make that it's worth naming explicitly.

## Build and run

Assemble and run it. The striped background should now scroll smoothly and
continuously to one side, wrapping seamlessly — because your tilemap is a
single 32×32-tile (256×256-pixel) block and, per the [background
reference](https://wiki.superfamicom.org/backgrounds#bg-scrolling), "the
display can never fall outside the BG: it simply wraps around automatically."
You didn't write any wrapping logic; the hardware did it for you.

## Exercises

1. Add a second counter for `BG3VOFS` and scroll diagonally.
2. The `BG3SC` register's low two bits (from [Lesson
   6](06-backgrounds-and-tilemaps.md#a-crucial-gotcha-word-addresses-vs-byte-addresses))
   select 32×32, 64×32, 32×64, or 64×64 tile arrangements. Try `01` (64×32) and
   fill the second 32×32 block with a different tilemap pattern — confirm the
   scroll now reveals two distinct halves before wrapping, instead of one
   repeating block.
3. Slow the scroll rate down to one pixel every 4 frames instead of every
   frame, without changing the frame loop's structure — think about what
   condition should gate the `inc scroll_lo` line.

---

[Home](README.md) |
Previous: [Lesson 8 — DMA & HDMA deep dive](08-dma-and-hdma.md)
Next: [Lesson 10 — Sprites (OAM) basics](10-sprites-oam-basics.md)
