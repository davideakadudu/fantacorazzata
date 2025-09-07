import * as React from "react";
type TabsCtx = { value: string; setValue: (v:string)=>void };
const Ctx = React.createContext<TabsCtx | null>(null);
export function Tabs({ value, onValueChange, children }: { value: string; onValueChange: (v:string)=>void; children: React.ReactNode; }){
  return <Ctx.Provider value={{ value, setValue: onValueChange }}>{children}</Ctx.Provider>;
}
export function TabsList({ children }: { children: React.ReactNode }){
  return <div className="inline-flex gap-2 rounded-xl border p-1 bg-white">{children}</div>;
}
export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }){
  const ctx = React.useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button onClick={()=>ctx.setValue(value)} className={`px-3 h-8 rounded-lg text-sm border ${active? "bg-black text-white border-black":"bg-white text-black border-slate-300 hover:bg-slate-100"}`}>
      {children}
    </button>
  );
}
export function TabsContent({ value, children }: { value: string; children: React.ReactNode }){
  const ctx = React.useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className="pt-3">{children}</div>;
}
