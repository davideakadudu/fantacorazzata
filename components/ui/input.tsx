import * as React from "react";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Inp({ className="", ...props}, ref){
  return <input ref={ref} className={`h-9 px-3 border rounded-md w-full ${className}`} {...props} />;
});
