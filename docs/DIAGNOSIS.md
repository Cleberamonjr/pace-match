# Diagnóstico — Cleberamonjr/pace-match

Data: 2026-10-06. Branch `main`, commit `b77319c`.

## O que existe

O repositório é um protótipo de uma página. Não há frontend componentizado, banco, autenticação nem API.

Arquivos: `index.html`, `README.md`, `imagine_images/`. Três commits, todos desta sessão.

O `index.html` já faz, no navegador e só na sessão:

- cadastro em 4 passos: identidade, 3 fotos, texto, GPS e raio 0–50 km
- deck com swipe, like, super like, desfazer
- match apenas se o outro perfil já tiver curtido
- chat de texto depois do match
- filtro de gênero e distância

## O que não existe

- usuário real, sessão ou verificação
- fotos em storage
- likes, matches e mensagens persistidos
- hard filter separado de soft signal
- score configurável
- bloqueio, denúncia, RLS
- analytics
- PWA instalável de verdade

Os outros perfis estão escritos no JavaScript. A distância é fixa, não calculada. O GPS só guarda coordenadas na memória e a tela antiga chegou a exibir latitude e longitude. Isso viola a regra de privacidade.

## O que preservar

O protótipo continua em `index.html` e em `prototype/index.html`. Ele é a referência de fluxo, não a base de dados. A evolução fica em `app/`, `docs/` e `supabase/`.

## Problemas a não repetir

- marca oscilou entre Pace Match e RunDate; a marca desta fase é PACE
- esporte aparecia como tema visual dominante; no produto ele é sinal, não requisito
- match mútuo estava certo; exclusão por pace estaria errada
- um único arquivo não escala para auth, chat e moderação
