import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Printer, ChefHat, RefreshCw } from "lucide-react";
import { api, BRL } from "@/lib/api";
import { Button } from "@/components/ui/button";

const COLS = [
  { key: "novo", title: "Novos", color: "border-blue-500", badge: "bg-blue-500", next: "preparo", nextLabel: "Iniciar preparo" },
  { key: "preparo", title: "Em Preparo", color: "border-amber-500", badge: "bg-amber-500", next: "pronto", nextLabel: "Marcar pronto" },
  { key: "pronto", title: "Prontos", color: "border-green-600", badge: "bg-green-600", next: null },
];

export default function KitchenBoard() {
  const [orders, setOrders] = useState([]);
  const load = useCallback(() => api.get("/orders").then((r) => setOrders(r.data)), []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const changeStatus = async (o, status) => {
    await api.patch(`/orders/${o.id}/status?status=${status}`);
    toast.success(`Pedido atualizado`);
    load();
  };

  const printReceipt = (o) => {
    const w = window.open("", "_blank", "width=320,height=600");
    const rows = o.items.map((i) => `<tr><td>${i.qty}x ${i.name}</td><td style="text-align:right">${BRL(i.price * i.qty)}</td></tr>`).join("");
    w.document.write(`<html><head><title>Comprovante</title><style>body{font-family:monospace;padding:12px;width:280px}h2{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000}table{width:100%;font-size:13px}.tot{font-weight:bold;font-size:15px}</style></head><body>
      <h2>Sabor & Arte</h2><p style="text-align:center;margin:0">Comprovante de Pedido</p><hr/>
      <p>${o.table}<br/>Cliente: ${o.customer_name}</p><hr/>
      <table>${rows}</table><hr/>
      <table><tr class="tot"><td>TOTAL</td><td style="text-align:right">${BRL(o.total)}</td></tr></table>
      ${o.note ? `<hr/><p>Obs: ${o.note}</p>` : ""}<hr/><p style="text-align:center">Obrigado!</p>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="animate-float-up">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold font-heading">Cozinha ao Vivo</h1><p className="text-muted-foreground text-sm mt-1">Pedidos atualizam automaticamente.</p></div>
        <Button variant="outline" size="sm" onClick={load} data-testid="kitchen-refresh"><RefreshCw size={16} className="mr-1" /> Atualizar</Button></div>

      <div className="grid md:grid-cols-3 gap-5 mt-6">
        {COLS.map((col) => {
          const list = orders.filter((o) => o.status === col.key);
          return (
            <div key={col.key} data-testid={`kitchen-col-${col.key}`}>
              <div className="flex items-center gap-2 mb-3"><span className={`w-2.5 h-2.5 rounded-full ${col.badge}`} /><h3 className="font-heading font-bold">{col.title}</h3><span className="text-sm text-muted-foreground">({list.length})</span></div>
              <div className="space-y-3">
                {list.length === 0 && <p className="text-sm text-muted-foreground px-1">Nenhum pedido.</p>}
                {list.map((o) => (
                  <div key={o.id} data-testid={`order-card-${o.id}`} className={`bg-card rounded-2xl border-l-4 ${col.color} border border-border p-4 shadow-sm`}>
                    <div className="flex items-center justify-between"><p className="font-bold">{o.table}</p><p className="text-terracotta font-bold">{BRL(o.total)}</p></div>
                    <p className="text-sm text-muted-foreground">{o.customer_name}</p>
                    <ul className="mt-2 text-sm space-y-0.5">{o.items.map((i, idx) => <li key={idx}>{i.qty}x {i.name}</li>)}</ul>
                    {o.note && <p className="text-xs mt-2 bg-amber-50 text-amber-800 px-2 py-1 rounded">Obs: {o.note}</p>}
                    <div className="flex gap-2 mt-3">
                      {col.next && <Button size="sm" data-testid={`kitchen-order-status-change-${o.id}`} onClick={() => changeStatus(o, col.next)} className="flex-1 bg-olive hover:bg-olive/90 text-white rounded-full">{col.nextLabel}</Button>}
                      <Button size="sm" variant="outline" data-testid={`kitchen-print-receipt-${o.id}`} onClick={() => printReceipt(o)}><Printer size={16} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
