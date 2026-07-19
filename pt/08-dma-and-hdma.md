# Lição 8: Mergulho Profundo em DMA & HDMA

**Objetivo:** substituir os loops de CPU das Lições
[4](04-palettes-and-cgram.md)-[6](06-backgrounds-and-tilemaps.md) por
transferências de DMA por hardware, e depois usar HDMA para fazer algo que um
loop de CPU fundamentalmente não consegue: mudar um registrador no meio da tela,
uma vez por scanline, de graça.

## DMA: deixe o hardware fazer o loop

Todo padrão "configure um registrador de endereço, depois faça um loop escrevendo
em um registrador de dados" das Lições 4-6 é exatamente o que o DMA (Direct
Memory Access) automatiza. Você configura uma origem, um destino, uma contagem e
um formato de transferência, vira um bit, e o hardware move os bytes — a CPU fica
pausada durante esse tempo, mas nenhuma instrução executa a cópia.

Existem 8 canais de DMA independentes, cada um controlado por um bloco de
registradores em `$43x0`-`$43xA` (`x` = número do canal, 0-7):

| Registrador | Endereço | Finalidade |
|---|---|---|
| `DMAPx` | `$43x0` | Direção, modo de endereçamento, incremento/fixo, formato de transferência |
| `BBADx` | `$43x1` | Destino: byte baixo do registrador `$21xx` alvo |
| `A1TxL/H` | `$43x2`/`$43x3` | Endereço de origem, byte baixo/alto |
| `A1Bx` | `$43x4` | Endereço de origem, byte de banco |
| `DASxL/H` | `$43x5`/`$43x6` | Número de bytes a transferir |

Os bits de formato de transferência do `DMAPx` (`ttt`) importam bastante — eles
decidem como os bytes de origem mapeiam para os registradores de destino por
"unidade" da transferência. Os três que esta lição usa:

```
000 = 1 register write once   (1 byte : p)
001 = 2 registers write once  (2 bytes: p, p+1)
010 = 1 register write twice  (2 bytes: p, p)
```

O modo `010` encaixa naturalmente no padrão de escrita baixo-depois-alto do
CGDATA; o modo `001` encaixa naturalmente em `VMDATAL`/`VMDATAH` (dois
registradores adjacentes de um byte cada). Você já aprendeu os dois padrões de
escrita manualmente — DMA é o mesmo formato, executado por hardware.

## Reescrevendo o carregamento de paleta

O loop `load_palette` da Lição 4 vira:

```asm
    stz $2121           ; CGADD: still need to set the starting index by hand

    lda #<palette_table
    sta $4302            ; A1T0L
    lda #>palette_table
    sta $4303            ; A1T0H
    lda #^palette_table
    sta $4304            ; A1B0 (bank byte)
    lda #(PALETTE_COUNT*2)
    sta $4305             ; DAS0L: byte count, low
    stz $4306              ; DAS0H: byte count, high (0 since count < 256)

    lda #%00000010         ; DMAP0: CPU->PPU, incrementing source, mode 010
    sta $4300
    lda #$22                ; BBAD0: target $2122 (CGDATA)
    sta $4301

    lda #$01                 ; MDMAEN: fire channel 0
    sta $420B
```

`^palette_table` é sintaxe do ca65 para "o byte de banco do endereço deste
rótulo" — novidade aqui porque endereços de origem de DMA são endereços completos
de 24 bits, diferente do endereçamento absoluto que você usou até agora.

## Reescrevendo o carregamento de tile

Mesmo formato, modo `001` desta vez, já que `VMDATAL`/`VMDATAH` são dois
registradores adjacentes separados, em vez de um único registrador de
escrita-dupla:

```asm
    lda #$80
    sta $2115            ; VMAIN (unchanged from Lesson 5)
    stz $2116
    stz $2117             ; VMADDL/H: word address 0 (unchanged)

    lda #<tile_stripe
    sta $4302
    lda #>tile_stripe
    sta $4303
    lda #^tile_stripe
    sta $4304
    lda #(tile_stripe_end - tile_stripe)
    sta $4305
    stz $4306

    lda #%00000001          ; DMAP0: CPU->PPU, incrementing source, mode 001
    sta $4300
    lda #$18                 ; BBAD0: target $2118 (VMDATAL, then VMDATAH)
    sta $4301

    lda #$01
    sta $420B
```

## Um truque de DMA: preenchendo memória sem uma tabela grande

O loop de tilemap da Lição 6 escreveu o mesmo valor (`$0000`) 1024 vezes. Copiar
uma tabela de origem com 1024 entradas seria um desperdício quando toda entrada é
idêntica — e o DMA tem um bit exatamente para esse caso. O bit 4 do `DMAPx`
(`f`, "transferência fixa") impede o endereço de *origem* de avançar, então todo
byte transferido relê o mesmo único byte de origem:

```asm
zero_byte:
    .byte 0

    ; ... (VMADDL/H already point at the tilemap's VRAM location)

    lda #<zero_byte
    sta $4302
    lda #>zero_byte
    sta $4303
    lda #^zero_byte
    sta $4304
    lda #<2048               ; 1024 words = 2048 bytes total
    sta $4305
    lda #>2048
    sta $4306

    lda #%00010001            ; DMAP0: fixed source (bit 4 set), mode 001
    sta $4300
    lda #$18                   ; BBAD0: $2118/$2119 again
    sta $4301

    lda #$01
    sta $420B
```

Um byte de ROM, uma chamada de DMA, 2048 bytes escritos. Esse idioma de
"preenchimento por DMA" aparece constantemente em código real de SNES para
limpar buffers de VRAM, OAM ou WRAM.

Troque os três loops da sua ROM pelos equivalentes em DMA, recompile, e confirme
no Mesen que a tela parece exatamente como no final da Lição 6 — mesmo resultado
visual, com muito menos tempo de CPU gasto para produzi-lo. Se você quiser ver
isso concretamente em vez de apenas confiar, o Event Viewer da [Lição
7](07-debugging-with-mesen.md) vai mostrar as transferências de DMA como uma
única rajada compacta, em vez da longa sequência espalhada de escritas
individuais que as versões com loop de CPU produziam.

## HDMA: uma escrita de registrador, uma vez por scanline, automaticamente

O DMA roda uma vez e para. O **HDMA** (H-Blank DMA) é diferente: em vez de
transferir um bloco de uma vez, ele executa uma pequena transferência *por
scanline*, automaticamente, durante o frame inteiro, com envolvimento zero da CPU
depois de configurado. É assim que o SNES consegue efeitos que uma CPU jamais
conseguiria acompanhar manualmente — mudanças de cor por scanline, scroll
dividido, e gradientes.

Canais de HDMA usam o mesmo bloco de registradores que o DMA (`$43x0`-`$43xA`),
só que interpretado de forma um pouco diferente, mais um registrador novo:

| Registrador | Endereço | Finalidade |
|---|---|---|
| `A2AxL/H` | `$43x8`/`$43x9` | Posição atual na tabela de HDMA (gerenciada automaticamente) |
| `NLTRx` | `$43xA` | Contador de linhas: quantas scanlines faltam até a próxima entrada da tabela carregar |

Uma tabela de HDMA é uma sequência de grupos `(byte de contagem de linhas, bytes
de dados...)`, terminada por um byte de contagem `$00`. O bit mais alto de cada
byte de contagem é uma flag de "repetição" (reenviar o mesmo dado a cada linha
enquanto conta regressivamente, em vez de uma única vez); esta lição a deixa
zerada (`0`) para um efeito **em faixas** simples — uma escrita, mantida por N
scanlines, depois a próxima entrada.

### Um gradiente de brilho

Vamos fazer a tela inteira esmaecer de claro para escuro, de cima para baixo,
controlando o `INIDISP` (`$2100` — o mesmo registrador de brilho da Lição 1) com
HDMA em vez de um valor fixo. 16 faixas de 14 scanlines cada cobrem todas as 224
linhas visíveis:

```asm
hdma_gradient:
    .byte 14, $0F
    .byte 14, $0E
    .byte 14, $0D
    .byte 14, $0C
    .byte 14, $0B
    .byte 14, $0A
    .byte 14, $09
    .byte 14, $08
    .byte 14, $07
    .byte 14, $06
    .byte 14, $05
    .byte 14, $04
    .byte 14, $03
    .byte 14, $02
    .byte 14, $01
    .byte 14, $00
    .byte 0             ; terminator
```

Configure o canal 1 (mantido separado do canal 0 de DMA usado acima, para evitar
qualquer confusão entre os dois) para uma transferência de um único registrador,
escrita única, tendo o `INIDISP` como alvo:

```asm
    lda #<hdma_gradient
    sta $4312             ; A1T1L
    lda #>hdma_gradient
    sta $4313              ; A1T1H
    lda #^hdma_gradient
    sta $4314               ; A1B1

    lda #%00000000            ; DMAP1: direct table, mode 000 (1 byte)
    sta $4310
    lda #$00                   ; BBAD1: target $2100 (INIDISP)
    sta $4311

    lda #%00000010               ; HDMAEN: enable channel 1
    sta $420C
```

Faça isso *em vez do* `lda #$0F / sta $2100` fixo e final da Lição 1 — o HDMA vai
controlar `INIDISP` para você, em toda scanline, a partir daqui, relendo
automaticamente a tabela desde o topo no início de todo frame. Compile e execute:
você deve ver o background listrado esmaecer de brilho total no topo da tela até
preto na parte de baixo, um gradiente limpo de 16 passos, sem tempo de CPU gasto
depois da configuração inicial.

O timing exato, scanline por scanline, de quando o dado de uma entrada da tabela
é (re-)transferido em relação à recarga do contador de linhas tem alguns casos
extremos genuinamente sutis — até a [referência oficial de
registradores](https://wiki.superfamicom.org/registers#dasxl-dma-sizehdma-indirect-address-low-byte-x0-7-1101)
é cautelosa em parte da letra miúda aqui. A receita de gradiente em faixas acima
é um padrão bem estabelecido e confiável; se você começar a construir efeitos com
precisão por scanline (em vez de por faixa), reserve tempo para testar contra o
comportamento real do hardware no Mesen em vez de confiar só em um modelo mental —
e revisite o Event Viewer da [Lição 7](07-debugging-with-mesen.md), que é a
ferramenta certa para observar exatamente quando cada escrita de HDMA de fato
acontece.

## Exercícios

1. Mude a tabela de gradiente para esmaecer na direção *oposta* (escuro em cima,
   claro embaixo), invertendo a sequência de bytes.
2. `DASxL`/`DASxH` para um canal de *DMA* contam regressivamente enquanto a
   transferência roda, terminando em 0. O que esses mesmos registradores
   significam para um canal de HDMA *indireto* em vez disso? (Veja a [entrada do
   registrador
   DASx](https://wiki.superfamicom.org/registers#dasxl-dma-sizehdma-indirect-address-low-byte-x0-7-1101) —
   este tutorial só usa HDMA direto, mas vale saber que o modo indireto existe.)
3. Usando o truque de preenchimento por DMA, escreva uma rotina que zere todos
   os 544 bytes da OAM (memória de sprites) em uma única chamada de DMA, em
   preparação para a [Lição 10](10-sprites-oam-basics.md).

---

Root: [README.md](README.md)
Previous: [Lição 7 — Depurando com o Mesen](07-debugging-with-mesen.md)
Next: [Lição 9 — Rolagem de background](09-background-scrolling.md)
