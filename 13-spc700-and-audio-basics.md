# Lesson 13: The SPC700 & Audio Basics

**Goal:** understand why SNES audio programming feels so different from
everything else in this tutorial (it's a second, separate computer), and make
a sound — without writing a single line of SPC700 assembly.

## A second CPU you can barely talk to

Every lesson so far has run entirely on the 65816. Sound is different: the
SNES has a completely independent second processor, the **SPC700**, with its
own 64 KB of RAM (called ARAM) and its own instruction set, dedicated to
driving the audio hardware (the DSP). The 65816 cannot read or write ARAM
directly, and the SPC700 cannot see the rest of the console's memory at all.
The *only* connection between the two is four one-byte communication ports:

```
$2140-$2143  (65816 side, APUIO0-3)
$00F4-$00F7  (SPC700 side, same four ports, different addresses)
```

Whatever the 65816 writes to `$2140`, the SPC700 reads back at `$00F4` — and
vice versa. That's the entire interface. Every SNES game's music and sound
effects get into ARAM through this four-byte mail slot, using a boot-time
handshake protocol built into the SPC700's boot ROM (its "IPL ROM").

This tutorial does not write an SPC700 audio driver from scratch — that's a
substantial project on its own, and real games almost universally use an
existing, battle-tested sound engine rather than writing one from first
principles. What this lesson *does* cover — the upload handshake, and a neat
trick for making sound with zero SPC700 code — is the piece every driver,
however sophisticated, ultimately sits on top of.

## The boot handshake

This protocol (and the routines below) closely follow the well-documented,
long-established recipe on the [SNESdev wiki's "Booting the
SPC700"](https://snes.nesdev.org/wiki/Booting_the_SPC700) page — worth reading
directly if you want the full detail on indirect/relocating uploads, which this
lesson doesn't need.

**Step 1 — wait for ready.** On power-on, the SPC700's boot ROM writes `$AA` to
`APUIO0` and `$BB` to `APUIO1` once it's finished initializing:

```asm
spc_wait_boot:
    lda #$AA
@wait:  cmp $2140
    bne @wait
    sta $2140          ; clear it, in case a stale $CC is still sitting there
    lda #$BB
@wait2: cmp $2141
    bne @wait2
    rts
```

**Step 2 — start an upload at a given address**, and **step 3 — send bytes one
at a time**, each acknowledged before the next is sent:

```asm
; Starts upload to SPC address Y; leaves Y=0 for use as an index.
spc_begin_upload:
    sty $2142
    lda $2140
    clc
    adc #$22
    bne @skip
    inc
@skip:
    sta $2141
    sta $2140
@wait:
    cmp $2140
    bne @wait
    ldy #0
    rts

; Uploads byte A to SPC and increments Y.
spc_upload_byte:
    sta $2141
    tya
    sta $2140
    iny
@wait:
    cmp $2140
    bne @wait
    rts
```

This tutorial doesn't need a "start execution" routine — the trick in the next
section skips running any uploaded SPC700 program entirely.

## Making a sound without writing SPC700 code

The SPC700's audio chip (the DSP) has 128 one-byte registers controlling
volume, pitch, and playback for 8 independent voices. Normally, only SPC700
code can touch them. But the boot ROM has a special case: if you target upload
address `$00F2`, the two bytes you send are interpreted directly as *(DSP
register number, value)* — meaning **you can drive the DSP from the 65816
alone**, with no SPC700 program running at all. This is a genuinely useful
technique, not just a teaching shortcut — it's a documented, real way to get a
simple beep out before a full music driver exists in a project.

```asm
; Writes DSP register (low byte of X) = value (high byte of X).
write_dsp:
    phx
    ldy #$00F2
    jsr spc_begin_upload
    pla
    jsr spc_upload_byte     ; register number -> $00F2
    pla
    jsr spc_upload_byte     ; value -> $00F3
    rts
```

Even the DSP needs *something* to play, though — a tiny looping waveform in
ARAM, uploaded the normal way first. This one-tile-sized BRR sample (the SNES's
compressed audio format; two bytes of header describing loop points, then a
tiny repeating waveform) is enough for a test tone:

```asm
sample:
    .word $0204      ; sample directory: this sample's start address
    .word $0204       ; sample directory: this sample's loop point
    .byte $B0,$78,$78,$78,$78,$78,$78,$78,$78
    .byte $B3,$78,$78,$78,$78,$78,$78,$78,$78
sample_end:
```

## Putting it together

```asm
    jsr spc_wait_boot

    ; Upload the sample to SPC RAM at $0200 (the conventional first free
    ; address, since $0000-01FF holds the SPC700's zero page and stack).
    ldy #$0200
    jsr spc_begin_upload
@upload_loop:
    lda sample,y
    jsr spc_upload_byte
    cpy #(sample_end - sample)
    bne @upload_loop
```

Then a sequence of `write_dsp` calls configures voice 0 and starts it playing:

| Call | Register | Meaning |
|---|---|---|
| `ldx #$206C` | `FLG` | Echo-buffer write protect on (safe default) |
| `ldx #$004C` | `KON` | Key-on: no voices yet |
| `ldx #$FF5C` | `KOFF` | Key-off: silence everything first |
| `ldx #$025D` | `DIR` | Sample directory at ARAM page 2 (`$0200`), matching the upload above |
| `ldx #$7F00` / `ldx #$7F01` | `VOLL`/`VOLR` (voice 0) | Max volume, both channels |
| `ldx #$0002` / `ldx #$0203` | `PITCHL`/`PITCHH` (voice 0) | Playback rate — this sets the tone's pitch |
| `ldx #$0004` | `SRCN` (voice 0) | Use sample directory entry 0 (the one we uploaded) |
| `ldx #$C305` / `ldx #$2F06` | `ADSR1`/`ADSR2` (voice 0) | Enable the volume envelope |
| `ldx #$005C` | `KOFF` | Clear key-off (undo the earlier silence) |
| `ldx #$7F0C` / `ldx #$7F1C` | `MVOLL`/`MVOLR` | Master volume, max |
| `ldx #$014C` | `KON` | **Key on voice 0 — this line starts the sound** |

Every one of those is a call to `write_dsp` with that value. Build, run, and
you should hear a continuous tone starting the moment the last `write_dsp` call
executes.

## Exercises

1. Change the `PITCHH`/`PITCHL` values (`$0203`/`$0002`) and rebuild — higher
   values raise the pitch. Find roughly where it stops sounding like a
   recognizable tone and starts aliasing badly; that's a real limitation of
   this tiny hand-written waveform, not a mistake.
2. Trigger the `KON` write (just that one `write_dsp` call) from inside
   `nmi_handler`, gated on a button press instead of running once at startup —
   this is the shape [Lesson 14](14-music-and-sound-effects.md) builds on.
3. Read the ["Writing to DSP Registers Without any SPC-700
   Code"](https://wiki.superfamicom.org/how-to-write-to-dsp-registers-without-any-spc-700-code)
   source this lesson is based on, and identify which lines in its
   `manual_dsp.s` correspond to each row of the table above — a good way to
   confirm you actually understand what each `write_dsp` call is doing rather
   than pattern-matching the table.

---

[Home](README.md) |
Previous: [Lesson 12 — Collision detection](12-collision-detection.md)
Next: [Lesson 14 — Music & sound effects](14-music-and-sound-effects.md)
