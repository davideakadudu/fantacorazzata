
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, Upload, Plus, Trash2, Save, RefreshCw, Users, Target, Wallet,
  Calculator, Database, Image as ImageIcon, X, Search, Star, StarOff
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

/* ------------------------------------------------------
   Fantacazzo – Asta Assistant v0.6.9 (deploy)
------------------------------------------------------ */

const ROLES = ["G", "D", "C", "A"] as const;
type Role = typeof ROLES[number];
const ROLE_INDEX: Record<Role, number> = { G: 0, D: 1, C: 2, A: 3 } as const;

const EXCEL_TIERS = [
  "Top","Semitop","Sotto ai semitop","Fascia alta","Fascia media","Scommesse",
  "Jolly prima fascia","Sopra ai low cost","Low cost prima fascia","Jolly seconda fascia",
  "Low cost seconda fascia","Jolly terza fascia","Leghe numerose","Jolly quarta fascia","A rischio","Da evitare"
] as const;
type Tier = typeof EXCEL_TIERS[number];
const TIERS_ORDER_INDEX: Record<Tier, number> = EXCEL_TIERS.reduce((acc, t, i) => { (acc as any)[t] = i; return acc; }, {} as Record<Tier, number>);

type Player = { id: string; name: string; role: Role; price: number; status: "confermato" | "da_decidere" | "acquisto" };
type Settings = {
  teams: number; budgetTotal: number; roster: { G: number; D: number; C: number; A: number };
  modifiers: boolean; minBid: number; allocations: { G: number; D: number; C: number; A: number };
};
type WatchItem = {
  id: string; name: string; role: Role; tier: Tier; target: number; cap: number; priority: number; note?: string;
  status: "libero" | "preso_mio" | "preso_altro" | "saltato"; finalPrice?: number;
};

const PRESETS = {
  balanced: { G: 8, D: 25, C: 32, A: 35 },
  bomber: { G: 6, D: 22, C: 28, A: 44 },
  modDifesa: { G: 9, D: 27, C: 29, A: 35 },
  corazzata: { G: 9, D: 13, C: 29, A: 49 },
} as const;

/* ----------------- Utils ----------------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const currency = (n: number) => (!isFinite(n) ? "-" : Math.round(n).toString());
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function normalizeTier(raw: string): Tier {
  const s = String(raw || "").trim().toLowerCase();
  const map: Record<string, Tier> = {
    "top": "Top", "semi-top": "Semitop", "semitop": "Semitop", "sotto ai semitop": "Sotto ai semitop",
    "fascia alta": "Fascia alta", "fascia media": "Fascia media", "scommesse": "Scommesse", "scommessa": "Scommesse",
    "jolly prima fascia": "Jolly prima fascia", "sopra ai low cost": "Sopra ai low cost", "low cost prima fascia": "Low cost prima fascia",
    "jolly seconda fascia": "Jolly seconda fascia", "low cost seconda fascia": "Low cost seconda fascia", "jolly terza fascia": "Jolly terza fascia",
    "leghe numerose": "Leghe numerose", "jolly quarta fascia": "Jolly quarta fascia", "a rischio": "A rischio", "da evitare": "Da evitare",
  };
  if (map[s]) return map[s];
  const found = (EXCEL_TIERS as readonly string[]).find(t => t.toLowerCase() === s || s.includes(t.toLowerCase()));
  return (found as Tier) || "Fascia media";
}
function roleFromSheetName(sheetName: string): Role {
  const s = (sheetName || "").trim().toLowerCase();
  if (/^p(ortieri)?$/.test(s) || /^g$/.test(s) || /portier/.test(s) || /gk/.test(s)) return "G";
  if (/^d(ifensori)?$/.test(s) || /^d$/.test(s) || /difens/.test(s) || /\bdef\b/.test(s)) return "D";
  if (/^c(entrocampisti)?$/.test(s) || /^m$/.test(s) || /^c$/.test(s) || /centro/.test(s)) return "C";
  if (/^a(ttaccanti)?$/.test(s) || /^f(w)?$/.test(s) || /^a$/.test(s) || /attacc/.test(s) || /forward/.test(s)) return "A";
  return "C";
}

/* ----------------- Main Page ----------------- */
export default function Page() {
  const [settings, setSettings] = useState<Settings>({
    teams: 10, budgetTotal: 300, roster: { G: 3, D: 8, C: 8, A: 6 }, modifiers: true, minBid: 1, allocations: { ...PRESETS.modDifesa },
  });
  const [players, setPlayers] = useState<Player[]>([
    { id: uid(), name: "Maignan", role: "G", price: 24, status: "confermato" },
    { id: uid(), name: "N'Dicka", role: "D", price: 1, status: "confermato" },
    { id: uid(), name: "Rrahmani", role: "D", price: 4, status: "confermato" },
    { id: uid(), name: "Vlasic", role: "C", price: 8, status: "confermato" },
    { id: uid(), name: "Kean", role: "A", price: 31, status: "confermato" },
  ]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [showOpenOnly, setShowOpenOnly] = useState(true);

  // Shortlist persistente
  const [shortlist, setShortlist] = useState<WatchItem[]>(() => {
    try { if (typeof window === "undefined") return []; const raw = localStorage.getItem("fc_shortlist"); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  useEffect(() => { try { if (typeof window !== "undefined") localStorage.setItem("fc_shortlist", JSON.stringify(shortlist)); } catch {} }, [shortlist]);

  /* ------- Derived ------- */
  const myConfirmed = useMemo(() => players.filter(p => p.status !== "da_decidere"), [players]);
  const spentTotal = useMemo(() => myConfirmed.reduce((s, p) => s + p.price, 0), [myConfirmed]);
  const remainingBudget = Math.max(0, settings.budgetTotal - spentTotal);

  const countsByRole = useMemo(() => {
    const c: Record<Role, number> = { G: 0, D: 0, C: 0, A: 0 };
    myConfirmed.forEach(p => { c[p.role]++; });
    return c;
  }, [myConfirmed]);

  const remainingSlotsByRole = useMemo(() => {
    const r: Record<Role, number> = { G: 0, D: 0, C: 0, A: 0 };
    ROLES.forEach(role => { r[role] = Math.max(0, settings.roster[role] - (countsByRole[role] || 0)); });
    return r;
  }, [settings.roster, countsByRole]);

  const spentByRole = useMemo(() => {
    const r: Record<Role, number> = { G: 0, D: 0, C: 0, A: 0 };
    myConfirmed.forEach(p => { r[p.role] += p.price; });
    return r;
  }, [myConfirmed]);

  const allocationBudget = useMemo(() => {
    const r: Record<Role, number> = { G: 0, D: 0, C: 0, A: 0 };
    ROLES.forEach(role => { r[role] = (settings.allocations[role] / 100) * settings.budgetTotal; });
    return r;
  }, [settings.allocations, settings.budgetTotal]);

  const minNeededAll = useMemo(() => ROLES.reduce((s, r) => s + remainingSlotsByRole[r] * settings.minBid, 0), [remainingSlotsByRole, settings.minBid]);

  const roleGuides = useMemo(() => {
    return ROLES.map(role => {
      const slots = remainingSlotsByRole[role];
      const allocated = allocationBudget[role];
      const already = spentByRole[role];
      const roleRemainBudget = Math.max(0, allocated - already);
      const perSlotGuide = slots > 0 ? roleRemainBudget / slots : 0;
      const maxBidNow = (() => {
        if (remainingBudget <= 0 || slots <= 0) return 0;
        const othersMin = Math.max(0, minNeededAll - settings.minBid);
        return Math.max(0, remainingBudget - othersMin);
      })();
      return { role, slots, allocated, already, roleRemainBudget, perSlotGuide, maxBidNow };
    });
  }, [remainingSlotsByRole, allocationBudget, spentByRole, remainingBudget, minNeededAll, settings.minBid]);

  const roleGuideMap = useMemo(() => {
    const m: Record<Role, (typeof roleGuides)[number]> = { G: roleGuides[0], D: roleGuides[1], C: roleGuides[2], A: roleGuides[3] } as any;
    roleGuides.forEach(g => { (m as any)[g.role] = g; });
    return m;
  }, [roleGuides]);

  const demandData = useMemo(() => ROLES.map(r => ({ role: r, Tu: remainingSlotsByRole[r] })), [remainingSlotsByRole]);

  /* ------- Helpers ------- */
  function setAllo(role: Role, value: number) {
    const totalOther = ROLES.filter(r => r !== role).reduce((s, r) => s + settings.allocations[r], 0);
    const val = clamp(value, 0, 100 - totalOther);
    setSettings(s => ({ ...s, allocations: { ...s.allocations, [role]: val } }));
  }
  function applyPreset(preset: keyof typeof PRESETS) { setSettings(s => ({ ...s, allocations: { ...PRESETS[preset] } })); }

  function importLogo(file: File) { const r = new FileReader(); r.onload = () => setLogo(String(r.result || "")); r.readAsDataURL(file); }
  function clearLogo() { setLogo(null); }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ settings, players, watchlist, logo }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "fantacazzo_asta_backup.json"; a.click(); URL.revokeObjectURL(url);
  }
  function importJSON(file: File) {
    const r = new FileReader();
    r.onload = () => { try {
      const data = JSON.parse(String(r.result || "{}"));
      if (data.settings) setSettings(data.settings);
      if (data.players) setPlayers(data.players);
      if (data.watchlist) setWatchlist(data.watchlist);
      if ("logo" in data) setLogo(data.logo);
    } catch { alert("File non valido"); } };
    r.readAsText(file);
  }

  function tierMultiplier(tier: Tier) {
    const idx = TIERS_ORDER_INDEX[tier];
    const max = 1.6, min = 0.4;
    const t = idx / (EXCEL_TIERS.length - 1);
    return +(max - (max - min) * t).toFixed(2);
  }
  function suggestFor(role: Role, tier: Tier) {
    const g = roleGuideMap[role]; const base = g ? g.perSlotGuide : 0; const max = g ? g.maxBidNow : 0;
    const mult = tierMultiplier(tier);
    const target = Math.max(settings.minBid, Math.round(base * mult));
    const cap = Math.max(settings.minBid, Math.round(Math.min(max, target * (1 + Math.min(0.25, (mult-1) * 0.6)))));
    return { target, cap };
  }

  // aggiorna watchlist e shortlist insieme
  function updateWatch(id: string, patch: Partial<WatchItem>) {
    setWatchlist(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
    setShortlist(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  }
  function removeWatchItem(id: string) { setWatchlist(prev => prev.filter(w => w.id !== id)); }

  // aggiungi alla rosa e rimuovi da liste
  function addWatchItemToRoster(w: WatchItem) {
    const price = typeof w.finalPrice === "number" && isFinite(w.finalPrice) ? w.finalPrice : NaN;
    if (!price || price < settings.minBid) { alert(`Inserisci il prezzo finale (>= ${settings.minBid}) prima di cliccare "Mio".`); return; }
    setPlayers((prev: Player[]) => {
      const next: Player[] = [...prev, { id: uid(), name: w.name, role: w.role, price, status: "acquisto" }];
      next.sort((a,b)=> ROLE_INDEX[a.role]-ROLE_INDEX[b.role] || a.name.localeCompare(b.name));
      return next;
    });
    setWatchlist(prev => prev.filter(it => it.id !== w.id));
    setShortlist(prev => prev.filter(it => it.id !== w.id));
  }

  // Import Excel → Watchlist
  function importExcelToWatchlist(file: File) {
    const r = new FileReader();
    r.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      let importedAll: WatchItem[] = [];
      wb.SheetNames.forEach((sheetName) => {
        const role: Role = roleFromSheetName(sheetName);
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
        if (!rows.length) return;
        const first = rows[0] || {}; const keys = Object.keys(first);
        const nameKey = ["Nome","Giocatore","Player","NOME","Name"].find(k => k in first) || keys[0];
        const tierKey = ["Tier","Categoria","Fascia","Livello","Categoria SOS"].find(k => k in first);
        const items: WatchItem[] = rows.map((row, idx) => {
          const name = String(row[nameKey] || `Giocatore ${idx+1}`);
          const tier: Tier = normalizeTier(String(tierKey ? row[tierKey] : ""));
          const { target, cap } = suggestFor(role, tier);
          return { id: uid(), name, role, tier, target, cap, priority: 3, note: "", status: "libero" };
        });
        importedAll = importedAll.concat(items);
      });
      if (!importedAll.length) { alert("Nessuna riga trovata nei fogli"); return; }
      setWatchlist(prev => {
        const merged = [...prev];
        importedAll.forEach(it => {
          const exists = merged.some(m => m.name.toLowerCase() === it.name.toLowerCase() && m.role === it.role);
          if (!exists) merged.push(it);
        });
        merged.sort((a,b)=> ROLE_INDEX[a.role]-ROLE_INDEX[b.role] || TIERS_ORDER_INDEX[a.tier]-TIERS_ORDER_INDEX[b.tier] || a.name.localeCompare(b.name));
        return merged;
      });
      alert(`Importati ${importedAll.length} giocatori in Watchlist da ${wb.SheetNames.length} fogli`);
    };
    r.readAsArrayBuffer(file);
  }

  // Filter + Group
  const watchlistFiltered = useMemo(
    () => (showOpenOnly ? watchlist.filter(w => w.status === "libero") : watchlist),
    [watchlist, showOpenOnly]
  );
  const groupedWatchlist = useMemo(() => {
    const g: Record<Role, WatchItem[]> = { G: [], D: [], C: [], A: [] };
    watchlistFiltered.forEach(w => g[w.role].push(w));
    for (const r of ROLES) g[r].sort(
      (a,b) => TIERS_ORDER_INDEX[a.tier] - TIERS_ORDER_INDEX[b.tier] || b.priority - a.priority || a.name.localeCompare(b.name)
    );
    return g;
  }, [watchlistFiltered]);

  // Shortlist helpers
  function addToShortlist(item: WatchItem) {
    setShortlist(prev => {
      const exists = prev.some(p => p.name === item.name && p.role === item.role);
      const next = exists ? prev : [...prev, item];
      return [...next].sort((a,b) => ROLE_INDEX[a.role]-ROLE_INDEX[b.role] || TIERS_ORDER_INDEX[a.tier]-TIERS_ORDER_INDEX[b.tier] || a.name.localeCompare(b.name));
    });
  }
  function removeFromShortlist(item: WatchItem) { setShortlist(prev => prev.filter(p => !(p.name === item.name && p.role === item.role))); }

  /* ----------------- UI ----------------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Topbar */}
      <div className="sticky top-0 z-40 border-b-2 border-rose-300 bg-black/95 text-white backdrop-blur supports-[backdrop-filter]:bg-black/80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo as string} alt="Logo" className="h-12 w-auto rounded-md border border-rose-300 bg-white"/>
            ) : (
              <div className="h-12 w-12 rounded-md border border-rose-300 flex items-center justify-center text-rose-200 bg-black/50">
                <ImageIcon className="w-6 h-6"/>
              </div>
            )}
            <div className="space-y-0.5">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Fantacazzo – Asta Assistant</h1>
              <p className="text-xs md:text-sm text-rose-200">Excel multi-foglio → Watchlist • Shortlist in alto • Ricerca</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Input className="hidden" type="file" accept="image/*" onChange={(e) => e.target.files && importLogo(e.target.files[0])} />
              <div className="px-3 py-2 rounded-xl border border-rose-300 bg-rose-300 text-black hover:bg-rose-200 transition flex items-center"><ImageIcon className="w-4 h-4 mr-2"/>Logo</div>
            </label>
            {logo && <Button variant="ghost" className="rounded-xl text-white hover:bg-white/10" onClick={clearLogo} title="Rimuovi logo"><X className="w-4 h-4 mr-1"/>Rimuovi</Button>}
            <Button variant="ghost" onClick={() => { if(confirm("Sicuro di voler azzerare tutto?")) { location.reload(); } }} className="rounded-xl text-white hover:bg-white/10"><RefreshCw className="w-4 h-4 mr-2"/>Reset</Button>
            <Button variant="ghost" onClick={exportJSON} className="rounded-xl text-white hover:bg-white/10"><Download className="w-4 h-4 mr-2"/>Export</Button>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Input className="hidden" type="file" accept="application/json" onChange={(e) => e.target.files && importJSON(e.target.files[0])} />
              <div className="px-3 py-2 rounded-xl border border-rose-300 bg-rose-300 text-black hover:bg-rose-200 transition flex items-center"><Upload className="w-4 h-4 mr-2"/>Import JSON</div>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Input className="hidden" type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files && importExcelToWatchlist(e.target.files[0])} />
              <div className="px-3 py-2 rounded-xl border border-rose-300 bg-rose-300 text-black hover:bg-rose-200 transition flex items-center"><Database className="w-4 h-4 mr-2"/>Import Excel</div>
            </label>
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <Dashboard
        settings={settings}
        countsByRole={countsByRole}
        spentTotal={spentTotal}
        remainingBudget={remainingBudget}
        roleGuides={roleGuides}
        allocationBudget={allocationBudget}
        remainingSlotsByRole={remainingSlotsByRole}
        demandData={demandData}
      />

      <main className="max-w-7xl mx-auto px-4 pb-10 space-y-6">
        <LeagueSettings settings={settings} setSettings={setSettings} setAllo={setAllo} applyPreset={applyPreset} />

        <WatchlistTabs
          EXCEL_TIERS={EXCEL_TIERS}
          groupedWatchlist={groupedWatchlist}
          showOpenOnly={showOpenOnly}
          setShowOpenOnly={setShowOpenOnly}
          updateWatch={updateWatch}
          removeWatch={removeWatchItem}
          shortlist={shortlist}
          addToShortlist={addToShortlist}
          removeFromShortlist={removeFromShortlist}
          onAddToRoster={addWatchItemToRoster}
        />

        <RosterSection players={players} setPlayers={setPlayers} minBid={settings.minBid} />

        <TipsSection settings={settings} />
        <footer className="text-xs text-muted-foreground text-center">
          v0.6.9 • Deploy package
        </footer>
      </main>
    </div>
  );
}

/* ----------------- Subcomponents ----------------- */

function Dashboard({ settings, countsByRole, spentTotal, remainingBudget, roleGuides, allocationBudget, remainingSlotsByRole, demandData }: any) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Wallet className="w-5 h-5"/>Budget</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Speso: <span className="font-semibold">{currency(spentTotal)}</span> / {settings.budgetTotal}</div>
          <div>Rimanente: <span className="font-semibold">{currency(remainingBudget)}</span></div>
          <div>Slot: <span className="font-semibold">{ROLES.reduce((s,r)=>s+(countsByRole[r]||0),0)}</span> / {ROLES.reduce((s,r)=>s+settings.roster[r],0)}</div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Calculator className="w-5 h-5"/>Linee guida per ruolo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground">
            <div>Ruolo</div><div className="text-right">Budget allocato</div><div className="text-right">Per slot</div><div className="text-right">Max ora</div>
          </div>
          {roleGuides.map((g: any) => (
            <div key={g.role} className="grid grid-cols-4 gap-4 py-1 items-center text-sm">
              <div className="font-semibold">{g.role} <span className="text-xs text-muted-foreground">({settings.roster[g.role] - remainingSlotsByRole[g.role]}/{settings.roster[g.role]})</span></div>
              <div className="text-right">{currency(Math.max(0, g.roleRemainBudget))} / {currency(allocationBudget[g.role])}</div>
              <div className="text-right">{g.slots>0? currency(g.perSlotGuide): "-"}</div>
              <div className="text-right font-semibold">{currency(g.maxBidNow)}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Users className="w-5 h-5"/>Domanda residua (tu)</CardTitle></CardHeader>
        <CardContent className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demandData}>
              <XAxis dataKey="role"/>
              <YAxis allowDecimals={false}/>
              <Tooltip />
              <Bar dataKey="Tu" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function LeagueSettings({ settings, setSettings, setAllo, applyPreset }: { settings: Settings; setSettings: React.Dispatch<React.SetStateAction<Settings>>; setAllo: (r: Role, v: number)=>void; applyPreset: (p: keyof typeof PRESETS)=>void; }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Impostazioni lega</CardTitle>
        <p className="text-sm text-muted-foreground">Configura budget, slot e preset di allocazione.</p>
      </CardHeader>
      <CardContent className="grid md:grid-cols-4 gap-4">
        <div className="space-y-2"><Label>Partecipanti</Label><Input className="rounded-xl" type="number" value={settings.teams} min={2} max={20} onChange={e => setSettings((s) => ({ ...s, teams: parseInt(e.target.value||"10",10) }))} /></div>
        <div className="space-y-2"><Label>Budget totale</Label><Input className="rounded-xl" type="number" value={settings.budgetTotal} min={50} max={2000} onChange={e => setSettings((s) => ({ ...s, budgetTotal: parseInt(e.target.value||"300",10) }))} /></div>
        <div className="space-y-2"><Label>Prezzo minimo</Label><Input className="rounded-xl" type="number" value={settings.minBid} min={1} max={10} onChange={e => setSettings((s) => ({ ...s, minBid: parseInt(e.target.value||"1",10) }))} /></div>
        <div className="flex items-center gap-3 mt-6"><Switch checked={settings.modifiers} onCheckedChange={(v) => setSettings((s) => ({ ...s, modifiers: v, allocations: v ? { ...PRESETS.modDifesa } : { ...PRESETS.balanced } }))} /><span>Modificatore difesa attivo</span></div>

        <div className="md:col-span-4 grid grid-cols-4 gap-4">
          {ROLES.map(r => (
            <div key={r} className="space-y-2">
              <Label>{r} – slot: {settings.roster[r]}</Label>
              <Input className="rounded-xl" type="number" value={settings.roster[r]} min={1} max={r==="G"?4:15} onChange={e => setSettings((s) => ({ ...s, roster: { ...s.roster, [r]: parseInt(e.target.value||"0",10) } }))} />
              <div className="text-xs text-muted-foreground">Allocazione: {settings.allocations[r]}%</div>
              <input type="range" min={0} max={100} value={settings.allocations[r]} onChange={(e) => setAllo(r, parseInt(e.target.value,10))} className="w-full accent-rose-400"/>
            </div>
          ))}
        </div>

        <div className="md:col-span-4 flex gap-2 flex-wrap">
          <Button variant="secondary" className="rounded-xl" onClick={() => applyPreset("balanced")}>Preset Bilanciato</Button>
          <Button variant="secondary" className="rounded-xl" onClick={() => applyPreset("bomber")}>Preset Bomber-heavy</Button>
          <Button variant="secondary" className="rounded-xl" onClick={() => applyPreset("modDifesa")}>Preset Mod. Difesa</Button>
          <Button variant="secondary" className="rounded-xl" onClick={() => applyPreset("corazzata")}>Preset Corazzata</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WatchlistTabs({
  EXCEL_TIERS, groupedWatchlist, showOpenOnly, setShowOpenOnly,
  updateWatch, removeWatch, shortlist, addToShortlist, removeFromShortlist, onAddToRoster
}: any) {
  const safeGroup: Record<Role, WatchItem[]> = useMemo(
    () => ({ G: [], D: [], C: [], A: [], ...(groupedWatchlist || {}) }),
    [groupedWatchlist]
  );

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Role>("G");
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const firstWith = (Object.keys(safeGroup) as Role[]).find(r => safeGroup[r].some((w: any) => w.name.toLowerCase().includes(q)));
    if (firstWith) setActiveTab(firstWith);
  }, [search, safeGroup]);

  const isInShortlist = (w: WatchItem) => (shortlist || []).some((s: WatchItem) => s.name===w.name && s.role===w.role);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Watchlist & Target</CardTitle>
        <p className="text-sm text-muted-foreground">Ricerca globale + tab per ruolo (dall'Excel). Shortlist sopra.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ricerca globale + solo liberi */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label>Cerca giocatore nella watchlist</Label>
            <div className="relative">
              <Input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Digita il nome…" className="rounded-xl pr-10"/>
              <Search className="w-4 h-4 absolute right-7 top-1/2 -translate-y-1/2 opacity-60"/>
              {search && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground" onClick={()=>setSearch("")}>✕</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6"><Switch checked={showOpenOnly} onCheckedChange={(v:any)=>setShowOpenOnly(v)} /><span className="text-sm">Solo liberi</span></div>
        </div>

        {/* Shortlist in alto (no scroll) */}
        <div className="border rounded-2xl p-3">
          <div className="font-semibold mb-2">Shortlist personale</div>
          {(!shortlist || shortlist.length===0) ? (
            <div className="text-sm text-muted-foreground">Nessun giocatore selezionato. Usa la stellina per aggiungere.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  <th className="text-left p-2">Giocatore</th>
                  <th className="text-left p-2">R</th>
                  <th className="text-left p-2">Tier</th>
                  <th className="text-right p-2">Prezzo</th>
                  <th className="text-right p-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {shortlist.map((w: WatchItem, i:number) => (
                  <tr key={w.id+"sl"} className={"border-t " + (i % 2 === 1 ? "bg-muted/40" : "") }>
                    <td className="p-2 font-medium">{w.name}</td>
                    <td className="p-2">{w.role}</td>
                    <td className="p-2">{w.tier}</td>
                    <td className="p-2 text-right">
                      <Input className="text-right rounded-xl" type="number" placeholder="finale"
                        value={w.finalPrice ?? ""} onChange={(e:any)=>updateWatch(w.id,{ finalPrice: parseInt(e.target.value||'',10) || undefined })} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" className="rounded-lg" onClick={() => onAddToRoster(w)}>Mio</Button>
                        <Button size="icon" variant="ghost" onClick={() => removeFromShortlist(w)} title="Rimuovi"><Trash2 className="w-4 h-4"/></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tabs elenco Watchlist */}
        <Tabs value={activeTab} onValueChange={(v:any)=>setActiveTab(v as Role)}>
          <TabsList>
            <TabsTrigger value="G">Portieri</TabsTrigger>
            <TabsTrigger value="D">Difensori</TabsTrigger>
            <TabsTrigger value="C">Centrocampisti</TabsTrigger>
            <TabsTrigger value="A">Attaccanti</TabsTrigger>
          </TabsList>

          {ROLES.map((r) => (
            <TabsContent key={r} value={r}>
              <table className="w-full text-sm border rounded-xl overflow-hidden">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Giocatore</th>
                    <th className="text-left p-2">Tier</th>
                    <th className="text-right p-2">Target</th>
                    <th className="text-right p-2">Cap</th>
                    <th className="text-left p-2">Note</th>
                    <th className="text-right p-2">Prezzo</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {safeGroup[r]
                    .filter((w: any) => !search.trim() || w.name.toLowerCase().includes(search.trim().toLowerCase()))
                    .map((w: WatchItem, i: number) => (
                      <tr key={w.id} className={"border-t " + (i % 2 === 1 ? "bg-muted/40" : "") }>
                        <td className="p-2 font-medium">{w.name}</td>
                        <td className="p-2">{w.tier}</td>
                        <td className="p-2 text-right">{w.target}</td>
                        <td className="p-2 text-right">{w.cap}</td>
                        <td className="p-2">{w.note}</td>
                        <td className="p-2 text-right">
                          <Input className="text-right rounded-xl" type="number" placeholder="finale"
                            value={w.finalPrice ?? ""} onChange={(e: any) => updateWatch(w.id, { finalPrice: parseInt(e.target.value||'',10) || undefined })} />
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" className="rounded-lg" title={isInShortlist(w)? "Rimuovi da shortlist" : "Aggiungi a shortlist"}
                              onClick={() => isInShortlist(w) ? removeFromShortlist(w) : addToShortlist(w)}>
                              {isInShortlist(w) ? <Star className="w-4 h-4"/> : <StarOff className="w-4 h-4"/>}
                            </Button>
                            <Button size="sm" className="rounded-lg" onClick={() => onAddToRoster(w)}>Mio</Button>
                            <Button size="sm" className="rounded-lg" variant="secondary" onClick={() => updateWatch(w.id, { status: 'preso_altro' })}>Altro</Button>
                            <Button size="icon" className="rounded-lg" variant="ghost" onClick={() => updateWatch(w.id, { status: 'saltato' })} title="Salta"><Save className="w-4 h-4 rotate-90"/></Button>
                            <Button size="icon" className="rounded-lg" variant="ghost" onClick={() => removeWatch(w.id)} title="Elimina"><Trash2 className="w-4 h-4"/></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {safeGroup[r].filter((w: any) => !search.trim() || w.name.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
                    <tr><td className="p-3 text-sm text-muted-foreground" colSpan={7}>{search? "Nessun risultato nel ruolo" : "Nessun giocatore nel ruolo."}</td></tr>
                  )}
                </tbody>
              </table>
              <div className="text-xs text-muted-foreground mt-2">Ordine categoria: {EXCEL_TIERS.join(" → ")}</div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RosterSection({ players, setPlayers, minBid }: { players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; minBid: number; }) {
  const [newP, setNewP] = useState<{ name: string; role: Role; price: string; mine: boolean }>({ name: "", role: "G", price: "", mine: true });
  function addPurchase() {
    const price = parseInt(newP.price || "0", 10); if (!newP.name || !price || price < minBid) return;
    setPlayers((prev: Player[]) => {
      const next: Player[] = [...prev, { id: uid(), name: newP.name, role: newP.role, price, status: newP.mine ? "acquisto" : "confermato" }];
      next.sort((a,b)=> ROLE_INDEX[a.role]-ROLE_INDEX[b.role] || a.name.localeCompare(b.name));
      return next;
    });
    setNewP({ name: "", role: newP.role, price: "", mine: newP.mine });
  }
  function removePlayer(id: string) { setPlayers(prev => prev.filter(p => p.id !== id)); }
  function toggleDecidere(id: string) { setPlayers(prev => prev.map(p => p.id === id ? { ...p, status: p.status === "da_decidere" ? "confermato" : "da_decidere" } : p)); }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Conferme e rosa (tu)</CardTitle>
        <p className="text-sm text-muted-foreground">Non viene mai popolata dall'Excel. Aggiungi solo i tuoi acquisti.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2">Giocatore</th>
                    <th className="text-left p-2">R</th>
                    <th className="text-right p-2">Prezzo</th>
                    <th className="text-center p-2">Stato</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...players].sort((a,b)=> ROLE_INDEX[a.role]-ROLE_INDEX[b.role] || a.name.localeCompare(b.name)).map((p: Player, i: number) => (
                    <tr key={p.id} className={"border-t " + (i % 2 === 1 ? "bg-muted/40" : "") }>
                      <td className="p-2">{p.name}</td>
                      <td className="p-2">{p.role}</td>
                      <td className="p-2 text-right">{p.price}</td>
                      <td className="p-2 text-center">{p.status === "da_decidere" ? (
                        <Button size="sm" variant="secondary" className="rounded-lg" onClick={() => toggleDecidere(p.id)}>Decidi</Button>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-900">{p.status}</span>
                      )}</td>
                      <td className="p-2 text-right"><Button size="icon" variant="ghost" className="rounded-lg" onClick={() => removePlayer(p.id)}><Trash2 className="w-4 h-4"/></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4"/>Registra aggiudicazione</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input className="rounded-xl" value={newP.name} onChange={(e: any) => setNewP({ ...newP, name: e.target.value })} placeholder="Giocatore"/></div>
              <div><Label>Ruolo</Label><select className="w-full border rounded-xl h-9 px-2" value={newP.role} onChange={(e: any) => setNewP({ ...newP, role: e.target.value as Role })}>{ROLES.map((r: Role)=> <option key={r} value={r}>{r}</option>)}</select></div>
              <div><Label>Prezzo</Label><Input className="rounded-xl" type="number" min={minBid} value={newP.price} onChange={(e: any) => setNewP({ ...newP, price: e.target.value })} /></div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2"><Switch checked={newP.mine} onCheckedChange={(v: any) => setNewP({ ...newP, mine: v })} /><span className="text-sm">È un tuo acquisto</span></div>
                <Button className="ml-auto rounded-xl" onClick={addPurchase}><Save className="w-4 h-4 mr-2"/>Registra</Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Suggerimento: tieni un cuscinetto per gli ultimi slot.</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TipsSection({ settings }: { settings: Settings }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base"><Target className="w-5 h-5 inline mr-2"/>Aiuti tattici rapidi</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="space-y-2">
          <div className="font-semibold">Linee guida di spesa</div>
          <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
            <li>Portieri premium: tieni {settings.modifiers ? "8–12%" : "6–9%"} del budget.</li>
            <li>Difensori con modificatore: priorità su titolari da buon voto.</li>
            <li>Centrocampo: 2–3 slot top/medio-top, riempi il resto a 1–5.</li>
            <li>Attacco: non sforare il massimale; lascia cuscinetto per gli ultimi slot.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <div className="font-semibold">Massimali intelligenti</div>
          <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
            <li>"Max ora" presuppone il prezzo minimo {settings.minBid} sugli slot restanti.</li>
            <li>Domanda alta? +5–10% sul target dei top rimasti.</li>
            <li>Se sei avanti di budget per ruolo, puoi splafonare del +{settings.modifiers?"8":"10"}% su un obiettivo chiave.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <div className="font-semibold">Consigli live</div>
          <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
            <li>Controlla gli slot mancanti per ruolo prima di rilanciare.</li>
            <li>Se scarseggiano gli attaccanti titolari, anticipa gli acquisti.</li>
            <li>Con modificatore, il 4°-5° difensore affidabile &gt; scommessa glamour.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
