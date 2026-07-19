# Lição 1: Configurando as Ferramentas & Sua Primeira ROM

**Objetivo:** fazer o `ca65`/`ld65` e o Mesen funcionarem juntos, entender o que
um arquivo mínimo de ROM de SNES realmente contém, e produzir uma ROM que pinta a
tela com uma cor sólida. Só isso — ainda sem motor gráfico. O objetivo é provar que
todo o ciclo escrever → montar → linkar → executar funciona antes de qualquer coisa
ser construída em cima disso.

## 1. Instale as ferramentas

Você disse que já tem `asar`, `ca65` e Mesen instalados. Forma rápida de confirmar:

```sh
ca65 --version
ld65 --version
```

Se algum dos comandos não for encontrado, instale (ou reinstale) o `cc65` via Homebrew:

```sh
brew install cc65
```

Isso te dá tanto o `ca65` (o montador/assembler) quanto o `ld65` (o linker) — o
cc65 é um conjunto completo (assembler, linker, e um compilador C que você não vai
precisar aqui).

Para o Mesen, confirme que ele abre e consegue carregar uma ROM. Builds recentes do
Mesen são um único pacote de aplicativo; se você o instalou separadamente, o núcleo
de emulação que importa aqui é o núcleo de SNES (às vezes chamado de Mesen-S em
versões antigas, unificado em um único "Mesen" nas versões atuais).

## 2. O que realmente tem dentro de um arquivo de ROM de SNES

Antes de escrever código, é preciso saber o que você está construindo. Um arquivo
`.sfc` é apenas um blob binário simples que é mapeado para o espaço de endereços do
SNES seguindo um padrão específico. Existem dois esquemas de mapeamento comuns,
**LoROM** e **HiROM** — este tutorial usa LoROM do início ao fim porque é mais
simples de raciocinar e é o que a maior parte do material para iniciantes (incluindo
a série do nesdoug) usa.

No LoROM, o cartucho é dividido em blocos de 32 KB, e cada bloco é mapeado na
metade superior (`$8000`–`$FFFF`) de um banco de CPU. Então o offset `$0000` da ROM
acaba no endereço de CPU `$808000`, o offset `$8000` em `$818000`, e assim por diante.

Três posições fixas perto do final do primeiro bloco de 32 KB importam desde já:

| Endereço de CPU | Conteúdo |
|---|---|
| `$80FFC0`–`$80FFD4` | **Cabeçalho**: nome da ROM com 21 bytes (preenchido com espaços), usado por emuladores/flash carts para exibição. |
| `$80FFD5`–`$80FFDF` | **Info da ROM**: modo de mapeamento, tipo de cartucho, tamanho da ROM, tamanho da RAM, região, etc. |
| `$80FFE0`–`$80FFFF` | **Vetores**: endereços para onde a CPU pula em interrupções e reset, tanto em modo nativo quanto em modo de emulação. |

O único vetor com o qual nos importamos agora é o **vetor de reset em modo nativo**
(a última word dessa tabela). Quando o SNES é ligado, o 65816 começa em modo de
emulação compatível com o 6502 e lê imediatamente o vetor de reset *do modo de
emulação*, em `$80FFFC`. Nosso código de reset muda a CPU para o modo nativo já
nas primeiras instruções, então a partir daí os vetores *nativos* passam a valer —
mas o ponto de entrada inicial é sempre o reset do modo de emulação. Vamos escrever
nossa rotina de reset lá, e ela mesma cuidará da troca de modo.

Você não precisa decorar essa tabela — vai voltar a ela depois. O ponto é: uma ROM
de SNES não é "código que começa no endereço 0". É um binário com bytes específicos
em offsets específicos que o hardware lê antes mesmo do seu código rodar.

## 3. A configuração do linker

O `ld65` precisa saber como organizar essas regiões. Crie o `lorom128.cfg`:

```
# lorom128.cfg — ca65 linker config for a 128KB LoROM SNES ROM.

MEMORY {
    ZEROPAGE:   start =      0, size =  $100;
    BSS:        start =   $200, size = $1800;
    ROM:        start =  $8000, size = $8000, fill = yes;
}

SEGMENTS {
    ZEROPAGE:   load = ZEROPAGE,    type = zp;
    BSS:        load = BSS,         type = bss, align = $100;

    CODE:       load = ROM,         align = $8000;
    RODATA:     load = ROM;
    HEADER:     load = ROM,         start = $FFC0;
    ROMINFO:    load = ROM,         start = $FFD5, optional = yes;
    VECTORS:    load = ROM,         start = $FFE0;
}
```

Leia isso como: "aqui estão as regiões físicas de memória (`MEMORY`), e aqui estão
os grupos nomeados de código/dados (`SEGMENTS`) que são despejados nelas."
`ZEROPAGE` e `BSS` são RAM (elas não acabam *dentro* do arquivo de ROM — são apenas
endereços reservados para variáveis). `HEADER`, `ROMINFO` e `VECTORS` são fixados
exatamente nos offsets da tabela acima. Por enquanto estamos limitando isso a um
único banco de 32 KB; lições posteriores estendem isso para mais bancos quando
precisarmos de mais espaço para dados gráficos.

## 4. A ROM em si

Crie o `lesson1.asm`:

```asm
; ============================================================
; Lesson 1: minimal SNES ROM — fills the screen with one color.
;
; Build:
;   ca65 lesson1.asm -o lesson1.o
;   ld65 -C lorom128.cfg -o lesson1.sfc lesson1.o
; ============================================================

.p816                   ; assemble for the 65816 instruction set
.i16                    ; reminder: X/Y start out 16-bit after our init code
.a8                     ; reminder: A will be 8-bit after our init code

; ------------------------------------------------------------
; Header: 21-byte ROM title, space-padded. Purely cosmetic —
; shown by emulators/flash carts, ignored by the hardware.
; ------------------------------------------------------------
.segment "HEADER"
    .byte "LESSON 1 TUTORIAL    "  ; must be exactly 21 bytes

; ------------------------------------------------------------
; ROM info block. Byte-by-byte:
; ------------------------------------------------------------
.segment "ROMINFO"
    .byte $20      ; map mode: LoROM, slow ROM (bit4 set = fast; we leave it slow/safe)
    .byte $00      ; cartridge type: $00 = ROM only, no extra chips
    .byte $07      ; ROM size: 2^$07 KB = 128 KB
    .byte $00      ; RAM size: none
    .byte $01      ; destination/region code: $01 = USA/NTSC (cosmetic here)
    .byte $00      ; fixed / licensee byte
    .byte $00      ; ROM version / revision
    .word $0000    ; checksum complement (placeholder — real carts need this
                    ;   computed correctly; emulators don't care)
    .word $0000    ; checksum (placeholder, same note as above)

; ------------------------------------------------------------
; Interrupt/reset vectors. We only fill in what we use; the
; rest point at a "do nothing forever" trap for safety, so
; that if the CPU ever jumps somewhere we didn't expect, it
; halts visibly instead of running garbage.
; ------------------------------------------------------------
.segment "VECTORS"
    ; --- Native mode vectors (used once we've switched out of
    ;     emulation mode, which our reset code does immediately) ---
    .word $0000    ; unused
    .word $0000    ; unused
    .word trap     ; COP
    .word trap     ; BRK
    .word trap     ; ABORT
    .word trap     ; NMI  (vertical blank interrupt — unused for now)
    .word $0000    ; unused (reserved)
    .word trap     ; IRQ

    ; --- Emulation mode vectors (this is what the CPU actually
    ;     reads on power-on / reset, before our code runs) ---
    .word $0000    ; unused
    .word $0000    ; unused
    .word trap     ; COP (emulation)
    .word $0000    ; unused (reserved)
    .word trap     ; ABORT (emulation)
    .word trap     ; NMI (emulation)
    .word reset    ; RESET — this is the one that matters at power-on
    .word trap     ; IRQ/BRK (emulation)

; ------------------------------------------------------------
; Code
; ------------------------------------------------------------
.segment "CODE"

reset:
    sei             ; disable interrupts while we set things up
    clc             ; clear carry...
    xce             ; ...then exchange carry with emulation flag:
                     ;   this is the standard idiom that switches the
                     ;   65816 from 6502-compatible emulation mode
                     ;   into full native 16-bit-capable mode.

    rep #$10        ; REP = "reset processor status bits" — clears bits
                     ;   in the flag register. Bit 4 (X) controls
                     ;   X/Y register width; clearing it makes X/Y 16-bit.
    sep #$20        ; SEP = "set processor status bits". Bit 5 (M)
                     ;   controls the A register width; setting it makes
                     ;   A 8-bit. Mixed 16-bit index / 8-bit accumulator
                     ;   is the most common working mode for SNES code.
    .a8
    .i16

    ldx #$1FFF      ; set up the stack pointer — SNES RAM is $0000-$1FFF
    txs             ;   in bank 0, so $1FFF is the top of low RAM.

    ; --- Reset every PPU and DMA register to a known state. ---
    ; On power-on these registers can contain garbage. Rather than
    ; hand-initialize the ones we care about and hope the rest don't
    ; matter, we zero the whole block. $2100-$2133 is  the PPU/CGRAM
    ; register window; $4200-$421F is CPU/DMA control.
    ldx #$33
clear_regs:
    stz $2100,x
    stz $4200,x
    dex
    bpl clear_regs

    ; --- Set the background color (CGRAM entry 0) to blue. ---
    ; CGRAM holds the SNES's palette memory: 256 entries, each a
    ; 15-bit BGR color (5 bits per channel, top bit unused).
    ; With no background layers or sprites turned on (which we
    ; haven't touched yet), the screen just shows palette entry 0
    ; directly — it's the simplest possible visual proof that code
    ; is running.
    stz $2121       ; CGADD: set the CGRAM write address to entry 0
    lda #$00        ; low byte of color $7C00 (blue): gggrrrrr = 00000000
    sta $2122       ; CGDATA — first write is the low byte
    lda #$7C        ; high byte: -bbbbbgg = 01111100 (blue = 11111, top bit 0)
    sta $2122       ; CGDATA — second write is the high byte

    ; --- Turn the screen on. ---
    ; $2100 (INIDISP): bit 7 = forced blank (1 = screen off, ignore
    ; everything else). Low nibble = brightness, 0-$0F.
    lda #$0F        ; forced blank OFF, full brightness
    sta $2100

forever:
    jmp forever     ; nothing left to do — spin here.

; A landing pad for any vector we didn't wire up to real code.
; If you ever see the screen do something unexpected and suspect
; a stray interrupt, this is what lets you notice: put a break-
; point on `trap` in Mesen's debugger and see if it gets hit.
trap:
    jmp trap
```

Algumas coisas que vale a pena não passar batido:

- **`rep`/`sep` e as diretivas `.a8`/`.i16` são duas coisas diferentes.**
  `rep #$10` / `sep #$20` são instruções reais do 65816 — elas mudam as larguras
  reais dos registradores da CPU em tempo de execução. `.a8` / `.i16` são diretivas
  do assembler que dizem ao *ca65* qual largura assumir ao codificar instruções a
  partir daquele ponto (então `lda #$0F` é montado como um load imediato de 8 bits,
  não de 16). Se você deixar isso fora de sincronia — dizer `.a16` ao assembler
  enquanto a CPU está de fato em modo 8 bits — vai ter bugs corrompidos e difíceis
  de diagnosticar. A Lição 2 cobre isso em profundidade; por enquanto, apenas
  perceba o padrão: mude a CPU, depois avise imediatamente o assembler para
  acompanhar.

- **Por que `$001F` vs `$7C00` para cores** — uma cor do SNES tem 15 bits,
  organizados como `-bbbbbgg gggrrrrr` em dois bytes. Vermelho puro é `$001F`
  (todos os 5 bits de vermelho ligados), verde puro é `$03E0`, azul puro é `$7C00`.
  Usamos azul aqui — tente mudar e remontar assim que estiver configurado.

- **O checksum de placeholder.** Cartuchos reais precisam de um par
  checksum/complemento correto, ou algum hardware (e emuladores mais rigorosos) vai
  recusar a inicializar. O Mesen não se importa, então estamos deixando como
  `$0000`/`$0000` por enquanto. Você vai corrigir isso de forma apropriada quando
  estiver mais perto de um lançamento de verdade — não vale a pena a complexidade
  tão cedo.

## 5. Compile e execute

```sh
ca65 lesson1.asm -o lesson1.o
ld65 -C lorom128.cfg -o lesson1.sfc lesson1.o
```

Se ambos os comandos terminarem sem saída nenhuma, funcionou — `ca65`/`ld65` são
silenciosos quando dá certo. Abra `lesson1.sfc` no Mesen. Você deve ver uma tela
azul sólida.

**Solução de problemas:**

- *O Mesen mostra preto, ou não mostra nada:* use File → Open (ou Reload from
  file) — não clique duas vezes na ROM novamente com o Mesen já aberto, o que pode
  recarregar um save state em cache em vez do binário recém-compilado. Isso
  confunde muita gente constantemente e vale a pena lembrar em toda lição daqui
  para frente.
- *O `ca65` reporta um erro de segmento ou de faixa (range):* quase sempre
  significa que um segmento no arquivo `.asm` não bate com o `lorom128.cfg`, ou que
  o código total ultrapassou 32 KB (não vai acontecer aqui, mas vai eventualmente —
  é para isso que serve a configuração multi-banco de lições posteriores).
- *A tela mostra uma cor, mas a errada:* confira a ordem dos bytes — escritas em
  CGDATA são o byte baixo primeiro, depois o byte alto, e é fácil trocá-los.

## O que você acabou de construir

Uma ROM com um cabeçalho correto, um vetor de reset que o hardware consegue de fato
encontrar, uma troca de modo de CPU, estado de hardware limpo, e um efeito colateral
visível. Esse é o esqueleto sobre o qual toda lição posterior se apoia — da Lição 3
em diante vamos substituir a etapa "cor sólida" por backgrounds e sprites de
verdade, mas o código de configuração acima muda muito pouco.

## Exercícios

1. Mude a cor de fundo para outra usando a tabela BGR nos comentários acima.
   Remonte, recarregue no Mesen, confirme que mudou.
2. Tente configurar o brilho de `$2100` para `$00` em vez de `$0F` — confirme que a
   tela fica escura mesmo com a cor ainda configurada na CGRAM. Isso é um prévia de
   por que o "forced blank" existe: ele permite atualizar VRAM/CGRAM/OAM com
   segurança, sem que a PPU as leia no meio de uma atualização — o que importa
   muito quando gráficos de verdade entram em cena.
3. Quebre alguma coisa de propósito — comente a linha `xce` e tente
   remontar/executar. Observe o que acontece (ou não acontece), para você ter uma
   noção de como é uma falha de "preso em modo de emulação" antes que isso
   aconteça sem querer mais adiante.

## Apêndice A: a mesma ROM em asar (para comparação)

Já que você também tem o asar instalado, aqui está o equivalente na sintaxe do
asar — note que é um único arquivo, sem configuração de linker separada, porque o
asar deduz o layout a partir de `lorom` e do posicionamento baseado em diretivas:

```asm
; lesson1_asar.asm
lorom

org $00FFC0
db "LESSON 1 TUTORIAL   "     ; 21-byte header

org $00FFD5
db $20, $00, $07, $00, $01, $00, $00
dw $0000, $0000               ; checksum placeholders

org $00FFE0
dw $0000, $0000, trap, trap, trap, trap, $0000, trap   ; native vectors
dw $0000, $0000, trap, $0000, trap, trap, reset, trap  ; emulation vectors

org $008000
reset:
    sei
    clc
    xce
    rep #$10
    sep #$20
    ldx #$1FFF
    txs
    ldx #$33
.clear_regs:
    stz $2100,x
    stz $4200,x
    dex
    bpl .clear_regs
    stz $2121
    lda #$00
    sta $2122
    lda #$7C
    sta $2122
    lda #$0F
    sta $2100
forever:
    jmp forever
trap:
    jmp trap
```

Compile com um único comando: `asar lesson1_asar.asm lesson1_asar.sfc`. Não vamos
manter essa versão em asar além da Lição 1 — ela está aqui só para você ver como os
mesmos conceitos se traduzem para a outra toolchain, caso tenha curiosidade.

---

Root: [README.md](README.md)
Next: [Lição 2 — Curso intensivo sobre a CPU 65816](02-cpu-crash-course.md)
