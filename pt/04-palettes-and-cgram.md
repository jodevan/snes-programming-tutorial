# Lição 4: Paletas & CGRAM

**Objetivo:** ir de "escrever uma cor na CGRAM" (Lição 1) até "carregar uma paleta
inteira a partir da ROM em um loop" — a técnica da qual todo gráfico das próximas
lições depende.

## Um recapitulação rápida do formato de cor

Toda cor do SNES tem 15 bits, empacotados em uma word de 16 bits, organizados como
`-bbbbbgg gggrrrrr`: 5 bits para azul, verde e vermelho cada, bit mais alto não
usado.

| Cor | Valor |
|---|---|
| Preto | `$0000` |
| Vermelho | `$001F` |
| Verde | `$03E0` |
| Azul | `$7C00` |
| Branco | `$7FFF` |

A CGRAM contém 256 dessas — 512 bytes ao todo. Ela é endereçada como um array
plano de *índices* de cor de 0 a 255, não como "paletas" separadas; a ideia de
dividi-la em dezesseis paletas de 16 cores (ou de forma mais fina, para tiles de
menor profundidade de bits) é uma convenção que os tiles de background e de sprite
impõem sobre esse array plano — as lições [6](06-backgrounds-and-tilemaps.md) e
[10](10-sprites-oam-basics.md) cobrem como o número de paleta de um tile escolhe de
qual fatia da CGRAM ele desenha.

A entrada 0 da paleta (índice de cor 0) é especial: sem nenhuma camada de
background ou sprite habilitados, ela é a única coisa visível — a cor de fundo
simples que você vem observando desde a Lição 1.

## CGADD e CGDATA, precisamente {#cgadd-and-cgdata-precisely}

Pela [referência de registradores](https://wiki.superfamicom.org/registers#cgadd-cgram-address-487):

```
$2121  wb+++-
        cccccccc        <- CGADD: sets the color INDEX (0-255)

$2122  ww+++-
        -bbbbbgg gggrrrrr   <- CGDATA: writes the color at that index
```

`CGDATA` é um registrador de "escrita dupla": a primeira escrita depois de
configurar `CGADD` fornece o byte baixo, a segunda fornece o byte alto, e *só
depois que o byte alto chega* é que a cor de fato é atualizada e o índice
auto-incrementa. Isso importa por causa de uma sutileza que a documentação do
registrador aponta explicitamente: escritas em CGRAM são bufferizadas exatamente
como as escritas na tabela baixa da OAM (a Lição 10 retoma essa comparação) — se
você escrever byte-baixo, byte-baixo, byte-alto em sequência sem a alternância
esperada, você não vai obter a cor que espera. Na prática, a correção é simples e
este tutorial a segue em todo lugar: sempre escreva CGDATA em pares estritos de
byte-baixo-depois-byte-alto, uma cor completa de cada vez, nunca intercalada com
outra coisa.

## Carregando uma paleta a partir da ROM

Aqui está o padrão geral para escrever N cores começando em algum índice de CGRAM,
a partir de uma tabela guardada na ROM:

```asm
; Writes (count) colors from (table) into CGRAM starting at (start_index).
; Assumes: 8-bit A, 16-bit X/Y (the Lesson 1 convention).
.a8
.i16
load_palette:
    lda #start_index
    sta $2121           ; CGADD: point CGRAM at the first entry we'll touch

    ldx #0
@loop:
    lda table,x          ; low byte of this color
    sta $2122
    inx
    lda table,x           ; high byte of this color
    sta $2122
    inx
    cpx #(count*2)
    bne @loop
    rts
```

Esse é um loop guiado pela CPU — o 65816 toca em cada byte, um por um. Funciona
bem para um punhado de cores, mas é o jeito lento: a [Lição
8](08-dma-and-hdma.md) substitui exatamente esse loop por uma transferência de DMA
que copia a tabela inteira em uma única operação de hardware, sem loop nenhum.
Vale a pena aprender a versão manual primeiro, porém, porque é ela que faz a versão
com DMA fazer sentido — DMA é basicamente "o mesmo loop de escrita na porta da PPU,
só que o hardware faz o looping."

## Estendendo a ROM da Lição 1

Adicione uma pequena tabela de paleta e uma chamada para `load_palette` logo depois
da configuração de CPU/PPU, substituindo a escrita de cor única de duas instruções
da Lição 1:

```asm
; --- add near the top of the CODE segment, alongside reset: ---

palette_table:
    .word $0000     ; index 0: black (backdrop)
    .word $001F     ; index 1: red
    .word $03E0     ; index 2: green
    .word $7C00     ; index 3: blue
palette_table_end:

.define PALETTE_COUNT ((palette_table_end - palette_table) / 2)
```

E dentro de `reset:`, substitua as linhas antigas de escrita em CGRAM por:

```asm
    ; --- Load our 4-color palette into CGRAM, starting at index 0. ---
    stz $2121
    ldx #0
@pal_loop:
    lda palette_table,x
    sta $2122
    inx
    lda palette_table,x
    sta $2122
    inx
    cpx #(PALETTE_COUNT*2)
    bne @pal_loop
```

Compile e execute exatamente como na Lição 1. **A tela ainda vai parecer idêntica**
— preto sólido agora, já que o índice 0 da paleta é preto nesta tabela, e nada
ainda exibe os índices 1-3. Isso é esperado e vale a pena parar um segundo para
digerir: você construiu infraestrutura de verdade (um carregador de paleta
reutilizável, guiado por tabela) que não produz *nenhuma mudança visível*, porque
nada ainda está pedindo para usar as cores 1-3. A [Lição 5](05-tiles-and-vram.md)
cria um tile, e a [Lição 6](06-backgrounds-and-tilemaps.md) é onde essas outras
três cores finalmente aparecem na tela. Programar hardware gráfico costuma
funcionar assim — você instala os canos antes da água passar por eles.

## Exercícios

1. Mude `palette_table` para usar índice 0 = azul em vez de preto, recompile, e
   confirme que a cor de fundo muda — essa é a única parte do trabalho desta lição
   que você *consegue* ver imediatamente.
2. `load_palette` acima escreve de forma fixa a partir do índice 0 da CGRAM.
   Modifique-a (ou escreva uma segunda chamada) para carregar uma *segunda*
   paleta de 4 cores começando no índice 4 da CGRAM, sem duplicar o loop inteiro —
   pense no que precisaria virar um parâmetro.
3. As [entradas CGWSEL/CGADSUB/COLDATA da página de
   Registradores](https://wiki.superfamicom.org/registers#cgwsel-color-addition-select-588)
   descrevem "color math" — misturar duas cores por hardware. Dê uma olhada
   rápida, só o suficiente para responder: color math muda o que está armazenado
   na CGRAM, ou muda o que é calculado no momento da renderização? Este tutorial
   não implementa color math, mas saber a resposta vai poupar confusão se você vir
   isso no código de outras pessoas.

---

Root: [README.md](README.md)
Previous: [Lição 3 — Mapa de memória do SNES & registradores de hardware](03-memory-map-and-registers.md)
Next: [Lição 5 — Tiles & VRAM](05-tiles-and-vram.md)
