import "./globals.css";
import type { ReactNode } from "react";
import { AppHeader } from "@/ui/components/AppHeader";

export const metadata = {
  title: "Syntra",
  description:
    "Syntra — the autonomous, multi-agent SEO engineer that ships pull requests for sites in any industry.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Warm the font origins early so the @import in globals.css resolves
            without a late connection cost (Lighthouse: render-blocking fonts). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;450;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            // Pre-paint theme resolution (no flash): a saved choice wins,
            // otherwise default to light — we intentionally ignore the OS
            // preference so first-time visitors always land on the light theme.
            __html:
              "try{var t=localStorage.getItem('syntra-theme');if(t!=='dark'&&t!=='light'){t='light'}document.documentElement.dataset.theme=t}catch{document.documentElement.dataset.theme='light'}",
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
