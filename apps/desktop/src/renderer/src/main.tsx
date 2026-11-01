import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeView } from "@nb-hub/views/home";
import "@nb-hub/ui/styles/globals.css";

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [router] = useState(() => createMemoryRouter([
    { path: "/", element: <HomeView apiUrl={window.nbHub.apiUrl} /> },
  ]));

  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
