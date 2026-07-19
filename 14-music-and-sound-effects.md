# Lesson 14: Music & Sound Effects

**Goal:** trigger a sound from a real gameplay event using [Lesson
13](13-spc700-and-audio-basics.md)'s manual-DSP technique, then get an honest
picture of what it takes to add real music — which this tutorial deliberately
doesn't implement from scratch.

## Triggering a sound effect on demand

Lesson 13's tone started once, at boot, and never stopped. A sound *effect*
needs to fire on demand — say, when [Lesson 12](12-collision-detection.md)'s
`check_collision` reports a hit. The trick: re-triggering a voice that's
already playing requires a **key-off, then key-on** pair, not just key-on again
— writing `KON` while a voice is already active doesn't restart its envelope,
it's ignored.

```asm
; Call after check_collision returns with carry set.
play_hit_sfx:
    ldx #$015C        ; KOFF: key off voice 0
    jsr write_dsp
    ldx #$014C         ; KON: key on voice 0 (restarts the envelope cleanly)
    jsr write_dsp
    rts
```

Wire it into the collision check from Lesson 12:

```asm
    jsr check_collision
    bcc @no_hit
    jsr play_hit_sfx
@no_hit:
```

Because both `check_collision` and `write_dsp`/`spc_upload_byte` are plain
subroutines, calling one from the other's success path is nothing new — it's
the same `JSR`/`RTS` discipline from every earlier lesson, just with a sound
chip on the other end instead of a PPU register.

### A second, independent sound

The DSP has 8 voices; Lesson 13 only used voice 0. A second sound effect —
say, a short blip on a button press — can run on voice 1 entirely
independently, using the same `write_dsp` calls with voice 1's register
offsets (add `$10` to each of voice 0's register numbers: `VOLL` becomes
`$10`, `PITCHL` becomes `$12`, and so on). Wire this to the `A` button from
[Lesson 11](11-controller-input-and-animation.md#reading-the-controller)'s
exercises, and you have two independently-triggerable sounds sharing the same
sample data, distinguished only by which voice plays them.

## What real music actually requires

Everything in Lessons 13-14 is deliberately minimal — enough to understand the
communication protocol and make *a* sound. Real background music needs a
sequencer running *on the SPC700 itself*: something that reads a compact song
format out of ARAM and continuously updates DSP registers in time, entirely
independent of the 65816 (which should be free to run gameplay code, not spend
every frame bit-banging DSP writes). Writing that sequencer from scratch is a
serious project on its own — arguably comparable in scope to everything covered
in Lessons 1-13 combined — which is why essentially every SNES homebrew game,
however small, builds on an existing audio driver rather than writing one.
Three actively-used, ca65-compatible options, roughly in order of how actively
maintained and documented they are as of this writing:

- **[Terrific Audio Driver](https://github.com/undisbeliever/terrific-audio-driver)**
  — supports ca65 directly, uses a text-based MML (Music Macro Language) format
  for composing, and ships its own previewer with a built-in SPC700 emulator so
  you can hear changes without a full rebuild.
- **[SNESGSS Extended](https://github.com/NovaSquirrel/snesgss-extended)** — a
  ca65-macro-pack-based fork of the long-standing SNESGSS engine, with a
  dedicated tracker-style editor.
- **[SNESMOD](https://nesdoug.com/2022/03/02/snesmod/)** — MIT-licensed,
  assembled with ca65 via blargg's macro pack, driven by `.it` (Impulse
  Tracker) module files you can author in the free tool OpenMPT.

All three solve the same underlying problem this lesson introduced by hand —
getting a compact song representation into ARAM and having the SPC700 play it
back continuously — with a real sequencer instead of a fixed one-shot tone.
Picking one and working through its own integration guide is the natural next
step after this tutorial, and is intentionally left as that: a next step,
not part of the core curriculum here.

## Exercises

1. Implement the voice-1 button-triggered blip described above, distinct from
   the voice-0 collision sound, and confirm both can be heard independently
   (including overlapping, if you trigger them close together).
2. Read through [Terrific Audio Driver's
   documentation](https://github.com/undisbeliever/terrific-audio-driver) (or
   whichever of the three options interests you most) far enough to answer:
   how does it expect song data to be included in your ROM — as a separate
   assembled file, a linker segment, or something else? You don't need to
   integrate it, just locate the answer.
3. Look back at [Lesson 13](13-spc700-and-audio-basics.md)'s `ADSR1`/`ADSR2`
   values (`$C3`/`$2F`) for voice 0. The [SPC700
   reference](https://wiki.superfamicom.org/spc700-reference) documents the
   ADSR envelope bit layout — without necessarily working out exact timings,
   identify which of the two registers controls "attack" (how quickly the
   sound reaches full volume when key-on fires) versus "release."

---

[Home](docs/index.html) |
Previous: [Lesson 13 — The SPC700 & audio basics](13-spc700-and-audio-basics.md)
Next: [Lesson 15 — Code organization & optimization](15-code-organization-and-optimization.md)
