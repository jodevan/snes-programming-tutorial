# Lição 9: Rolagem de Background

**Objetivo:** transformar o background listrado e estático das Lições 4-8 em um
que se move, e de quebra substituir o loop de espera `forever: jmp forever` com
que toda lição anterior terminava por um loop de jogo real, por frame.

## BGxHOFS / BGxVOFS

Cada camada de background tem um registrador de rolagem horizontal e um
vertical: `BG3HOFS` (`$2111`) e `BG3VOFS` (`$2112`) para a camada que você vem
construindo. Ambos são registradores de "escrita dupla", a mesma ideia do
`CGDATA` na Lição 4 — escreva o byte baixo, depois o byte alto, no *mesmo*
endereço:

```asm
    lda scroll_lo
    sta $2111        ; BG3HOFS: first write = low byte
    lda scroll_hi
    sta $2111         ; BG3HOFS: second write = high byte
```

### Uma pegadinha de latch compartilhado que vale a pena conhecer antes de cair nela

Segundo a [referência de rolagem de
background](https://wiki.superfamicom.org/backgrounds#bg-scrolling), todos os
oito registradores `BGnHOFS`/`BGnVOFS` compartilham um *único* latch interno de
"último byte escrito", não um latch por registrador. Se você escrever o byte
baixo do BG3, depois escrever o byte baixo do BG1 antes de voltar para terminar
o byte alto do BG3, o hardware combina sua escrita do byte alto do BG3 com os
dados de latch remanescentes *errados*, corrompendo o resultado. A regra que te
mantém seguro: **sempre escreva o byte baixo de um registrador de rolagem
imediatamente seguido pelo byte alto, sem nenhuma outra escrita em registrador
de rolagem no meio.** Este tutorial só rola uma camada, então isso ainda não
pode te morder — mas no momento em que você rolar duas camadas
independentemente (um efeito de paralaxe, por exemplo), esse é o bug esperando
por você.

## Construindo um loop por frame

Toda ROM até agora terminou em uma espera infinita — nada acontecia depois da
configuração. Jogos de verdade atualizam o estado uma vez por frame,
sincronizados com a atualização da tela. Sem interrupções apropriadas (que a
[Lição 11](11-controller-input-and-animation.md) apresenta), a forma correta
mais simples de fazer isso é **fazer polling do `HVBJOY`** (`$4212`) — o bit 7
fica ligado durante toda a duração do V-Blank, e desligado no resto do tempo:

```asm
frame_loop:
@wait_vblank_start:
    lda $4212
    bpl @wait_vblank_start   ; loop while bit 7 (N) is clear = not yet in vblank

    ; --- game logic goes here, once per frame ---

@wait_vblank_end:
    lda $4212
    bmi @wait_vblank_end      ; loop while bit 7 is still set = still in vblank

    jmp frame_loop
```

A segunda espera importa tanto quanto a primeira: sem ela, seu código de "uma
vez por frame" na verdade rodaria dezenas de vezes durante um único período de
V-Blank de ~40 scanlines, já que o loop de polling continuaria passando na
primeira checagem durante todo o tempo em que o V-Blank permanece ativo. Esperar
o V-Blank *terminar* antes de voltar ao loop garante exatamente uma atualização
por frame. A [Lição 11](11-controller-input-and-animation.md) substitui todo
esse padrão de polling por um handler de NMI, que é ao mesmo tempo mais preciso
e libera a CPU para fazer outro trabalho enquanto espera — mas vale a pena
entender o polling primeiro, já que ele deixa o timing subjacente explícito em
vez de escondê-lo dentro de uma interrupção.

## Estendendo sua ROM

Reserve dois bytes de página direta para um contador de rolagem de 16 bits,
substitua o loop final `forever:` da sua ROM pelo loop de frame acima, e
incremente o valor de rolagem uma vez por frame usando o idioma clássico de 8
bits "incremente o byte baixo, propague o carry para o byte alto":

```asm
; --- direct-page variables, reserved once near the top of your code ---
scroll_lo := $00
scroll_hi := $01

; --- inside the frame loop, replacing the "game logic" comment above ---
    inc scroll_lo
    bne @no_carry
    inc scroll_hi
@no_carry:
    lda scroll_lo
    sta $2111        ; BG3HOFS low byte
    lda scroll_hi
    sta $2111         ; BG3HOFS high byte
```

Um atalho tentador a evitar: não recorra a um único `sta $2111` de 16 bits aqui,
mesmo que `scroll_lo`/`scroll_hi` estejam em memória consecutiva como um valor
natural de 16 bits. Uma escrita de 16 bits grava seu byte baixo em `$2111` e seu
byte alto em `$2113` — desculpe, em `$2112`, o *próximo* endereço, que é o
`BG3VOFS`, não a segunda metade do `BG3HOFS`. Duas escritas deliberadas de 8
bits no mesmo endereço é o padrão correto aqui, não uma escrita de 16 bits em
dois endereços — um erro fácil o suficiente de cometer que vale a pena nomear
explicitamente.

## Compile e execute

Monte e execute. O background listrado agora deve rolar suave e continuamente
para um dos lados, dando a volta sem emendas — porque seu tilemap é um único
bloco de 32×32 tiles (256×256 pixels) e, segundo a [referência de
backgrounds](https://wiki.superfamicom.org/backgrounds#bg-scrolling), "a
exibição nunca pode cair para fora do BG: ela simplesmente dá a volta
automaticamente." Você não escreveu nenhuma lógica de wrap-around; o hardware
fez isso por você.

## Exercícios

1. Adicione um segundo contador para `BG3VOFS` e role na diagonal.
2. Os dois bits mais baixos do registrador `BG3SC` (da [Lição
   6](06-backgrounds-and-tilemaps.md#a-crucial-gotcha-word-addresses-vs.-byte-addresses))
   selecionam arranjos de tiles 32×32, 64×32, 32×64, ou 64×64. Tente `01`
   (64×32) e preencha o segundo bloco 32×32 com um padrão de tilemap diferente —
   confirme que a rolagem agora revela duas metades distintas antes de dar a
   volta, em vez de um bloco que se repete.
3. Diminua a velocidade da rolagem para um pixel a cada 4 frames em vez de a
   cada frame, sem mudar a estrutura do loop de frame — pense em qual condição
   deveria controlar a linha `inc scroll_lo`.

---

Root: [README.md](README.md)
Previous: [Lição 8 — Mergulho profundo em DMA & HDMA](08-dma-and-hdma.md)
Next: [Lição 10 — Fundamentos de sprites (OAM)](10-sprites-oam-basics.md)
