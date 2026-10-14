import { useState, useEffect } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LayoutGrid, UtensilsCrossed, QrCode, ChefHat, Sparkles, Settings, LogOut, Utensils, Menu as MenuIcon, Store, Check, Loader2 } from "lucide-react";
import { api, BRL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import MenuManager from "@/pages/dashboard/MenuManager";
import KitchenBoard from "@/pages/dashboard/KitchenBoard";
import QRCodes from "@/pages/dashboard/QRCodes";
import AIPromo from "@/pages/dashboard/AIPromo";

const nav = [
  { to: "/painel", end: true, icon: LayoutGrid, label: "Visão Geral", testid: "dashboard-nav-overview" },
  { to: "/painel/cardapio", icon: UtensilsCrossed, label: "Cardápio", testid: "dashboard-nav-menu-manager" },
  { to: "/painel/qrcode", icon: QrCode, label: "QR Code & Mesas", testid: "dashboard-nav-qr" },
  { to: "/painel/cozinha", icon: ChefHat, label: "Cozinha ao Vivo", testid: "dashboard-nav-kitchen-board" },
  { to: "/painel/promocoes", icon: Sparkles, label: "Promoções IA", testid: "dashboard-nav-ai-promo" },
  { to: "/painel/plano", icon: Settings, label: "Plano", testid: "dashboard-nav-plan" },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const nv = useNavigate();
  const [rest, setRest] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => api.get("/restaurant").then((r) => setRest(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggleOpen = async (v) => {
    const { data } = await api.put("/restaurant", { is_open: v });
    setRest(data);
    toast.success(v ? "Restaurante aberto" : "Restaurante fechado");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-olive text-white flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 flex items-center gap-2 font-heading font-extrabold text-lg border-b border-white/10"><Utensils size={20} /> PratoDigital</div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.testid} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${isActive ? "bg-terracotta text-white font-semibold" : "text-white/70 hover:bg-white/10"}`}>
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 text-sm"><p className="font-semibold truncate">{user?.name}</p><p className="text-white/50 text-xs truncate">{user?.email}</p></div>
          <Button variant="ghost" data-testid="logout-button" onClick={() => { logout(); nv("/"); }} className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"><LogOut size={18} className="mr-2" /> Sair</Button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <main className="flex-1 min-w-0">
        <header className="h-16 border-b border-border bg-card/70 backdrop-blur-sm flex items-center justify-between px-5 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="sidebar-toggle"><MenuIcon /></button>
            <div className="flex items-center gap-2"><Store size={18} className="text-terracotta" /><span className="font-heading font-bold">{rest?.name || "..."}</span></div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={rest?.is_open ? "text-olive font-semibold" : "text-muted-foreground"}>{rest?.is_open ? "Aberto" : "Fechado"}</span>
            <Switch checked={!!rest?.is_open} onCheckedChange={toggleOpen} data-testid="restaurant-open-toggle" />
          </div>
        </header>

        <div className="p-5 lg:p-8 max-w-6xl">
          <Routes>
            <Route index element={<Overview rest={rest} />} />
            <Route path="cardapio" element={<MenuManager />} />
            <Route path="qrcode" element={<QRCodes rest={rest} />} />
            <Route path="cozinha" element={<KitchenBoard />} />
            <Route path="promocoes" element={<AIPromo />} />
            <Route path="plano" element={<PlanSettings rest={rest} reload={load} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function Overview({ rest }) {
  const [stats, setStats] = useState({ orders: 0, items: 0, customers: 0, revenue: 0 });
  useEffect(() => {
    Promise.all([api.get("/orders"), api.get("/items"), api.get("/customers")]).then(([o, i, c]) => {
      setStats({ orders: o.data.length, items: i.data.length, customers: c.data.length, revenue: o.data.reduce((s, x) => s + (x.total || 0), 0) });
    });
  }, []);
  const trialDays = rest?.trial_ends_at ? Math.max(0, Math.ceil((new Date(rest.trial_ends_at) - new Date()) / 86400000)) : 0;
  const cards = [
    { label: "Pedidos", value: stats.orders }, { label: "Itens no cardápio", value: stats.items },
    { label: "Clientes cadastrados", value: stats.customers }, { label: "Faturamento", value: BRL(stats.revenue) },
  ];
  return (
    <div className="animate-float-up">
      <h1 className="text-2xl font-bold font-heading">Visão Geral</h1>
      <p className="text-muted-foreground text-sm mt-1">Resumo do seu restaurante.</p>
      {rest?.plan === "trial" && (
        <div className="mt-5 rounded-2xl bg-terracotta/10 border border-terracotta/30 p-4 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-medium">Você está no período de teste grátis. <span className="font-bold text-terracotta">{trialDays} dias restantes.</span></p>
          <NavLink to="/painel/plano"><Button size="sm" className="bg-terracotta hover:bg-terracotta-dark text-white rounded-full">Escolher plano</Button></NavLink>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-2xl border border-border p-5">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-extrabold font-heading mt-1">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanSettings({ rest, reload }) {
  const [loading, setLoading] = useState(null);
  const plans = [
    { id: "simples", name: "Simples", price: "49", features: ["Cardápio ilimitado", "QR Code por mesa", "Pedidos pelo celular"] },
    { id: "intermediario", name: "Intermediário", price: "99", features: ["Tudo do Simples", "Cozinha ao vivo", "Comprovante de impressão"] },
    { id: "avancado", name: "Avançado", price: "189", features: ["Tudo do Intermediário", "Promoções com IA", "Clientes e relatórios"] },
  ];
  const choose = async (id) => {
    setLoading(id);
    try {
      const { data } = await api.post("/payments/checkout", { lookup_key: `plano_${id}_mensal`, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao iniciar pagamento");
      setLoading(null);
    }
  };
  const active = rest?.subscription_status === "active";
  return (
    <div className="animate-float-up">
      <h1 className="text-2xl font-bold font-heading">Seu Plano</h1>
      <p className="text-muted-foreground text-sm mt-1">Plano atual: <span className="font-semibold capitalize text-foreground">{rest?.plan === "trial" ? "Teste grátis (30 dias)" : rest?.plan}</span>{active && <span className="ml-2 text-xs bg-olive text-white px-2 py-0.5 rounded-full">Assinatura ativa</span>}</p>
      <div className="grid md:grid-cols-3 gap-5 mt-6">
        {plans.map((p) => {
          const current = rest?.plan === p.id && active;
          return (
            <div key={p.id} className={`rounded-2xl border p-6 ${current ? "border-terracotta ring-2 ring-terracotta/30" : "border-border"} bg-card`}>
              <h3 className="font-heading font-bold text-lg">{p.name}</h3>
              <p className="text-3xl font-extrabold font-heading mt-2">R$ {p.price}<span className="text-base text-muted-foreground font-normal">/mês</span></p>
              <ul className="mt-4 space-y-2 text-sm">{p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check size={16} className="text-olive shrink-0 mt-0.5" />{f}</li>)}</ul>
              <Button onClick={() => choose(p.id)} disabled={current || loading === p.id} data-testid={`plan-select-${p.id}`} className={`w-full mt-5 rounded-full ${current ? "" : "bg-terracotta hover:bg-terracotta-dark text-white"}`} variant={current ? "outline" : "default"}>
                {loading === p.id ? <Loader2 className="animate-spin" size={16} /> : current ? "Plano atual" : "Assinar"}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-4">Pagamento seguro via Stripe. Cartão de teste: 4242 4242 4242 4242, qualquer data futura e CVC.</p>
    </div>
  );
}
