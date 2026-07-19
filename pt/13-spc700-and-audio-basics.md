# Lição 13: O SPC700 & Fundamentos de Áudio

**Objetivo:** entender por que programar áudio no SNES parece tão diferente de
tudo mais neste tutorial (é um segundo computador, separado), e produzir um som
— sem escrever uma única linha de assembly de SPC700.

## Uma segunda CPU com a qual você mal consegue falar

Toda lição até agora rodou inteiramente no 65816. O som é diferente: o SNES tem
um segundo processador completamente independente, o **SPC700**, com seus
próprios 64 KB de RAM (chamada de ARAM) e seu próprio conjunto de instruções,
dedicado a controlar o hardware de áudio (o DSP). O 65816 não consegue ler ou
escrever na ARAM diretamente, e o SPC700 não consegue ver o resto da memória do
console de forma alguma. A *única* conexão entre os dois são quatro portas de
comunicação de um byte cada:

```
$2140-$2143  (65816 side, APUIO0-3)
$00F4-$00F7  (SPC700 side, same four ports, different addresses)
```

O que quer que o 65816 escreva em `$2140`, o SPC700 lê de volta em `$00F4` — e
vice-versa. Essa é a interface inteira. A música e os efeitos sonoros de todo
jogo de SNES entram na ARAM através dessa caixa de correio de quatro bytes,
usando um protocolo de handshake em tempo de boot embutido na ROM de boot do
SPC700 (sua "IPL ROM").

Este tutorial não escreve um driver de áudio de SPC700 do zero — isso é um
projeto substancial por si só, e jogos de verdade quase universalmente usam um
motor de som já existente e testado em batalha, em vez de escrever um a partir
de princípios primeiros. O que esta lição *cobre* — o handshake de upload, e um
truque interessante para fazer som com zero código de SPC700 — é a peça sobre a
qual todo driver, por mais sofisticado que seja, no fim das contas se apoia.

## O handshake de boot

Este protocolo (e as rotinas abaixo) seguem de perto a receita bem
documentada e há muito estabelecida da página ["Booting the SPC700" da SNESdev
wiki](https://snes.nesdev.org/wiki/Booting_the_SPC700) — vale a pena ler
diretamente se você quiser todo o detalhe sobre uploads indiretos/relocáveis,
que esta lição não precisa.

**Passo 1 — esperar o "pronto".** Ao ligar, a ROM de boot do SPC700 escreve
`$AA` em `APUIO0` e `$BB` em `APUIO1` assim que termina de inicializar:

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

**Passo 2 — iniciar um upload em um endereço dado**, e **passo 3 — enviar bytes
um de cada vez**, cada um confirmado antes do próximo ser enviado:

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

Este tutorial não precisa de uma rotina de "iniciar execução" — o truque na
próxima seção pula completamente a execução de qualquer programa enviado para o
SPC700.

## Produzindo um som sem escrever código de SPC700

O chip de áudio do SPC700 (o DSP) tem 128 registradores de um byte controlando
volume, pitch e reprodução para 8 vozes independentes. Normalmente, só o código
do SPC700 consegue tocar neles. Mas a ROM de boot tem um caso especial: se você
mirar o endereço de upload `$00F2`, os dois bytes que você envia são
interpretados diretamente como *(número do registrador DSP, valor)* —
significando que **você pode controlar o DSP a partir do 65816 sozinho**, sem
nenhum programa de SPC700 rodando. Essa é uma técnica genuinamente útil, não só
um atalho didático — é uma forma real e documentada de conseguir um bipe simples
antes de um driver de música completo existir em um projeto.

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

Mesmo o DSP precisa de *algo* para tocar, porém — uma pequena forma de onda em
loop na ARAM, enviada primeiro da forma normal. Essa amostra BRR do tamanho de
um tile (o formato de áudio comprimido do SNES; dois bytes de cabeçalho
descrevendo pontos de loop, depois uma pequena forma de onda repetitiva) é o
suficiente para um tom de teste:

```asm
sample:
    .word $0204      ; sample directory: this sample's start address
    .word $0204       ; sample directory: this sample's loop point
    .byte $B0,$78,$78,$78,$78,$78,$78,$78,$78
    .byte $B3,$78,$78,$78,$78,$78,$78,$78,$78
sample_end:
```

## Juntando tudo

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

Depois, uma sequência de chamadas a `write_dsp` configura a voz 0 e a coloca
para tocar:

| Chamada | Registrador | Significado |
|---|---|---|
| `ldx #$206C` | `FLG` | Proteção de escrita do buffer de eco ligada (padrão seguro) |
| `ldx #$004C` | `KON` | Key-on: nenhuma voz ainda |
| `ldx #$FF5C` | `KOFF` | Key-off: silenciar tudo primeiro |
| `ldx #$025D` | `DIR` | Diretório de amostras na página 2 da ARAM (`$0200`), batendo com o upload acima |
| `ldx #$7F00` / `ldx #$7F01` | `VOLL`/`VOLR` (voz 0) | Volume máximo, ambos os canais |
| `ldx #$0002` / `ldx #$0203` | `PITCHL`/`PITCHH` (voz 0) | Taxa de reprodução — isso define o pitch do tom |
| `ldx #$0004` | `SRCN` (voz 0) | Usa a entrada 0 do diretório de amostras (a que enviamos) |
| `ldx #$C305` / `ldx #$2F06` | `ADSR1`/`ADSR2` (voz 0) | Habilita o envelope de volume |
| `ldx #$005C` | `KOFF` | Limpa o key-off (desfaz o silenciamento anterior) |
| `ldx #$7F0C` / `ldx #$7F1C` | `MVOLL`/`MVOLR` | Volume master, máximo |
| `ldx #$014C` | `KON` | **Key on da voz 0 — esta linha inicia o som** |

Cada uma dessas é uma chamada a `write_dsp` com aquele valor. Compile, execute,
e você deve ouvir um tom contínuo começando no momento em que a última chamada
a `write_dsp` executa.

## Exercícios

1. Mude os valores de `PITCHH`/`PITCHL` (`$0203`/`$0002`) e recompile — valores
   mais altos elevam o pitch. Encontre mais ou menos onde ele para de soar como
   um tom reconhecível e começa a distorcer feio; isso é uma limitação real
   dessa forma de onda pequena escrita à mão, não um erro.
2. Dispare a escrita de `KON` (só essa chamada a `write_dsp`) de dentro do
   `nmi_handler`, condicionada a um botão pressionado em vez de rodar uma vez no
   início — essa é a forma sobre a qual a [Lição 14](14-music-and-sound-effects.md)
   se constrói.
3. Leia a fonte ["Writing to DSP Registers Without any SPC-700
   Code"](https://wiki.superfamicom.org/how-to-write-to-dsp-registers-without-any-spc-700-code)
   na qual esta lição se baseia, e identifique quais linhas do `manual_dsp.s`
   dela correspondem a cada linha da tabela acima — uma boa forma de confirmar
   que você de fato entende o que cada chamada a `write_dsp` está fazendo, em
   vez de só reconhecer o padrão da tabela.

---

Root: [README.md](README.md)
Previous: [Lição 12 — Detecção de colisão](12-collision-detection.md)
Next: [Lição 14 — Música & efeitos sonoros](14-music-and-sound-effects.md)
