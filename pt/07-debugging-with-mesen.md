# Lição 7: Depurando com o Mesen

**Objetivo:** parar de adivinhar e passar a observar. Agora você tem uma ROM com
estado real — uma paleta, um tile, um tilemap — o que torna este o momento certo
para aprender direito as ferramentas de depuração do Mesen, antes que os projetos
fiquem complexos demais para adivinhar continuar funcionando. Este também é, por
sinal, o motivo pelo qual este tutorial escolheu [ca65 em vez de asar lá no
sumário](../docs/pt/index.html#lessons): o depurador do Mesen tem suporte de
primeira classe aos símbolos de depuração do ca65, então breakpoints e a view de
disassembly mostram os rótulos reais do seu código-fonte, não só endereços crus.

## O conjunto de ferramentas

Tudo abaixo vive dentro do menu **Debug** do Mesen. A [documentação
oficial](https://www.mesen.ca/snes/docs/debugging.md) cobre cada ferramenta em
detalhes completos; esta lição é um tour guiado pelas que você vai usar
constantemente, usando bugs plantados de propósito no seu próprio código da Lição
6 como alvos de prática.

| Ferramenta | Para que serve |
|---|---|
| **Debugger** | Disassembly mapeado ao código-fonte, breakpoints, uma janela de watch, e o estado dos registradores — a janela principal onde você vai viver. |
| **PPU Viewers** | Views ao vivo de tiles, tilemaps, sprites e paletas, lidas diretamente de VRAM/CGRAM/OAM. |
| **Memory Tools** | Um editor hexadecimal mais contadores de acesso de leitura/escrita/execução para cada tipo de memória. |
| **Event Viewer** | Uma linha do tempo por scanline dos acessos a registradores, NMI e IRQ. |
| **Trace Logger** | Um trace de execução instrução por instrução, rolável (ou registrado em arquivo). |

### A janela do Debugger e breakpoints

Abra **Debug → Debugger** enquanto sua ROM está rodando. Você vai ver o
disassembly com seus rótulos do ca65 intactos (`reset:`, `@pal_loop:`, e assim
por diante) — essa é a recompensa da escolha de toolchain feita lá atrás no
sumário. Breakpoints podem disparar em acesso de **leitura**, **escrita**, ou
**execução** a um endereço ou faixa de endereços, em qualquer um dos tipos de
memória do SNES (espaço de endereços da CPU, VRAM, CGRAM, OAM, e mais),
opcionalmente filtrados por uma expressão de condição.

Tente isso concretamente: configure um breakpoint de **escrita** em `$2122`
(CGDATA) e execute novamente sua ROM das Lições 4/5/6 desde o início. A execução
vai pausar em toda escrita de paleta, deixando você percorrer o código e
confirmar — byte por byte — que o loop de `load_palette` está escrevendo o que
você acha que está escrevendo. Faça o mesmo para `$2118`/`$2119` para observar o
upload do tile na VRAM. Isso é uma forma muito mais confiável de responder "meu
loop está fazendo o que eu acho que está fazendo?" do que ficar olhando para o
código-fonte.

### PPU Viewers: vendo os dados, não só as escritas

Abra **Debug → PPU Viewers**. Três views importam mais para o que você construiu
até agora:

- **Palette viewer** — mostra as 256 entradas da CGRAM como amostras de cor.
  Confirme que as entradas 0-3 são preto/vermelho/verde/azul, exatamente como a
  tabela da Lição 4 especificou.
- **Tile viewer** — renderiza os bytes crus da VRAM como tiles, com predefinições
  para "tiles atualmente usados pelo BG3" e similares. Confirme que seu tile da
  Lição 5 de fato mostra uma listra vermelho-sobre-verde, usando a paleta que
  você acabou de confirmar acima. Você pode até clicar com o botão direito em um
  tile aqui e configurar um breakpoint nele diretamente, pulando direto para o
  código que o escreveu por último — muito mais rápido do que caçar manualmente
  a escrita certa de `VMDATAL` no código-fonte.
- **Tilemap viewer** — mostra o tilemap montado (escolha de tile, paleta, flip,
  prioridade por célula) como uma grade. É aqui que a pegadinha "endereço de word
  vs. endereço de byte" da Lição 6 se torna instantaneamente visível: se o
  `BG3SC` estivesse apontando para o local errado da VRAM, essa view mostraria
  tiles de lixo, puxados de qualquer dado aleatório que esteja ali, mesmo que o
  tile viewer e o palette viewer pareçam corretos isoladamente.

### Memory Tools: pegando leituras não inicializadas

**Debug → Memory Tools** te dá um editor hexadecimal sobre qualquer tipo de
memória, mais contadores de acesso — o Mesen rastreia toda leitura, escrita e
execução por endereço enquanto o depurador está ativo. Essa é a ferramenta para
uma categoria específica e muito comum de bug: ler uma variável antes de
qualquer coisa ter escrito nela. Se um endereço mostra leituras mas zero
escritas na view de contadores, você encontrou uma variável que seu código
assume estar inicializada mas que nunca foi de fato configurada.

### Event Viewer: pegando violações de timing

Lembre-se da notação de diagrama de registrador da [Lição
3](03-memory-map-and-registers.md#reading-a-register-diagram) — `wb+++-` e
similares — que codifica exatamente quando um registrador é seguro de escrever
(forced blank, V-Blank, H-Blank, ou a qualquer momento). **Debug → Event
Viewer** desenha uma linha do tempo visual, uma linha por scanline, marcando
todo acesso a registrador como um ponto colorido na posição horizontal em que
aconteceu. É a forma empírica de confirmar que você está respeitando essas
janelas de timing: escritas em registradores da PPU devem se concentrar bem
juntas ao redor do período de forced-blank/V-Blank no topo da linha do tempo.
Uma escrita espalhada no meio da renderização ativa é exatamente o tipo de bug
que produz o sintoma de "glitch por alguns tiles" mencionado lá atrás nas notas
sobre `INIDISP` da Lição 3 — e é muito difícil de perceber só olhando o
código-fonte, mas fica imediatamente óbvio como um ponto fora do lugar nessa
linha do tempo.

### Trace Logger: o último recurso que sempre funciona

**Debug → Trace Logger** registra (ou exibe ao vivo) cada instrução executada,
em ordem, com o estado dos registradores em cada passo. É verboso — geralmente
você não lê um trace completo de cima a baixo — mas é inestimável quando você
sabe *mais ou menos* quando algo deu errado (digamos, "em algum momento depois
da terceira escrita de paleta") e precisa ver o caminho exato, instrução por
instrução, que a CPU percorreu, incluindo qualquer branch que não foi para onde
você esperava.

## Um bug de prática

Quebre de propósito o código da sua Lição 6 para ter prática de verdade: troque a
ordem das escritas de `VMADDL`/`VMADDH` no loop de carregamento do tilemap
(escreva o byte alto primeiro, o byte baixo depois). Recompile, execute, e use as
ferramentas acima nesta ordem para encontrar o bug sem olhar o diff:

1. **Tile viewer** — o tile listrado em si ainda parece correto, já que o loop
   de carregamento de tile da Lição 5 não foi tocado. Isso te diz que o bug está
   depois do carregamento do tile.
2. **Tilemap viewer** — agora mostra o tilemap lendo de uma região inteiramente
   errada da VRAM, porque o endereço onde ele caiu não é o que o `BG3SC` espera.
3. **Breakpoint do Debugger** na escrita em `$2117` (VMADDH) — percorra o código
   e observe os bytes de endereço de fato chegando na ordem errada em relação a
   `$2116`.

Esse fluxo de trabalho — restringir *em qual* estágio está o problema usando os
viewers, depois identificar exatamente *por quê* usando breakpoints — é o padrão
geral que você vai usar pelo resto deste tutorial, e para qualquer projeto de
SNES depois dele.

## Exercícios

1. Configure um breakpoint que dispare só quando `X` for igual a um valor
   específico dentro do loop de preenchimento de tilemap da Lição 6, usando uma
   expressão de condição em vez de percorrer manualmente as 1024 iterações.
2. Abra o Event Viewer na sua ROM da Lição 6 funcionando (sem o bug) e confirme
   por si mesmo que toda escrita de registrador da PPU acontece antes da escrita
   de brilho no `INIDISP` — ou seja, inteiramente dentro do forced blank.
3. Desfaça o bug de prática acima, depois introduza um diferente de propósito
   (por exemplo, carregue a paleta da Lição 4 no índice 4 da CGRAM em vez do
   índice 0) e use o Palette Viewer para confirmar sua previsão do que vai dar
   errado antes de corrigir.

---

Root: [README.md](README.md)
Previous: [Lição 6 — Backgrounds & tilemaps](06-backgrounds-and-tilemaps.md)
Next: [Lição 8 — Mergulho profundo em DMA & HDMA](08-dma-and-hdma.md)
