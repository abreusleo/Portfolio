# Mural de recados

Deixar o visitante colar um post-it na parede, com o país de onde veio a
mensagem. É a única parte do quarto em que a pessoa deixa alguma coisa, então
vale gastar tempo antes de escrever código.

Feito: o serviço em `server/recados/`, o mural dentro da cena, e a entrada no
compose e no Caddy do `../Hub`, em `msg.leo-abreu.com`. Falta o salt no VPS, o
registro de DNS e apontar o build do Pages para lá.

---

## 1. Onde na cena

**Mudou na construção: é a porta, não a parede de reboco.** As faixas de
reboco que sobram dos lados da porta têm 38 e 50 cm — estreitas demais para um
mural de qualquer coisa. A parede esquerda é grande o bastante, mas fica atrás
da câmera de entrada, e mural que ninguém vê não é mural. A porta estava no
enquadramento de abertura, era a última superfície grande sem nada, e recado
colado em porta é onde recado vai.

O mural tem estação de câmera própria: o clique enquadra a porta e abre o
painel, que traz o botão de escrever. Um post-it em branco embaixo da pilha faz
o mesmo, direto da sala.

Cada recado é um plano com textura de canvas, escrito à mão em Caveat, com a
cor do papel sorteada a partir do id — então um recado mantém a cor entre
visitas. Ficam os 60 mais recentes, com posição e rotação levemente
irregulares. O resto continua existindo, só não cabe na porta.

## 2. Por que isso precisa de servidor

Recado que outras pessoas veem não cabe em `localStorage`. Precisa de um lugar
que guarde e devolva o mesmo conteúdo para todo mundo.

**Decidido:** serviço Go no VPS que já roda o Hub e os outros cinco, atrás do
mesmo Caddy, com SQLite como o Orb. **Sem login** — exigir conta para deixar um
oi mata a coisa. O que segura o abuso é limite de taxa, não cadastro.

```
navegador  →  Caddy  →  serviço de recados (SQLite)
                             ↓
                        moderação + sentimento
```

## 3. Contrato

```
GET  /api/notes?limit=60          →  { notes: [...] }
POST /api/notes  { text }         →  { note } | 429 | 422
```

```json
{
  "id": "01J...",
  "text": "passei pra dizer que ficou muito bom",
  "country": "BR",
  "sentiment": "positive",
  "created_at": "2026-09-02T18:40:00Z"
}
```

O cliente **nunca** manda país, IP nem sentimento. Os três são decididos no
servidor. Campo mandado pelo cliente é campo que o cliente mente.

## 4. Como a análise é feita

**Decidido: publica na hora.** Fila de aprovação é mais segura e é pior — a
pessoa escreve, não vê nada acontecer e vai embora achando que quebrou. O preço
disso é que toda a análise roda **dentro do POST**, antes da linha existir, e é
por isso que ela é feita em camadas: cada etapa só recebe o que a anterior
deixou passar, e as caras só rodam para o que sobrou.

```
texto → forma → lista de termos → modelo → parede
         µs         µs              ~1s
```

### Etapa 0 — normalizar

Isto é o que faz uma lista de palavras valer alguma coisa. Comparar o texto cru
não pega ninguém: a primeira pessoa que quiser passar escreve `p0rr@`,
`c a r a l h o` ou `caraaaalho`, e uma lista de palavras inteiras vê três
strings que nunca ouviu falar.

O normalizador tira acento, dobra leetspeak, remove caractere invisível
(largura zero é o truque clássico) e colapsa letra repetida. Ele produz **duas
formas**, porque as duas tarefas puxam para lados opostos:

| forma | o que faz | quem usa |
|---|---|---|
| `Words` | mantém os espaços | casamento com fronteira de palavra, pouco falso positivo — é a única que pode bloquear sozinha |
| `Squashed` | tira tudo que não é letra ou dígito | pega `c.a.r.a.l.h.o`, mas colide fácil, então só vale para termo longo |

A lista passa pelo mesmo normalizador na hora de carregar. Sem isso os dois
lados nunca se encontram: o recado chega colapsado e a lista continua com a
palavra inteira.

Um detalhe que só apareceu porque tem teste: `!` vira `i` em `b!tch`, mas
`trabalho!` não pode virar `trabalhoi`. Substituição que é pontuação antes de
ser letra (`!`, `*`, `+`) só conta quando tem letra dos dois lados.

### Etapa 1 — forma

Até 140 caracteres, sem link, pelo menos três letras, letra sendo pelo menos um
quarto do texto, e nada de tecla presa. Pega spam, arte em ASCII e teste de
layout sem depender de nada.

### Etapa 2 — duas listas, não uma

Aqui está a decisão que mais muda o resultado: **vulgar e ofensivo não são a
mesma coisa**, e tratar os dois igual é como um mural acaba recusando "que
porra boa ficou isso".

| lista | o que tem | o que acontece |
|---|---|---|
| `block.txt` | xingamento identitário, ameaça, assédio | recusa direta. O modelo nem é consultado |
| `suspect.txt` | palavrão e ofensa que depende de para quem foi dita | não recusa nada. Manda o modelo ler com rigor |

As duas são arquivo de texto embutido no binário, não código. Estender é editar
um `.txt`; o rabo longo está em listas mantidas, tipo a do LDNOOBW.

O termo que casou **nunca** volta na resposta. Dizer qual palavra pegou
transforma a recusa em sonda: manda uma palavra, lê a resposta, aprende a lista
uma requisição por vez.

### Etapa 3 — o modelo

Uma chamada ao Gemini, o mesmo provedor que o Orb já usa, no `flash-lite`.
Devolve as duas respostas de uma vez:

```json
{ "allow": true, "sentiment": "positive", "reason": "" }
```

Três coisas fazem isso ser seguro o bastante para receber texto de estranho:

1. **O recado vai como conteúdo do usuário, entre marcas**, nunca concatenado na
   instrução. A instrução diz, com todas as letras, que o que está entre as
   marcas é dado a classificar e que tentar dar ordem já é motivo de reprovar.
2. **A resposta é presa a um schema.** O `responseSchema` do Gemini faz o
   provedor não conseguir responder prosa, então "ignore as instruções
   anteriores" no máximo vira um booleano trocado, nunca um texto que o parser
   tem que adivinhar.
3. **E o booleano que mais importa ele não alcança**, porque a lista roda antes
   e o modelo não é perguntado sobre nada que ela já recusou.

O que sobra: um recado que a lista nunca viu, escrito para convencer o modelo,
dentro de 140 caracteres que ainda precisam carregar a ofensa. É um buraco real
e estreito, e a resposta para ele é o botão de apagar.

O filtro de segurança do próprio Gemini fica desligado. Ele julga o texto como
algo que está sendo pedido para ele produzir, e se recusa a olhar exatamente a
ofensa que a chamada existe para reconhecer — uma resposta bloqueada deixaria o
pipeline sem veredito justo no recado que mais precisava de um.

### Quando o provedor cai

Não é uma resposta, são duas, e trocar as duas de lugar é o risco inteiro de
publicar na hora:

- **Recado que a lista de atenção marcou: recusa.** A única etapa que sabia
  pesar aquilo está faltando, e é exatamente o texto que precisava de peso.
- **Qualquer outro: publica, marcado para revisão**, com o tom vindo do léxico.
  Um mural que para de aceitar recado toda vez que uma API cai é pior que um
  mural com fila de revisão.

### O tom

Vem da mesma chamada. Fica guardado, **não vira cor na parede** — essa foi a
minha recomendação e é a que está implementada. Rotular em cor vira convite:
sempre vai ter quem queira ver o post-it vermelho aparecer. Crítica honesta é
`negative` e continua na parede.

### E depois

Publicação imediata só se sustenta com o outro lado: `/admin/notes` lista tudo,
com o marcado para revisão junto, e `DELETE` apaga. Fica atrás do Hub, no mesmo
portão de sempre.

## 5. País

Sai do IP da requisição, no servidor, na hora de gravar.

- Se um dia o Caddy ficar atrás da Cloudflare, o cabeçalho `CF-IPCountry` chega
  pronto e de graça.
- Senão, GeoLite2 Country da MaxMind: base gratuita, arquivo local, atualização
  mensal, resolução em memória sem chamada externa.

**Guarde só o código de duas letras.** O IP inteiro não vai para o banco. Para
o limite de envio, guarde `hash(ip + segredo)` com validade curta, o suficiente
para contar sem identificar. É menos dado sensível parado no disco e responde
sozinho a qualquer pergunta sobre privacidade.

Na parede, o país aparece como código e bandeira no rodapé do post-it. Bandeira
em emoji resolve sem baixar nenhum ícone.

## 6. Limite de taxa

Sem login, é isto que segura o mural de pé. **Decidido:** entra junto com o
serviço, não depois.

Três limites em camadas, do mais barato para o mais caro:

| onde | limite | por quê |
|---|---|---|
| Caddy | 60 req/min por IP, em todo o `/api/` | corta flood antes de acordar o Go |
| Serviço, leitura | 30 `GET`/min por IP | a página lê a cada 30 s, isso é folga de sobra |
| Serviço, escrita | 1 `POST`/10 min, 3/dia por IP | recado é para ser pensado, não metralhado |

Detalhes que importam:

- A chave do limite é `hash(ip + segredo)`, o mesmo hash do país. IP inteiro não
  entra no banco em lugar nenhum.
- **Verificado no ../Hub:** o Caddy é a borda, termina o TLS ele mesmo e é o
  único container que publica porta. Então o `X-Forwarded-For` que chega no Go
  foi escrito pelo seu próprio Caddy e vale — desde que o serviço só acredite
  nele vindo da rede do Docker. O hub-auth já resolve exatamente isso, com
  `TRUSTED_PROXIES=172.16.0.0/12,10.0.0.0/8,192.168.0.0/16` e um extractor que
  ignora o cabeçalho quando a variável está vazia. O recados copia o mesmo
  valor e o mesmo comportamento.
- O detalhe que faz funcionar: o Caddy **acrescenta** ao `X-Forwarded-For` em
  vez de substituir. Quem manda o próprio cabeçalho produz `<forjado>, <real>`,
  e por isso a leitura é da direita para a esquerda, parando no primeiro
  endereço que não é proxy conhecido. Tem teste para esse caso.
- Devolva `429` com `Retry-After`. O front mostra quanto falta em vez de um erro
  genérico.
- Balde de fichas (token bucket) em memória basta. Se um dia rodar em mais de um
  processo, aí sim vale mover o contador para o SQLite.
- 140 caracteres e sem link, que também é limite: mensagem curta é barata de
  moderar e não serve para spam.

Isso resolve enxurrada e script bobo, que é o realista para um mural de
portfólio. **Não resolve DDoS volumétrico**, o que enche o link antes de chegar
no seu servidor — para isso a resposta é a Cloudflare na frente, de graça, e o
`CF-IPCountry` ainda vem junto de brinde. Se um dia virar alvo de gente
insistindo, Turnstile na frente do `POST`.

## 7. Como fica no quarto

1. Clique no mural: a câmera enquadra a parede.
2. Clique no post-it em branco: abre um campo de texto sobre a cena, com o
   contador de caracteres.
3. "Colar na parede": o post-it aparece na hora, com uma animaçãozinha de
   queda, enquanto o `POST` acontece.
4. Se o servidor recusar, o post-it cai e a mensagem explica o porquê.

Buscar na abertura e a cada 30 segundos enquanto a parede estiver enquadrada.
SSE só se um dia fizer diferença, e não vai fazer.

## 8. Estado

Feito, em `server/recados/`:

- serviço Go, SQLite, `GET`/`POST`, `/admin` com apagar
- normalizador, duas listas, léxico de reserva
- modelo via Gemini, com schema de resposta
- limite de taxa em duas janelas, na memória e conferido no banco
- país por `CF-IPCountry` ou GeoLite2
- testes: evasão do normalizador, fronteira de palavra, cada caminho do
  pipeline, as duas respostas para provedor fora do ar, falsificação de
  `X-Forwarded-For`, CORS e as rotas de admin

Feito, na cena:

- mural na porta, lendo do serviço, com o país no rodapé de cada recado
- caixa de escrever no estilo post-it, com contador e o motivo da recusa vindo
  do servidor, escrito para quem escreveu
- `VITE_RECADOS_API` decide se o mural existe: sem ela nada aparece e a sala
  fica exatamente como estava, a mesma regra dos modelos
- verificado de ponta a ponta contra o serviço rodando: 10 recados na parede,
  ofensa recusada com 422, link recusado, tecla presa recusada, segundo envio
  do mesmo IP com 429, país lido do cabeçalho, e o preflight de CORS liberando
  só a origem da lista

Falta:

1. `RECADOS_IP_SALT` no `.env` do VPS. É o único segredo, e o serviço se recusa
   a subir sem ele
2. um A record para `msg.leo-abreu.com`, para o Caddy conseguir o certificado
3. `VITE_RECADOS_API=https://msg.leo-abreu.com` como repository variable, e um
   bloco `env:` no workflow do Pages — hoje ele não tem nenhum, que é a razão de
   o mural não aparecer no site no ar
4. GeoLite2, se a bandeira importar. O caminho do `CF-IPCountry` não vai
   acontecer: o CDN está na frente do front, no Pages, e não na frente desta
   API. Sem a base local o país volta vazio, o que nunca recusa um recado

Feito, na infraestrutura:

- Dockerfile: build estático em `scratch`, sem cgo, rodando como uid 65532
- serviço, volume e rede no compose do `../Hub`, sem `ports:` como todo o resto
- host `msg.leo-abreu.com` no Caddyfile: a parede pública num ramo, `/admin`
  atrás do portão no outro, seguindo o `fut` em vez de dois hostnames
