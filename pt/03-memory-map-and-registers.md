# Lição 3: Mapa de Memória do SNES & Registradores de Hardware

**Objetivo:** construir um mapa mental de onde tudo mora — WRAM, VRAM, CGRAM, OAM,
e as janelas de registradores que as controlam — antes de mexer em gráficos. Toda
lição a partir daqui aponta de volta para esta, então vale a pena lê-la com calma
mesmo sem ter uma nova ROM para montar ainda.

## Quatro tipos de memória, quatro portas diferentes

O SNES não tem um único espaço de memória plano que a CPU possa ler e escrever
livremente. Ele tem vários chips de memória fisicamente separados, e o 65816 só
consegue alcançar a maioria deles indiretamente, através de pequenos registradores
"vigia" (porthole). Deixar isso claro agora poupa muita confusão depois — "por que
eu não posso simplesmente dar `LDA` em um endereço de VRAM?" é uma das perguntas
mais comuns de iniciantes, e a resposta é simplesmente que a VRAM não está sequer
conectada ao barramento de endereços da CPU.

| Memória | Tamanho | Contém | Como a CPU a alcança |
|---|---|---|---|
| **WRAM** | 128 KB | RAM de propósito geral — variáveis, pilhas, buffers | Diretamente, como endereços reais (veja abaixo) |
| **VRAM** | 64 KB | Dados gráficos de tiles e tilemaps | Indiretamente, através de `$2115`-`$2119` |
| **CGRAM** | 512 bytes | A paleta de cores (256 entradas × cor de 15 bits) | Indiretamente, através de `$2121`-`$2122` |
| **OAM** | 544 bytes | Atributos de sprite (posição, tile, paleta, flags) | Indiretamente, através de `$2102`-`$2104` |

A WRAM é a exceção — é a única das quatro que a CPU consegue endereçar como memória
comum. VRAM, CGRAM e OAM só são alcançáveis escrevendo um endereço em um
registrador e um valor em outro, um passo afastado da CPU. Esta lição apresenta
onde cada uma fica e como é sua janela de registradores; as lições
[4](04-palettes-and-cgram.md), [5](05-tiles-and-vram.md) e
[10](10-sprites-oam-basics.md) voltam a cada uma delas e aprofundam.

## WRAM: o espaço de endereços real da CPU

A WRAM tem 128 KB, mapeada em `$7E0000`-`$7FFFFF`. Mas você raramente vai escrever
um endereço long como `$7E1234` na prática, porque os *primeiros 8 KB* desse
espaço — `$7E0000`-`$7E1FFF` — são adicionalmente **espelhados** em `$0000`-`$1FFF`
nos bancos `$00`-`$3F` e `$80`-`$BF`. É por isso que a configuração de pilha da
Lição 1 funcionou com um endereço curto:

```asm
    ldx #$1FFF      ; top of the WRAM mirror visible in bank 0
    txs
```

O `$0000`-`$1FFF` do banco 0 e a WRAM "real" em `$7E0000`-`$7E1FFF` são exatamente
os mesmos bytes físicos — escrever em um muda o que você leria do outro. Esse
espelhamento é o motivo pelo qual o endereçamento de página direta (veja a [Lição
2](02-cpu-crash-course.md#direct-page-addressing)) funciona tão naturalmente para
variáveis: contanto que seus dados caibam nesses primeiros 8 KB, você nunca precisa
de um endereço long para alcançá-los.

Se você precisar de WRAM além desses primeiros 8 KB — o resto do chip de 128 KB —
existe um segundo caminho: os registradores `$2180`-`$2183`
(`WMDATA`/`WMADDL`/`WMADDM`/`WMADDH`) permitem configurar um endereço de WRAM de 17
bits e depois ler/escrever um byte de cada vez através de `$2180`, com
auto-incremento após cada acesso. Isso é mais lento que endereçamento direto (e, a
propósito, é como o motor de DMA da Lição 8 alcança a WRAM além de `$1FFF` sem
precisar que `DBR` aponte para algum lugar incomum), mas funciona a partir de
qualquer banco sem mexer em `DBR`.

## VRAM, CGRAM e OAM: três dispositivos "vigia" {#vram-cgram-and-oam-three-porthole-devices}

Esses três seguem o mesmo padrão: um **registrador de endereço**, um **registrador
de dados**, e (geralmente) auto-incremento na escrita. Você vai reconhecer esse
padrão imediatamente porque a Lição 1 já o usou para a CGRAM:

```asm
    stz $2121       ; CGADD:  "point at palette entry 0"
    lda #$00
    sta $2122       ; CGDATA: "write this byte, then advance"
    lda #$7C
    sta $2122       ; CGDATA: second byte of the same color, advances again
```

A VRAM (`$2115`-`$2119`) e a OAM (`$2102`-`$2104`) funcionam da mesma forma, só que
com nomes de registradores diferentes e peculiaridades um pouco diferentes — a OAM
em particular tem um comportamento estranho de escrita em "par bufferizado" que a
Lição 10 cobre em detalhes. O importante para internalizar agora: **sempre que você
vir código escrevendo repetidamente em um registrador de "dados" dentro de um loop,
quase sempre isso está transmitindo bytes para uma dessas três memórias**, com o
registrador de "endereço" correspondente configurado uma vez antes.

## As janelas de registradores

O Barramento de Endereços B — a janela que a CPU usa para alcançar a PPU, as portas
de comunicação da APU, e o DMA — vive inteiramente dentro de `$2100`-`$21FF` e
`$4200`-`$43FF` do banco 0 (também espelhada no banco `$80`, já que `DBR`
normalmente é `$00` ou `$80` no código deste tutorial). Aqui está o mapa que vale a
pena marcar para consulta:

| Faixa | O que tem ali | Coberto em |
|---|---|---|
| `$2100`-`$2133` | Controle da PPU: tela, backgrounds, portas de VRAM/CGRAM, rolagem | Lições [4](04-palettes-and-cgram.md), [5](05-tiles-and-vram.md), [6](06-backgrounds-and-tilemaps.md), [9](09-background-scrolling.md) |
| `$2134`-`$213F` | Status/resultados da PPU: resultado de multiplicação, leitura de volta de OAM/VRAM/CGRAM, posição da scanline | conforme necessário |
| `$2140`-`$2143` | Portas de comunicação da APU (SPC700) | Lições [13](13-spc700-and-audio-basics.md)-[14](14-music-and-sound-effects.md) |
| `$2180`-`$2183` | Porta de acesso indireto à WRAM | esta lição, e DMA na Lição [8](08-dma-and-hdma.md) |
| `$4016`-`$4017` | Acesso ao joypad no estilo antigo (compatível com NES) | raramente usado diretamente — veja a Lição [11](11-controller-input-and-animation.md) |
| `$4200`-`$420D` | Controle da CPU: habilitação de NMI/IRQ, unidade de matemática, habilitação de DMA, velocidade da ROM | Lições [8](08-dma-and-hdma.md), [11](11-controller-input-and-animation.md) |
| `$4210`-`$4213` | Status da CPU: flags de NMI/IRQ, status de auto-leitura do joypad | Lição [11](11-controller-input-and-animation.md) |
| `$4214`-`$4217` | Resultados de multiplicação/divisão por hardware | não coberto em profundidade neste tutorial |
| `$4218`-`$421F` | Estados dos botões do joypad capturados (auto-leitura) | Lição [11](11-controller-input-and-animation.md) |
| `$4300`-`$437F` | Registradores de canal de DMA/HDMA (8 canais × 16 bytes cada) | Lição [8](08-dma-and-hdma.md) |

Essa tabela é propositalmente densa — a ideia não é você decorá-la, é você
reconhecê-la depois. Quando uma lição futura apresentar `$210D` do nada, você vai
saber pensar "isso está no bloco de controle da PPU, provavelmente um registrador
de background" antes mesmo de ler o que ele faz.

O detalhamento completo, bit a bit, de todo registrador aqui vive na [página de
Registradores da Super Famicom Development
Wiki](https://wiki.superfamicom.org/registers) — as explicações de registradores
deste tutorial são todas conferidas cruzando com ela, e é a aba mais útil para
manter aberta enquanto você avança pelo resto deste curso.

### Lendo um diagrama de registrador {#reading-a-register-diagram}

A wiki de referência (e este tutorial) descreve registradores com diagramas de bits
compactos como este, para o `BGMODE`:

```
$2105  wb+++-
        DCBAemmm
```

A primeira linha é metadado: `w` significa gravável (writable), `b` significa que é
um registrador de byte simples (em oposição a uma word dividida em dois
endereços), e os quatro símbolos depois disso (`+++-`) indicam se é seguro
escrever durante h-blank/v-blank/forced-blank/a qualquer momento. A segunda linha
é o layout de bits, lido da esquerda para a direita, do bit 7 até o bit 0. Então
`DCBAemmm` significa: os bits 7-4 são as flags individuais D, C, B, A; o bit 3 é
`e`; os bits 2-0 juntos formam `mmm`. Uma vez que essa notação faz sentido, a
referência inteira de registradores se torna legível de relance — você vai ver
esse formato exato constantemente a partir da Lição 4.

## Por que o DBR importa aqui

Lembre-se, pela [Lição
2](02-cpu-crash-course.md#absolute-a-full-16-bit-address-in-the-current-data-bank),
que o endereçamento absoluto simples (`lda $2122`) resolve contra o que quer que
`DBR` contenha no momento. Todo acesso a registrador neste tutorial funciona porque
o código de reset da Lição 1 deixa `DBR` em `$00`, e `$2100`-`$21FF`/`$4200`-`$43FF`
são espelhados de forma idêntica no banco `$00` e no banco `$80`. Se algum dia você
escrever código que roda a partir de um banco diferente com `DBR` apontando para
outro lugar, escritas em registrador como `sta $2122` vão silenciosamente ir para o
lugar errado — esse é um bug real que aparece quando projetos crescem além de um
único banco, então vale lembrar que essa dependência existe mesmo que ela ainda não
vá te morder.

## Exercícios

1. Sem consultar, tente adivinhar em qual memória (WRAM, VRAM, CGRAM ou OAM) cada
   um destes moraria: o valor de vida de um jogador; um tilemap de background; a
   cor da entrada 5 da paleta; a posição X de um sprite. Confira suas respostas com
   a tabela no topo desta lição.
2. Leia a entrada de `OAMADDL`/`OAMADDH` na [página de
   Registradores](https://wiki.superfamicom.org/registers#oamaddl-oam-address-low-byte-214)
   e, usando apenas a técnica de leitura de diagrama de registrador acima, descubra
   qual bit de `$2103` é o bit de "rotação de prioridade da OAM" antes de ler a
   explicação em texto logo abaixo. (A Lição 10 usa isso.)
3. Explique com suas próprias palavras por que `lda $7E1234` e `lda $1234`
   (executados a partir do banco `$00`) leem o mesmo byte, mas `lda $7E2000` e
   `lda $2000` não.

---

Root: [README.md](README.md)
Previous: [Lição 2 — Curso intensivo sobre a CPU 65816](02-cpu-crash-course.md)
Next: [Lição 4 — Paletas & CGRAM](04-palettes-and-cgram.md)
