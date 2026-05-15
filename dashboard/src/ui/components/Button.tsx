import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "dark";
}

const VARIANT_CLASS = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  dark: "btn btn-dark",
};

export function Button({ children, variant = "primary", className = "", ...props }: Props) {
  return (
    <button className={`${VARIANT_CLASS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
