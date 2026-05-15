import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sug-card ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '14px 20px',
      fontSize: '13px',
      fontWeight: 500,
      color: 'var(--fg)',
    }}>
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div style={{ padding: '20px' }} className={className}>{children}</div>;
}
