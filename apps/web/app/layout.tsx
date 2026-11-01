import type { ReactNode } from "react";
import { Providers } from "./providers";
import "@nb-hub/ui/styles/globals.css";

export const metadata = { title: "nb-hub" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
