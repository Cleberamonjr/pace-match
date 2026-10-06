# Arquitetura PACE

PACE é um app de relacionamento. Esporte é sinal de compatibilidade, não filtro eliminatório e não é o objetivo do produto.

## Decisão

Não trocar o protótipo por um backend falso. A primeira etapa separa três coisas:

1. `index.html` — protótipo visual preservado
2. `app/` — cliente React/Vite, mobile-first, PWA
3. `supabase/migrations` — modelo real, com RLS, pronto para aplicar

O cliente fala com um repositório. Se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existirem, o adaptador Supabase é o caminho de produção. Sem as chaves, o app sobe em modo local e avisa isso. O modo local não é o produto.

## Hard filter e soft signal

Hard filter, aplicado antes do deck:

- gênero buscado
- faixa etária
- distância máxima
- bloqueio

Soft signal, só no PACE Score:

- interesses e hobbies
- intenção
- estilo de vida
- esporte, frequência e pace

Alguém que não corre não sai do deck por isso. O peso do esporte sobe se a pessoa marcar que isso importa, e desce se não marcar. Os pesos padrão não são definitivos: ficam num objeto, não espalhados na interface.

Pesos iniciais: preferências 30%, distância 20%, interesses 20%, intenção 15%, estilo de vida 10%, esporte 5%.

## Privacidade

O cliente nunca renderiza latitude, longitude ou endereço. A tela mostra quilômetros aproximados e, se houver, um bairro. Coordenadas ficam no servidor, atrás de RLS.

## Entidades

`profiles`, `preferences`, `photos`, `sport_profiles`, `likes`, `matches`, `messages`, `blocks`, `reports`, `analytics_events`.

Auth e storage ficam no Supabase. Mensagens usam Realtime na fase de chat real. Nesta etapa o contrato já existe; a conexão ao projeto Supabase é o próximo passo, porque as chaves não estão no repositório.

## Ordem

Fase 1, esta: diagnóstico, domínio, schema, app executável, protótipo intacto.  
Fase 2: ligar Auth assim que o projeto Supabase existir.  
Fases seguintes: fotos reais, deck real, likes, match, chat, bloqueio, analytics, score em produção, IA, encontros.
