# Lesson 12: Collision Detection

**Goal:** the SNES has no collision hardware — everything in this lesson is
plain arithmetic and lookup tables, the same techniques you'd use on any
platform. Two flavors: sprite-vs-sprite (bounding boxes) and sprite-vs-world
(a lookup table).

## Sprite-vs-sprite: axis-aligned bounding boxes

Treat each sprite as an 8×8 rectangle. Two rectangles overlap exactly when they
overlap on *both* axes independently — the classic **AABB** (axis-aligned
bounding box) test:

```
overlap  =  (x1 < x2+w2)  AND  (x2 < x1+w1)  AND  (y1 < y2+h2)  AND  (y2 < y1+h1)
```

In words: neither box is entirely to the left, right, above, or below the
other. If none of those four "definitely separated" conditions hold, they must
be touching.

Add a second, stationary sprite to your [Lesson
11](11-controller-input-and-animation.md) ROM — a "wall" sprite at a fixed
`wall_x`/`wall_y` — using the same OAM-writing technique from Lesson 10. Then
test the player sprite against it every frame:

```asm
; Sets carry SET if the player sprite overlaps the wall sprite (both 8x8).
; Clobbers A. Uses a direct-page scratch byte, `temp`.
check_collision:
    ; X axis: player_x < wall_x+8  AND  wall_x < player_x+8
    lda wall_x
    clc
    adc #8
    sta temp
    lda sprite_x
    cmp temp
    bcs @no_collision      ; sprite_x >= wall_x+8: fully separated on X

    lda sprite_x
    clc
    adc #8
    sta temp
    lda wall_x
    cmp temp
    bcs @no_collision       ; wall_x >= sprite_x+8: fully separated on X

    ; Y axis: same pattern
    lda wall_y
    clc
    adc #8
    sta temp
    lda sprite_y
    cmp temp
    bcs @no_collision

    lda sprite_y
    clc
    adc #8
    sta temp
    lda wall_y
    cmp temp
    bcs @no_collision

    sec                      ; every "separated" check failed -> they overlap
    rts
@no_collision:
    clc
    rts
```

The `CMP`/`BCS` pattern here relies on 65816 comparison semantics from [Lesson
2](02-cpu-crash-course.md#instructions): `CMP` sets carry when the
accumulator is **greater than or equal to** the operand (unsigned). So
`lda sprite_x / cmp temp / bcs @no_collision` reads as "if `sprite_x >= temp`,
branch" — exactly the negation of the `<` condition from the overlap formula
above. Call `check_collision` once per frame from `nmi_handler`, after moving
the sprite; if carry comes back set, you know the two boxes touch — Lesson 16's
capstone uses exactly this to detect the player reaching a collectible.

## Sprite-vs-world: a lookup table

Bounding boxes work for sprite pairs, but checking a moving sprite against an
entire background would mean testing dozens of tiles every frame. The standard
solution is a **separate, purpose-built lookup table** — not necessarily the
same data as your visible tilemap — indexed by position, giving an instant
solid/passable answer.

This tutorial's background is a repeating stripe with no natural "walls," so
we'll build a small standalone collision map instead: divide the 256×224
screen into 32×32-pixel cells (8 columns × 7 rows = 56 cells) and mark the
border cells solid, keeping the player inside the play area:

```asm
; 8 columns x 7 rows, row-major. 1 = solid, 0 = passable.
collision_map:
    .byte 1,1,1,1,1,1,1,1     ; row 0 (top border)
    .byte 1,0,0,0,0,0,0,1     ; rows 1-5: solid left/right edge only
    .byte 1,0,0,0,0,0,0,1
    .byte 1,0,0,0,0,0,0,1
    .byte 1,0,0,0,0,0,0,1
    .byte 1,0,0,0,0,0,0,1
    .byte 1,1,1,1,1,1,1,1     ; row 6 (bottom border)
```

Since each cell is 32 pixels (`2^5`), converting a pixel coordinate to a cell
index is just a shift, not a division:

```asm
; Computes collision_map[(y>>5)*8 + (x>>5)] and returns it in A.
; Input: A = x, temp = y (caller sets temp first). Clobbers A, X.
get_cell:
    lsr a
    lsr a
    lsr a
    lsr a
    lsr a                  ; A = x >> 5  (cell column, 0-7)
    sta temp2
    lda temp
    lsr a
    lsr a
    lsr a
    lsr a
    lsr a                   ; A = y >> 5  (cell row, 0-6)
    asl a
    asl a
    asl a                    ; A = row * 8
    clc
    adc temp2
    tax
    lda collision_map,x
    rts
```

### Using it to gate movement

Rather than unconditionally applying the D-pad movement from Lesson 11, check
whether the *destination* cell is passable first. Here's the pattern for one
direction — Right — the other three follow the same shape:

```asm
    lda buttons
    and #%00000001          ; Right held?
    beq @not_right

    lda sprite_x
    clc
    adc #1                   ; proposed new X
    pha                        ; save it
    sta temp
    lda sprite_y
    sta temp2
    lda temp
    jsr get_cell               ; check the cell at the PROPOSED position
    bne @blocked                ; nonzero = solid, reject the move
    pla
    sta sprite_x                 ; passable: commit the move
    bra @not_right
@blocked:
    pla                           ; discard the proposed position
@not_right:
```

This is the same shape you'll recognize from every "porthole register" loop
since Lesson 4, applied to logic instead of hardware: compute a candidate
value, check it against a table, only commit if it passes.

## Build and run

With both pieces in place, the player sprite now stops at the edges of the
32-pixel border instead of scrolling off the visible play area, and touching
the stationary wall sprite is something your code can detect (even if nothing
visibly reacts to it yet — that's what [Lesson 16](16-capstone.md) adds).

## Exercises

1. Finish the Left/Up/Down cases of the movement-gating pattern above.
2. Make `check_collision` react to something observable — for example, changing
   the wall sprite's own tile number when it's touched, so you get visible
   confirmation without waiting for the capstone.
3. The collision map here is hand-written. Real games generate collision data
   from the same source as their visual tilemap (often by tagging certain tile
   numbers as solid when the level is built). Sketch — in comments, not full
   code — how you'd turn Lesson 6's tilemap into a collision map automatically,
   given a rule like "tile numbers 16 and above are solid."

---

[Home](README.md) |
Previous: [Lesson 11 — Controller input & sprite animation](11-controller-input-and-animation.md)
Next: [Lesson 13 — The SPC700 & audio basics](13-spc700-and-audio-basics.md)
