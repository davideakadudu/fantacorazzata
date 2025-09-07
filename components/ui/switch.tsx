
import * as React from "react";
type Props = { checked?: boolean; onCheckedChange?: (v:boolean)=>void } & Omit<React.HTMLAttributes<HTMLButtonElement>,"onChange">;
export function Switch({ checked=false, onCheckedChange, className="", ...rest}: Props){
  return (
    <button role="switch" aria-checked={checked} onClick={()=> onCheckedChange && onCheckedChange(!checked)}
      className={`inline-flex h-5 w-9 items-center rounded-full border transition ${checked? "bg-emerald-500 border-emerald-600":"bg-slate-200 border-slate-300"} ${className}`} {...rest}>
      <span className={`h-4 w-4 bg-white rounded-full shadow transform transition ${checked? "translate-x-4":"translate-x-0.5"}`} />
    </button>
  );
}
