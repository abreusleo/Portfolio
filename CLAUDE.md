# Regras deste projeto

## O que não vai para o site

O que combinamos nos prompts sobre como uma funcionalidade se comporta não pode
ser externado no site. O texto que o visitante lê diz para que a coisa serve;
nunca as regras internas que a sustentam — o que é recusado, o que é limitado,
o que exige verificação, o que acontece em que ordem por dentro.

Não é vergonha do funcionamento. É que uma regra publicada vira mapa para quem
quer contorná-la, e quem não quer não precisa dela: entende o comportamento no
momento do uso.

Exemplo do que não escrever, tirado do painel do mural:

> Each shows the country it came from. Anything abusive never lands; everything
> else lands straight away.

Quem cola um recado vê a bandeira aparecer e vê o recado entrar. Ninguém precisa
ler, antes de usar, que existe moderação nem que ela é imediata.

A regra vale para toda superfície que o visitante alcança: o painel lateral, as
legendas impressas na cena, o machine view e o `llms.txt`. Ela é a irmã da COPY
RULE que já está no topo de `src/Experience/config/projects.js` — aquela diz
para falar do propósito e não da construção; esta diz que a parte da construção
que protege alguma coisa não é nem opcional, é proibida.

## Como as funcionalidades se chamam

`docs/funcionalidades.md` dá nome a cada peça do site — o portão, a abertura, o
colchete, as setas de vista, a escada de qualidade — e diz onde cada uma mora no
código. É o vocabulário que usamos para apontar um problema sem descrevê-lo.

Leia antes de mexer em qualquer coisa da interface, e atualize quando algo
nascer, mudar de nome ou sair. Um nome que não corresponde mais ao que está na
tela é pior que nenhum nome: manda a conversa para o lugar errado com confiança.
