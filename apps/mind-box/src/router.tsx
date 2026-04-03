import { createBrowserRouter } from "react-router";
import BlogLayout from "./layouts/BlogLayout";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: BlogLayout,
      children: [
        {
          index: true,
          lazy: async () => ({
            Component: (await import("./pages/HomePage")).default,
          }),
        },
        {
          path: "posts/:slug",
          lazy: async () => ({
            Component: (await import("./pages/PostPage")).default,
          }),
        },
        {
          path: "*",
          lazy: async () => ({
            Component: (await import("./pages/NotFoundPage")).default,
          }),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
