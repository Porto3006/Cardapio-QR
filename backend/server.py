from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File, Depends, Response, Query
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, re, bcrypt, jwt, requests
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "pratodigital"

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
storage_key = None

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
    return r

@api_router.put("/restaurant")
async def update_restaurant(body: RestaurantUpdate, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if upd:
        await db.restaurants.update_one({"id": r["id"]}, {"$set": upd})
    return await db.restaurants.find_one({"id": r["id"]}, {"_id": 0})

@api_router.post("/restaurant/plan")
async def set_plan(body: PlanIn, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    await db.restaurants.update_one({"id": r["id"]}, {"$set": {"plan": body.plan}})
    return {"ok": True, "plan": body.plan}

# ---------------- Upload ----------------
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
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
    r = await get_restaurant_for(user)
    return await db.categories.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)

@api_router.post("/categories")
async def add_category(body: CategoryIn, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    cat = {"id": str(uuid.uuid4()), "restaurant_id": r["id"], "name": body.name, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.categories.insert_one(cat)
    return {k: v for k, v in cat.items() if k != "_id"}

@api_router.delete("/categories/{cid}")
async def del_category(cid: str, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    await db.categories.delete_one({"id": cid, "restaurant_id": r["id"]})
    await db.items.delete_many({"category_id": cid, "restaurant_id": r["id"]})
    return {"ok": True}

@api_router.get("/items")
async def list_items(user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    return await db.items.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", 1).to_list(1000)

@api_router.post("/items")
async def add_item(body: ItemIn, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    item = {"id": str(uuid.uuid4()), "restaurant_id": r["id"], **body.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.items.insert_one(item)
    return {k: v for k, v in item.items() if k != "_id"}

@api_router.put("/items/{iid}")
async def update_item(iid: str, body: ItemIn, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    await db.items.update_one({"id": iid, "restaurant_id": r["id"]}, {"$set": body.model_dump()})
    return await db.items.find_one({"id": iid}, {"_id": 0})

@api_router.delete("/items/{iid}")
async def del_item(iid: str, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    await db.items.delete_one({"id": iid, "restaurant_id": r["id"]})
    return {"ok": True}

# ---------------- Orders (owner) ----------------
@api_router.get("/orders")
async def list_orders(user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    return await db.orders.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.patch("/orders/{oid}/status")
async def update_order_status(oid: str, status: str = Query(...), user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    await db.orders.update_one({"id": oid, "restaurant_id": r["id"]}, {"$set": {"status": status}})
    return await db.orders.find_one({"id": oid}, {"_id": 0})

@api_router.get("/customers")
async def list_customers(user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    return await db.customers.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)

# ---------------- AI Promo ----------------
@api_router.post("/ai/promo")
async def ai_promo(body: PromoIn, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    system = f"Você é um especialista em marketing para restaurantes. Escreva mensagens promocionais curtas e persuasivas em português do Brasil para WhatsApp/SMS. Tom: {body.tone}. Inclua emojis moderados e uma chamada para ação. Nome do restaurante: {r['name']}. Responda APENAS com a mensagem pronta para envio."
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"promo-{r['id']}", system_message=system).with_model("anthropic", "claude-sonnet-5-5")
    prompt = f"Crie uma promoção do tipo '{body.preset}'. Detalhes adicionais: {body.details or 'nenhum'}."
    msg = await chat.send_message(UserMessage(text=prompt))
    return {"message": msg}

@api_router.post("/ai/promo/send")
async def send_promo(body: dict, user=Depends(get_current_user)):
    r = await get_restaurant_for(user)
    count = await db.customers.count_documents({"restaurant_id": r["id"]})
    camp = {"id": str(uuid.uuid4()), "restaurant_id": r["id"], "message": body.get("message", ""), "recipients": count, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.campaigns.insert_one(camp)
    return {"ok": True, "recipients": count}

# ---------------- Public (customer) ----------------
@api_router.get("/public/menu/{slug}")
async def public_menu(slug: str):
    r = await db.restaurants.find_one({"slug": slug}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Cardápio não encontrado")
    cats = await db.categories.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    items = await db.items.find({"restaurant_id": r["id"], "available": True}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return {"restaurant": r, "categories": cats, "items": items}

@api_router.post("/public/order/{slug}")
async def place_order(slug: str, body: OrderIn):
    r = await db.restaurants.find_one({"slug": slug})
    if not r:
        raise HTTPException(404, "Restaurante não encontrado")
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
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ---------------- Seed ----------------
async def seed():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id")
        await db.restaurants.create_index("slug", unique=True)
    except Exception as e:
        logger.warning(f"index: {e}")
    try:
        init_storage()
    except Exception as e:
        logger.error(f"storage init: {e}")
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    existing = await db.users.find_one({"email": admin_email})
    if existing:
        return
    uid = str(uuid.uuid4())
    await db.users.insert_one({"id": uid, "email": admin_email, "name": "Alexandre", "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]), "role": "owner", "created_at": datetime.now(timezone.utc).isoformat()})
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
