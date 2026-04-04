import { createBrowserRouter } from "react-router";
import AnkiLayout from "./layouts/AnkiLayout";
import BlogLayout from "./layouts/BlogLayout";
import TodoListLayout from "./layouts/TodoListLayout";

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
    {
      path: "anki",
      Component: AnkiLayout,
      children: [
        {
          index: true,
          lazy: async () => ({
            Component: (await import("./pages/AnkiPage")).default,
          }),
        },
      ],
    },
    {
      path: "todolist",
      Component: TodoListLayout,
      children: [
        {
          index: true,
          lazy: async () => ({
            Component: (await import("./pages/TodoListPage")).default,
          }),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
