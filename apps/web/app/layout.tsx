import type { ReactNode } from "react";
import { WebProviders } from "@/components/web-providers";
import "@nb-hub/ui/styles/globals.css";

export const metadata = { title: "nb-hub" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebProviders>{children}</WebProviders>
      </body>
    </html>
  );
}
