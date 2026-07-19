# Lição 2: Curso Intensivo sobre a CPU 65816

**Objetivo:** entender a CPU o suficiente para que o resto do código deste
tutorial pare de parecer uma sequência mágica de símbolos. Você não precisa
decorar cada opcode — precisa de um modelo mental dos registradores, dos dois
modos de operação, e dos modos de endereçamento que você vai realmente usar.

Se você nunca escreveu assembly de 6502/65816 antes, leia esta lição com calma e
faça os exercícios. Se você *já* escreveu código para 6502 antes, dê uma olhada
rápida na tabela de registradores e vá direto para [6502 → 65816: o que realmente
é novo](#whats-actually-new) — essa é a seção que vai te livrar dos bugs que
programadores de 6502 experientes costumam ter.

## Os registradores

| Registrador | Nome | Para que serve |
|---|---|---|
| `A` | Acumulador | O registrador de matemática — um operando e o resultado da maioria das operações aritméticas/lógicas. |
| `X`, `Y` | Registradores de índice | Contadores de loop, e offsets para endereçamento indexado (`LDA table,X`). |
| `S` | Ponteiro de pilha | Aponta para o próximo byte livre da pilha. Sempre 16 bits. |
| `D` (ou `DP`) | Registrador de página direta | Veja [Página direta](#direct-page-addressing) abaixo. |
| `DBR` (ou `DB`) | Registrador de banco de dados | O banco padrão para acesso absoluto (não-long) à memória. |
| `PBR` (ou `PB`) | Registrador de banco de programa | O banco de onde as instruções são buscadas. |
| `P` | Status do processador | Bits de flag — veja a próxima tabela. |
| `PC` | Contador de programa | Endereço da instrução atual, dentro do `PBR`. |

`A`, `X` e `Y` são os que você vai mexer o tempo todo. `D`, `DBR` e `PBR` você
configura uma vez durante a inicialização (a rotina `reset` da Lição 1 já mexe em
`D` implicitamente, deixando-o em seu valor de power-on, `$0000`, e é por isso que
os endereços de página direta naquele código mapeiam diretamente para a RAM baixa).

### Flags no registrador `P`

| Flag | Bit | Significado |
|---|---|---|
| N | `$80` | Negativo |
| V | `$40` | Overflow |
| **M** | `$20` | **Largura do acumulador** (só em modo nativo): 0 = 16 bits, 1 = 8 bits |
| **X** | `$10` | **Largura dos registradores de índice** (só em modo nativo): 0 = 16 bits, 1 = 8 bits |
| D | `$08` | Modo decimal (aritmética BCD — código de SNES essencialmente nunca usa isso) |
| I | `$04` | Desabilita IRQ |
| Z | `$02` | Zero |
| C | `$01` | Carry |
| E | — | Modo de emulação (não faz parte do byte de flags visível, mas está conceitualmente aqui) |

As duas flags que mais importam no dia a dia de programação para SNES são **M** e
**X** — elas não são só status, elas *mudam o que a CPU fisicamente faz* com `A`,
`X` e `Y`. Essa é a próxima seção.

## Duas CPUs em uma: modo de emulação vs. modo nativo {#two-cpus-in-one-emulation-vs.-native-mode}

O 65816 é um 65C02 (um 6502 melhorado) que pode mudar para um modo genuinamente
diferente, com capacidade de 16 bits. Ao ligar, ele sempre está em **modo de
emulação** — se comporta como um 6502, `A`/`X`/`Y` são de 8 bits, a pilha é fixa na
página `$01xx`. O código de reset da Lição 1 muda para o **modo nativo** já nas
primeiras instruções:

```asm
    clc
    xce             ; the standard idiom: swap carry with the emulation flag.
                     ; carry was cleared above, so this clears E — native mode.
```

Uma vez em modo nativo, `A`, `X` e `Y` *ainda começam em 8 bits* — modo nativo não
significa automaticamente 16 bits, significa que a CPU agora deixa você *escolher*,
através das flags M e X. É para isso que servem `REP`/`SEP`:

```asm
    rep #$10        ; REP = clear these bits in P. #$10 = the X flag → X/Y become 16-bit.
    sep #$20        ; SEP = set these bits in P.   #$20 = the M flag → A becomes 8-bit.
```

Você pode misturar larguras — `A` de 8 bits com `X`/`Y` de 16 bits (como na Lição
1) é a configuração mais comum em código de SNES, porque dados de paleta/tile são
naturalmente do tamanho de um byte, enquanto índices em tabelas grandes se
beneficiam do alcance de 16 bits. Mas você também pode simplesmente rodar
`rep #$30` para deixar *tanto* `A` quanto `X`/`Y` em 16 bits — você vai fazer isso
sempre que estiver trabalhando diretamente com valores de 16 bits, como escrever um
endereço de VRAM de 16 bits ou uma variável de jogo do tamanho de uma word.

### Por que isso é a causa nº 1 de bugs no 65816

O assembler não sabe a largura real dos registradores da CPU — ele só sabe o que
*você* disse a ele através das diretivas `.a8`/`.a16` e `.i8`/`.i16`. Se essas
diretivas dizem uma coisa e a CPU está de fato em um modo diferente, o `ca65` vai
tranquilamente montar um load imediato de 1 byte quando você queria 2 bytes (ou
vice-versa), e toda instrução depois dela lê operandos desalinhados. Isso produz
bugs que parecem completamente sem relação com o erro real — um valor três linhas
depois vira lixo, ou o programa pula para o meio de uma instrução.

```asm
    sep #$20        ; A is now 8-bit at runtime
    .a16            ; ...but we forgot to tell the assembler! BUG.
    lda #$1234      ; ca65 assembles this as a 16-bit immediate load (3 bytes:
                     ; A9 34 12). At runtime the CPU is in 8-bit A mode, so it
                     ; reads only A9 34 as "LDA #$34", and the next instruction
                     ; starts at the byte 12 — which is probably not a valid
                     ; opcode, or worse, a valid-but-wrong one.
```

O jeito de evitar isso é disciplina: todo `REP`/`SEP` que muda M ou X ganha uma
diretiva `.a8`/`.a16`/`.i8`/`.i16` correspondente logo em seguida, sempre, sem
exceções. O código da Lição 1 faz isso. Continue fazendo.

### A diretiva `.smart`

O ca65 tem uma diretiva, `.smart`, que rastreia `REP`/`SEP` automaticamente e
ajusta suas próprias suposições sobre a largura dos registradores — você vai vê-la
no topo da maioria dos arquivos de exemplo do nesdoug. Ela remove a necessidade de
controlar manualmente `.a8`/`.i16` em código linear.

Este tutorial **não** usa `.smart`, de propósito: enquanto você ainda está
construindo intuição para as larguras, ter que escrever a diretiva você mesmo te
obriga a rastrear conscientemente em qual largura cada registrador está em cada
ponto do código — que é exatamente a habilidade que você está construindo aqui.
`.smart` é genuinamente útil quando essa intuição já é automática (ela elimina uma
categoria inteira de erros de copiar-e-colar em bases de código maiores), e
provavelmente você vai querer ativá-la em seus próprios projetos mais adiante. Só
saiba que, quando você ler código de outras pessoas em ca65 e ver `.smart` no topo
sem diretivas `.a8`/`.i16` espalhadas por ele, é por isso — o assembler está
inferindo o que você está fazendo aqui manualmente.

## Modos de endereçamento

Um modo de endereçamento é *como* o operando de uma instrução diz à CPU onde
encontrar os dados. O 65816 tem muitos deles — mais que o 6502 puro — porque os
modos extras são o que torna viável programar com 16 bits e múltiplos bancos. Você
não vai usar todos eles o tempo todo, mas vai reconhecê-los no código de outras
pessoas, então vale a pena ver cada um pelo menos uma vez.

### Imediato — o valor é o próprio operando

```asm
    lda #$0F        ; A = $0F. The value is baked into the instruction itself.
```

### Página direta {#direct-page-addressing}

```asm
    lda $10         ; A = the byte at address (D + $10)
```

"Página direta" é a evolução, no 65816, da página zero do 6502. Em vez de sempre
significar o endereço literal `$0000`–`$00FF`, significa "o valor do registrador
`D`, mais este offset de um byte." Como a Lição 1 nunca mexe em `D`, ele permanece
em seu valor de power-on, `$0000`, então o endereçamento de página direta ali se
comporta exatamente como a página zero clássica do 6502. Mais adiante, ao trabalhar
com variáveis ligadas a uma região específica de memória, você às vezes vai
configurar `D` de propósito (via `TCD`, Transfer Accumulator to Direct Page) para
tornar um bloco inteiro de variáveis endereçável com offsets baratos de um byte, em
vez de endereços absolutos de dois bytes. Essa é uma otimização de tamanho e
velocidade que você vai encontrar de novo quando o tamanho do código começar a
importar.

### Absoluto — um endereço completo de 16 bits no banco de dados atual {#absolute-a-full-16-bit-address-in-the-current-data-bank}

```asm
    lda $2122       ; A = the byte at (DBR : $2122)
```

Foi isso que a Lição 1 usou para acessar registradores da PPU — `$2100`–`$21FF`
vivem no banco 0, e `DBR` é deixado em `$00` pelo nosso código de inicialização,
então `$2122` significa, sem ambiguidade, `$002122`.

### Absoluto long — endereço mais banco explícito

```asm
    lda $7F0000     ; A = the byte at literal address $7F0000, regardless of DBR
```

Use isso quando precisar ler/escrever em um banco específico independentemente do
que `DBR` contenha no momento — mais frequentemente ao mexer em bancos de RAM de
trabalho do SNES além do banco 0 (`$7E`/`$7F`) a partir de código cujo `DBR` aponta
para outro lugar.

### Endereçamento indexado — página direta, absoluto, ou long, mais X ou Y

```asm
    lda $2100,x     ; absolute indexed: A = byte at (DBR:$2100 + X)
    lda table,y     ; same idea against a label
```

Foi assim que funcionou o loop de limpeza de registradores da Lição 1: `stz
$2100,x` com `X` contando para baixo atinge cada registrador do bloco, um por
iteração do loop.

### Modos indiretos — o operando aponta para um ponteiro

```asm
    lda ($10)       ; direct page indirect: read a 2-byte pointer from
                     ;   (D+$10, D+$11), then A = byte at that address (in DBR)

    lda [$10]       ; direct page indirect LONG: read a 3-byte pointer from
                     ;   (D+$10..D+$12) — includes the bank byte, so this can
                     ;   reach any bank, not just DBR's.

    lda ($10),y     ; indirect indexed: read the 2-byte pointer at (D+$10),
                     ;   THEN add Y to it. This is the classic "iterate a
                     ;   table of structures" pattern — Y walks fields within
                     ;   one entry while the pointer itself picks the entry.
```

Você vai usar `lda [dp],y` constantemente quando começar a copiar dados gráficos
por aí, porque é uma das poucas formas de endereçar através de fronteiras de banco
usando um ponteiro calculado em tempo de execução, em vez de um endereço long fixo
em tempo de compilação.

### Relativo à pilha — lendo argumentos passados na pilha

```asm
    lda $03,s       ; A = the byte at (S + 3)
```

Útil quando você começar a escrever sub-rotinas que recebem argumentos empilhados
antes de um `JSR`/`JSL` — um padrão que você vai ver mais em lições posteriores,
quando o código passar a ser organizado em rotinas reutilizáveis em vez de um único
bloco `reset:` longo.

## 6502 → 65816: o que realmente é novo {#whats-actually-new}

Se você já escreveu código para NES/6502 antes, a maior parte do que veio acima vai
parecer familiar, com sabores extras adicionados. Estas são as diferenças que
realmente mordem:

**Jumps e chamadas long.** Como o código pode viver em qualquer um dos vários
bancos, um `JMP`/`JSR` simples (3 bytes: opcode + endereço de 16 bits) só consegue
alcançar endereços *dentro do banco de programa atual*. Para chamar código em um
banco diferente, você precisa das formas long:

```asm
    jsl $818000     ; JSL: jump to subroutine, long — pushes PBR too, so...
    ...
    rtl             ; ...RTL (return long) can restore it correctly.

    jml $818000     ; JML: jump long, no return expected.
```

Misturar isso — dar `JSR` atravessando uma fronteira de banco, ou dar `RTS` para
sair de uma rotina que foi chamada com `JSL` — é uma forma clássica de travar o
programa. `JSR`/`RTS` e `JSL`/`RTL` precisam ser usados em pares, de forma
consistente.

**O registrador de página direta é realocável.** No 6502, a página zero é sempre
`$0000`–`$00FF`. No 65816, `D` pode apontar para qualquer lugar, via `TCD`
(Transfer-C-to-D — carregue um valor de 16 bits em `A`, depois `TCD` move-o para
`D`). Isso é um recurso deliberado, não uma pegadinha, mas significa que você não
pode assumir "endereçamento de página direta = os primeiros 256 bytes literais da
RAM" como podia no 6502 — sempre confira em que valor `D` foi configurado por
último.

**A largura dos registradores é dinâmica, conforme as flags M/X acima** — no 6502
tudo é simplesmente 8 bits, sempre. Esse é o maior ajuste de todos, e é por isso
que existe toda a seção sobre [modo de emulação vs.
nativo](#two-cpus-in-one-emulation-vs.-native-mode).

**`DBR` importa para endereçamento absoluto.** No 6502 não existe conceito de banco
nenhum. No 65816, um `LDA $2122` simples resolve contra o que quer que `DBR`
contenha no momento — quase sempre o que você quer, uma vez configurado
corretamente na inicialização, mas vale saber que ele está ali, especialmente
quando você começar a escrever código que roda a partir de um banco diferente do
banco 0.

**Instruções novas e úteis que não existem no 6502**, vale a pena conhecer pelo
nome mesmo antes de precisar delas: `PHX`/`PHY`/`PLX`/`PLY` (empilhar/desempilhar X
e Y — o 6502 só consegue empilhar/desempilhar A), `PEA`/`PEI` (empilha um endereço
efetivo, útil para preparar chamadas distantes), `MVN`/`MVP` (block move — copia um
intervalo inteiro de memória em uma única instrução, extremamente útil para limpar
ou copiar buffers grandes), e `WAI` (espera por interrupção — coloca a CPU para
dormir até o próximo IRQ/NMI, útil quando você estiver sincronizando com o vblank
em vez de simplesmente girar em um loop de espera).

## Exemplo resolvido: uma pequena sub-rotina

Aqui está uma rotina autocontida que preenche 32 bytes de RAM em página direta com
um valor, usando alguns dos modos acima em conjunto. Ela ainda não faz parte da ROM
em execução — trate-a como um exercício de leitura, e tente percorrê-la manualmente
antes de ler a explicação.

```asm
; Fills direct-page addresses $00-$1F with the value in A.
; Assumes: 8-bit A, 16-bit X (the same convention as Lesson 1's reset code).
.a8
.i16
fill_zeropage:
    pha             ; save the fill value — X is about to clobber nothing,
                     ;   but we're about to use A as a loop variable via TDC/TAX
                     ;   in a fancier version of this; for now we just keep A
                     ;   as-is and use X purely as the index.
    ldx #$0000
@loop:
    pla             ; restore the fill value into A...
    pha             ; ...and push it right back (a cheap way to "peek" the
                     ;   stack without a dedicated stack-relative read, since
                     ;   we already have it sitting there from the first PHA)
    sta $00,x       ; direct page indexed: write A to (D + $00 + X)
    inx
    cpx #$0020      ; compare 16-bit X against 32
    bne @loop
    pla             ; balance the stack — pull the value we've been peeking
    rts
```

Percorrendo o código: o `pha` no início salva o valor de preenchimento na pilha,
para que a rotina não dependa dele ficar em um local fixo de memória ou em um
registrador que talvez a gente queira usar para outra coisa. O loop usa `X` como um
contador de 16 bits (endereçamento indexado precisa de um registrador de índice, e
`X` é a escolha convencional), e `sta $00,x` é endereçamento indexado de página
direta — exatamente o modo da tabela acima, só que aplicado a uma escrita em vez de
uma leitura. O par `pla`/`pha` dentro do loop é uma forma um pouco desajeitada de
reutilizar repetidamente um valor guardado na pilha sem uma variável dedicada; uma
vez que você tiver visto o endereçamento `stack relative` em uso real mais adiante,
vai reconhecer isso como o tipo de coisa que `lda $01,s` existe para simplificar.

Isso é propositalmente um pouco ineficiente — o objetivo é ver o endereçamento
indexado, a pilha, e um loop limitado por uma comparação de 16 bits, todos
funcionando juntos de verdade, não escrever a rotina de preenchimento mais rápida
possível.

## Exercícios

1. Na rotina `reset:` da Lição 1, encontre todo `REP`/`SEP` e confirme que cada um
   tem uma diretiva `.a8`/`.a16`/`.i8`/`.i16` correspondente logo depois. Existe
   exatamente um par — mas crie o hábito de checar, porque lições posteriores
   adicionam mais.
2. Reescreva o loop de limpeza de registradores da Lição 1
   (`ldx #$33` / `stz $2100,x` / `stz $4200,x` / `dex` / `bpl`) usando words em vez
   de bytes: o que mudaria se você quisesse limpar valores de 16 bits, dois bytes
   por vez, em vez de um byte por vez? (Você não precisa implementar isso de fato —
   raciocinar sobre *o que precisaria mudar* — o modo de endereçamento do STZ, o
   limite do loop, o tamanho do passo — é o exercício.)
3. Preveja o que dá errado se você apagar a diretiva `.i16` logo depois de
   `rep #$10` no código de reset da Lição 1, deixando a instrução `rep #$10` em si
   no lugar. Depois, uma vez que sua toolchain esteja confirmadamente funcionando a
   partir da Lição 1, tente de fato e veja se o resultado montado bate com sua
   previsão (dica: compare a quantidade de bytes de `ldx #$1FFF` antes e depois da
   sua mudança — você pode checar isso com `ca65 -l` para gerar um arquivo de
   listagem, ou inspecionando `lesson1.o` com um visualizador hexadecimal).

---

[Home](../docs/pt/index.html) |
Previous: [Lição 1 — Configurando as ferramentas & sua primeira ROM](01-toolchain-setup-and-first-rom.md)
Next: [Lição 3 — Mapa de memória do SNES & registradores de hardware](03-memory-map-and-registers.md)
