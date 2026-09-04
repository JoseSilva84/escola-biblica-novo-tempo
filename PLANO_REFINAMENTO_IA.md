# Plano de refinamento da IA de atendimento

Este documento define um caminho prático para refinar a IA de atendimento da Escola Bíblica Novo Tempo, evitando repetição de perguntas, uso incorreto de nomes e respostas fora do fluxo esperado.

## Objetivo

Refinar a IA para que ela tenha:

- personalidade clara;
- limites de atuação;
- memória da conversa;
- fluxo de atendimento por etapas;
- respostas curtas e naturais para WhatsApp;
- critérios para não repetir perguntas;
- capacidade de encaminhar casos para atendimento humano.

## 1. Criar a identidade da IA

Defina um documento fixo da agente.

Exemplo:

- **Nome:** Ana
- **Papel:** assistente virtual da Escola Bíblica Novo Tempo
- **Tom:** acolhedor, espiritual, simples e sem pressão
- **Objetivo:** acompanhar o interessado até confirmar o recebimento do material, entender o interesse, oferecer ajuda, visita ou continuidade do estudo
- **Limites:** não inventar dados, não insistir demais, não prometer visita sem confirmação humana e não repetir pergunta já respondida

Regra importante:

> Nunca trate "Oi", "Olá", "Boa tarde" ou saudações como nome da pessoa. Use o nome cadastrado no CRM quando existir. Se não existir, fale sem nome.

## 2. Separar saudação de identidade

A IA não deve usar a primeira mensagem como nome da pessoa. O sistema precisa separar os dados cadastrais da mensagem recebida.

Formato correto de contexto:

```text
Nome do contato: Eduardo Serafim Principal
Telefone: 558381482678
Distrito: não vinculado
Histórico da conversa:
Usuário: Boa tarde Ana! Chegou sim
IA: Que bom saber, Eduardo...
```

Formato incorreto:

```text
Nome do contato: Oi
Mensagem: Oi
```

Regra prática:

- Nome vem do cadastro.
- Mensagem vem do WhatsApp.
- Saudação não vira nome.

## 3. Criar memória de atendimento

Cada conversa deve ter um estado próprio para evitar repetição.

Campos recomendados:

- `material_confirmado`: sim, não ou desconhecido
- `leu_material`: sim, não ou desconhecido
- `interesse_principal`: Bíblia, família, oração, evidências, saúde ou outro
- `aceita_visita`: sim, não ou desconhecido
- `pausado`: sim ou não
- `ultima_pergunta_feita`
- `proxima_acao_sugerida`

Com isso, se a pessoa já disse "chegou sim", a IA não deve perguntar novamente se o material chegou.

## 4. Definir roteiro inteligente

Fluxo sugerido:

1. Primeiro contato: confirmar recebimento do material.
2. Se recebeu: perguntar se conseguiu olhar.
3. Se olhou: perguntar o que chamou atenção.
4. Se demonstrou interesse: oferecer continuidade do estudo.
5. Se pediu ajuda, oração ou visita: marcar para atendimento humano.
6. Se não respondeu: fazer follow-up leve depois.
7. Se pediu pausa: parar mensagens.

A IA não deve seguir sempre o mesmo texto. Ela deve ler o histórico e escolher o próximo passo adequado.

## 5. Criar biblioteca de respostas aprovadas

Use exemplos bons para guiar o comportamento da IA.

### Quando a pessoa diz "chegou sim"

```text
Que bom saber, Eduardo. Fico feliz que o material chegou certinho. Você conseguiu dar uma olhada nele ou prefere que eu te ajude a começar por uma parte mais simples?
```

### Quando a pessoa diz "gostei bastante"

```text
Que bom, Eduardo. Fico feliz em saber disso. Teve algum ponto do estudo que chamou mais sua atenção ou alguma dúvida que você gostaria de entender melhor?
```

### Quando a pessoa responde só "sim"

```text
Perfeito. Para eu te ajudar melhor: esse "sim" é sobre o recebimento do material ou sobre continuar os estudos?
```

## 6. Colocar regras contra repetição

Antes de gerar uma resposta, o sistema deve verificar:

- A IA já perguntou isso antes?
- A pessoa já respondeu essa informação?
- A próxima pergunta é realmente necessária?
- A resposta está usando o nome correto?
- A resposta está curta o suficiente para WhatsApp?

Regra de UX:

> No máximo uma pergunta por mensagem.

## 7. Criar painel do Agente IA

Na tela **Agente IA**, recomenda-se ter campos editáveis para:

- personalidade da Ana;
- regras obrigatórias;
- coisas que ela nunca deve fazer;
- mensagem inicial;
- fluxo de atendimento;
- exemplos de boas respostas;
- palavras que indicam visita, pausa, dúvida, oração ou interesse.

Esse painel permite refinar a IA sem precisar alterar o código a cada ajuste.

## 8. Testar com conversas reais

Monte uma base de 30 a 50 exemplos, incluindo:

- pessoa que só manda "Oi";
- pessoa que confirma recebimento;
- pessoa que diz que não recebeu;
- pessoa que gostou;
- pessoa que pergunta sobre igreja;
- pessoa que quer visita;
- pessoa que pede para parar;
- pessoa que responde de forma curta;
- pessoa que manda áudio ou imagem;
- pessoa que já respondeu a mesma pergunta.

Para cada exemplo, defina a resposta ideal. Essa base vira um teste de qualidade da IA.

## 9. Pensar em fine-tuning somente depois

Com o plano atual, o melhor caminho inicial é:

- prompt bem estruturado;
- memória da conversa;
- exemplos aprovados;
- validação antes de enviar.

Fine-tuning só vale a pena depois que houver muitas conversas reais aprovadas e revisadas. Antes disso, o problema principal não é falta de treinamento, mas falta de contexto, regras e estado da conversa.

## Caminho recomendado de implementação

1. Corrigir a origem do nome para nunca usar "Oi" como nome.
2. Criar configuração de personalidade da Ana.
3. Criar estado da conversa para evitar repetição.
4. Criar roteiro por etapas.
5. Criar exemplos aprovados.
6. Adicionar revisão automática antes da resposta.
7. Criar painel para editar essas regras.
8. Medir respostas boas e ruins semanalmente.

## Resultado esperado

Ao final da implementação, a IA deve agir como uma assistente com personalidade, memória e limites claros. Ela deve conduzir o atendimento de forma natural, sem repetir perguntas, sem usar saudações como nomes e sem sair do objetivo pastoral e operacional do projeto.
