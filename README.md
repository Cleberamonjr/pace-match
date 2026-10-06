# PACE

Aplicativo de relacionamento. A mecânica de descoberta usa card, swipe e match mútuo. Esporte é sinal de compatibilidade, não requisito.

A marca desta fase é PACE.

## O que está no repositório

- `index.html` — protótipo preservado, ainda abre no navegador
- `prototype/index.html` — mesma cópia
- `docs/DIAGNOSIS.md` — estado do repositório
- `docs/ARCHITECTURE.md` — hard filter, soft signal e ordem de evolução
- `supabase/migrations/0001_init.sql` — schema e RLS, ainda não aplicado
- `app/` — cliente React/Vite

## App

```bash
cd app
npm install
npm test
npm run dev
```

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o app sobe em modo local e diz isso. Não há projeto Supabase ligado neste repositório.

## Privacidade

A interface mostra distância aproximada e bairro. Não mostra coordenada.
