# PratoDigital — PRD

## Problema original
SaaS de cardápio digital: donos de restaurante se cadastram, criam cardápio (categorias/itens/fotos), geram QR Codes por mesa. Clientes escaneiam, veem o cardápio e fazem pedidos que chegam numa cozinha em tempo real (pagamento no local). 3 planos (Simples, Intermediário, Avançado) com 30 dias grátis. IA gera mensagens promocionais para clientes cadastrados.

## Arquitetura
React 19 + Tailwind + shadcn | FastAPI (server.py) | MongoDB | Stripe Billing (assinaturas) | Emergent Object Storage | Emergent LLM Key (Claude).

## Implementado
- Auth JWT, CRUD de cardápio, upload de imagens, cardápio público + pedidos via QR, cozinha ao vivo, Promoções IA, assinaturas Stripe (checkout + webhook).
- (Jun/2026) Portal de faturamento Stripe (`POST /api/payments/portal`) — botão "Gerenciar assinatura" na tela Plano (aparece quando há stripe_customer_id).
- (Jun/2026) Bloqueio pós-trial: sem trial ativo e sem assinatura ativa → todas as rotas do painel retornam 402; cardápio público/pedidos retornam 403 (QR Codes desativados). Frontend só libera a tela Plano, com banner de bloqueio e menu com cadeados. `GET /api/restaurant` retorna `access_active`.
- Webhook trata `customer.subscription.updated/deleted` para atualizar status.

## Backlog
- P1: Envio real das promoções por WhatsApp/SMS (hoje só registra campanha — MOCKADO).
- P2: Restringir recursos por plano (ex.: IA só no Avançado), relatórios.
