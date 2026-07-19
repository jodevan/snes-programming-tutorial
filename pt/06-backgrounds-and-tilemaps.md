# Lição 6: Backgrounds & Tilemaps

**Objetivo:** a lição da recompensa. Você tem uma paleta (Lição 4) e um tile
(Lição 5) parados na memória sem fazer nada — esta lição constrói o tilemap que
finalmente os coloca na tela, e liga a camada de background que os exibe.

## Mais duas peças: modos de BG e tilemaps

Uma camada de background precisa de três coisas, duas das quais você já tem:

1. **Dados de caractere** — os bitmaps de tile (construídos na [Lição
   5](05-tiles-and-vram.md)).
2. **Um tilemap** — uma grade que diz *qual* tile (e qual paleta) vai em cada
   célula da tela. Isso é novo nesta lição.
3. **Um modo de BG** — uma configuração global (`BGMODE`, `$2105`) que decide
   quantas camadas de background existem e quantas cores cada uma recebe.

### Modos de BG, brevemente

O SNES tem 8 modos de background, selecionados pelos 3 bits mais baixos de
`$2105`. Os modos trocam "quantas camadas" por "quantas cores por camada" — veja a
[tabela completa de modos de BG](https://wiki.superfamicom.org/backgrounds#bg-modes)
para todos os oito. Este tutorial usa o **Modo 1**: duas camadas de 16 cores
(4bpp) mais uma camada de 4 cores (2bpp). Vamos ligar só a camada 2bpp, `BG3`, já
que ela combina com o tile que você já construiu na Lição 5.

```
$2105  wb+++-
        DCBAemmm
        mmm = 001           -> Mode 1
        e   = 0             -> BG3 priority bit, default behavior
        A/B/C/D = 0         -> all BGs use 8x8 tiles, not 16x16
```

### O formato das entradas do tilemap

Um tilemap é uma grade de entradas de 16 bits, uma por célula de tela de 8×8 (ou
16×16). Pela [referência de
backgrounds](https://wiki.superfamicom.org/backgrounds#tile-maps--character-maps):

```
vhopppcc cccccccc
v/h  = vertical/horizontal flip this tile
o    = tile priority
ppp  = palette number for this tile
cccccccccc = tile number (10 bits)
```

A entrada "vazia" padrão `$0000` significa: sem flip, prioridade 0, paleta 0,
tile 0 — que é exatamente o tile que você construiu na Lição 5, na paleta que
você construiu na Lição 4. Um tilemap preenchido inteiramente com `$0000` vai
mostrar esse mesmo tile listrado, repetido, pela tela toda. É isso que estamos
prestes a construir.

Tilemaps são sempre 32×32 tiles internamente (mais sobre mapas maiores na [Lição
9](09-background-scrolling.md)), o que dá exatamente 256×256 pixels — maior que
a área visível de 256×224, então um único mapa 32×32 já preenche a tela com
sobra.

## Uma pegadinha crucial: endereços de word vs. endereços de byte {#a-crucial-gotcha-word-addresses-vs.-byte-addresses}

Isso engana quase todo mundo na primeira vez. `VMADDL`/`VMADDH` (que você usou
diretamente na Lição 5) sempre recebem um **endereço de word** — a VRAM é,
fundamentalmente, endereçada em 16 bits do lado da CPU. Mas os campos de
*endereço base* dentro de `BG34NBA` (localização dos dados de caractere) e
`BG3SC` (localização do tilemap) descrevem posições no espaço de endereços de
**byte** de 64 KB da VRAM, já pré-deslocados:

```
BG34NBA:  aaaa = BG3 character base, as (byte address) >> 12
BG3SC:    aaaaaa = BG3 tilemap base, as (byte address) >> 10
```

A conversão que você precisa lembrar: **endereço de word = endereço de byte ÷ 2**.
Como a Lição 5 colocou o tile no endereço de word `$0000` da VRAM (endereço de
byte `$0000` também, convenientemente), o campo de BG3 do `BG34NBA` é
simplesmente `0`. Para o tilemap, vamos escolher o endereço de byte `$1000` (bem
longe dos 16 bytes do tile) — isso é o endereço de word `$0800` quando escrevemos
com `VMADDL`/`VMADDH`, mas `$1000 >> 10 = 4` quando escrevemos no `BG3SC`. Dois
registradores diferentes, duas unidades diferentes, o mesmo local físico. Errar
isso (escrever um endereço de word no `BG3SC`, ou vice-versa) produz um sintoma
clássico: os dados do seu tile parecem corretos em um visualizador de VRAM, mas a
tela mostra lixo ou nada — vale lembrar disso quando a [Lição
7](07-debugging-with-mesen.md) cobrir técnicas de depuração.

## Estendendo sua ROM

Adicione isto depois do loop de carregamento de tile na VRAM da Lição 5:

```asm
    ; --- Fill a 32x32 tilemap at VRAM byte $1000 (word $0800) with
    ;     zeros: tile 0, palette 0, no flip, priority 0, everywhere. ---
    lda #$08
    sta $2117           ; VMADDH: word address $0800, high byte
    stz $2116           ; VMADDL: word address $0800, low byte

    ldx #0
@map_loop:
    stz $2118            ; VMDATAL: tile number low byte = 0
    stz $2119             ; VMDATAH: rest of the entry = 0
    inx
    cpx #1024             ; 32*32 = 1024 tilemap entries
    bne @map_loop

    ; --- Point BG3 at that character data and tilemap. ---
    lda #$00
    sta $210C            ; BG34NBA: BG3 character base = byte $0000 (>>12 = 0)
    lda #$10
    sta $2109            ; BG3SC: BG3 tilemap base = byte $1000 (>>10 = 4), 32x32

    ; --- Select BG Mode 1. ---
    lda #$01
    sta $2105            ; BGMODE: mode 1, all BGs 8x8 tiles

    ; --- Enable BG3 on the main screen. ---
    lda #$04
    sta $212C            ; TM: bit 2 = BG3
```

Tudo isso precisa acontecer *antes* da escrita em `INIDISP` que liga a tela (as
últimas linhas do `reset:` da Lição 1) — tudo aqui escreve em registradores da
PPU que só são seguros de tocar durante forced blank ou V-Blank, e forced blank é
exatamente o estado em que a CPU está durante toda essa rotina `reset:`, até bem
perto dessa escrita final de brilho.

## Compile e execute

Monte e execute. Desta vez a tela muda: em vez de uma cor de fundo plana, você
deve ver toda a área visível preenchida com listras horizontais vermelhas e
verdes — o tile da Lição 5, repetido em um tilemap 32×32, renderizado através da
paleta da Lição 4. Esta é a primeira lição em que cada peça anterior do tutorial
visivelmente se junta.

## Exercícios

1. Mude `BG3SC` para colocar o tilemap em uma localização diferente (ainda sem
   sobreposição) na VRAM, recalculando tanto o deslocamento de endereço de byte
   para `BG3SC` quanto o endereço de word para a escrita em
   `VMADDL`/`VMADDH`. Confirme que a exibição não muda — o endereço exato não
   importa, contanto que seja consistente e não colida com os dados do tile.
2. Escreva um valor de tilemap *diferente* para apenas uma entrada (digamos, o
   índice 5 do tilemap) que ative o bit de prioridade ou espelhe o tile, e
   descubra qual quadrado 8×8 na tela mudou como resultado. (Dica: as entradas do
   tilemap preenchem em ordem row-major — a entrada 0 é a célula superior
   esquerda, a entrada 1 é a célula à direita dela.)
3. `TM` (`$212C`) habilita camadas na tela *principal*; `TS` (`$212D`) é o
   registrador idêntico para a *subtela*, usado em efeitos de color-math que este
   tutorial não cobre. Dê uma olhada rápida na entrada dele na [referência de
   registradores](https://wiki.superfamicom.org/registers#tm-main-screen-designation-567),
   só o suficiente para confirmar que ele usa exatamente o mesmo layout de bits
   que o `TM`.

---

Root: [README.md](README.md)
Previous: [Lição 5 — Tiles & VRAM](05-tiles-and-vram.md)
Next: [Lição 7 — Depurando com o Mesen](07-debugging-with-mesen.md)
