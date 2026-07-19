# Lesson 11: Controller Input & Sprite Animation

**Goal:** replace [Lesson 9](09-background-scrolling.md)'s V-Blank polling
loop with a proper NMI handler, read the controller, and use it to move and
animate the sprite from [Lesson 10](10-sprites-oam-basics.md).

## From polling to interrupts

Lesson 9's frame loop worked by busy-waiting on `HVBJOY`. That's fine for a
single scrolling background, but it wastes CPU time doing nothing but checking
a flag, and it doesn't scale well once a frame's logic gets more involved. The
proper mechanism is the **NMI** (Non-Maskable Interrupt), which the PPU fires
automatically at the start of every V-Blank — no polling required.

### Enabling NMI

```
$4200  NMITIMEN  n-yx---a
        n = Enable NMI
        a = Auto-Joypad Read Enable
```

```asm
    lda #%10000001    ; n=1 (enable NMI), a=1 (enable auto-joypad read)
    sta $4200
```

Setting bit 0 here is what makes `$4218`-`$421F` (the latched joypad registers
below) update automatically every frame, with no manual polling of the old
`$4016`/`$4017` port needed.

### Wiring up the handler

Go back to your ROM's `VECTORS` segment from Lesson 1 and change the one word
that was `.word trap ; NMI` to point at a real handler instead:

```asm
    .word nmi_handler   ; NMI (was: trap)
```

Then acknowledge the NMI at the top of the handler by reading `$4210`
(`RDNMI`) — per the [register
reference](https://wiki.superfamicom.org/registers#nmi-flag-and-5a22-version-942),
this is required, not optional bookkeeping:

```asm
nmi_handler:
    pha
    phx
    phy

    lda $4210         ; RDNMI: must be read during the NMI handler

    ; ... per-frame logic goes here ...

    ply
    plx
    pla
    rti
```

Since this tutorial's code never changes register widths anywhere after
[Lesson 1](01-toolchain-setup-and-first-rom.md)'s initial `REP`/`SEP` (every
lesson has stayed in 8-bit-A/16-bit-X the whole time), the handler only needs
to save and restore the registers it actually touches — `A`, `X`, `Y` — with
plain `PHA`/`PHX`/`PHY`. A handler that changes register widths mid-interrupt
would need to save and restore the `P` register too, which this tutorial
deliberately avoids needing.

## Reading the controller

Auto-joypad read populates `JOY1L`/`JOY1H` (`$4218`/`$4219`) once per frame:

```
$4219 (high byte): byetUDLR   B / Y / Select / Start / Up / Down / Left / Right
$4218 (low byte):  axlr0000   A / X / L / R / (unused)
```

```asm
    lda $4219          ; JOY1H: bit0=Right, bit1=Left, bit2=Down, bit3=Up
    sta buttons
```

One honest caveat: the hardware finishes this auto-read a few scanlines *after*
NMI fires, so the value your handler reads is technically left over from the
*previous* frame's completed read, not a value freshly captured this exact
frame — a lag of at most one frame, generally imperceptible. Waiting for
`HVBJOY` bit 0 to clear before trusting `JOY1L`/`H` would close that gap
entirely; this tutorial accepts the tiny lag for simplicity, which is what most
small SNES projects do in practice.

## Extending your ROM

Reserve a few more direct-page bytes, move Lesson 9's scroll update into the
new handler, and add movement plus a simple two-frame animation on top:

```asm
; --- new direct-page variables ---
sprite_x := $02
sprite_y := $03
buttons  := $04
anim_ctr := $05

; --- inside reset:, before enabling NMI, initialize the sprite position ---
    lda #120
    sta sprite_x
    lda #100
    sta sprite_y
    stz anim_ctr

nmi_handler:
    pha
    phx
    phy
    lda $4210            ; acknowledge NMI

    ; --- scroll the background (moved here from Lesson 9) ---
    inc scroll_lo
    bne @no_carry
    inc scroll_hi
@no_carry:
    lda scroll_lo
    sta $2111
    lda scroll_hi
    sta $2111

    ; --- read the controller ---
    lda $4219
    sta buttons

    ; --- move the sprite ---
    lda buttons
    and #%00000001        ; Right
    beq @not_right
    inc sprite_x
@not_right:
    lda buttons
    and #%00000010         ; Left
    beq @not_left
    dec sprite_x
@not_left:
    lda buttons
    and #%00000100          ; Down
    beq @not_down
    inc sprite_y
@not_down:
    lda buttons
    and #%00001000           ; Up
    beq @not_up
    dec sprite_y
@not_up:

    ; --- pick an animation frame: tile 1 alternates every 16 frames,
    ;     but only while a direction is actually held ---
    lda buttons
    and #%00001111
    beq @idle
    inc anim_ctr
    lda anim_ctr
    and #$10
    beq @frame0
    lda #1
    bra @write_oam
@frame0:
    lda #0
    bra @write_oam
@idle:
    lda #0

@write_oam:
    pha                    ; save chosen tile number
    stz $2102
    stz $2103
    lda sprite_x
    sta $2104
    lda sprite_y
    sta $2104
    pla
    sta $2104               ; tile number: 0 or 1
    stz $2104                ; attributes

    ply
    plx
    pla
    rti
```

Also add the second sprite tile — a hollow outline, reusing the same palette
entry from Lesson 10 so no new colors are needed — immediately after
`sprite_tile` in VRAM (tile numbers are just steps of 32 bytes, so placing it
right after makes it tile number 1 automatically):

```asm
sprite_tile2:
    .byte $FF, $00
    .byte $81, $00
    .byte $81, $00
    .byte $81, $00
    .byte $81, $00
    .byte $81, $00
    .byte $81, $00
    .byte $FF, $00
    .byte $00, $00        ; bitplanes 2/3: all zero, same as sprite_tile
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
sprite_tile2_end:
```

Load both tiles as one contiguous 64-byte block when you load sprite graphics
into VRAM, instead of just `sprite_tile` alone.

Finally, replace the main loop with `WAI` — the instruction [Lesson
2](02-cpu-crash-course.md#6502--65816-whats-actually-new) mentioned but never
had a use for yet. With all per-frame work now happening in the NMI handler,
the main thread has nothing left to do but sleep until the next interrupt:

```asm
main_loop:
    wai
    bra main_loop
```

## Build and run

Hold the D-pad. The sprite moves, and toggles between a solid square and a
hollow outline every 16 frames while moving — a stand-in for a real walk
animation, demonstrating the mechanism (swap the OAM tile number over time)
without needing real character art. The background keeps scrolling underneath,
now driven by the same interrupt instead of a separate polling loop.

## Exercises

1. Use `A`/`X`/`L`/`R` (from `JOY1L`) to trigger something distinct from
   movement — for example, instantly reset `sprite_x`/`sprite_y` to the
   starting position.
2. The animation counter increments every frame a direction is held, and toggles
   frames based on bit 4 (every 16 frames). Change it to toggle every 8 frames
   instead, then every 4 — notice how fast is "too fast" for a convincing
   animation using only two frames.
3. Diagonal movement currently lets Up+Right (for instance) move the sprite
   faster than a single direction, since both `inc`/`dec` pairs apply
   independently. Is this a bug worth fixing for this tutorial's purposes?
   Think about what a real game would do differently, even if you don't
   implement it.

---

[Home](docs/index.html) |
Previous: [Lesson 10 — Sprites (OAM) basics](10-sprites-oam-basics.md)
Next: [Lesson 12 — Collision detection](12-collision-detection.md)
