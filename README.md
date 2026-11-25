# Os Nove Fragmentos do Luto — publicação no Render

Este projeto agora valida respostas no servidor. O navegador recebe somente os textos dos enigmas e o estado já conquistado; respostas e código de recompensa ficam em variáveis secretas do Render.

## Executar localmente

1. Copie `.env.example` para `.env`.
2. Substitua os 11 textos de exemplo em `ANSWERS_JSON`, na ordem: nove manuscritos, encantamento e resposta final.
3. Defina um `REWARD_CODE` e um `SESSION_SECRET` longo e aleatório.
4. Execute `npm run dev` e abra `http://localhost:3000`.
5. Abra `http://localhost:3000`.

O servidor não inicia sem esses segredos, de propósito. Não envie `.env` ao GitHub.

## Publicar no Render, passo a passo

1. Crie um repositório **privado** no GitHub e envie estes arquivos, mas nunca o `.env`.
2. No [Render](https://render.com), escolha **New +** → **Web Service** e conecte o repositório.
3. Informe `Node` como ambiente, `npm install` como *Build Command* e `npm start` como *Start Command*. O `render.yaml` já registra esses valores caso use Blueprint.
4. Em **Environment**, crie as variáveis `ANSWERS_JSON`, `REWARD_CODE` e `SESSION_SECRET`. Cole os valores reais apenas aí. Para `SESSION_SECRET`, use uma sequência aleatória longa (ao menos 32 bytes).
5. Clique em **Create Web Service** / **Deploy** e aguarde o endereço `https://...onrender.com`.
6. Teste uma resposta correta e uma incorreta no site publicado. Abra o código-fonte: as respostas e o código de recompensa não devem aparecer.

## Proteções aplicadas

- Respostas e código de recompensa não são enviados ao navegador.
- Cookie de sessão é `HttpOnly`, assinado, `Secure` e `SameSite=Lax`; o progresso não pode ser liberado alterando o `localStorage`.
- O endpoint aceita apenas etapas já desbloqueadas e tem limite por sessão e IP.
- Cabeçalhos reduzem clickjacking e interpretações indevidas de conteúdo.

### Limitação importante

O progresso fica em memória para manter o projeto simples. Em reinícios ou no plano gratuito, o Render pode apagá-lo. Isso não expõe respostas, mas pode fazer jogadores perderem o progresso. Para persistência, a próxima etapa é conectar um Redis ou banco de dados ao `server.js`.
