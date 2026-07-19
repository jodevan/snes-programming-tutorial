# Construindo um Jogo para o SNES

**Um tutorial passo a passo para escrever um jogo de Super Nintendo em assembly
65816, feito para rodar em um emulador real em cada etapa.**
Uma versão em inglês deste tutorial também está disponível
[aqui](https://jodevan.github.io/snes-programming-tutorial/), e a versão HTML
em português está [aqui](../html/pt/index.html).

## Objetivo & motivação

O objetivo é um jogo de SNES de verdade, jogável — construído à mão, em
assembly, entendendo cada peça ao longo do caminho, em vez de partir do motor
de outra pessoa. Chegar lá significa aprender um leque genuinamente amplo de
hardware do SNES: a CPU 65816, os backgrounds e sprites da PPU, DMA/HDMA, o
processador de som SPC700 independente, e as ferramentas para depurar tudo
isso quando inevitavelmente não funcionar de primeira.

Este tutorial existe porque a maior parte do material de homebrew de SNES
assume que você vai juntar as peças a partir de posts de blog espalhados,
páginas de wiki, e tópicos de fórum escritos ao longo das últimas duas
décadas — todos excelentes individualmente (este projeto se apoia bastante
neles; veja [Recursos de referência](#recursos-de-referência) abaixo), mas não
escritos como um caminho único e contínuo para um iniciante. As lições aqui
são sequenciadas de forma que cada uma se apoia em uma base de código
funcional da lição anterior, não em uma pilha de demos desconectadas, e toda
afirmação sobre como o hardware se comporta foi conferida cruzando com
referências primárias, em vez de folclore meio-lembrado.

**Toolchain:** [`ca65`](https://cc65.github.io/) (parte do conjunto `cc65`) e o
emulador [Mesen](https://www.mesen.ca/), no macOS. A [Lição
1](01-toolchain-setup-and-first-rom.md) cobre a configuração e explica por que
este tutorial escolheu o `ca65` em vez do `asar`.

## Como usar isto

Trabalhe nas lições em ordem — as posteriores assumem o código das
anteriores. Toda lição que mexe na ROM te dá os comandos exatos de
`ca65`/`ld65` e descreve o que você deve ver no Mesen; se o que você vir não
bater, a [Lição 7](07-debugging-with-mesen.md) cobre as ferramentas de
depuração para descobrir o porquê.

## Lições

### Parte 0 — Fundamentos
1. [Configurando as ferramentas & sua primeira ROM](01-toolchain-setup-and-first-rom.md) — instale/verifique o ca65 e o Mesen, o cabeçalho da ROM e o vetor de reset, exiba uma cor sólida.
2. [Curso intensivo sobre a CPU 65816](02-cpu-crash-course.md) — registradores, alternância entre modo 8/16 bits, modos de endereçamento, pegadinhas 6502-vs-65816.
3. [Mapa de memória do SNES & registradores de hardware](03-memory-map-and-registers.md) — WRAM, VRAM, CGRAM, OAM, e as janelas de registradores da PPU/CPU.

### Parte 1 — Fundamentos de gráficos
4. [Paletas & CGRAM](04-palettes-and-cgram.md) — o formato de cor de 15 bits, carregando uma paleta a partir da ROM.
5. [Tiles & VRAM](05-tiles-and-vram.md) — formatos de bitplane de tiles, carregando dados gráficos na VRAM.
6. [Backgrounds & tilemaps](06-backgrounds-and-tilemaps.md) — modos de BG, o formato do tilemap, ligando uma camada de background.
7. [Depurando com o Mesen](07-debugging-with-mesen.md) — breakpoints, PPU viewers, ferramentas de memória, o event viewer, o trace logger.
8. [Mergulho profundo em DMA & HDMA](08-dma-and-hdma.md) — transferências guiadas por hardware, o truque de preenchimento por DMA, efeitos por scanline com HDMA.
9. [Rolagem de background](09-background-scrolling.md) — `BGxHOFS`/`BGxVOFS`, um loop de jogo real por frame, wrap-around de tilemap sem emendas.

### Parte 2 — Sprites & interação
10. [Fundamentos de sprites (OAM)](10-sprites-oam-basics.md) — gráficos de sprite, a tabela OAM, atributos de tamanho/prioridade.
11. [Entrada do controle & animação de sprite](11-controller-input-and-animation.md) — configuração de NMI, leitura do joypad, movendo e animando um sprite.
12. [Detecção de colisão](12-collision-detection.md) — sprite-contra-sprite (caixas AABB) e sprite-contra-cenário (uma tabela de consulta).

### Parte 3 — Áudio
13. [O SPC700 & fundamentos de áudio](13-spc700-and-audio-basics.md) — a segunda CPU, o handshake de boot, produzindo um som sem código de SPC700.
14. [Música & efeitos sonoros](14-music-and-sound-effects.md) — disparando efeitos sonoros a partir do gameplay, e um caminho realista até música de verdade.

### Parte 4 — Encerrando
15. [Organização de código & otimização](15-code-organization-and-optimization.md) — projetos com múltiplos arquivos, macros, o orçamento de tempo do V-Blank, bancos de ROM.
16. [Projeto final](16-capstone.md) — um pequeno jogo jogável combinando tudo: background com rolagem, sprite de jogador animado/colidível, um colecionável, e som.

## Recursos de referência

- [Referência do 65816](https://wiki.superfamicom.org/65816-reference) — conjunto completo de instruções da CPU.
- [Referência do SPC700](https://wiki.superfamicom.org/spc700-reference) — conjunto de instruções da CPU de som.
- [Registradores](https://wiki.superfamicom.org/registers) — todo registrador de hardware da PPU/CPU, bit a bit.
- [Mapeamento de memória](https://wiki.superfamicom.org/memory-mapping) — detalhes do layout LoROM/HiROM.
- [Série de tutoriais de SNES do nesdoug](https://nesdoug.com/2020/03/19/snes-projects/) — um segundo estilo de explicação para os mesmos temas, também baseado em ca65.
- [SNESdev Wiki](https://snes.nesdev.org/wiki/SNESdev_Wiki) — as referências de handshake de boot e depuração nas quais este tutorial se apoia.

## Status

As 16 lições estão escritas. Perguntas e correções de quem realmente está
construindo isso realimentam as lições — este é um documento vivo, não uma
foto fixa.
