import "./globals.css";
import type { ReactNode } from "react";
import { AppHeader } from "@/ui/components/AppHeader";

export const metadata = {
  title: "Syntra",
  description:
    "Syntra multi-agent SEO/growth pipeline for real-estate websites.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('syntra-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}",
          }}
        />
        <div className="app">
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
