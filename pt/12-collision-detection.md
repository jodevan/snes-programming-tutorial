# Lição 12: Detecção de Colisão

**Objetivo:** o SNES não tem hardware de colisão — tudo nesta lição é aritmética
comum e tabelas de consulta, as mesmas técnicas que você usaria em qualquer
plataforma. Duas variantes: sprite-contra-sprite (bounding boxes) e
sprite-contra-cenário (uma tabela de consulta).

## Sprite-contra-sprite: bounding boxes alinhadas aos eixos

Trate cada sprite como um retângulo 8×8. Dois retângulos se sobrepõem exatamente
quando se sobrepõem em *ambos* os eixos independentemente — o clássico teste
**AABB** (axis-aligned bounding box):

```
overlap  =  (x1 < x2+w2)  AND  (x2 < x1+w1)  AND  (y1 < y2+h2)  AND  (y2 < y1+h1)
```

Em palavras: nenhuma das caixas está inteiramente à esquerda, à direita, acima,
ou abaixo da outra. Se nenhuma dessas quatro condições de "definitivamente
separado" se sustenta, elas precisam estar se tocando.

Adicione um segundo sprite, parado, à sua ROM da [Lição
11](11-controller-input-and-animation.md) — uma "parede" em uma posição fixa
`wall_x`/`wall_y` — usando a mesma técnica de escrita em OAM da Lição 10. Depois
teste o sprite do jogador contra ela a cada frame:

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

O padrão `CMP`/`BCS` aqui se apoia na semântica de comparação do 65816 da
[Lição 2](02-cpu-crash-course.md#instructions): `CMP` ativa o carry quando o
acumulador é **maior ou igual** ao operando (sem sinal). Então
`lda sprite_x / cmp temp / bcs @no_collision` se lê como "se `sprite_x >= temp`,
desvie" — exatamente a negação da condição `<` da fórmula de sobreposição
acima. Chame `check_collision` uma vez por frame a partir de `nmi_handler`,
depois de mover o sprite; se o carry voltar ativado, você sabe que as duas
caixas se tocam — o projeto final da Lição 16 usa exatamente isso para detectar
o jogador alcançando um colecionável.

## Sprite-contra-cenário: uma tabela de consulta

Bounding boxes funcionam para pares de sprites, mas checar um sprite em
movimento contra um background inteiro significaria testar dezenas de tiles a
cada frame. A solução padrão é uma **tabela de consulta separada, construída
para esse propósito** — não necessariamente os mesmos dados do seu tilemap
visível — indexada por posição, dando uma resposta instantânea de
sólido/passável.

O background deste tutorial é uma listra repetida sem "paredes" naturais, então
vamos construir um mapa de colisão independente: dividir a tela de 256×224 em
células de 32×32 pixels (8 colunas × 7 linhas = 56 células) e marcar as células
da borda como sólidas, mantendo o jogador dentro da área de jogo:

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

Como cada célula tem 32 pixels (`2^5`), converter uma coordenada de pixel em um
índice de célula é apenas um shift, não uma divisão:

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

### Usando isso para controlar movimento

Em vez de aplicar incondicionalmente o movimento do D-pad da Lição 11, verifique
se a célula de *destino* é passável primeiro. Aqui está o padrão para uma
direção — Direita — as outras três seguem a mesma forma:

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

Esse é o mesmo formato que você vai reconhecer de todo loop de "registrador
vigia" desde a Lição 4, aplicado à lógica em vez de hardware: calcule um valor
candidato, verifique-o contra uma tabela, só confirme se ele passar.

## Compile e execute

Com as duas peças no lugar, o sprite do jogador agora para nas bordas do limite
de 32 pixels em vez de rolar para fora da área de jogo visível, e tocar o
sprite de parede parado é algo que seu código consegue detectar (mesmo que nada
reaja visivelmente a isso ainda — é isso que a [Lição 16](16-capstone.md)
adiciona).

## Exercícios

1. Termine os casos de Esquerda/Cima/Baixo do padrão de controle de movimento
   acima.
2. Faça `check_collision` reagir a algo observável — por exemplo, mudando o
   número de tile do próprio sprite de parede quando ele é tocado, para você
   ter confirmação visual sem esperar pelo projeto final.
3. O mapa de colisão aqui é escrito à mão. Jogos de verdade geram dados de
   colisão a partir da mesma fonte que seu tilemap visual (geralmente marcando
   certos números de tile como sólidos quando o nível é construído). Esboce —
   em comentários, não código completo — como você transformaria o tilemap da
   Lição 6 em um mapa de colisão automaticamente, dada uma regra como "números
   de tile 16 e acima são sólidos".

---

Root: [README.md](README.md)
Previous: [Lição 11 — Entrada do controle & animação de sprite](11-controller-input-and-animation.md)
Next: [Lição 13 — O SPC700 & fundamentos de áudio](13-spc700-and-audio-basics.md)
