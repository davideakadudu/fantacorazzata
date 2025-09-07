import * as React from "react";
export function Label({ className="", children, ...props}: React.LabelHTMLAttributes<HTMLLabelElement>){
  return <label className={`text-sm font-medium ${className}`} {...props}>{children}</label>;
}
