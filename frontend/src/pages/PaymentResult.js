import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, Utensils } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function PaymentResult({ status }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState(status === "cancel" ? "cancel" : "checking");
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (status === "cancel" || !sessionId) return;
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") { setState("success"); setPlan(data.plan); return; }
        if (data.status === "expired" || tries > 10) { setState("error"); return; }
      } catch { if (tries > 10) { setState("error"); return; } }
      setTimeout(poll, 2000);
    };
    poll();
  }, [sessionId, status]);

  const planNames = { simples: "Simples", intermediario: "Intermediário", avancado: "Avançado" };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <div className="bg-card rounded-3xl border border-border p-10 max-w-md w-full text-center">
        <Link to="/painel" className="flex items-center justify-center gap-2 font-heading font-extrabold text-terracotta mb-8"><Utensils size={20} /> PratoDigital</Link>
        {state === "checking" && (<><Loader2 className="animate-spin text-terracotta mx-auto mb-4" size={48} /><h1 className="text-xl font-bold font-heading">Confirmando seu pagamento...</h1><p className="text-muted-foreground text-sm mt-2">Aguarde um instante.</p></>)}
        {state === "success" && (<><div className="w-16 h-16 rounded-full bg-olive text-white grid place-items-center mx-auto mb-4"><CheckCircle2 size={36} /></div><h1 className="text-2xl font-bold font-heading">Assinatura ativada!</h1><p className="text-muted-foreground mt-2">Seu plano <b>{planNames[plan] || ""}</b> está ativo. Obrigado!</p><Button onClick={() => nav("/painel/plano")} className="mt-6 rounded-full bg-terracotta hover:bg-terracotta-dark text-white" data-testid="payment-back-button">Voltar ao painel</Button></>)}
        {state === "cancel" && (<><div className="w-16 h-16 rounded-full bg-muted text-muted-foreground grid place-items-center mx-auto mb-4"><XCircle size={36} /></div><h1 className="text-2xl font-bold font-heading">Pagamento cancelado</h1><p className="text-muted-foreground mt-2">Nenhuma cobrança foi feita. Você pode tentar novamente quando quiser.</p><Button onClick={() => nav("/painel/plano")} variant="outline" className="mt-6 rounded-full" data-testid="payment-back-button">Voltar aos planos</Button></>)}
        {state === "error" && (<><div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto mb-4"><XCircle size={36} /></div><h1 className="text-2xl font-bold font-heading">Não foi possível confirmar</h1><p className="text-muted-foreground mt-2">Se o valor foi debitado, entre em contato. Tente novamente pelo painel.</p><Button onClick={() => nav("/painel/plano")} variant="outline" className="mt-6 rounded-full" data-testid="payment-back-button">Voltar aos planos</Button></>)}
      </div>
    </div>
  );
}
