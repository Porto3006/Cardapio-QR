# Guia de Deploy — PratoDigital

## Deploy 100% Vercel (frontend + backend serverless)

O projeto agora suporta deploy completo no Vercel: frontend estático + backend FastAPI como função serverless Python, tudo no mesmo domínio.

Arquitetura Vercel: **Frontend (React/Vite) + Backend (FastAPI serverless) no Vercel** · **Banco no MongoDB Atlas** · **Imagens no Cloudinary** (opcional) · **IA com sua chave Anthropic** · **Pagamentos Stripe**.

### 1. MongoDB Atlas
1. Crie um cluster grátis em https://cloud.mongodb.com
2. Em *Database Access*, crie um usuário e senha.
3. Em *Network Access*, libere `0.0.0.0/0`.
4. Copie a connection string (`mongodb+srv://...`) → será o `MONGO_URL`.

### 2. Importar no Vercel
1. No Vercel: **Add New → Project** → importe o repositório.
2. **Root Directory: deixe vazio (raiz do repositório)** — o `vercel.json` na raiz configura tudo (build do frontend em `frontend/` + API serverless em `api/`).
3. **Não** defina `REACT_APP_BACKEND_URL` — com ele vazio, o frontend chama `/api/*` no mesmo domínio (same-origin), roteado para a função Python pelo Vercel.

### 3. Variáveis de ambiente no Vercel
Em **Settings → Environment Variables**, defina:
- `MONGO_URL` = connection string do MongoDB Atlas
- `DB_NAME` = `pratodigital` (ou o nome do banco)
- `JWT_SECRET` = qualquer string aleatória longa
- `ADMIN_EMAIL` = email do admin (ex.: `admin@pratodigital.com`)
- `ADMIN_PASSWORD` = senha do admin (ex.: `pratodigital123`)
- `STRIPE_SECRET_KEY` = sua chave do Stripe
- `STRIPE_WEBHOOK_SECRET` = (opcional) secret do webhook Stripe
- `ANTHROPIC_API_KEY` = (opcional) chave da Anthropic para promoções com IA
- `ANTHROPIC_MODEL` = (opcional) modelo da Anthropic (padrão: `claude-sonnet-4-20250514`)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` = (opcional) para upload de imagens

### 4. Stripe
1. Rode uma vez localmente: `python backend/setup_stripe.py` (cria os 3 planos na sua conta).
2. Em Stripe → Developers → Webhooks → **Add endpoint**: `https://SEU-DOMINIO-VERCEL/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copie o *Signing secret* (`whsec_...`) para `STRIPE_WEBHOOK_SECRET` no Vercel.

### 5. Deploy
- Clique em **Deploy**. O Vercel vai:
  1. Instalar as deps Python do `requirements.txt` raiz (~75 MB, bem abaixo do limite de 250 MB).
  2. Instalar as deps do frontend (`yarn install` em `frontend/`).
  3. Buildar o frontend (`yarn build` → `frontend/build/`).
  4. Servir `api/index.py` como função serverless Python.
- Acesse a URL do Vercel, entre com `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

### Tamanho da função serverless
O `requirements.txt` raiz contém apenas as dependências runtime mínimas (~75 MB). Pacotes pesados desnecessários (numpy, pandas, litellm, tokenizers, tiktoken, boto3, google-*, etc.) foram removidos. A feature de IA agora chama a API Anthropic diretamente via `requests` em vez de usar `emergentintegrations`/`litellm` (economiza ~300 MB).

---

## Deploy alternativo: Vercel (frontend) + Render (backend)

Arquitetura: **Frontend (React/Vite) no Vercel** · **Backend (FastAPI) no Render** (ou Railway) · **Banco no MongoDB Atlas** · **Imagens no Cloudinary** · **IA com sua chave Anthropic** · **Pagamentos Stripe**.

## 1. MongoDB Atlas
1. Crie um cluster grátis em https://cloud.mongodb.com
2. Em *Database Access*, crie um usuário e senha.
3. Em *Network Access*, libere `0.0.0.0/0` (o Render não tem IP fixo no plano grátis).
4. Copie a connection string (`mongodb+srv://...`) → será o `MONGO_URL`.

## 2. Cloudinary (imagens dos pratos)
1. Crie conta em https://cloudinary.com → Dashboard.
2. Copie **Cloud Name**, **API Key** e **API Secret**.

## 3. Anthropic (Promoções com IA)
1. Crie uma chave em https://console.anthropic.com → API Keys → `ANTHROPIC_API_KEY`.

## 4. Backend no Render
1. Envie o projeto ao GitHub (botão "Save to Github").
2. No Render: **New → Blueprint** e selecione o repositório (o arquivo `render.yaml` já configura tudo).
   - Ou manualmente: *New Web Service* → Root Directory `backend` → Build `pip install -r requirements.txt` → Start `uvicorn server:app --host 0.0.0.0 --port $PORT`.
3. Preencha as variáveis (modelo em `backend/.env.example`):
   - `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - `CORS_ORIGINS` = URL do Vercel (ex.: `https://pratodigital.vercel.app`; várias separadas por vírgula)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (passo 6)
   - `ANTHROPIC_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
4. Anote a URL do backend (ex.: `https://pratodigital-api.onrender.com`).

> Railway: crie um serviço apontando para a pasta `backend` — o `Procfile` já define o comando de start. Use as mesmas variáveis.

## 5. Frontend no Vercel
1. No Vercel: **Add New → Project** → importe o repositório.
2. **Root Directory: `frontend`** (o `vercel.json` já define build, saída `build/` e rotas SPA).
3. Variável de ambiente: `REACT_APP_BACKEND_URL` = URL do backend do passo 4 (sem `/` no final).
4. Deploy. Depois volte ao Render e confirme que `CORS_ORIGINS` contém a URL final do Vercel.

## 6. Stripe
1. Rode uma vez, localmente com o `.env` do backend preenchido: `python backend/setup_stripe.py` (cria os 3 planos na sua conta).
2. Em Stripe → Developers → Webhooks → **Add endpoint**: `https://SEU-BACKEND/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copie o *Signing secret* (`whsec_...`) para `STRIPE_WEBHOOK_SECRET` no Render.
4. Em Stripe → Settings → Billing → Customer portal, ative o portal (cancelamento e troca de cartão).

## 7. Teste final
- Acesse a URL do Vercel, entre com `ADMIN_EMAIL`/`ADMIN_PASSWORD` (criado automaticamente no primeiro start).
- Envie uma foto de prato (vai para o Cloudinary), gere uma promoção com IA, abra um QR Code e faça um pedido.

## Observações
- O plano grátis do Render "dorme" após inatividade: a primeira requisição pode levar ~30s.
- Sem as variáveis `CLOUDINARY_*`, o backend usa o armazenamento da Emergent (funciona só na Emergent).
- Sem `ANTHROPIC_API_KEY`, usa a chave Emergent (`EMERGENT_LLM_KEY`).
