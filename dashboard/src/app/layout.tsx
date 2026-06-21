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
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('syntra-theme')==='dark'?'dark':'light'}catch{document.documentElement.dataset.theme='light'}",
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
