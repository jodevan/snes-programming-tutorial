# Lição 11: Entrada do Controle & Animação de Sprite

**Objetivo:** substituir o loop de polling de V-Blank da [Lição
9](09-background-scrolling.md) por um handler de NMI apropriado, ler o
controle, e usá-lo para mover e animar o sprite da [Lição
10](10-sprites-oam-basics.md).

## De polling para interrupções

O loop de frame da Lição 9 funcionava fazendo busy-wait em `HVBJOY`. Isso é
aceitável para um único background com rolagem, mas desperdiça tempo de CPU só
checando uma flag, e não escala bem quando a lógica de um frame fica mais
complexa. O mecanismo apropriado é o **NMI** (Non-Maskable Interrupt), que a
PPU dispara automaticamente no início de todo V-Blank — sem necessidade de
polling.

### Habilitando o NMI

```
$4200  NMITIMEN  n-yx---a
        n = Enable NMI
        a = Auto-Joypad Read Enable
```

```asm
    lda #%10000001    ; n=1 (enable NMI), a=1 (enable auto-joypad read)
    sta $4200
```

Configurar o bit 0 aqui é o que faz `$4218`-`$421F` (os registradores de joypad
capturados abaixo) atualizarem automaticamente todo frame, sem necessidade de
polling manual da porta antiga `$4016`/`$4017`.

### Conectando o handler

Volte ao segmento `VECTORS` da sua ROM, da Lição 1, e mude a única word que era
`.word trap ; NMI` para apontar para um handler de verdade:

```asm
    .word nmi_handler   ; NMI (was: trap)
```

Depois reconheça o NMI no topo do handler lendo `$4210` (`RDNMI`) — segundo a
[referência de
registradores](https://wiki.superfamicom.org/registers#nmi-flag-and-5a22-version-942),
isso é obrigatório, não uma formalidade opcional:

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

Como o código deste tutorial nunca muda a largura dos registradores em nenhum
lugar depois do `REP`/`SEP` inicial da [Lição
1](01-toolchain-setup-and-first-rom.md) (toda lição permaneceu em
A-de-8-bits/X-de-16-bits o tempo todo), o handler só precisa salvar e restaurar
os registradores que de fato toca — `A`, `X`, `Y` — com simples
`PHA`/`PHX`/`PHY`. Um handler que muda a largura dos registradores no meio de
uma interrupção precisaria salvar e restaurar o registrador `P` também, o que
este tutorial deliberadamente evita precisar fazer.

## Lendo o controle {#reading-the-controller}

A auto-leitura do joypad preenche `JOY1L`/`JOY1H` (`$4218`/`$4219`) uma vez por
frame:

```
$4219 (high byte): byetUDLR   B / Y / Select / Start / Up / Down / Left / Right
$4218 (low byte):  axlr0000   A / X / L / R / (unused)
```

```asm
    lda $4219          ; JOY1H: bit0=Right, bit1=Left, bit2=Down, bit3=Up
    sta buttons
```

Uma ressalva honesta: o hardware termina essa auto-leitura algumas scanlines
*depois* do NMI disparar, então o valor que seu handler lê é tecnicamente
remanescente da leitura completada do frame *anterior*, não um valor capturado
recém neste frame exato — um atraso de no máximo um frame, geralmente
imperceptível. Esperar o bit 0 do `HVBJOY` zerar antes de confiar em
`JOY1L`/`H` fecharia essa lacuna completamente; este tutorial aceita o pequeno
atraso pela simplicidade, o que é o que a maioria dos pequenos projetos de SNES
faz na prática.

## Estendendo sua ROM

Reserve mais alguns bytes de página direta, mova a atualização de rolagem da
Lição 9 para o novo handler, e adicione movimento mais uma animação simples de
dois frames por cima:

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

Adicione também o segundo tile de sprite — um contorno vazado, reaproveitando a
mesma entrada de paleta da Lição 10, então nenhuma cor nova é necessária — logo
depois de `sprite_tile` na VRAM (números de tile são apenas passos de 32 bytes,
então colocá-lo logo em seguida o torna o número de tile 1 automaticamente):

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

Carregue os dois tiles como um único bloco contíguo de 64 bytes quando você
carregar os gráficos de sprite na VRAM, em vez de só `sprite_tile` sozinho.

Por fim, substitua o loop principal por `WAI` — a instrução que a [Lição
2](02-cpu-crash-course.md#whats-actually-new) mencionou mas ainda não tinha
uso. Com todo o trabalho por frame agora acontecendo no handler de NMI, a
thread principal não tem mais nada a fazer além de dormir até a próxima
interrupção:

```asm
main_loop:
    wai
    bra main_loop
```

## Compile e execute

Segure o D-pad. O sprite se move, e alterna entre um quadrado sólido e um
contorno vazado a cada 16 frames enquanto se move — um substituto para uma
animação de caminhada de verdade, demonstrando o mecanismo (trocar o número de
tile da OAM ao longo do tempo) sem precisar de arte de personagem de verdade. O
background continua rolando por baixo, agora acionado pela mesma interrupção em
vez de um loop de polling separado.

## Exercícios

1. Use `A`/`X`/`L`/`R` (de `JOY1L`) para disparar algo distinto de movimento —
   por exemplo, resetar instantaneamente `sprite_x`/`sprite_y` para a posição
   inicial.
2. O contador de animação incrementa a cada frame em que uma direção é
   segurada, e alterna frames baseado no bit 4 (a cada 16 frames). Mude para
   alternar a cada 8 frames, depois a cada 4 — note quão rápido é "rápido
   demais" para uma animação convincente usando só dois frames.
3. Movimento diagonal atualmente deixa Cima+Direita (por exemplo) mover o
   sprite mais rápido do que uma única direção, já que os dois pares
   `inc`/`dec` se aplicam independentemente. Isso é um bug que vale a pena
   corrigir para os propósitos deste tutorial? Pense no que um jogo de verdade
   faria diferente, mesmo que você não implemente isso.

---

[Home](../docs/pt/index.html) |
Previous: [Lição 10 — Fundamentos de sprites (OAM)](10-sprites-oam-basics.md)
Next: [Lição 12 — Detecção de colisão](12-collision-detection.md)
