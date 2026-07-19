# Lição 14: Música & Efeitos Sonoros

**Objetivo:** disparar um som a partir de um evento real de gameplay usando a
técnica de DSP manual da [Lição 13](13-spc700-and-audio-basics.md), e depois
ter uma visão honesta do que é preciso para adicionar música de verdade — que
este tutorial deliberadamente não implementa do zero.

## Disparando um efeito sonoro sob demanda

O tom da Lição 13 começava uma vez, no boot, e nunca parava. Um *efeito* sonoro
precisa disparar sob demanda — digamos, quando o `check_collision` da [Lição
12](12-collision-detection.md) reporta um toque. O truque: redisparar uma voz
que já está tocando exige um par de **key-off, depois key-on**, não apenas
key-on de novo — escrever `KON` enquanto uma voz já está ativa não reinicia seu
envelope, é simplesmente ignorado.

```asm
; Call after check_collision returns with carry set.
play_hit_sfx:
    ldx #$015C        ; KOFF: key off voice 0
    jsr write_dsp
    ldx #$014C         ; KON: key on voice 0 (restarts the envelope cleanly)
    jsr write_dsp
    rts
```

Conecte isso à checagem de colisão da Lição 12:

```asm
    jsr check_collision
    bcc @no_hit
    jsr play_hit_sfx
@no_hit:
```

Como tanto `check_collision` quanto `write_dsp`/`spc_upload_byte` são
sub-rotinas comuns, chamar uma a partir do caminho de sucesso da outra não é
nada novo — é a mesma disciplina `JSR`/`RTS` de toda lição anterior, só que com
um chip de som do outro lado em vez de um registrador da PPU.

### Um segundo som, independente

O DSP tem 8 vozes; a Lição 13 só usou a voz 0. Um segundo efeito sonoro —
digamos, um bipe curto ao pressionar um botão — pode rodar na voz 1
inteiramente independente, usando as mesmas chamadas a `write_dsp` com os
offsets de registrador da voz 1 (some `$10` a cada um dos números de registrador
da voz 0: `VOLL` vira `$10`, `PITCHL` vira `$12`, e assim por diante). Conecte
isso ao botão `A` dos exercícios da [Lição
11](11-controller-input-and-animation.md#reading-the-controller), e você tem
dois sons independentemente disparáveis compartilhando os mesmos dados de
amostra, distinguidos só por qual voz os toca.

## O que música de verdade realmente exige

Tudo nas Lições 13-14 é deliberadamente mínimo — o suficiente para entender o
protocolo de comunicação e fazer *um* som. Música de fundo de verdade precisa
de um sequenciador rodando *no próprio SPC700*: algo que lê um formato de
música compacto da ARAM e atualiza continuamente os registradores do DSP no
tempo certo, inteiramente independente do 65816 (que deveria estar livre para
rodar código de gameplay, não gastar todo frame escrevendo registradores do DSP
manualmente). Escrever esse sequenciador do zero é um projeto sério por si só —
comparável em escopo a tudo que foi coberto nas Lições 1-13 juntas, o que é
por isso que essencialmente todo jogo homebrew de SNES, por menor que seja, se
apoia em um driver de áudio já existente em vez de escrever um do zero. Três
opções ativamente usadas e compatíveis com ca65, em ordem aproximada de quão
ativamente mantidas e documentadas estão no momento em que isto foi escrito:

- **[Terrific Audio Driver](https://github.com/undisbeliever/terrific-audio-driver)**
  — suporta ca65 diretamente, usa um formato de texto MML (Music Macro
  Language) para composição, e vem com seu próprio previewer com um emulador de
  SPC700 embutido, para você ouvir mudanças sem precisar recompilar tudo.
- **[SNESGSS Extended](https://github.com/NovaSquirrel/snesgss-extended)** —
  um fork do motor SNESGSS, de longa data, baseado em um pacote de macros para
  ca65, com um editor dedicado no estilo tracker.
- **[SNESMOD](https://nesdoug.com/2022/03/02/snesmod/)** — licenciado sob MIT,
  montado com ca65 via pacote de macros do blargg, controlado por arquivos de
  módulo `.it` (Impulse Tracker) que você pode compor na ferramenta gratuita
  OpenMPT.

Todas as três resolvem o mesmo problema subjacente que esta lição introduziu à
mão — colocar uma representação compacta de música na ARAM e fazer o SPC700
tocá-la continuamente — com um sequenciador de verdade em vez de um tom único e
fixo. Escolher uma e seguir seu próprio guia de integração é o próximo passo
natural depois deste tutorial, e é deixado intencionalmente assim: um próximo
passo, não parte do currículo principal aqui.

## Exercícios

1. Implemente o bipe da voz 1, disparado por botão, descrito acima, distinto
   do som de colisão da voz 0, e confirme que os dois conseguem ser ouvidos
   independentemente (inclusive sobrepostos, se você os disparar próximos um
   do outro).
2. Leia a [documentação do Terrific Audio
   Driver](https://github.com/undisbeliever/terrific-audio-driver) (ou
   qualquer uma das três opções que mais te interessar) o suficiente para
   responder: como ele espera que os dados de música sejam incluídos na sua
   ROM — como um arquivo montado separado, um segmento de linker, ou outra
   coisa? Você não precisa integrá-lo, só localizar a resposta.
3. Olhe de novo para os valores de `ADSR1`/`ADSR2` (`$C3`/`$2F`) da voz 0 na
   [Lição 13](13-spc700-and-audio-basics.md). A [referência do
   SPC700](https://wiki.superfamicom.org/spc700-reference) documenta o layout
   de bits do envelope ADSR — sem necessariamente calcular os tempos exatos,
   identifique qual dos dois registradores controla o "ataque" (quão rápido o
   som atinge o volume máximo quando o key-on dispara) versus o "release".

---

[Home](../docs/pt/index.html) |
Previous: [Lição 13 — O SPC700 & fundamentos de áudio](13-spc700-and-audio-basics.md)
Next: [Lição 15 — Organização de código & otimização](15-code-organization-and-optimization.md)
