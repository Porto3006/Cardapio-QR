from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File, Depends, Response, Query
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, re, bcrypt, jwt, requests, stripe
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'pratodigital')]

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-change-me')
ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')
JWT_ALGORITHM = "HS256"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
LLM_KEY = os.environ.get("ANTHROPIC_API_KEY") or EMERGENT_KEY
APP_NAME = "pratodigital"

USE_CLOUDINARY = bool(os.environ.get("CLOUDINARY_CLOUD_NAME"))
if USE_CLOUDINARY:
    import cloudinary, cloudinary.uploader
    cloudinary.config(cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"], api_key=os.environ["CLOUDINARY_API_KEY"], api_secret=os.environ["CLOUDINARY_API_SECRET"], secure=True)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
storage_key = None

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
PLAN_BY_LOOKUP = {"plano_simples_mensal": "simples", "plano_intermediario_mensal": "intermediario", "plano_avancado_mensal": "avancado"}

app = FastAPI()
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pratodigital")

# ---------------- Storage ----------------
def init_storage(force=False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path, data, content_type):
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------------- Auth helpers ----------------
def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def verify_password(p, h): return bcrypt.checkpw(p.encode(), h.encode())

def create_token(user_id, email):
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "Usuário não encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")

def slugify(name):
    s = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return s or "restaurante"

def has_premium(r):
    if r.get("subscription_status") == "active":
        return True
    te = r.get("trial_ends_at")
    if te:
        try:
            return datetime.fromisoformat(te) > datetime.now(timezone.utc)
        except Exception:
            return False
    return False

# ---------------- Models ----------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    restaurant_name: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    is_open: Optional[bool] = None

class CategoryIn(BaseModel):
    name: str

class ItemIn(BaseModel):
    category_id: str
    name: str
    description: Optional[str] = ""
    price: float
    image_path: Optional[str] = None
    available: bool = True

class OrderItemIn(BaseModel):
    item_id: str
    name: str
    price: float
    qty: int

class OrderIn(BaseModel):
    table: str
    customer_name: str
    phone: Optional[str] = ""
    items: List[OrderItemIn]
    note: Optional[str] = ""

class PlanIn(BaseModel):
    plan: str

class PromoIn(BaseModel):
    preset: str
    details: Optional[str] = ""
    tone: Optional[str] = "amigável e animado"

# ---------------- Auth routes ----------------
async def get_restaurant_for(user):
    return await db.restaurants.find_one({"owner_id": user["id"]}, {"_id": 0})

BLOCK_MSG = "Seu período de teste terminou. Assine um plano para continuar usando o PratoDigital."

async def get_active_restaurant(user):
    r = await get_restaurant_for(user)
    if not r:
        raise HTTPException(404, "Restaurante não encontrado")
    if not has_premium(r):
        raise HTTPException(402, BLOCK_MSG)
    return r

@api_router.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Este email já está cadastrado")
    uid = str(uuid.uuid4())
    await db.users.insert_one({"id": uid, "email": email, "name": body.name, "password_hash": hash_password(body.password), "role": "owner", "created_at": datetime.now(timezone.utc).isoformat()})
    slug = slugify(body.restaurant_name)
    if await db.restaurants.find_one({"slug": slug}):
        slug = f"{slug}-{uid[:4]}"
    await db.restaurants.insert_one({"id": str(uuid.uuid4()), "owner_id": uid, "name": body.restaurant_name, "slug": slug, "description": "", "phone": "", "is_open": True, "plan": "trial", "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()})
    token = create_token(uid, email)
    return {"token": token, "user": {"id": uid, "email": email, "name": body.name, "role": "owner"}}

@api_router.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email ou senha inválidos")
    token = create_token(user["id"], email)
    return {"token": token, "user": {"id": user["id"], "email": email, "name": user["name"], "role": user.get("role", "owner")}}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

# ---------------- Restaurant ----------------
@api_router.get("/restaurant")
async def my_restaurant(user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    if not r:
        raise HTTPException(404, "Restaurante não encontrado")
    r["access_active"] = has_premium(r)
    return r

@api_router.put("/restaurant")
async def update_restaurant(body: RestaurantUpdate, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if upd:
        await db.restaurants.update_one({"id": r["id"]}, {"$set": upd})
    return await db.restaurants.find_one({"id": r["id"]}, {"_id": 0})

@api_router.post("/restaurant/plan")
async def set_plan(body: PlanIn, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    await db.restaurants.update_one({"id": r["id"]}, {"$set": {"plan": body.plan}})
    return {"ok": True, "plan": body.plan}

# ---------------- Upload ----------------
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    await get_active_restaurant(user)
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Envie apenas imagens")
    data = await file.read()
    if USE_CLOUDINARY:
        res = cloudinary.uploader.upload(data, folder=f"{APP_NAME}/users/{user['id']}/images", resource_type="image")
        return {"path": res["secure_url"]}
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type or "image/jpeg")
    await db.files.insert_one({"id": str(uuid.uuid4()), "storage_path": result["path"], "content_type": file.content_type or "image/jpeg", "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"path": result["path"]}

@api_router.get("/files/{path:path}")
async def download(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not rec:
        raise HTTPException(404, "Arquivo não encontrado")
    data, ct = get_object(path)
    return Response(content=data, media_type=rec.get("content_type", ct))

# ---------------- Categories & Items ----------------
@api_router.get("/categories")
async def list_categories(user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    return await db.categories.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)

@api_router.post("/categories")
async def add_category(body: CategoryIn, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    cat = {"id": str(uuid.uuid4()), "restaurant_id": r["id"], "name": body.name, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.categories.insert_one(cat)
    return {k: v for k, v in cat.items() if k != "_id"}

@api_router.delete("/categories/{cid}")
async def del_category(cid: str, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    await db.categories.delete_one({"id": cid, "restaurant_id": r["id"]})
    await db.items.delete_many({"category_id": cid, "restaurant_id": r["id"]})
    return {"ok": True}

@api_router.get("/items")
async def list_items(user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    return await db.items.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", 1).to_list(1000)

@api_router.post("/items")
async def add_item(body: ItemIn, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    item = {"id": str(uuid.uuid4()), "restaurant_id": r["id"], **body.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.items.insert_one(item)
    return {k: v for k, v in item.items() if k != "_id"}

@api_router.put("/items/{iid}")
async def update_item(iid: str, body: ItemIn, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    await db.items.update_one({"id": iid, "restaurant_id": r["id"]}, {"$set": body.model_dump()})
    return await db.items.find_one({"id": iid}, {"_id": 0})

@api_router.delete("/items/{iid}")
async def del_item(iid: str, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    await db.items.delete_one({"id": iid, "restaurant_id": r["id"]})
    return {"ok": True}

# ---------------- Orders (owner) ----------------
@api_router.get("/orders")
async def list_orders(user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    return await db.orders.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.patch("/orders/{oid}/status")
async def update_order_status(oid: str, status: str = Query(...), user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    await db.orders.update_one({"id": oid, "restaurant_id": r["id"]}, {"$set": {"status": status}})
    return await db.orders.find_one({"id": oid}, {"_id": 0})

@api_router.get("/customers")
async def list_customers(user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    return await db.customers.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)

# ---------------- AI Promo ----------------
@api_router.post("/ai/promo")
async def ai_promo(body: PromoIn, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    if not LLM_KEY:
        raise HTTPException(503, "IA não configurada. Defina ANTHROPIC_API_KEY nas variáveis de ambiente.")
    system = f"Você é um especialista em marketing para restaurantes. Escreva mensagens promocionais curtas e persuasivas em português do Brasil para WhatsApp/SMS. Tom: {body.tone}. Inclua emojis moderados e uma chamada para ação. Nome do restaurante: {r['name']}. Responda APENAS com a mensagem pronta para envio."
    prompt = f"Crie uma promoção do tipo '{body.preset}'. Detalhes adicionais: {body.details or 'nenhum'}."
    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": LLM_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": ANTHROPIC_MODEL, "max_tokens": 1024, "system": system, "messages": [{"role": "user", "content": prompt}]},
            timeout=60,
        )
        if resp.status_code == 401:
            raise HTTPException(503, "Chave da API Anthropic inválida. Verifique ANTHROPIC_API_KEY.")
        if resp.status_code == 429:
            raise HTTPException(429, "Limite de requisições atingido. Tente novamente em instantes.")
        if resp.status_code != 200:
            logger.error(f"ai_promo error: {resp.status_code} {resp.text}")
            raise HTTPException(503, "A IA está indisponível no momento. Tente novamente em instantes.")
        msg = resp.json()["content"][0]["text"]
        return {"message": msg}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ai_promo error: {e}")
        raise HTTPException(503, "A IA está indisponível no momento. Tente novamente em instantes.")

@api_router.post("/ai/promo/send")
async def send_promo(body: dict, user=Depends(get_current_user)):
    r = await get_active_restaurant(user)
    count = await db.customers.count_documents({"restaurant_id": r["id"]})
    camp = {"id": str(uuid.uuid4()), "restaurant_id": r["id"], "message": body.get("message", ""), "recipients": count, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.campaigns.insert_one(camp)
    return {"ok": True, "recipients": count}

# ---------------- Stripe payments (owner subscriptions) ----------------
class CheckoutRequest(BaseModel):
    lookup_key: str
    origin_url: str

async def apply_subscription(session_id, lookup_key, user_id, subscription_id, customer_id=None):
    plan = PLAN_BY_LOOKUP.get(lookup_key)
    if plan and user_id:
        upd = {"plan": plan, "stripe_subscription_id": subscription_id, "subscription_status": "active"}
        if customer_id:
            upd["stripe_customer_id"] = customer_id
        await db.restaurants.update_one({"owner_id": user_id}, {"$set": upd})

@api_router.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest, user=Depends(get_current_user)):
    prices = stripe.Price.list(lookup_keys=[req.lookup_key], active=True, limit=1).data
    if not prices:
        raise HTTPException(500, f"Plano não encontrado: {req.lookup_key}")
    price = prices[0]
    session = stripe.checkout.Session.create(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        metadata={"user_id": user["id"], "lookup_key": req.lookup_key},
        subscription_data={"metadata": {"user_id": user["id"], "lookup_key": req.lookup_key}},
    )
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user["id"], "lookup_key": req.lookup_key,
        "amount": (price.unit_amount or 0) / 100, "currency": price.currency,
        "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.id}

@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Transação não encontrada")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                res = await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid", "stripe_subscription_id": s.subscription, "updated_at": datetime.now(timezone.utc).isoformat()}})
                if res.modified_count:
                    await apply_subscription(session_id, record["lookup_key"], record["user_id"], s.subscription, s.customer)
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"], "payment_status": record["payment_status"], "plan": PLAN_BY_LOOKUP.get(record["lookup_key"])}

@api_router.post("/payments/portal")
async def billing_portal(body: dict, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    cust = r.get("stripe_customer_id")
    if not cust:
        raise HTTPException(400, "Nenhuma assinatura ativa encontrada.")
    origin = body.get("origin_url") or ""
    return_url = f"{origin}/painel/plano"
    try:
        sess = stripe.billing_portal.Session.create(customer=cust, return_url=return_url)
    except stripe.error.InvalidRequestError as e:
        if "configuration" in str(e).lower():
            cfg = stripe.billing_portal.Configuration.create(
                business_profile={"headline": "PratoDigital"},
                features={"subscription_cancel": {"enabled": True, "mode": "at_period_end"}, "payment_method_update": {"enabled": True}, "invoice_history": {"enabled": True}},
            )
            sess = stripe.billing_portal.Session.create(customer=cust, configuration=cfg.id, return_url=return_url)
        else:
            raise
    return {"portal_url": sess.url}

@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Assinatura inválida")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        res = await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"), "stripe_subscription_id": obj.get("subscription"), "updated_at": datetime.now(timezone.utc).isoformat()}})
        if res.modified_count:
            md = obj.get("metadata", {}) or {}
            await apply_subscription(obj["id"], md.get("lookup_key", ""), md.get("user_id", ""), obj.get("subscription"), obj.get("customer"))
    elif t in ("customer.subscription.deleted", "customer.subscription.updated"):
        status = "canceled" if t == "customer.subscription.deleted" else ("active" if obj.get("status") in ("active", "trialing") else obj.get("status"))
        await db.restaurants.update_one({"stripe_subscription_id": obj.get("id")}, {"$set": {"subscription_status": status}})
    return {"status": "ok"}

# ---------------- Public (customer) ----------------
@api_router.get("/public/menu/{slug}")
async def public_menu(slug: str):
    r = await db.restaurants.find_one({"slug": slug}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Cardápio não encontrado")
    if not has_premium(r):
        raise HTTPException(403, "Este cardápio está temporariamente indisponível.")
    cats = await db.categories.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    items = await db.items.find({"restaurant_id": r["id"], "available": True}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return {"restaurant": r, "categories": cats, "items": items}

@api_router.post("/public/order/{slug}")
async def place_order(slug: str, body: OrderIn):
    r = await db.restaurants.find_one({"slug": slug})
    if not r:
        raise HTTPException(404, "Restaurante não encontrado")
    if not has_premium(r):
        raise HTTPException(403, "Este cardápio está temporariamente indisponível.")
    total = sum(i.price * i.qty for i in body.items)
    order = {"id": str(uuid.uuid4()), "restaurant_id": r["id"], "table": body.table, "customer_name": body.customer_name, "phone": body.phone, "items": [i.model_dump() for i in body.items], "note": body.note, "total": total, "status": "novo", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.orders.insert_one(order)
    if body.phone:
        existing = await db.customers.find_one({"restaurant_id": r["id"], "phone": body.phone})
        if not existing:
            await db.customers.insert_one({"id": str(uuid.uuid4()), "restaurant_id": r["id"], "name": body.customer_name, "phone": body.phone, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"id": order["id"], "status": order["status"], "total": total}

@api_router.get("/public/order/{oid}")
async def public_order_status(oid: str):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido não encontrado")
    return {"id": o["id"], "status": o["status"], "total": o["total"]}

app.include_router(api_router)
_cors = os.environ.get("CORS_ORIGINS", "*")
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=[o.strip() for o in _cors.split(",")], allow_methods=["*"], allow_headers=["*"])

# ---------------- Seed ----------------
async def seed():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id")
        await db.restaurants.create_index("slug", unique=True)
    except Exception as e:
        logger.warning(f"index: {e}")
    if not USE_CLOUDINARY:
        try:
            init_storage()
        except Exception as e:
            logger.error(f"storage init: {e}")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@pratodigital.com").lower()
    existing = await db.users.find_one({"email": admin_email})
    if existing:
        return
    uid = str(uuid.uuid4())
    await db.users.insert_one({"id": uid, "email": admin_email, "name": "Alexandre", "password_hash": hash_password(os.environ.get("ADMIN_PASSWORD", "pratodigital123")), "role": "owner", "created_at": datetime.now(timezone.utc).isoformat()})
    rid = str(uuid.uuid4())
    await db.restaurants.insert_one({"id": rid, "owner_id": uid, "name": "Sabor & Arte Bistrô", "slug": "sabor-e-arte", "description": "Cozinha artesanal com ingredientes frescos.", "phone": "(11) 99999-0000", "is_open": True, "plan": "trial", "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()})
    demo = {
        "Entradas": [("Bruschetta Artesanal", "Pão italiano, tomate, manjericão e azeite", 24.90, "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400"),
                     ("Bolinho de Bacalhau", "6 unidades crocantes", 32.00, "https://images.unsplash.com/photo-1541529086526-db283c563270?w=400")],
        "Pratos Principais": [("Risoto de Funghi", "Arroz arbóreo, funghi secchi e parmesão", 58.00, "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400"),
                              ("Filé ao Molho Madeira", "Filé mignon, arroz e batata rústica", 72.00, "https://images.unsplash.com/photo-1558030006-450675393462?w=400"),
                              ("Spaghetti alla Carbonara", "Massa fresca, pancetta e gema", 49.90, "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400")],
        "Sobremesas": [("Tiramisù", "Clássico italiano com café e mascarpone", 26.00, "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400")],
        "Bebidas": [("Suco Natural", "Laranja, limão ou maracujá", 12.00, "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400"),
                    ("Taça de Vinho", "Tinto ou branco da casa", 28.00, "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400")],
    }
    for cname, items in demo.items():
        cid = str(uuid.uuid4())
        await db.categories.insert_one({"id": cid, "restaurant_id": rid, "name": cname, "created_at": datetime.now(timezone.utc).isoformat()})
        for nm, desc, price, img in items:
            await db.items.insert_one({"id": str(uuid.uuid4()), "restaurant_id": rid, "category_id": cid, "name": nm, "description": desc, "price": price, "image_path": img, "available": True, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.orders.insert_one({"id": str(uuid.uuid4()), "restaurant_id": rid, "table": "Mesa 04", "customer_name": "João Silva", "phone": "", "items": [{"item_id": "x", "name": "Risoto de Funghi", "price": 58.0, "qty": 1}], "note": "Sem cebola", "total": 58.0, "status": "novo", "created_at": datetime.now(timezone.utc).isoformat()})
    logger.info("Seed concluído")

@app.on_event("startup")
async def on_start():
    await seed()

@app.on_event("shutdown")
async def shutdown_db():
    client.close()
