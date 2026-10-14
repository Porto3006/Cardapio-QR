import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ImagePlus, Loader2, UtensilsCrossed } from "lucide-react";
import { api, API, BRL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const imgUrl = (p) => (!p ? null : p.startsWith("http") ? p : `${API}/files/${p}`);

export default function MenuManager() {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [dialog, setDialog] = useState(null);

  const load = () => Promise.all([api.get("/categories"), api.get("/items")]).then(([c, i]) => { setCats(c.data); setItems(i.data); });
  useEffect(() => { load(); }, []);

  const addCat = async () => {
    if (!newCat.trim()) return;
    await api.post("/categories", { name: newCat });
    setNewCat(""); toast.success("Categoria adicionada"); load();
  };
  const delCat = async (id) => { await api.delete(`/categories/${id}`); toast.success("Categoria removida"); load(); };
  const delItem = async (id) => { await api.delete(`/items/${id}`); toast.success("Item removido"); load(); };

  return (
    <div className="animate-float-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold font-heading">Cardápio</h1><p className="text-muted-foreground text-sm mt-1">Organize categorias e pratos.</p></div>
        <Button data-testid="menu-add-item-button" onClick={() => cats.length ? setDialog({ category_id: cats[0].id, name: "", description: "", price: "", image_path: "", available: true }) : toast.error("Crie uma categoria primeiro")} className="bg-terracotta hover:bg-terracotta-dark text-white rounded-full"><Plus size={18} className="mr-1" /> Novo prato</Button>
      </div>

      <div className="mt-6 flex gap-2 max-w-md">
        <Input data-testid="menu-add-category-input" placeholder="Nova categoria (ex: Sobremesas)" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} />
        <Button data-testid="menu-add-category-button" onClick={addCat} variant="outline"><Plus size={18} /></Button>
      </div>

      {cats.length === 0 && <div className="mt-10 text-center text-muted-foreground"><UtensilsCrossed className="mx-auto mb-3 opacity-40" size={40} /><p>Nenhuma categoria ainda. Crie a primeira acima.</p></div>}

      <div className="mt-8 space-y-8">
        {cats.map((c) => (
          <div key={c.id}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-lg">{c.name}</h3>
              <button data-testid={`category-delete-${c.id}`} onClick={() => delCat(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.filter((i) => i.category_id === c.id).map((i) => (
                <div key={i.id} data-testid={`menu-item-${i.id}`} className="bg-card rounded-2xl border border-border overflow-hidden flex">
                  {imgUrl(i.image_path) ? <img src={imgUrl(i.image_path)} alt={i.name} className="w-24 h-full object-cover" /> : <div className="w-24 bg-secondary grid place-items-center text-muted-foreground"><ImagePlus size={20} /></div>}
                  <div className="p-3 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-sm truncate">{i.name}</p>
                      <div className="flex gap-1 shrink-0">
                        <button data-testid={`item-edit-${i.id}`} onClick={() => setDialog({ ...i, price: String(i.price) })} className="text-muted-foreground hover:text-terracotta"><Pencil size={14} /></button>
                        <button data-testid={`item-delete-${i.id}`} onClick={() => delItem(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{i.description}</p>
                    <p className="text-terracotta font-bold text-sm mt-1">{BRL(i.price)}{!i.available && <span className="ml-2 text-xs text-destructive font-normal">Esgotado</span>}</p>
                  </div>
                </div>
              ))}
              {items.filter((i) => i.category_id === c.id).length === 0 && <p className="text-sm text-muted-foreground">Sem itens nesta categoria.</p>}
            </div>
          </div>
        ))}
      </div>

      {dialog && <ItemDialog data={dialog} cats={cats} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
    </div>
  );
}

function ItemDialog({ data, cats, onClose, onSaved }) {
  const [f, setF] = useState(data);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const isEdit = !!f.id;
  const set = (k, v) => setF({ ...f, [k]: v });

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      set("image_path", data.path); toast.success("Foto enviada");
    } catch { toast.error("Erro ao enviar foto"); } finally { setUploading(false); }
  };

  const save = async () => {
    if (!f.name || !f.price) return toast.error("Preencha nome e preço");
    setSaving(true);
    const payload = { category_id: f.category_id, name: f.name, description: f.description || "", price: parseFloat(f.price), image_path: f.image_path || null, available: f.available };
    try {
      if (isEdit) await api.put(`/items/${f.id}`, payload); else await api.post("/items", payload);
      toast.success(isEdit ? "Prato atualizado" : "Prato adicionado"); onSaved();
    } catch { toast.error("Erro ao salvar"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Editar prato" : "Novo prato"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Categoria</Label>
            <Select value={f.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger data-testid="item-category-select" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Nome</Label><Input data-testid="item-name-input" className="mt-1.5" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea data-testid="item-desc-input" className="mt-1.5" value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} /></div>
          <div><Label>Preço (R$)</Label><Input data-testid="item-price-input" type="number" step="0.01" className="mt-1.5" value={f.price} onChange={(e) => set("price", e.target.value)} /></div>
          <div>
            <Label>Foto</Label>
            <div className="mt-1.5 flex items-center gap-3">
              {imgUrl(f.image_path) && <img src={imgUrl(f.image_path)} alt="" className="w-14 h-14 rounded-lg object-cover" />}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
              <Button type="button" variant="outline" data-testid="item-upload-button" onClick={() => fileRef.current.click()} disabled={uploading}>{uploading ? <Loader2 className="animate-spin" size={16} /> : <ImagePlus size={16} className="mr-1" />} Enviar foto</Button>
            </div>
          </div>
          <div className="flex items-center justify-between"><Label>Disponível</Label><Switch checked={f.available} onCheckedChange={(v) => set("available", v)} data-testid="item-available-toggle" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button data-testid="item-save-button" onClick={save} disabled={saving} className="bg-terracotta hover:bg-terracotta-dark text-white">{saving ? <Loader2 className="animate-spin" size={16} /> : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
