import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      {hint && <div className="form-hint">{hint}</div>}
      {children}
    </div>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`form-input ${className}`} {...props} />;
}
