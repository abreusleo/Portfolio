# recados

Serviço do mural de recados do portfólio. Qualquer pessoa cola um bilhete curto
na parede do quarto. Sem conta, sem login.

O desenho completo, com o porquê de cada escolha, está em `docs/recados.md`.
Aqui é só como rodar.

```
go build ./...
go test ./...
```

## Variáveis

| variável | obrigatória | o que é |
|---|---|---|
| `RECADOS_IP_SALT` | **sim** | segredo do HMAC do endereço. Sem ele o serviço nem sobe |
| `RECADOS_ORIGINS` | **sim** | origens que podem chamar, separadas por vírgula. Nunca `*` |
| `TRUSTED_PROXIES` | quase | CIDRs cujo `X-Forwarded-For` vale. Sem isso todo mundo cai no mesmo balde |
| `RECADOS_GEOIP_DB` | não | caminho do GeoLite2-Country.mmdb. Sem ele e sem Cloudflare, o país fica vazio |
| `RECADOS_ADMINS` | não | usuários do Hub que podem apagar |
| `RECADOS_DB` | não | padrão `recados.db` |
| `RECADOS_ADDR` | não | padrão `:8080` |
| `RECADOS_WALL_SIZE` | não | quantos cabem na porta, padrão 36 |
| `RECADOS_NOTE_RETENTION_DAYS` | não | quanto tempo um recado fica no banco, padrão 30 |
| `RECADOS_WRITE_EVERY_SECONDS` | não | intervalo entre dois recados do mesmo endereço, padrão 600 |
| `RECADOS_WRITE_PER_DAY` | não | quantos por dia do mesmo endereço, padrão 3 |

Os dois últimos existem para dar para testar na própria máquina: com os números
de produção, um recado a cada dez minutos deixa a funcionalidade impossível de
exercitar por quem a está construindo. Em qualquer lugar real, deixe no padrão.
| `RECADOS_EXTRA_BLOCK` | não | termos a mais para a lista de bloqueio, um por linha |
| `RECADOS_EXTRA_SUSPECT` | não | idem, para a lista de atenção |

`RECADOS_IP_SALT` é o único que não tem padrão de propósito. Um HMAC sem
segredo é um hash de um espaço pequeno e enumerável, e o serviço continuaria
parecendo funcionar.

## Rotas

```
GET    /api/notes?limit=36            a parede
POST   /api/notes {"text","x","y"}    cola um bilhete
GET    /healthz

GET    /admin/notes             tudo, com o marcador de revisão
DELETE /admin/notes/{id}        apaga
```

O `POST` responde `201` com o bilhete, `422` com o motivo em português quando a
moderação recusa, `409` quando alguém colou naquele ponto primeiro, `429` com
`Retry-After` quando o autor já colou um agora há pouco, ou `503` quando o
limitador está cheio, que é o serviço admitindo lotação e não uma culpa de quem
chamou.

## Onde o recado fica

`x` e `y` vêm em metros a partir do centro do retângulo da porta, e são um
pedido, não uma ordem: o serviço corta para dentro da porta, recusa se encostar
em outro, e ignora por completo quando a porta está cheia. Com a porta cheia o
novo ocupa o lugar do mais antigo, e o mais antigo cai da consulta sozinho.
Nada é apagado por causa disso.

As medidas da porta estão duas vezes, aqui em `internal/httpapi/server.go` e no
quarto em `src/Experience/config/notes.js`. É a mesma porta física: mexer em um
lado só põe recado atravessando o batente.

## Moderação

Tudo local: forma, lista de bloqueio, lista de atenção e um léxico de tom.
Nenhuma chamada de rede no caminho de escrita.

Havia um modelo aqui, uma chamada por recado dentro da requisição. Saiu de
propósito: além dos seis segundos de espera, quando o provedor estourava a cota
o recado era publicado assim mesmo. Um portão que abre sob carga não é portão, e
a carga que o abria era exatamente o tráfego que atacaria o mural.

O preço é real: nada aqui lê uma frase. Ofensa que escapa da lista, em outro
idioma ou educada demais, é publicada. A resposta para isso é a lista do admin.

## Caddy

Duas entradas para o mesmo serviço, e é essa separação que sustenta o admin.
A pública não passa por autenticação nenhuma e **não roteia `/admin`**. A do
Hub passa, e o serviço confere o `Remote-User` contra `RECADOS_ADMINS`.

```caddyfile
# Público: a parede. Sem gate, porque um recado é anônimo por natureza.
# /admin não existe deste lado.
recados.leo-abreu.com {
	import hardening

	@wall path /api/notes /healthz
	handle @wall {
		request_header -Remote-User
		request_header -Remote-Apps
		request_header -Cookie
		reverse_proxy recados:8080
	}

	handle {
		respond 404
	}
}

# Administração, atrás do mesmo portão de sempre.
recados-admin.leo-abreu.com {
	import hardening
	import protected recados - recados:8080
}
```

A tira de `Remote-User` no ramo público não é decoração. Sem ela, qualquer
pessoa manda o cabeçalho e o serviço acha que o Hub garantiu quem ela é.

## Compose

```yaml
recados:
  build: ./server/recados
  restart: unless-stopped
  networks: [web]
  volumes:
    - recados-data:/data
  environment:
    - RECADOS_DB=/data/recados.db
    - RECADOS_IP_SALT=${RECADOS_IP_SALT}
    - RECADOS_ORIGINS=https://leo-abreu.com
    - TRUSTED_PROXIES=172.16.0.0/12,10.0.0.0/8,192.168.0.0/16
    - GEMINI_API_KEY=${GEMINI_API_KEY}
    - RECADOS_ADMINS=leonardo
```

Sem `ports:`, como todo o resto: quem alcança este serviço é o Caddy e mais
ninguém. É disso que a checagem de `Remote-User` depende.

`TRUSTED_PROXIES` é o mesmo valor que o hub-auth já usa, e pelo mesmo motivo.

## País

Duas fontes, nesta ordem:

1. `CF-IPCountry`, se a Cloudflare estiver na frente. De graça e já correto.
2. GeoLite2 local, via `RECADOS_GEOIP_DB`. Conta gratuita na MaxMind, arquivo
   baixado uma vez, nenhuma chamada externa por requisição.

Sem nenhuma das duas o país volta vazio e o post-it fica sem bandeira. Isso
nunca recusa um recado.

## O que fica no banco

`id`, texto, país, tom, marcador de revisão, data e `ip_hash`. O endereço em si
não entra em coluna nenhuma, e o `ip_hash` é apagado depois de 24 horas — que é
a janela mais longa que ele ainda podia responder. Passado isso, a coluna não
serve para nada, então deixa de existir.
