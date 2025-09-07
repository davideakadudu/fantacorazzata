import * as React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "ghost"; size?: "sm" | "icon"; };
export const Button = React.forwardRef<HTMLButtonElement, Props>(function Btn({ className="", variant="default", size, children, ...props}, ref){
  const base = "inline-flex items-center justify-center border rounded-md font-medium transition";
  const variants = {
    default: "bg-black text-white border-black hover:opacity-90",
    secondary: "bg-slate-100 text-slate-900 border-slate-200 hover:bg-slate-200",
    ghost: "bg-transparent text-current border-transparent hover:bg-slate-100"
  } as const;
  const sizes = { sm: "h-8 px-2 text-sm", icon: "h-8 w-8 p-0" } as const;
  const sz = size ? sizes[size] : "h-9 px-3";
  return <button ref={ref} className={`${base} ${variants[variant]} ${sz} ${className}`} {...props}>{children}</button>;
});
