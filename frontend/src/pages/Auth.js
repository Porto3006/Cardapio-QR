import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Utensils, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Auth({ mode }) {
  const isLogin = mode === "login";
  const nav = useNavigate();
  const { loginSuccess } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", restaurant_name: "" });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isLogin ? "/auth/login" : "/auth/register";
      const payload = isLogin ? { email: form.email, password: form.password } : form;
      const { data } = await api.post(url, payload);
      loginSuccess(data);
      toast.success(isLogin ? "Bem-vindo de volta!" : "Conta criada! Aproveite 30 dias grátis.");
      nav("/painel");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-olive text-white p-12">
        <Link to="/" className="flex items-center gap-2 font-heading font-extrabold text-xl"><Utensils size={22} /> PratoDigital</Link>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight font-heading">Seu restaurante,<br />no digital.</h2>
          <p className="mt-4 text-white/70 max-w-sm">Cardápio, QR Code, pedidos e cozinha conectada. Tudo em uma plataforma simples.</p>
        </div>
        <p className="text-white/50 text-sm">30 dias grátis · sem cartão de crédito</p>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Link to="/" className="lg:hidden flex items-center gap-2 font-heading font-extrabold text-lg mb-8 text-terracotta"><Utensils size={20} /> PratoDigital</Link>
          <h1 className="text-2xl font-bold font-heading">{isLogin ? "Entrar na sua conta" : "Criar conta grátis"}</h1>
          <p className="text-muted-foreground text-sm mt-1">{isLogin ? "Acesse o painel do seu restaurante." : "Comece agora seu teste de 30 dias."}</p>

          <div className="mt-7 space-y-4">
            {!isLogin && (
              <>
                <div><Label>Seu nome</Label><Input data-testid="register-name-input" className="mt-1.5" value={form.name} onChange={set("name")} required placeholder="Ex: Maria Souza" /></div>
                <div><Label>Nome do restaurante</Label><Input data-testid="register-restaurant-input" className="mt-1.5" value={form.restaurant_name} onChange={set("restaurant_name")} required placeholder="Ex: Cantina da Maria" /></div>
              </>
            )}
            <div><Label>Email</Label><Input data-testid="owner-login-email-input" type="email" className="mt-1.5" value={form.email} onChange={set("email")} required placeholder="voce@email.com" /></div>
            <div><Label>Senha</Label><Input data-testid="owner-login-password-input" type="password" className="mt-1.5" value={form.password} onChange={set("password")} required placeholder="••••••••" /></div>
          </div>

          <Button type="submit" data-testid="owner-login-submit-button" disabled={loading} className="w-full mt-6 h-11 bg-terracotta hover:bg-terracotta-dark text-white rounded-full">
            {loading ? <Loader2 className="animate-spin" size={18} /> : isLogin ? "Entrar" : "Criar conta"}
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-5">
            {isLogin ? "Ainda não tem conta? " : "Já tem conta? "}
            <Link to={isLogin ? "/cadastrar" : "/entrar"} className="text-terracotta font-semibold">{isLogin ? "Cadastre-se" : "Entrar"}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
