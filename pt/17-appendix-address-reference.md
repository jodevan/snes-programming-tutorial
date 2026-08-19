# Apêndice: Mapa de Endereços & Registradores do SNES

Uma referência de página única para todo endereço de hardware que este curso
realmente usa, organizada na ordem em que as lições apresentaram cada um, não
despejada em ordem alfabética. Conferida contra o mesmo código mostrado em
cada lição, não transcrita de memória — se algum valor aqui algum dia
discordar do código de uma lição, o código da lição está correto e esta
página tem um bug que vale a pena reportar.

## Três espaços de endereço, não um

É fácil supor que "o espaço de endereços" é uma coisa só. Este curso na
verdade trabalha em três espaços separados, e confundi-los é uma fonte real
de confusão:

| Espaço | Quem lê/escreve nele | Coberto em |
|---|---|---|
| **Espaço da CPU 65816** | A CPU principal — tudo até a [Lição 12](12-collision-detection.md) | [Lição 3](03-memory-map-and-registers.md) |
| **Espaço SPC700 / ARAM** | Os próprios 64 KB de RAM do coprocessador de som, alcançáveis só através de 4 bytes de caixa de correio | [Lição 13](13-spc700-and-audio-basics.md) |
| **Espaço de registradores do DSP** | Os 128 registradores de um byte do chip de áudio, alcançáveis só através do truque `$00F2` da ROM de boot do SPC700 | [Lição 13](13-spc700-and-audio-basics.md) |

Toda tabela abaixo é do espaço da CPU 65816, a menos que o título diga o
contrário.

## Mapa de memória: tamanhos & limites

Seis áreas de memória de tamanho fixo que este curso usa, cada uma um recurso
físico separado — saber o tamanho de cada uma explica por que a VRAM cabe
confortavelmente os tiles e tilemaps deste curso, por que a OAM tem um teto de
128 sprites, e por que uma paleta não pode ter mais que 256 cores.

| Área | Tamanho total | Faixa de endereços | Contém | Lição |
|---|---|---|---|---|
| WRAM | 128 KB | `$7E0000`-`$7FFFFF` (chip inteiro); primeiros 8 KB espelhados em `$0000`-`$1FFF` na página baixa de todo banco | Variáveis, a pilha, rascunho de uso geral | [Lição 3](03-memory-map-and-registers.md) |
| VRAM | 64 KB | endereço de palavra `$0000`-`$7FFF`, alcançado via `VMADDL`/`VMADDH` | Dados de bitmap de tile (caractere) e tilemaps — os tiles e o tilemap do BG3 deste curso vivem aqui, nos endereços que você escolher | [Lição 5](05-tiles-and-vram.md), [Lição 6](06-backgrounds-and-tilemaps.md) |
| CGRAM | 512 bytes | índice `$00`-`$FF` via `CGADD` (cada índice = 2 bytes) | 256 cores, organizadas como 16 paletas de 16 cores, cada cor de 15 bits | [Lição 4](04-palettes-and-cgram.md) |
| OAM | 544 bytes | tabela baixa: byte `$000`-`$1FF` (512 bytes); tabela alta: byte `$200`-`$21F` (32 bytes), via `OAMADDL`/`OAMADDH` | Até 128 sprites — X/Y/tile/atributos na tabela baixa (4 bytes cada), tamanho + bit alto de X na tabela alta (2 bits cada) | [Lição 10](10-sprites-oam-basics.md) |
| ARAM (RAM do SPC700) | 64 KB | `$0000`-`$FFFF` no próprio barramento do SPC700 — não alcançável diretamente pelo 65816 | Código do driver de som, dados de amostra, buffer de eco, carregados byte a byte através das 4 portas de caixa de correio da APU | [Lição 13](13-spc700-and-audio-basics.md) |
| ROM (mapeamento LoROM) | até 4 MB endereçáveis (as ROMs deste curso usam bem menos) | bancos `$00`-`$7D` e `$80`-`$FF`, cada um expondo 32 KB em `$8000`-`$FFFF` | Código do programa, o cabeçalho & vetores, e qualquer outro dado de ROM | [Lição 1](01-toolchain-setup-and-first-rom.md), [Lição 3](03-memory-map-and-registers.md) |

VRAM, CGRAM e OAM não fazem parte do espaço de endereços do próprio 65816 —
são chips separados do lado da PPU, alcançáveis só através dos registradores
de porta documentados abaixo (`$2115`-`$2119` para a VRAM, `$2121`-`$2122`
para a CGRAM, `$2101`-`$2104` para a OAM).

## Cabeçalho da ROM & vetores — `$00:FFC0`–`$00:FFFF`

O layout exato de bytes que o `lesson1.asm` da [Lição 1](01-toolchain-setup-and-first-rom.md)
constrói, campo por campo:

| Endereço | Campo | Bytes | Notas |
|---|---|---|---|
| `$FFC0`-`$FFD4` | Título da ROM | 21 | ASCII preenchido com espaços, puramente cosmético |
| `$FFD5` | Modo de mapeamento | 1 | Bit de LoROM/HiROM + ROM rápida/lenta |
| `$FFD6` | Tipo de cartucho | 1 | `$00` = só ROM, as ROMs deste curso |
| `$FFD7` | Tamanho da ROM | 1 | `2^n` KB |
| `$FFD8` | Tamanho da RAM | 1 | `$00` aqui — nenhuma RAM de cartucho usada |
| `$FFD9` | Código de região/destino | 1 | Cosmético num emulador |
| `$FFDA` | Byte fixo/licenciado | 1 | |
| `$FFDB` | Versão da ROM | 1 | |
| `$FFDC`-`$FFDD` | Complemento do checksum | 2 | Placeholder (`$0000`) durante todo o curso |
| `$FFDE`-`$FFDF` | Checksum | 2 | Placeholder (`$0000`) durante todo o curso |
| `$FFE0`-`$FFE1` | não usado (nativo) | 2 | |
| `$FFE2`-`$FFE3` | não usado (nativo) | 2 | |
| `$FFE4`-`$FFE5` | Vetor COP (nativo) | 2 | → `trap` |
| `$FFE6`-`$FFE7` | Vetor BRK (nativo) | 2 | → `trap` |
| `$FFE8`-`$FFE9` | Vetor ABORT (nativo) | 2 | → `trap` |
| `$FFEA`-`$FFEB` | Vetor NMI (nativo) | 2 | → `trap` até a [Lição 11](11-controller-input-and-animation.md) conectar `nmi_handler` |
| `$FFEC`-`$FFED` | não usado (reservado) | 2 | |
| `$FFEE`-`$FFEF` | Vetor IRQ (nativo) | 2 | → `trap` |
| `$FFF0`-`$FFF1` | não usado (emulação) | 2 | |
| `$FFF2`-`$FFF3` | não usado (emulação) | 2 | |
| `$FFF4`-`$FFF5` | Vetor COP (emulação) | 2 | → `trap` |
| `$FFF6`-`$FFF7` | não usado (reservado) | 2 | |
| `$FFF8`-`$FFF9` | Vetor ABORT (emulação) | 2 | → `trap` |
| `$FFFA`-`$FFFB` | Vetor NMI (emulação) | 2 | → `trap` |
| `$FFFC`-`$FFFD` | **Vetor RESET (emulação)** | 2 | → `reset` — o único vetor do qual toda ROM deste curso realmente depende ao ligar, e a localização real de hardware do vetor RESET do 65816 |
| `$FFFE`-`$FFFF` | Vetor IRQ/BRK (emulação) | 2 | → `trap` |

## WRAM — RAM de uso geral

| Endereço | Propósito | Lição |
|---|---|---|
| `$0000`-`$1FFF` | Primeiros 8 KB da WRAM, espelhados na página baixa de todo banco (`$00`-`$3F`, `$80`-`$BF`) — onde vivem as variáveis de página direta e a pilha | [Lição 3](03-memory-map-and-registers.md) |
| `$7E0000`-`$7FFFFF` | O chip inteiro de 128 KB de WRAM, alcançável por endereço longo a partir de qualquer banco | [Lição 3](03-memory-map-and-registers.md) |
| `$2180` `WMDATA` | Porta de dados indireta da WRAM — lê/escreve um byte no endereço abaixo, auto-incrementando | [Lição 3](03-memory-map-and-registers.md) |
| `$2181`-`$2183` `WMADDL`/`WMADDM`/`WMADDH` | Endereço de WRAM de 17 bits para a porta acima | [Lição 3](03-memory-map-and-registers.md) |

## VRAM — dados de tile & tilemap (`$2115`-`$2119`)

| Endereço | Registrador | Propósito | Lição |
|---|---|---|---|
| `$2115` | `VMAIN` | Modo de incremento de endereço (depois do byte baixo ou alto, tamanho do passo) | [Lição 5](05-tiles-and-vram.md) |
| `$2116` | `VMADDL` | Endereço de word da VRAM, byte baixo | [Lição 5](05-tiles-and-vram.md) |
| `$2117` | `VMADDH` | Endereço de word da VRAM, byte alto | [Lição 5](05-tiles-and-vram.md) |
| `$2118` | `VMDATAL` | Dado da VRAM, byte baixo — a escrita dispara a transferência no modo "baixo" de `VMAIN` | [Lição 5](05-tiles-and-vram.md) |
| `$2119` | `VMDATAH` | Dado da VRAM, byte alto — a escrita dispara a transferência no modo "alto" padrão de `VMAIN` | [Lição 5](05-tiles-and-vram.md) |

## CGRAM — a paleta de cores (`$2121`-`$2122`)

| Endereço | Registrador | Propósito | Lição |
|---|---|---|---|
| `$2121` | `CGADD` | Índice de cor da CGRAM (0-255) a apontar | [Lição 1](01-toolchain-setup-and-first-rom.md), [Lição 4](04-palettes-and-cgram.md) |
| `$2122` | `CGDATA` | Dado de cor — registrador de escrita dupla, byte baixo depois byte alto | [Lição 1](01-toolchain-setup-and-first-rom.md), [Lição 4](04-palettes-and-cgram.md) |

## OAM — atributos de sprite (`$2101`-`$2104`)

| Endereço | Registrador | Propósito | Lição |
|---|---|---|---|
| `$2101` | `OBSEL` | Seleção de tamanho de sprite + endereço base na VRAM dos tiles de sprite | [Lição 10](10-sprites-oam-basics.md) |
| `$2102` | `OAMADDL` | Endereço da OAM, byte baixo | [Lição 10](10-sprites-oam-basics.md) |
| `$2103` | `OAMADDH` | Bit alto do endereço da OAM + flag de rotação de prioridade | [Lição 10](10-sprites-oam-basics.md) |
| `$2104` | `OAMDATA` | Dado da OAM — auto-incrementa; tabela baixa e tabela alta se sucedem em um único fluxo de escrita | [Lição 10](10-sprites-oam-basics.md) |

## Registradores de controle da PPU realmente usados (dentro de `$2100`-`$2133`)

| Endereço | Registrador | Propósito | Lição |
|---|---|---|---|
| `$2100` | `INIDISP` | Forced blank (bit 7) + brilho da tela (nibble baixo) | [Lição 1](01-toolchain-setup-and-first-rom.md) |
| `$2105` | `BGMODE` | Seleção do modo de background (este curso usa o Modo 1) | [Lição 6](06-backgrounds-and-tilemaps.md) |
| `$2109` | `BG3SC` | Endereço base do tilemap da BG3 + tamanho do mapa | [Lição 6](06-backgrounds-and-tilemaps.md) |
| `$210C` | `BG34NBA` | Endereço base dos dados de caractere (tile) da BG3/BG4 | [Lição 6](06-backgrounds-and-tilemaps.md) |
| `$2111` | `BG3HOFS` | Scroll horizontal da BG3 — registrador de escrita dupla | [Lição 9](09-background-scrolling.md) |
| `$2112` | `BG3VOFS` | Scroll vertical da BG3 — registrador de escrita dupla | [Lição 9](09-background-scrolling.md) |
| `$212C` | `TM` | Habilita camadas de background/sprite na tela principal | [Lição 6](06-backgrounds-and-tilemaps.md) |
| `$212D` | `TS` | Mesmo layout de bits do `TM`, para a subtela (color-math, não usado neste curso) | Exercícios da [Lição 6](06-backgrounds-and-tilemaps.md) |

O bloco `$2100`-`$2133` inteiro cobre muitos outros registradores que este
curso não usa diretamente (modo 7, windowing, color math) — veja a
[Lição 3](03-memory-map-and-registers.md) para o mapa geral e a
[referência de registradores](https://wiki.superfamicom.org/registers) para
todos eles.

## Controle e status da CPU, joypad (`$4200`-`$421F`)

| Endereço | Registrador | Propósito | Lição |
|---|---|---|---|
| `$4200` | `NMITIMEN` | Habilita NMI + habilita leitura automática do joypad | [Lição 11](11-controller-input-and-animation.md) |
| `$420B` | `MDMAEN` | Dispara um ou mais canais de DMA de uso geral | [Lição 8](08-dma-and-hdma.md) |
| `$420C` | `HDMAEN` | Habilita um ou mais canais de HDMA | [Lição 8](08-dma-and-hdma.md) |
| `$4210` | `RDNMI` | Flag de NMI — precisa ser lida dentro de todo handler de NMI para reconhecê-la | [Lição 11](11-controller-input-and-animation.md) |
| `$4212` | `HVBJOY` | Status de V-Blank/H-Blank, sondado pelo loop de frame pré-NMI | [Lição 9](09-background-scrolling.md) |
| `$4218` | `JOY1L` | Botões travados do controle 1, byte baixo (A/X/L/R) | [Lição 11](11-controller-input-and-animation.md) |
| `$4219` | `JOY1H` | Botões travados do controle 1, byte alto (B/Y/Select/Start/D-pad) | [Lição 11](11-controller-input-and-animation.md) |
| `$4016`-`$4017` | Portas antigas de joypad | Sondagem manual compatível com o NES; mencionado mas não usado — a leitura automática substitui isso | [Lição 3](03-memory-map-and-registers.md) |

## Registradores de canal de DMA & HDMA (`$43x0`-`$43xA`, um bloco por canal `x` = 0-7)

| Endereço | Registrador | Propósito | Lição |
|---|---|---|---|
| `$43x0` | `DMAPx` | Direção, modo de endereçamento, formato da unidade de transferência, bit de origem fixa | [Lição 8](08-dma-and-hdma.md) |
| `$43x1` | `BBADx` | Destino: byte baixo do registrador `$21xx` da PPU alvo | [Lição 8](08-dma-and-hdma.md) |
| `$43x2`-`$43x3` | `A1TxL`/`A1TxH` | Endereço de origem, byte baixo/alto | [Lição 8](08-dma-and-hdma.md) |
| `$43x4` | `A1Bx` | Endereço de origem, byte de banco | [Lição 8](08-dma-and-hdma.md) |
| `$43x5`-`$43x6` | `DASxL`/`DASxH` | Contagem de bytes do DMA — ou, para HDMA *indireto*, o endereço indireto de dados atual | [Lição 8](08-dma-and-hdma.md) |
| `$43x7` | `DASBx` | Byte de banco do endereço indireto de HDMA (só modo indireto, não usado neste curso) | Exercícios da [Lição 8](08-dma-and-hdma.md) |
| `$43x8`-`$43x9` | `A2AxL`/`A2AxH` | Posição atual do HDMA em sua tabela — gerenciado pelo hardware, não escrito diretamente | [Lição 8](08-dma-and-hdma.md) |
| `$43xA` | `NLTRx` | Contador de linhas do HDMA: scanlines restantes até a próxima entrada da tabela carregar | [Lição 8](08-dma-and-hdma.md) |

## Áudio: portas da APU (lado do 65816) — `$2140`-`$2143`

| Endereço | Registrador | Propósito | Lição |
|---|---|---|---|
| `$2140`-`$2143` | `APUIO0`-`APUIO3` | Quatro portas de caixa de correio de um byte para o SPC700 — a *única* conexão entre as duas CPUs | [Lição 13](13-spc700-and-audio-basics.md) |

O SPC700 vê essas mesmas quatro portas em `$00F4`-`$00F7` do seu próprio
lado — os mesmos bytes, endereço diferente, porque é uma CPU diferente com um
mapa de memória completamente diferente.

## Áudio: registradores do DSP (um espaço separado de 128 registradores, alcançado via `$00F2`)

Nem fazem parte do mapa de memória do 65816 — esses registradores são
escritos apontando o upload do SPC para o endereço `$00F2` com o truque de
DSP manual da ROM de boot, um par `(registrador, valor)` por chamada a
`write_dsp`. Os números de registrador abaixo são para a voz 0; a
[Lição 14](14-music-and-sound-effects.md) alcança a voz *n* somando `n * $10`
a cada número de registrador por voz.

| Registrador | Nome | Propósito | Lição |
|---|---|---|---|
| `$4C` | `KON` | Key-on — um bit por voz (0-7) | [Lição 13](13-spc700-and-audio-basics.md) |
| `$5C` | `KOFF` | Key-off — um bit por voz; necessário antes de um novo `KON` para *reiniciar* uma voz já tocando | [Lição 13](13-spc700-and-audio-basics.md), [Lição 14](14-music-and-sound-effects.md) |
| `$6C` | `FLG` | Flags globais (proteção de escrita do buffer de eco, etc.) | [Lição 13](13-spc700-and-audio-basics.md) |
| `$5D` | `DIR` | Página da ARAM do diretório de amostras | [Lição 13](13-spc700-and-audio-basics.md) |
| `$0C`/`$1C` | `MVOLL`/`MVOLR` | Volume master, esquerda/direita | [Lição 13](13-spc700-and-audio-basics.md) |
| `$00`/`$01` | `VOLL`/`VOLR` (voz 0) | Volume por voz, esquerda/direita | [Lição 13](13-spc700-and-audio-basics.md) |
| `$02`/`$03` | `PITCHL`/`PITCHH` (voz 0) | Taxa de reprodução — `$1000` toca uma amostra no pitch original gravado | [Lição 13](13-spc700-and-audio-basics.md) |
| `$04` | `SRCN` (voz 0) | Qual entrada do diretório de amostras essa voz toca | [Lição 13](13-spc700-and-audio-basics.md) |
| `$05`/`$06` | `ADSR1`/`ADSR2` (voz 0) | Envelope de volume: attack/decay (ADSR1), nível/taxa de sustain (ADSR2) | [Lição 13](13-spc700-and-audio-basics.md), exercícios da [Lição 14](14-music-and-sound-effects.md) |

## Fontes & leitura complementar

As afirmações deste curso sobre o comportamento do hardware são conferidas
contra referências primárias, não folclore meio-lembrado. Toda fonte externa
citada ao longo das 16 lições, e onde cada uma aparece:

### Super Famicom Development Wiki

A referência de hardware principal na qual este curso mais se apoia.

| Página | Cobre | Citada em |
|---|---|---|
| [Registradores](https://wiki.superfamicom.org/registers) | Todo registrador de PPU/CPU, bit a bit — as explicações de registradores deste tutorial são todas conferidas cruzando com ela, e é a aba mais útil para manter aberta enquanto você avança pelo curso | [Lição 3](03-memory-map-and-registers.md) (geral), [4](04-palettes-and-cgram.md), [6](06-backgrounds-and-tilemaps.md), [8](08-dma-and-hdma.md), [10](10-sprites-oam-basics.md), [11](11-controller-input-and-animation.md) |
| [Backgrounds](https://wiki.superfamicom.org/backgrounds) | Modos de BG, formato de tilemap, comportamento de scroll | [Lição 5](05-tiles-and-vram.md), [6](06-backgrounds-and-tilemaps.md), [9](09-background-scrolling.md) |
| [Sprites](https://wiki.superfamicom.org/sprites) | Layout da OAM, as regras de wrapping da tabela de caracteres para sprites de múltiplos tiles | [Lição 10](10-sprites-oam-basics.md) |
| [Referência do 65816](https://wiki.superfamicom.org/65816-reference) | Conjunto de instruções completo da CPU | [Lição 2](02-cpu-crash-course.md) |
| [Referência do SPC700](https://wiki.superfamicom.org/spc700-reference) | Conjunto de instruções da CPU de som, layout de bits do envelope ADSR | [Lição 13](13-spc700-and-audio-basics.md), [14](14-music-and-sound-effects.md) |
| [Mapeamento de memória](https://wiki.superfamicom.org/memory-mapping) | Detalhes do layout LoROM/HiROM | [Lição 3](03-memory-map-and-registers.md) |
| ["Writing to DSP Registers Without any SPC-700 Code"](https://wiki.superfamicom.org/how-to-write-to-dsp-registers-without-any-spc-700-code) | O truque de escrita manual de DSP no qual o código `write_dsp` da [Lição 13](13-spc700-and-audio-basics.md) se baseia diretamente | [Lição 13](13-spc700-and-audio-basics.md) |

### SNESdev Wiki

| Página | Cobre | Citada em |
|---|---|---|
| [Booting the SPC700](https://snes.nesdev.org/wiki/Booting_the_SPC700) | O protocolo de handshake de boot que `spc_wait_boot`/`spc_begin_upload` seguem | [Lição 13](13-spc700-and-audio-basics.md) |
| [SNESdev Wiki](https://snes.nesdev.org/wiki/SNESdev_Wiki) (geral) | Referência mais ampla de hardware/depuração — Modo 7, chips de save-data, multiplayer, bem além do escopo deste curso | [Lição 16](16-capstone.md) |

### Outras referências

| Fonte | Cobre | Citada em |
|---|---|---|
| [Série de tutoriais SNES do nesdoug](https://nesdoug.com/2020/03/19/snes-projects/) | Um segundo estilo de explicação para os mesmos temas, também baseado em ca65 | Sumário do curso, [Lição 15](15-code-organization-and-optimization.md) |
| [Documentação de depuração do Mesen](https://www.mesen.ca/snes/docs/debugging.md) | Referência oficial para cada ferramenta coberta — Debugger, PPU Viewers, Memory Tools, Event Viewer, Trace Logger | [Lição 7](07-debugging-with-mesen.md) |
| [Terrific Audio Driver](https://github.com/undisbeliever/terrific-audio-driver) | Driver de música/SFX compatível com ca65, baseado em MML | [Lição 14](14-music-and-sound-effects.md) |
| [SNESGSS Extended](https://github.com/NovaSquirrel/snesgss-extended) | Driver de áudio baseado em pacote de macros ca65, editor estilo tracker | [Lição 14](14-music-and-sound-effects.md) |
| [SNESMOD](https://nesdoug.com/2022/03/02/snesmod/) | Driver de áudio compatível com ca65, arquivos de módulo `.it` | [Lição 14](14-music-and-sound-effects.md) |

## O que deliberadamente não está aqui

Esta página é sobre fatos de hardware — registradores e regiões de memória
definidos pelo SNES que continuam os mesmos não importa qual ROM você
escreva. Ela não inclui as escolhas de variáveis de página direta deste
próprio curso (`sprite_x`, `scroll_lo`, `wall_x`, e assim por diante,
atribuídas pela primeira vez na [Lição 9](09-background-scrolling.md) e na
[Lição 11](11-controller-input-and-animation.md)) — essas são código de
exemplo deste tutorial, não arquitetura do SNES, e um projeto diferente é
livre para organizá-las de outro jeito.

---

[Home](../docs/pt/index.html) |
Previous: [Lição 16 — Projeto final](16-capstone.md)
