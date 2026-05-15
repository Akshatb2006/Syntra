import "./globals.css";
import type { ReactNode } from "react";
import { Nav, Footer } from "@/components/Nav";

// Intentionally minimal metadata — the agent should improve this.
export const metadata = {
  title: "Bangalore Homes",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
