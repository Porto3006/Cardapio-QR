import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Minus, ShoppingBag, Loader2, Check, Search, Utensils, Clock, ChefHat } from "lucide-react";
import { api, BRL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { imgUrl } from "@/pages/dashboard/MenuManager";

export default function PublicMenu() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const table = params.get("mesa") || "Balcão";
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [cart, setCart] = useState({});
  const [activeCat, setActiveCat] = useState(null);
  const [query, setQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [form, setForm] = useState({ customer_name: "", phone: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { api.get(`/public/menu/${slug}`).then((r) => { setData(r.data); setActiveCat(r.data.categories[0]?.id); }).catch(() => setNotFound(true)); }, [slug]);

  useEffect(() => {
    if (!placed) return;
    const t = setInterval(() => api.get(`/public/order/${placed.id}`).then((r) => setPlaced((p) => ({ ...p, status: r.data.status }))), 4000);
    return () => clearInterval(t);
  }, [placed]);

  if (notFound) return <div className="min-h-screen grid place-items-center text-muted-foreground p-6 text-center">Cardápio não encontrado.</div>;
  if (!data) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-terracotta" /></div>;

  const { restaurant, categories, items } = data;
  const add = (i) => setCart((c) => ({ ...c, [i.id]: { ...i, qty: (c[i.id]?.qty || 0) + 1 } }));
  const remove = (i) => setCart((c) => { const q = (c[i.id]?.qty || 0) - 1; const n = { ...c }; if (q <= 0) delete n[i.id]; else n[i.id] = { ...i, qty: q }; return n; });
  const cartItems = Object.values(cart);
  const count = cartItems.reduce((s, i) => s + i.qty, 0);
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  const filtered = items.filter((i) => (!query || i.name.toLowerCase().includes(query.toLowerCase())) && (query || i.category_id === activeCat));

  const submit = async () => {
    if (!form.customer_name) return toast.error("Informe seu nome");
    setSubmitting(true);
    try {
      const { data: res } = await api.post(`/public/order/${slug}`, {
        table, customer_name: form.customer_name, phone: form.phone, note: form.note,
        items: cartItems.map((i) => ({ item_id: i.id, name: i.name, price: i.price, qty: i.qty })),
      });
      setPlaced({ id: res.id, status: res.status, total: res.total });
      setCart({}); setCheckoutOpen(false);
      toast.success("Pedido enviado para a cozinha!");
    } catch { toast.error("Erro ao enviar pedido"); } finally { setSubmitting(false); }
  };

  if (placed) {
    const steps = [{ k: "novo", l: "Recebido", icon: Check }, { k: "preparo", l: "Em preparo", icon: ChefHat }, { k: "pronto", l: "Pronto", icon: Clock }];
    const idx = steps.findIndex((s) => s.k === placed.status);
    return (
      <div className="min-h-screen bg-background max-w-md mx-auto p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-olive text-white grid place-items-center mb-4"><Check size={32} /></div>
        <h1 className="text-2xl font-bold font-heading">Pedido enviado!</h1>
        <p className="text-muted-foreground mt-1">{table} · {BRL(placed.total)}</p>
        <div className="flex items-center gap-2 mt-8 w-full justify-center">
          {steps.map((s, i) => (
            <div key={s.k} className="flex items-center gap-2">
              <div className={`flex flex-col items-center gap-1 ${i <= idx ? "text-terracotta" : "text-muted-foreground/40"}`}>
                <div className={`w-10 h-10 rounded-full grid place-items-center border-2 ${i <= idx ? "border-terracotta bg-terracotta/10" : "border-muted"}`}><s.icon size={18} /></div>
                <span className="text-xs font-medium">{s.l}</span>
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < idx ? "bg-terracotta" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-10 rounded-full" onClick={() => setPlaced(null)} data-testid="new-order-button">Fazer novo pedido</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto pb-24">
      <div className="bg-olive text-white p-5 pb-6">
        <div className="flex items-center gap-2 text-xs text-white/60 mb-3"><Utensils size={14} /> {restaurant.is_open ? "Aberto agora" : "Fechado"}</div>
        <h1 className="text-2xl font-bold font-heading">{restaurant.name}</h1>
        {restaurant.description && <p className="text-white/70 text-sm mt-1">{restaurant.description}</p>}
        <span className="inline-block mt-3 bg-terracotta text-white text-xs font-bold px-3 py-1 rounded-full">{table}</span>
      </div>

      <div className="sticky top-0 z-10 bg-background border-b border-border p-3 space-y-3">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input data-testid="customer-search-input" className="pl-9 rounded-full" placeholder="Buscar prato..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        {!query && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button key={c.id} data-testid={`customer-menu-category-filter-${c.id}`} onClick={() => setActiveCat(c.id)} className={`whitespace-nowrap text-sm px-4 py-1.5 rounded-full border transition-colors ${activeCat === c.id ? "bg-terracotta text-white border-terracotta" : "border-border bg-card"}`}>{c.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum item encontrado.</p>}
        {filtered.map((i) => (
          <div key={i.id} data-testid={`customer-item-${i.id}`} className="bg-card rounded-2xl border border-border p-3 flex gap-3">
            {imgUrl(i.image_path) && <img src={imgUrl(i.image_path)} alt={i.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{i.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{i.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-terracotta font-bold">{BRL(i.price)}</span>
                {cart[i.id] ? (
                  <div className="flex items-center gap-3">
                    <button onClick={() => remove(i)} data-testid={`customer-remove-${i.id}`} className="w-7 h-7 rounded-full bg-secondary grid place-items-center"><Minus size={14} /></button>
                    <span className="font-bold w-4 text-center">{cart[i.id].qty}</span>
                    <button onClick={() => add(i)} data-testid={`customer-add-${i.id}`} className="w-7 h-7 rounded-full bg-terracotta text-white grid place-items-center"><Plus size={14} /></button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => add(i)} data-testid={`customer-menu-add-item-button-${i.id}`} className="rounded-full bg-terracotta hover:bg-terracotta-dark text-white h-8"><Plus size={16} className="mr-1" /> Adicionar</Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {count > 0 && (
        <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-3">
          <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
            <SheetTrigger asChild>
              <button data-testid="customer-cart-open-button" className="w-full bg-terracotta text-white rounded-full h-14 px-5 flex items-center justify-between shadow-lg">
                <span className="flex items-center gap-2"><ShoppingBag size={20} /> {count} item(s)</span>
                <span className="font-bold">{BRL(total)} · Ver pedido</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-3xl max-h-[90vh] overflow-y-auto">
              <SheetHeader><SheetTitle>Seu pedido · {table}</SheetTitle></SheetHeader>
              <div className="space-y-3 mt-4">
                {cartItems.map((i) => (
                  <div key={i.id} className="flex items-center justify-between">
                    <div><p className="font-medium text-sm">{i.name}</p><p className="text-xs text-muted-foreground">{BRL(i.price)}</p></div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => remove(i)} className="w-7 h-7 rounded-full bg-secondary grid place-items-center"><Minus size={14} /></button>
                      <span className="font-bold w-4 text-center">{i.qty}</span>
                      <button onClick={() => add(i)} className="w-7 h-7 rounded-full bg-terracotta text-white grid place-items-center"><Plus size={14} /></button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-border pt-3 space-y-3">
                  <div><Label>Seu nome</Label><Input data-testid="checkout-name-input" className="mt-1.5" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Como te chamamos?" /></div>
                  <div><Label>Celular (opcional)</Label><Input data-testid="checkout-phone-input" className="mt-1.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-0000" /></div>
                  <div><Label>Observação</Label><Textarea data-testid="checkout-note-input" className="mt-1.5" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex: sem cebola" /></div>
                </div>
                <div className="flex items-center justify-between text-lg font-bold"><span>Total</span><span className="text-terracotta">{BRL(total)}</span></div>
                <Button onClick={submit} disabled={submitting} data-testid="customer-order-submit-button" className="w-full h-12 rounded-full bg-terracotta hover:bg-terracotta-dark text-white">{submitting ? <Loader2 className="animate-spin" size={18} /> : "Enviar pedido para a cozinha"}</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}
