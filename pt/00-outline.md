# Construindo um Jogo para o SNES: Um Tutorial Passo a Passo

Bem-vindo(a). Este tutorial leva você de uma "pasta vazia" a um pequeno jogo jogável
de SNES, um conceito de cada vez. Cada lição é montada em uma ROM `.sfc` real que
você executa em um emulador — você nunca está apenas lendo, está construindo.

## Para quem é este tutorial

Você já programa com desenvoltura e instalou o `asar`, o `ca65` (parte do conjunto
`cc65`) e o emulador **Mesen** em um Mac. Não é necessário ter experiência prévia
com 6502/65816 ou SNES — a Lição 2 cobre a CPU do zero.

## Escolha do toolchain

Este tutorial padroniza o uso do **ca65** (do cc65), não do asar. Motivos:

- **O depurador do Mesen tem suporte completo e de primeira classe ao ca65**
  (breakpoints ligados a linhas do código-fonte, nomes de símbolos no disassembly,
  expressões de watch). O suporte a símbolos de depuração do asar é parcial em
  comparação, e é justamente na depuração que acontece a maior parte do
  aprendizado na prática.
- Os dois recursos nos quais este tutorial mais se apoia — a [série de SNES do
  nesdoug](https://nesdoug.com/2020/03/19/snes-projects/) e a [Super Famicom
  Development Wiki](https://wiki.superfamicom.org) — usam o ca65 em seus exemplos
  canônicos, então você conseguirá ler material externo sem uma etapa mental de
  tradução.
- O ca65 obriga você a escrever uma configuração explícita de linker (`.cfg`) e
  um layout de segmentos. Isso é um pouco mais de digitação no primeiro dia, mas
  torna visível o mapeamento de memória do SNES — o que mais confunde iniciantes —
  em vez de escondê-lo atrás de mágica.

O asar não é uma escolha ruim (ROMs em arquivo único, sintaxe mais suave), e você
já o tem instalado caso queira comparar algum dia. O Apêndice A mostra brevemente
a mesma ROM da Lição 1 em asar como referência. Todo o resto deste tutorial usa
apenas ca65.

## Como funciona cada lição

Cada lição tem: uma breve explicação do conceito, um arquivo `.asm` totalmente
comentado (ou um diff em relação ao arquivo da lição anterior), os comandos exatos
de `ca65`/`ld65` para compilá-lo, e o que você deve ver ao carregar a ROM no Mesen.
As lições se apoiam umas nas outras — no final, você terá uma base de código
funcional, não dezesseis demos desconectadas.

Se algo em uma lição confundir você ou quebrar na sua máquina, pergunte — este
tutorial é corrigido e expandido com base nessas perguntas.

## Sumário

### Parte 0 — Fundamentos
- [Lição 1: Configurando as ferramentas & sua primeira ROM](01-toolchain-setup-and-first-rom.md) — instale/verifique o ca65 e o Mesen, entenda o cabeçalho da ROM e o vetor de reset, exiba uma cor sólida.
- [Lição 2: Curso intensivo sobre a CPU 65816](02-cpu-crash-course.md) — registradores, alternância entre modo 8/16 bits, modos de endereçamento, a diretiva `.smart`, e pegadinhas 6502-vs-65816.
- [Lição 3: Mapa de memória do SNES & registradores de hardware](03-memory-map-and-registers.md) — WRAM, VRAM, CGRAM, OAM, as janelas de registradores da PPU/CPU, e como ler a wiki de referência.

### Parte 1 — Fundamentos de gráficos
- [Lição 4: Paletas & CGRAM](04-palettes-and-cgram.md) — formato de cor do SNES (15-bit BGR), escrevendo uma paleta a partir da ROM em um loop.
- [Lição 5: Tiles & VRAM](05-tiles-and-vram.md) — formatos de bitplane de tiles (2bpp/4bpp/8bpp), carregando dados gráficos na VRAM.
- [Lição 6: Backgrounds & tilemaps](06-backgrounds-and-tilemaps.md) — modos de BG, formato do tilemap, ativando uma camada de background.
- [Lição 7: Depurando com o Mesen](07-debugging-with-mesen.md) — breakpoints, visualizadores de PPU, ferramentas de memória, o event viewer, e o trace logger.
- [Lição 8: Mergulho profundo em DMA & HDMA](08-dma-and-hdma.md) — canais de DMA de propósito geral, o truque do preenchimento por DMA, HDMA para efeitos por scanline.
- [Lição 9: Rolagem de background](09-background-scrolling.md) — `BGxHOFS`/`BGxVOFS`, um loop de jogo real por frame, wrap-around de tilemap sem emendas.

### Parte 2 — Sprites & interação
- [Lição 10: Fundamentos de sprites (OAM)](10-sprites-oam-basics.md) — gráficos de sprite, a tabela OAM, atributos de tamanho/prioridade.
- [Lição 11: Entrada do controle & animação de sprite](11-controller-input-and-animation.md) — configuração de NMI, leitura do joypad, movendo e animando um sprite.
- [Lição 12: Detecção de colisão](12-collision-detection.md) — sprite-contra-sprite (caixas AABB) e sprite-contra-cenário (uma tabela de consulta).

### Parte 3 — Áudio
- [Lição 13: O SPC700 & fundamentos de áudio](13-spc700-and-audio-basics.md) — a segunda CPU, o handshake de boot, produzindo um som sem nenhum código SPC700.
- [Lição 14: Música & efeitos sonoros](14-music-and-sound-effects.md) — disparando efeitos sonoros a partir do gameplay, e um caminho realista até música de verdade.

### Parte 4 — Encerrando
- [Lição 15: Organização de código & otimização](15-code-organization-and-optimization.md) — projetos com múltiplos arquivos, macros, o orçamento de tempo do V-Blank, bancos de ROM.
- [Lição 16: Projeto final](16-capstone.md) — um pequeno jogo jogável combinando tudo: background com rolagem, sprite de jogador animado/colidível, um colecionável, e som.

## Recursos de referência

- [Referência do 65816](https://wiki.superfamicom.org/65816-reference) — conjunto completo de instruções.
- [Referência do SPC700](https://wiki.superfamicom.org/spc700-reference) — conjunto de instruções da CPU de som.
- [Registradores](https://wiki.superfamicom.org/registers) — todo registrador de hardware da PPU/CPU, bit a bit.
- [Mapeamento de memória](https://wiki.superfamicom.org/memory-mapping) — detalhes do layout LoROM/HiROM.
- [Série de tutoriais de SNES do nesdoug](https://nesdoug.com/2020/03/19/snes-projects/) — um segundo estilo de explicação para os mesmos temas, também baseado em ca65.
- [Código de exemplo de SNES do nesdoug](https://github.com/nesdoug) — repositórios complementares por lição.

## Status

As 16 lições estão escritas. Veja a [página inicial](../html/pt/index.html) para o
índice completo do curso.
