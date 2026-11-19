import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountView } from "@nb-hub/views/account";
import { createAuthClient } from "@nb-hub/core/auth";
import "@nb-hub/ui/styles/globals.css";

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [auth] = useState(() =>
    createAuthClient(window.nbHub.apiUrl, {
      mode: "bearer",
      storage: window.nbHub.authStorage,
      subscribeActivity: (listener) => {
        window.addEventListener("focus", listener);
        return () => window.removeEventListener("focus", listener);
      },
    }),
  );
  const [router] = useState(() =>
    createMemoryRouter([
      { path: "/", element: <AccountView client={auth} apiUrl={window.nbHub.apiUrl} /> },
    ]),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
