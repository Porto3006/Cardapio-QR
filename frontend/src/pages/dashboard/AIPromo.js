import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Sparkles, Copy, Send, Loader2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const PRESETS = ["Cupom Sextou", "Happy Hour 2x1", "Lançamento de Prato", "Combo do Dia", "Fim de Semana Especial"];

export default function AIPromo() {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [details, setDetails] = useState("");
  const [tone, setTone] = useState("amigável e animado");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [customers, setCustomers] = useState(0);

  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data.length)); }, []);

  const generate = async () => {
    setLoading(true); setMessage("");
    try {
      const { data } = await api.post("/ai/promo", { preset, details, tone });
      setMessage(data.message);
      toast.success("Mensagem gerada pela IA!");
    } catch { toast.error("Erro ao gerar mensagem"); } finally { setLoading(false); }
  };
  const copy = () => { navigator.clipboard.writeText(message); toast.success("Copiado!"); };
  const send = async () => {
    setSending(true);
    try { const { data } = await api.post("/ai/promo/send", { message }); toast.success(`Promoção registrada para ${data.recipients} cliente(s).`); }
    catch { toast.error("Erro ao enviar"); } finally { setSending(false); }
  };

  return (
    <div className="animate-float-up">
      <div className="flex items-center gap-2"><Sparkles className="text-terracotta" /><h1 className="text-2xl font-bold font-heading">Promoções com IA</h1></div>
      <p className="text-muted-foreground text-sm mt-1">A inteligência artificial escreve a mensagem de promoção para seus clientes cadastrados.</p>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div><Label>Tipo de promoção</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger data-testid="ai-promo-prompt-select" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{PRESETS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Detalhes (opcional)</Label><Input data-testid="ai-promo-details" className="mt-1.5" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Ex: 20% off em pizzas até sexta" /></div>
          <div><Label>Tom da mensagem</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger data-testid="ai-promo-tone" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amigável e animado">Amigável e animado</SelectItem>
                <SelectItem value="elegante e sofisticado">Elegante e sofisticado</SelectItem>
                <SelectItem value="divertido e descontraído">Divertido e descontraído</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={loading} data-testid="ai-promo-generate-button" className="w-full bg-terracotta hover:bg-terracotta-dark text-white rounded-full">{loading ? <Loader2 className="animate-spin" size={18} /> : <><Sparkles size={18} className="mr-1" /> Gerar mensagem</>}</Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
          <Label>Mensagem gerada</Label>
          <Textarea data-testid="ai-promo-result" className="mt-1.5 flex-1 min-h-40 resize-none" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A mensagem aparecerá aqui..." />
          <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Users size={14} /> {customers} cliente(s) cadastrado(s)</span></div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" onClick={copy} disabled={!message} data-testid="ai-promo-copy-button" className="flex-1"><Copy size={16} className="mr-1" /> Copiar</Button>
            <Button onClick={send} disabled={!message || sending} data-testid="ai-promo-send-button" className="flex-1 bg-olive hover:bg-olive/90 text-white">{sending ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} className="mr-1" /> Disparar</>}</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">O disparo registra a campanha. O envio real por WhatsApp/SMS pode ser conectado depois.</p>
        </div>
      </div>
    </div>
  );
}
