# Funcionalidades, e como chamá-las

Este documento existe por um motivo prático: dar nome às peças. Sem nome, um
problema vira descrição — "aquelas setinhas do lado quando tô no celular" — e
descrição vira adivinhação. Com nome, "as **setas de vista** aparecem durante a
**visita guiada**" já diz onde está o defeito e onde fica o código.

Os nomes em **negrito** são o vocabulário. Use-os. Se algum estiver errado ou
soar estranho, troque aqui primeiro — o documento é a fonte, não o resumo.

Cada entrada diz o que a coisa é, onde ela aparece na tela e onde mora no
código. O que ela *não* diz é como as regras internas funcionam por dentro:
isso está nos comentários do próprio código, que é onde não corre risco de
envelhecer separado.

---

## 1. Chegada

Tudo que acontece entre abrir o site e ter a sala nas mãos.

| Nome | O que é | Onde mora |
|---|---|---|
| **Portão** | A tela de carregamento: contador de 0 a 100%, barra, log `// iniciando` e o botão ENTRAR. Segura o visitante até a sala estar de pé. | `UI.setLoading` · `#loader` |
| **Pergunta de modo** | No celular e na primeira visita, o ENTRAR vira dois botões: PERFORMANCE ou QUALIDADE. Responder é entrar. | `UI.setMode` · `#mode-ask` |
| **Abertura** | O percurso de entrada: 6,6 s de câmera atravessando a sala, da porta à parede de quadros à sala inteira, terminando na estação de overview. Qualquer toque, clique ou tecla encerra. Uma vez por pessoa. | `Opening.js` |
| **Cartão de abertura** | O texto por cima da abertura: nome, cargo, uma linha e a dica de como pular. | `#opening` |
| **Revelação em mosaico** | A dissolução em blocos que monta a imagem quando a sala aparece. | `Renderer.reveal` |

Durante a abertura a sala fica **fechada**: não responde ao ponteiro, não abre
colchete, não muda o cursor. Isso tem nome próprio no código (`interactions.enabled`).

---

## 2. Navegação

Como se chega aos lugares.

| Nome | O que é | Onde mora |
|---|---|---|
| **Barra** | A faixa do topo, com um fio de 1 px embaixo. No celular ela some e as duas pontas viram colunas empilhadas. | `.hud-bar` · `.hud-tl` · `.hud-tr` |
| **Lugares da barra** | Os sete destinos escritos no meio da barra, com contagem nos dois que escondem mais de um (`Projetos⁽⁶⁾`, `Produtos⁽²⁾`). Precisa de 1180 px de largura; abaixo disso, o menu assume. | `BarNav.js` · `#bar-nav` |
| **Menu** | O botão IR PARA e sua lista. Aparece onde os lugares da barra não cabem: celular e janela estreita. Os dois nunca aparecem juntos. | `Menu.js` · `#menu` |
| **Setas de vista** | As duas setas nas laterais, só no celular. Giram a câmera entre três enquadramentos fixos: porta, mesa, TV. | `Views.js` · `#view-prev` `#view-next` |
| **Estações** | Os enquadramentos fixos para onde a câmera viaja. Cada lugar tem a sua. | `config/stations.js` · `Camera.goTo` |
| **Modo livre** | `F` solta a câmera para andar com WASD, `Space`/`Shift` sobem e descem, `ESC` volta. Só no desktop — ver *pontas soltas*. | `Controls/FreeFlyControls.js` · `#hint` |

---

## 3. Descoberta

Como o visitante fica sabendo que a sala é clicável.

| Nome | O que é | Onde mora |
|---|---|---|
| **Visita guiada** | A caminhada de primeira visita: 7 paradas, barra embaixo com SEGUIR e PULAR. Termina no mural. Uma vez por pessoa. | `Tour.js` · `#tour` |
| **Convite do mural** | A frase que só aparece na última parada: "Não esqueça de deixar o seu recado!". | `#tour-invite` |
| **Colchete** | A hachura que se deita na superfície do objeto sob o ponteiro, com o nome do lugar ao lado. Só no desktop — responde ao ponteiro, e celular não tem. Fica fora durante a abertura e a visita guiada. Todos os valores estão no `LOOK`, no topo do arquivo, e em sliders no `#debug`. | `HoverFrame.js` · `#hotspot-frame` |
| **Luminárias de acento** | Dois spots de teto sobre a parede de quadros, um sobre a porta, e uma poça quente sobre os souvenirs do balcão. Luz de cena de verdade, não sobreposição. A TV e o quadro do Arsène ficam fora: os dois já fazem a própria luz, e somar outra apaga o que eles têm para mostrar. | `World/Lights.js` → `createAccents` |
| **Ovos de páscoa** | Os objetos escondidos que se coleta clicando. O contador só aparece depois do primeiro. Nunca são desenhados nem listados. | `World/Eggs.js` · `#eggs` |

---

## 4. Conteúdo

O que a sala tem para mostrar.

| Nome | O que é | Onde mora |
|---|---|---|
| **Painel** | O texto lateral que abre ao clicar num lugar. | `InfoPanel` em `Interactions.js` · `#panel` |
| **Dobrar o painel** | O botão que recolhe o painel para um cabeçalho, devolvendo a sala. Só no celular. A escolha vale para os painéis seguintes. | `#panel-fold` |
| **Mural** | A porta coberta de recados. É a mesma coisa que "os recados" e que a parada `notes`. | `World/Notes.js` |
| **Enquadramento do mural** | A estação do mural é medida a partir dos recados que estão lá, não da porta: com um só, a câmera chega perto o bastante para ler sem clicar; espalhados nas pontas, ela recua até a porta inteira. Recalculada a cada mudança da parede. | `Interactions.refreshNotesStation` |
| **Compositor** | A caixa de escrever um recado, com o post-it que se arrasta até a porta. | `#compose` · `#place-hint` · `Interactions.beginPlacing` |
| **Contador de pessoas** | O `● 7 na sala` na barra. Vem do backend; se ele estiver fora, o contador simplesmente não aparece. | `Presence.js` · `GET /api/online` |
| **TV** | A televisão com as demonstrações em vídeo. | `World/Tv.js` · `#player` |
| **PC** | O monitor da mesa, que abre um desktop falso com janelas. Só o monitor responde: o gabinete abria a mesma coisa, e apertar a caixa embaixo da mesa para acender uma tela é uma frase que ninguém diz. | `Desktop.js` · `#desktop` |

---

## 5. Chrome e preferências

O que fica na moldura.

| Nome | O que é | Onde mora |
|---|---|---|
| **Marca** | `LÉO ABREU`, no portão e na barra. O nome completo (Leonardo Santos Abreu) é o *registro*, e aparece no cartão de abertura e na Machine. | `profile.short` vs `profile.name` |
| **Ícone** | As duas barras `//` laranja. Um SVG, e os PNGs são renderizados dele. | `static/favicon.svg` |
| **Cápsula** | O interruptor `HUMAN / MACHINE` no rodapé central, nas duas telas. | `#switches` · `.mode-toggle` |
| **Seletor de idioma** | A bandeira no canto direito da barra, que abre para mostrar a outra. Desenhadas em SVG — no Windows o emoji de bandeira vira as letras "BR". | `LangPicker.js` · `#lang-picker` |
| **Contato** | O link do canto direito. Hoje aponta para o LinkedIn. | `.bar-contact` |

---

## 6. Machine view

A metade em texto puro. Mesmo conteúdo, gerada dos mesmos configs.

| Nome | O que é | Onde mora |
|---|---|---|
| **Machine view** | A página `/machine.html`: currículo em texto puro, coluna centralizada, accent laranja. | `scripts/build-machine.mjs` |
| **Datilografia** | A revelação linha a linha na chegada, ~2 s. Quem não roda script recebe tudo de uma vez. | O `<script>` no fim de `machine.html` |
| **`llms.txt`** | O mesmo conteúdo em Markdown, para agentes. | `static/llms.txt` |

---

## 7. Sistema

O que ninguém vê e todo mundo sente.

| Nome | O que é | Onde mora |
|---|---|---|
| **Escada de qualidade** | Quatro degraus (`full`, `high`, `medium`, `low`) que mudam resolução, MSAA, bloom e blur. | `Quality.js` |
| **Calibração** | A descida pela escada atrás do portão, antes de alguém olhar. Lembrada por aparelho. | `Quality.calibrate` |
| **Rede de segurança** | O guarda que só desce degrau, e só depois que a sala foi entregue. Ignora travadas (aba escondida, máquina dormindo). | `Quality.update` · `Quality.arm` |
| **Sono da aba** | A liberação dos render targets quando a aba vai para segundo plano, e a reconstrução na volta. | `Renderer` |
| **Service worker** | O cache que faz a segunda visita não baixar nada. | `scripts/build-sw.mjs` |

---

## Chaves e interruptores

Coisas que ajudam a testar e a reproduzir um problema.

**Query flags** — `Utils/flags.js`

| Flag | O que faz |
|---|---|
| `?shot` | Modo screenshot: pula o portão, a abertura e a visita; esconde o HUD; fixa a qualidade. |
| `?open=prints` | Abre um lugar direto. |
| `?dpr=1` `?msaa=0` `?bloom=0` `?blur=0` `?fovcap=` | Fixam um parâmetro à mão e desligam a calibração. |
| `?nosw` | Descadastra o service worker. |
| `#debug` | Abre o painel de ajustes (lil-gui): cena, câmera, renderer, luzes e o colchete. Cobre o botão ENTRAR — clique nele antes de abrir o painel, ou entre e depois ponha o `#debug`. |

**Memória do navegador** — `localStorage`, prefixo `basement.`

| Chave | O que lembra |
|---|---|
| `basement.opened` | Já viu a abertura. |
| `basement.toured` | Já fez a visita guiada. |
| `basement.mode` | Performance ou qualidade. |
| `basement.quality` | Em que degrau o aparelho assentou. |
| `basement.lang` | Idioma. |
| `basement.eggs` | Ovos encontrados. |
| `basement.entered` | Já passou pelo portão *nesta aba* (`sessionStorage`). |

Para forçar uma primeira visita: apagar `basement.opened` e `basement.toured`.

---

## Como usar isto

Ao apontar um problema, o formato que resolve mais rápido é **nome + onde +
quando**:

> "O **colchete** aparece durante a **visita guiada**, no desktop."

> "As **setas de vista** ficam por baixo do **cartão de abertura**, no celular."

> "O **contador de pessoas** não aparece — e no `curl` o `/api/online` dá 302."

Não precisa dizer onde está o código: isso é o que este documento faz.

---

## Pontas soltas

Coisas verdadeiras hoje que valem estar escritas em algum lugar que não seja a
memória de ninguém. Nenhuma é urgente; todas mordem quando esquecidas.

**A suíte de verificação não está no repositório.** São 16 roteiros que abrem o
site num navegador de verdade e conferem cada funcionalidade desta lista — a
abertura, a visita, o colchete, o contador, a Machine. Vivem no diretório
temporário da sessão e somem quando a máquina limpa o temp. Enquanto for assim,
cada sessão nova precisa reconstruí-los antes de poder *afirmar* que algo
continua funcionando, em vez de supor.

**O joystick do modo livre está inalcançável.** `FreeFlyControls` tem um
joystick e um "olhar por toque" escritos para celular, mas a única porta de
entrada do modo livre é a tecla `F`, e ela é barrada no celular. Ficou assim
quando o botão EXPLORAR saiu. Ou volta uma porta, ou o código sai.

**A TV não tem vídeo nenhum.** `static/video/` só tem um README, então as seis
demonstrações aparecem marcadas como pendentes. É por isso que a TV está fora
da visita guiada: uma caminhada que termina numa coisa que não existe é pior
que uma parada a menos. Ela volta à lista no dia em que houver arquivo.

**"Celular" tem duas definições que discordam.** O JavaScript diz
`'ontouchstart' in window && innerWidth < 1024`; o CSS diz `max-width: 720px`,
em sete lugares. Um tablet em paisagem cai fora das duas. `matchMedia('(pointer:
coarse)')` resolveria, mas é uma troca que mexe em tudo de uma vez.

**2,3 MB de decodificadores servidos.** `static/draco` e `static/basis` estão
ligados nos loaders. O three.js só os baixa se algum modelo precisar — vale
confirmar num carregamento real se algum precisa, e apagá-los se não.
