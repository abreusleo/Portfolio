# Dados reais da Steam no desktop

A Steam **não tem webhook**. O que existe é uma Web API de consulta, e a chave
nunca pode ficar no navegador: qualquer pessoa leria o código-fonte da página.

A solução é um endpoint pequeno no seu próprio VPS, que já roda Go. Ele guarda a
chave, chama a Steam, guarda o resultado em cache e responde um JSON enxuto para
o portfólio. O portfólio consulta esse endpoint, não a Steam.

```
navegador  →  seu VPS (guarda a chave, cacheia)  →  Steam Web API
```

## O que a Steam entrega

| endpoint | conteúdo |
| --- | --- |
| `ISteamUser/GetPlayerSummaries` | apelido, avatar, status, jogo atual |
| `IPlayerService/GetRecentlyPlayedGames` | jogos das últimas duas semanas e horas |
| `IPlayerService/GetOwnedGames` | biblioteca inteira com horas totais |
| `ISteamUserStats/GetPlayerAchievements` | conquistas por jogo |

Requisitos: uma chave em <https://steamcommunity.com/dev/apikey>, o seu SteamID64
e o **perfil configurado como público**. Sem perfil público a API devolve vazio.

## O contrato

O portfólio espera exatamente isto:

```json
{
  "persona": "Leonardo",
  "avatar": "https://avatars.steamstatic.com/....jpg",
  "state": "online",
  "playing": "ARC Raiders",
  "profileUrl": "https://steamcommunity.com/id/...",
  "recent": [
    { "appid": 1808500, "name": "ARC Raiders", "minutes2Weeks": 340, "minutesTotal": 5210 }
  ]
}
```

## Handler em Go

Um esboço para colocar atrás do Hub, com cache de dez minutos e CORS liberado
apenas para o domínio do portfólio.

```go
type steamCache struct {
    mu   sync.Mutex
    body []byte
    at   time.Time
}

func (h *Handler) Steam(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Access-Control-Allow-Origin", "https://leo-abreu.com")
    w.Header().Set("Content-Type", "application/json")

    h.cache.mu.Lock()
    defer h.cache.mu.Unlock()

    if time.Since(h.cache.at) < 10*time.Minute {
        w.Write(h.cache.body)
        return
    }

    summary, err := h.steam.PlayerSummary(r.Context(), h.steamID)
    if err != nil {
        http.Error(w, `{"error":"steam indisponivel"}`, http.StatusBadGateway)
        return
    }
    recent, _ := h.steam.RecentlyPlayed(r.Context(), h.steamID)

    body, _ := json.Marshal(publicProfile(summary, recent))
    h.cache.body, h.cache.at = body, time.Now()
    w.Write(body)
}
```

Pontos que importam: a resposta é montada por você, então nada de campo extra
vaza; o cache evita bater na Steam a cada visita; e o CORS restringe quem pode
ler. Se a Steam cair, o portfólio simplesmente mostra a biblioteca estática.

## Ligando no portfólio

Em `src/Experience/config/steam.js`:

```js
export default {
    endpoint: 'https://hub.leo-abreu.com/api/steam',
    profileUrl: 'https://steamcommunity.com/id/seu-perfil',
    refreshMinutes: 10,
}
```

Com `endpoint: null` a janela mostra a biblioteca fixa. Com o endpoint no ar,
ela troca para o seu perfil e os jogos das últimas duas semanas.

## E os outros jogos

**Valorant** não tem API pública de estatísticas pessoais. A Riot exige aprovação
de produto e não expõe partidas de VALORANT para terceiros como expõe as de
League of Legends. Existem APIs comunitárias que devolvem elo e histórico a
partir do Riot ID, mas são não oficiais: podem sair do ar e não têm garantia.

**ARC Raiders** e **GTA VI** não têm API pública. O que dá para mostrar de real
vem pela Steam, já que o ARC Raiders é vendido lá.
