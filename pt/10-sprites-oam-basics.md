# Lição 10: Fundamentos de Sprites (OAM)

**Objetivo:** colocar um objeto que se move independentemente na tela, por cima
do background com rolagem da [Lição 9](09-background-scrolling.md). Sprites (o
SNES os chama de "objetos", daí `OBJ`/`OAM`) são um sistema genuinamente
diferente dos backgrounds — memória separada, faixa de paleta separada, regras
de formato de tile separadas — então esta lição os trata do zero, em vez de
como uma variação das Lições 5-6.

## OAM: 128 sprites, duas tabelas

A Object Attribute Memory guarda os dados de todos os 128 sprites, dividida em
uma **tabela baixa** (512 bytes, 4 bytes por sprite) e uma **tabela alta** (32
bytes, 2 bits por sprite). Pela [referência de
sprites](https://wiki.superfamicom.org/sprites#oam):

```
Low table, 4 bytes per sprite:
  byte 0: xxxxxxxx   X position (low 8 bits)
  byte 1: yyyyyyyy   Y position
  byte 2: cccccccc   Starting tile number
  byte 3: vhoopppN   flip/priority/palette/name-table bits

High table, 2 bits per sprite:
  bit 0: X position, bit 8 (sprites can be positioned up to X=511)
  bit 1: size flag (0 = small, 1 = large, per OBSEL's two configured sizes)
```

As duas tabelas compartilham o mesmo padrão de acesso "registrador de endereço,
registrador de dados" que você já conhece: `OAMADDL`/`OAMADDH` (`$2102`/`$2103`)
configuram o endereço, `OAMDATA` (`$2104`) escreve nele e avança
automaticamente — e o endereço interno de 10 bits naturalmente rola da tabela
baixa direto para a tabela alta assim que você passa do byte 511, então **um
único loop de escrita contínuo consegue preencher as duas tabelas** sem
reiniciar o endereço no meio do caminho.

Uma peculiaridade que vale a pena conhecer antes que ela te confunda: escritas
na tabela baixa da OAM são bufferizadas exatamente como o `CGDATA` era na [Lição
4](04-palettes-and-cgram.md#cgadd-and-cgdata-precisely) — o par de bytes de um
sprite não chega de fato até você ter escrito as duas metades da word relevante
em sequência. Na prática, escrever os 4 bytes de um registro de sprite em ordem,
um depois do outro, é exatamente o certo, e isso nunca vira um problema.

## OBSEL: tamanhos e onde os tiles de sprite vivem na VRAM

```
$2101  wb++?-
        sssnnbbb
        sss = size selection (000 = 8x8 and 16x16; this lesson uses 8x8)
        nn  = Name Select (offset to the second tile table, for N=1 sprites)
        bbb = Name Base Select, as (VRAM byte address) >> 14
```

Repare que o deslocamento aqui é `>>14`, não o `>>12` que você usou para o
`BG34NBA` na Lição 6 — a memória de tile de sprite é endereçada em páginas de 16
KB, não de 4 KB. Confundir isso (usar a convenção `>>12` do BG para uma base de
sprite, ou vice-versa) é um erro muito fácil de cometer, com um sintoma
confuso: seu sprite renderiza, mas mostra os dados de tile errados, deslocado
para o que quer que esteja de fato no endereço mal calculado.

Os tiles de sprite precisam do próprio espaço, separado dos dados de tile do
`BG3` (Lição 5, byte `$0000` da VRAM) e do tilemap (Lição 6, byte `$1000` da
VRAM). Esta lição usa o endereço de byte `$4000` — livre dos dois — então
`bbb = $4000 >> 14 = 1`.

## Sprites são sempre 4bpp

Diferente dos backgrounds, cuja profundidade de cor depende do modo de BG (a
Lição 6 usou o 2bpp do `BG3`), **tiles de sprite são sempre 4bpp** (16 cores) —
essa é uma regra fixa de hardware, não uma configuração. Um tile 4bpp tem 32
bytes: o mesmo formato intercalado de bitplane-0/1 da Lição 5, por 16 bytes,
seguido imediatamente pelos bitplanes 2/3 no mesmo formato, por mais 16 bytes.
Um único tile de sprite 8x8 de cor sólida usando o índice de cor 1 (bitplane0
ligado, bitplanes 1-3 desligados) fica assim:

```asm
sprite_tile:
    .byte $FF, $00     ; row 0: bitplane0, bitplane1
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00
    .byte $FF, $00     ; 16 bytes so far (bitplanes 0/1)
    .byte $00, $00     ; row 0: bitplane2, bitplane3
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00
    .byte $00, $00     ; 16 more bytes (bitplanes 2/3) = 32 total
sprite_tile_end:
```

## Paletas de sprite

Sprites usam os índices 128-255 da CGRAM, divididos em 8 paletas de 16 cores
cada (`ppp` no byte de atributos da OAM seleciona qual). A entrada 0 de paleta
de cada bloco de 16 cores é transparente, mesma regra dos backgrounds. Para a
paleta 0 (`ppp=000`), o índice de cor 1 mora no índice 129 da CGRAM. Carregue-a
da mesma forma que você carregou as cores de BG na Lição 4:

```asm
    lda #129
    sta $2121         ; CGADD: sprite palette 0, index 1
    lda #$FF
    sta $2122          ; low byte
    lda #$03
    sta $2122           ; high byte -> color $03FF (yellow)
```

## Estendendo sua ROM

Carregue os dados de tile e a paleta acima (via um loop de CPU ou as técnicas
de DMA da [Lição 8](08-dma-and-hdma.md) — sua escolha), configure `OBSEL`,
depois preencha a OAM: um sprite visível, todo o resto empurrado para fora da
tela para não renderizar como um tile perdido no canto superior esquerdo (a
posição padrão se deixado todo em zero):

```asm
    lda #$01
    sta $2101          ; OBSEL: 8x8/16x16 sizes, name base = VRAM byte $4000

    stz $2102
    stz $2103           ; OAMADDL/H: start at OAM address 0

    ; --- Sprite 0: our one visible sprite ---
    lda #120
    sta $2104           ; X = 120
    lda #100
    sta $2104            ; Y = 100
    stz $2104             ; tile number = 0
    stz $2104              ; attributes = 0 (no flip, priority 0, palette 0)

    ; --- Sprites 1-127: push off-screen (Y = -16, i.e. $F0) ---
    ldx #127
@hide_loop:
    stz $2104
    lda #$F0
    sta $2104
    stz $2104
    stz $2104
    dex
    bne @hide_loop

    ; --- High table: 32 bytes, all zero (small size, X < 256 for everyone) ---
    ldx #32
@hightable_loop:
    stz $2104
    dex
    bne @hightable_loop

    ; --- Enable OBJ on the main screen, alongside BG3 from Lesson 6 ---
    lda #$14             ; TM: bit 2 (BG3) | bit 4 (OBJ)
    sta $212C
```

## Compile e execute

Agora você deve ver um quadrado 8×8 amarelo sólido, parado em uma posição fixa,
por cima do background listrado com rolagem da Lição 9. Ele ainda não se move —
a [Lição 11](11-controller-input-and-animation.md) lê o controle e te dá
controle sobre ele.

## Exercícios

1. Mude os bits `sss` do `OBSEL` para `011` (16x16 e 32x32) e configure o bit de
   tamanho de atributo/tabela-alta da OAM do sprite 0 para selecionar o maior
   dos dois. Você vai precisar de um tile maior (ou quatro tiles 8x8 arranjados
   como um bloco 16x16 — veja as [regras de wrapping da tabela de
   caracteres](https://wiki.superfamicom.org/sprites#character-table-in-vram))
   para preenchê-lo corretamente.
2. Adicione um segundo sprite visível usando uma paleta diferente (`ppp=1`,
   cores 144-159) em outro lugar da tela, sem atrapalhar o loop de fora-da-tela
   dos 126 sprites restantes.
3. Usando os PPU Viewers da [Lição 7](07-debugging-with-mesen.md), abra o
   visualizador de sprites e confirme que os sprites 1-127 de fato mostram
   `Y = -16` e são excluídos da lista visível — uma boa forma de construir
   confiança em código como o loop de esconder acima, antes de você precisar
   depurar um sprite que misteriosamente não desaparece.

---

[Home](../docs/pt/index.html) |
Previous: [Lição 9 — Rolagem de background](09-background-scrolling.md)
Next: [Lição 11 — Entrada do controle & animação de sprite](11-controller-input-and-animation.md)
