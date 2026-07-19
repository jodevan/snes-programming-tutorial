# Lição 15: Organização de Código & Otimização

**Objetivo:** tudo até este ponto viveu em um único arquivo com comentários
generosos — razoável para um tutorial, irreal para um projeto que cresce. Esta
lição cobre dividir o código, reaproveitar padrões com macros, respeitar o
orçamento de tempo real do hardware, e finalmente usar os bancos de ROM que a
configuração de linker da Lição 1 reservou mas nunca explicou.

## Dividindo um arquivo em vários

O `ca65` suporta `.include "arquivo.s"`, que funciona exatamente como colar o
conteúdo do arquivo nomeado no lugar — o assembler continua tratando tudo como
uma única unidade de compilação. Essa é a abordagem que os [projetos de exemplo
do nesdoug](https://nesdoug.com/2020/03/19/snes-projects/) usam, e é o próximo
passo natural assim que um arquivo começa a ficar difícil de gerenciar:

```asm
; main.s
.include "regs.s"          ; hardware register address constants
.include "variables.s"     ; direct-page variable definitions
.include "macros.s"        ; reusable macros (see below)
.include "reset.s"         ; reset: and the setup code from Lessons 1-11
.include "gameplay.s"      ; nmi_handler: and the per-frame logic

.segment "VECTORS"
    ; ... unchanged from Lesson 1 ...
```

Cada arquivo `.s` pode referenciar livremente rótulos definidos em outro,
contanto que o `ca65` os veja todos antes de linkar — `.include` garante isso,
já que é resolvido antes mesmo da montagem começar. (Uma técnica separada —
montar cada arquivo independentemente com `ca65` e linkar múltiplos arquivos
`.o` com `ld65` — também funciona, e é mais parecida com como projetos grandes
em C/C++ são organizados, mas exige declarações `.import`/`.export` entre
arquivos. Para um projeto deste tamanho, `.include` é mais simples e é o que
este tutorial recomenda.)

## Macros: dar nome a um padrão em vez de repeti-lo

Você já escreveu à mão o mesmo formato de "configure um registrador de
endereço, depois faça um loop em um registrador de dados" pelo menos quatro
vezes agora — CGRAM (Lição 4), VRAM (Lição 5), o preenchimento de tilemap
(Lição 6), OAM (Lição 10). Um `.macro` transforma um padrão desses em algo que
você invoca pelo nome:

```asm
.macro write_dsp_reg reg, value
    ldx #(value << 8) | reg
    jsr write_dsp
.endmacro
```

Toda chamada da tabela de `write_dsp` da [Lição
13](13-spc700-and-audio-basics.md) vira uma linha em vez de um par
`ldx`/`jsr`:

```asm
    write_dsp_reg $6C, $20    ; FLG
    write_dsp_reg $4C, $00    ; KON
    write_dsp_reg $5C, $FF    ; KOFF
```

Macros não custam nada em tempo de execução — o `ca65` as expande inline em
tempo de montagem, de forma idêntica a escrever o par `ldx`/`jsr` à mão. Use-as
onde quer que um padrão se repita o suficiente para que nomeá-lo melhore a
legibilidade; resista à tentação de transformar em macro algo usado só uma ou
duas vezes, onde um comentário simples faz o trabalho com menos indireção para
desfazer mentalmente durante a leitura.

## Respeitando o orçamento de tempo do V-Blank {#respecting-the-v-blank-time-budget}

Lembre-se da notação de flags de timing do diagrama de registrador da [Lição
3](03-memory-map-and-registers.md#reading-a-register-diagram) — `wb+++-` e
similares — que codifica exatamente quando um registrador é seguro de escrever
(forced blank, V-Blank, H-Blank, ou a qualquer momento). Essa janela não é
infinita. O NTSC dá a você 38 scanlines em blank de um total de 262, cada uma
com 1364 ciclos de clock mestre — cerca de 51.800 ciclos de clock mestre de
V-Blank por frame. Na velocidade padrão de CPU do slowROM (8 ciclos de clock
mestre por ciclo de CPU), isso é aproximadamente **6.500 ciclos de CPU** — antes
de subtrair a auto-leitura do joypad e a própria sobrecarga do seu handler de
NMI. Compare isso com uma única instrução como `lda $2122` custando 3-4 ciclos,
e fica claro por que atualizações grandes de VRAM/CGRAM/OAM se apoiam em DMA
(Lição 8) em vez de loops de CPU: o custo por byte do DMA é uma fração do custo
de um loop escrito à mão, e é a diferença entre uma atualização caber
confortavelmente em um V-Blank e uma que não cabe, causando gráficos
visivelmente rasgados ou atrasados.

Os hábitos práticos que vale a pena construir agora: faça todo trabalho que
toca a PPU bem no topo do `nmi_handler`, antes de outra lógica; prefira DMA a
loops de CPU para qualquer coisa além de um punhado de bytes; e se você algum
dia ficar em dúvida se uma atualização está terminando de forma segura dentro
da janela, o Event Viewer da [Lição 7](07-debugging-with-mesen.md) mostra isso
diretamente, em vez de deixar por conta da aritmética.

## Usando mais de um banco

A configuração de linker da Lição 1 manteve as coisas deliberadamente simples:
uma única região de ROM de 32 KB, mesmo que o cabeçalho da ROM (`romsize =
$07`) declare 128 KB completos. Essa mentirinha era inofensiva enquanto o
código e os dados de toda lição cabiam confortavelmente em 32 KB — mas vale a
pena corrigir isso agora, tanto por correção quanto para de fato usar a
capacidade que o cabeçalho declara. Estenda o `lorom128.cfg` para os quatro
bancos completos:

```
MEMORY {
    ZEROPAGE:   start =      0, size =  $100;
    BSS:        start =   $200, size = $1800;
    ROM:        start =  $8000, size = $8000, fill = yes;
    BANK1:      start = $18000, size = $8000, fill = yes;
    BANK2:      start = $28000, size = $8000, fill = yes;
    BANK3:      start = $38000, size = $8000, fill = yes;
}

SEGMENTS {
    ZEROPAGE:   load = ZEROPAGE,    type = zp;
    BSS:        load = BSS,         type = bss, align = $100;
    CODE:       load = ROM,         align = $8000;
    RODATA:     load = ROM;
    HEADER:     load = ROM,         start =  $FFC0;
    ROMINFO:    load = ROM,         start =  $FFD5, optional = yes;
    VECTORS:    load = ROM,         start =  $FFE0;

    BANK1:      load = BANK1,       align = $8000, optional = yes;
    BANK2:      load = BANK2,       align = $8000, optional = yes;
    BANK3:      load = BANK3,       align = $8000, optional = yes;
}
```

Qualquer coisa colocada em `.segment "BANK1"` vive em um banco físico diferente
do seu segmento `CODE` principal — o que significa que o `JSL`/`RTL` (chamada
e retorno long) da [Lição 2](02-cpu-crash-course.md#whats-actually-new) são
necessários para alcançá-lo, não o simples `JSR`/`RTS` que você usou em tudo
até agora:

```asm
.segment "BANK1"
big_table:
    .byte ...     ; a large data table that doesn't need to fit in bank 0

.segment "CODE"
    jsl big_table_lookup   ; must be JSL: big_table_lookup lives in a
                             ; different bank than this call site
```

Esse é exatamente o erro que a [Lição 2](02-cpu-crash-course.md#whats-actually-new)
avisou de forma abstrata — misturar `JSR`/`RTS` com `JSL`/`RTL` — agora com um
motivo concreto para acontecer: código e dados se espalham por bancos quando um
projeto cresce além de 32 KB, e toda chamada entre bancos precisa da forma
long.

## Exercícios

1. Divida sua ROM de arquivo único atual em `regs.s`, `variables.s`,
   `reset.s`, e `gameplay.s`, conectados via `.include` a partir de um pequeno
   `main.s`. Confirme que ainda monta e roda de forma idêntica.
2. Escreva uma macro para o padrão "configure OAMADD, depois escreva 4 bytes"
   de registro de sprite da [Lição 10](10-sprites-oam-basics.md), e use-a para
   encurtar o loop de esconder daquela lição.
3. Usando a configuração de 4 bancos estendida acima, mova o `collision_map` da
   [Lição 12](12-collision-detection.md) para o `BANK1`, e atualize o que quer
   que o leia para usar endereçamento long. Já que `collision_map` é só lido,
   não chamado como uma sub-rotina, pense se ele precisa de `JSL` ou se um
   simples endereço long (`lda $18xxxx,x`) é suficiente — esses não são o mesmo
   requisito.

---

Root: [README.md](README.md)
Previous: [Lição 14 — Música & efeitos sonoros](14-music-and-sound-effects.md)
Next: [Lição 16 — Projeto final](16-capstone.md)
