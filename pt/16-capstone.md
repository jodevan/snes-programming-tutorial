# Lição 16: Projeto Final

**Objetivo:** juntar tudo das Lições 1-15 em uma cena pequena, coerente e
jogável — não é material novo, é a primeira vez que tudo isso roda como um
único programa, em vez de quinze demos separadas.

## O que você está construindo

Um sprite controlado pelo jogador que: se move por um background com rolagem,
fica dentro da área de jogo através de colisão baseada em tiles, consegue tocar
um sprite colecionável que desaparece e toca um som quando coletado, e é
construído a partir de arquivos organizados do jeito que a [Lição
15](15-code-organization-and-optimization.md) descreveu, em vez de um único
arquivo monolítico. Concretamente, cada peça mapeia para uma lição que você já
construiu:

| Peça | De |
|---|---|
| Esqueleto da ROM, cabeçalho, rotina de reset | [Lição 1](01-toolchain-setup-and-first-rom.md) |
| Paleta | [Lição 4](04-palettes-and-cgram.md) |
| Tile de background + tilemap | [Lições 5](05-tiles-and-vram.md)-[6](06-backgrounds-and-tilemaps.md) |
| Carregamento rápido via DMA | [Lição 8](08-dma-and-hdma.md) |
| Rolagem de background | [Lição 9](09-background-scrolling.md) |
| Sprite do jogador + animação | [Lições 10](10-sprites-oam-basics.md)-[11](11-controller-input-and-animation.md) |
| Limites de movimento + detecção de colecionável | [Lição 12](12-collision-detection.md) |
| Efeito sonoro de coleta | [Lições 13](13-spc700-and-audio-basics.md)-[14](14-music-and-sound-effects.md) |
| Organização de arquivos | [Lição 15](15-code-organization-and-optimization.md) |

## Organização de arquivos sugerida

```
main.s          ; .includes everything below, HEADER/ROMINFO/VECTORS segments
regs.s          ; hardware register address constants
variables.s     ; direct-page variable definitions
macros.s        ; write_dsp_reg and any other macros you've written
reset.s         ; reset: — CPU init, palette/tile/tilemap/sprite loading (DMA)
gameplay.s       ; nmi_handler: — scroll, input, movement, collision, sound
audio.s           ; spc_wait_boot, spc_begin_upload, spc_upload_byte, write_dsp
lorom128.cfg       ; the 4-bank linker config from Lesson 15
```

## O mecanismo do colecionável

Essa é a única peça genuinamente nova — todo o resto é reaproveitamento
direto. Estenda o sprite `wall_x`/`wall_y` da Lição 12 para virar um
colecionável de verdade: quando `check_collision` reportar um toque, esconda-o
(mova-o para fora da tela, a mesma técnica que a Lição 10 usou para sprites não
usados) e dispare o som da Lição 14, protegido para disparar só uma vez:

```asm
; --- new variable ---
collected := $06     ; 0 = not yet collected, 1 = collected

; --- inside nmi_handler, after the existing check_collision call ---
    lda collected
    bne @already_done       ; skip entirely once collected

    jsr check_collision
    bcc @no_hit
    lda #1
    sta collected

    ; hide the collectible sprite (same technique as Lesson 10's off-screen sprites)
    stz $2102
    lda #4                    ; OAMADDL: sprite 1's record starts at byte 4
    sta $2102
    stz $2103
    lda #$F0
    sta $2104                  ; overwrite its Y with an off-screen value
                                 ; (X/tile/attr bytes stay as previously set;
                                 ; only Y needs to change to hide it)

    jsr play_hit_sfx             ; from Lesson 14
@no_hit:
@already_done:
```

## Compile, execute e verifique

Este é o ponto em que as ferramentas da [Lição 7](07-debugging-with-mesen.md)
deixam de ser opcionais. Antes de considerar o projeto final terminado, use-as
deliberadamente:

1. **Palette e tile viewers** — confirme que tanto o sprite colecionável quanto
   o sprite do jogador renderizam com as cores e os dados de tile que você
   espera.
2. **Um breakpoint em `collected`** (acesso de escrita) — confirme que ele é
   configurado exatamente uma vez, não repetidamente, quando os sprites se
   sobrepõem.
3. **O Event Viewer** — confirme que o trabalho extra de OAM/DMA que esta lição
   adicionou ainda completa dentro do V-Blank, seguindo o orçamento discutido
   na [Lição 15](15-code-organization-and-optimization.md#respecting-the-v-blank-time-budget).
   Um projeto final que funciona mas silenciosamente estoura o orçamento de
   timing é um bom hábito de pegar agora, antes que um projeto maior torne isso
   muito mais difícil de encontrar.

## Para onde ir a partir daqui

Este tutorial para aqui de propósito — não porque não sobrou nada, mas porque
tudo que vem depois deste ponto é variação e aprofundamento sobre as mesmas
fundações, melhor explorado construindo algo que você realmente quer fazer.
Algumas direções, cada uma uma extensão natural de uma lição específica:

- **Um nível de verdade** em vez de uma listra repetida: múltiplos designs de
  tile, um tilemap desenhado à mão (Lição 6), e dados de colisão derivados dele
  (o terceiro exercício da Lição 12 esboçou exatamente isso).
- **Mais camadas de background**: o Modo 1 deixa `BG1`/`BG2` sem uso neste
  tutorial — uma camada de paralaxe ou uma camada de HUD é uma extensão direta
  da Lição 6, atenta à pegadinha do latch de rolagem compartilhado da Lição 9.
- **Música de verdade**, via um dos drivers que a Lição 14 apontou, substituindo
  o tom único ajustado à mão por uma faixa composta de verdade.
- **Efeitos de HDMA** além do gradiente de brilho — mudanças de cor por
  scanline ou um efeito de scroll dividido, construindo sobre a Lição 8.
- **Ferramentas gráficas** — codificar tiles byte a byte à mão (como toda lição
  aqui fez) não escala; pesquise ferramentas que convertem um PNG para o
  formato de tile do SNES diretamente.
- A [Super Famicom Development Wiki](https://wiki.superfamicom.org) e a
  [SNESdev Wiki](https://snes.nesdev.org/wiki/SNESdev_Wiki) — ambas citadas ao
  longo deste tutorial — cobrem tudo, do Modo 7 a chips de save-data e
  multiplayer, muito além do escopo deste curso.

Se você travar em qualquer um desses pontos, ou em qualquer coisa nas Lições
1-16, é exatamente para essa situação que o formato deste tutorial foi
construído — traga a pergunta de volta, e a lição relevante é corrigida ou
expandida com base nela.

---

[Home](../docs/pt/index.html) |
Previous: [Lição 15 — Organização de código & otimização](15-code-organization-and-optimization.md)
