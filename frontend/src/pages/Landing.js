import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { QrCode, ChefHat, Printer, Sparkles, BarChart3, Smartphone, Check, Star, ArrowRight, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";

const HERO_QR = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=1A1817&bgcolor=FFFFFF&data=https://pratodigital.com/menu/sabor-e-arte";

const features = [
  { icon: QrCode, title: "QR Code Instantâneo", desc: "Gere QR Codes por mesa em segundos. O cliente escaneia e já vê o cardápio." },
  { icon: ChefHat, title: "Cozinha ao Vivo", desc: "Painel em tempo real: Novos, Em Preparo e Prontos. Nada se perde." },
  { icon: Printer, title: "Comprovante para Impressão", desc: "Imprima o pedido no formato de cupom térmico direto do navegador." },
  { icon: Sparkles, title: "Promoções com IA", desc: "A inteligência artificial escreve mensagens de promoção prontas para enviar." },
  { icon: BarChart3, title: "Visão do Negócio", desc: "Acompanhe pedidos, itens e clientes cadastrados em um só lugar." },
  { icon: Smartphone, title: "Feito para o Celular", desc: "Experiência rápida e bonita no celular do seu cliente, sem baixar app." },
];

const plans = [
  { id: "simples", name: "Simples", price: "49", testid: "landing-plan-simple-select", popular: false, features: ["Cardápio digital ilimitado", "QR Code por mesa", "Pedidos pelo celular", "1 usuário"] },
  { id: "intermediario", name: "Intermediário", price: "99", testid: "landing-plan-intermediate-select", popular: true, features: ["Tudo do Simples", "Painel de cozinha ao vivo", "Comprovante para impressão", "Até 3 usuários"] },
  { id: "avancado", name: "Avançado", price: "189", testid: "landing-plan-advanced-select", popular: false, features: ["Tudo do Intermediário", "Promoções com IA", "Cadastro de clientes", "Relatórios e usuários ilimitados"] },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-heading font-extrabold text-lg">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-terracotta text-white"><Utensils size={18} /></span>
            PratoDigital
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/entrar"><Button variant="ghost" data-testid="nav-login-button">Entrar</Button></Link>
            <Link to="/cadastrar"><Button data-testid="landing-cta-start-trial" className="bg-terracotta hover:bg-terracotta-dark text-white rounded-full">Teste 30 dias grátis</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-5">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-terracotta bg-terracotta/10 px-3 py-1.5 rounded-full">Sem comissão por pedido</span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">Seu cardápio digital moderno, <span className="text-terracotta">sem complicação.</span></h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-md">Crie o cardápio, gere o QR Code e receba pedidos direto na cozinha. Seus clientes pedem pelo próprio celular.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/cadastrar"><Button size="lg" className="bg-terracotta hover:bg-terracotta-dark text-white rounded-full h-12 px-7" data-testid="hero-start-button">Começar grátis <ArrowRight size={18} className="ml-1" /></Button></Link>
              <a href="#planos"><Button size="lg" variant="outline" className="rounded-full h-12 px-7">Ver planos</Button></a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">30 dias grátis · não pedimos cartão para testar</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="relative">
            <div className="bg-white rounded-3xl shadow-xl border border-border p-8 max-w-sm mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-olive text-white grid place-items-center font-heading font-bold">S</div>
                <div><p className="font-heading font-bold leading-tight">Sabor & Arte Bistrô</p><p className="text-xs text-muted-foreground">Mesa 04 · Aberto</p></div>
              </div>
              <div className="rounded-2xl bg-secondary p-6 grid place-items-center">
                <img src={HERO_QR} alt="QR Code do cardápio" className="rounded-xl" />
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">Escaneie e faça seu pedido 📱</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-20 px-5 bg-secondary/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs uppercase font-bold tracking-[0.2em] text-terracotta">Tudo em um só lugar</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Uma plataforma completa para o seu restaurante</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="w-11 h-11 rounded-xl bg-terracotta/10 text-terracotta grid place-items-center mb-4"><f.icon size={22} /></div>
                <h3 className="font-heading font-bold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs uppercase font-bold tracking-[0.2em] text-terracotta">Planos</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Comece com 30 dias grátis</h2>
            <p className="mt-3 text-muted-foreground">Depois do período de teste, escolha o plano ideal. Cancele quando quiser.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((p) => (
              <div key={p.id} data-testid={`plan-card-${p.id}`} className={`relative rounded-3xl p-7 border transition-all ${p.popular ? "border-terracotta bg-card shadow-xl md:-translate-y-3" : "border-border bg-card"}`}>
                {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 bg-terracotta text-white text-xs font-bold px-3 py-1 rounded-full"><Star size={12} /> Mais popular</span>}
                <h3 className="font-heading font-bold text-xl">{p.name}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-extrabold font-heading">R$ {p.price}</span>
                  <span className="text-muted-foreground mb-1">/mês</span>
                </div>
                <p className="text-xs text-olive font-semibold mt-1">30 dias grátis para testar</p>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm"><Check size={18} className="text-olive shrink-0 mt-0.5" />{f}</li>
                  ))}
                </ul>
                <Link to="/cadastrar"><Button data-testid={p.testid} className={`w-full mt-7 rounded-full h-11 ${p.popular ? "bg-terracotta hover:bg-terracotta-dark text-white" : ""}`} variant={p.popular ? "default" : "outline"}>Começar agora</Button></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-olive text-white/80 py-12 px-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-heading font-extrabold text-white text-lg"><Utensils size={18} /> PratoDigital</div>
            <p className="mt-2 text-sm max-w-xs">Cardápio digital, pedidos e cozinha conectada. Feito para restaurantes do Brasil.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-white mb-2">Produto</p>
            <a href="#recursos" className="block hover:text-white">Recursos</a>
            <a href="#planos" className="block hover:text-white">Planos</a>
            <Link to="/entrar" className="block hover:text-white">Área do restaurante</Link>
          </div>
        </div>
        <p className="max-w-6xl mx-auto mt-8 text-xs text-white/50">© 2026 PratoDigital. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
