import { useState } from "react";
import { toast } from "sonner";
import { Download, Printer, QrCode as QrIcon, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function QRCodes({ rest }) {
  const [table, setTable] = useState("Mesa 01");
  const slug = rest?.slug || "";
  const menuUrl = `${window.location.origin}/menu/${slug}?mesa=${encodeURIComponent(table)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=1A1817&bgcolor=FFFFFF&data=${encodeURIComponent(menuUrl)}`;

  const download = () => {
    const a = document.createElement("a"); a.href = qrSrc + "&download=1"; a.download = `qrcode-${table}.png`; a.target = "_blank"; a.click();
  };
  const copy = () => { navigator.clipboard.writeText(menuUrl); toast.success("Link copiado!"); };
  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>QR ${table}</title><style>body{font-family:sans-serif;text-align:center;padding:40px}h1{margin:0}img{margin:20px 0}</style></head><body><h1>${rest?.name || ""}</h1><h2>${table}</h2><img src="${qrSrc}"/><p>Escaneie para ver o cardápio e fazer seu pedido</p><script>setTimeout(()=>window.print(),500)</script></body></html>`);
    w.document.close();
  };

  const presets = ["Mesa 01", "Mesa 02", "Mesa 03", "Balcão", "Delivery"];

  return (
    <div className="animate-float-up">
      <h1 className="text-2xl font-bold font-heading">QR Code & Mesas</h1>
      <p className="text-muted-foreground text-sm mt-1">Gere o QR Code de cada mesa. O cliente escaneia e já faz o pedido.</p>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="bg-card rounded-2xl border border-border p-6">
          <Label>Nome da mesa / área</Label>
          <Input data-testid="qr-generate-table-input" className="mt-1.5" value={table} onChange={(e) => setTable(e.target.value)} placeholder="Ex: Mesa 05" />
          <div className="flex flex-wrap gap-2 mt-3">{presets.map((p) => <button key={p} data-testid={`qr-preset-${p}`} onClick={() => setTable(p)} className={`text-xs px-3 py-1.5 rounded-full border ${table === p ? "bg-terracotta text-white border-terracotta" : "border-border"}`}>{p}</button>)}</div>
          <div className="mt-5 p-3 bg-secondary rounded-xl flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-muted-foreground">{menuUrl}</span>
            <button onClick={copy} data-testid="qr-copy-link" className="text-terracotta shrink-0"><Copy size={16} /></button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center">
          <div className="p-4 bg-white rounded-2xl border border-border"><img src={qrSrc} alt="QR Code" data-testid="qr-image" className="w-52 h-52" /></div>
          <p className="font-heading font-bold mt-3">{table}</p>
          <div className="flex gap-2 mt-4">
            <Button onClick={download} data-testid="qr-download-button" variant="outline"><Download size={16} className="mr-1" /> Baixar</Button>
            <Button onClick={print} data-testid="qr-print-button" className="bg-terracotta hover:bg-terracotta-dark text-white"><Printer size={16} className="mr-1" /> Imprimir</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
