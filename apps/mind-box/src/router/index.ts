import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    /** 博客：带顶栏、页脚 */
    {
      path: "/",
      component: () => import("../layouts/BlogLayout.vue"),
      children: [
        {
          path: "",
          name: "home",
          component: () => import("../views/HomeView.vue"),
        },
        {
          path: "posts/:slug",
          name: "post",
          component: () => import("../views/PostView.vue"),
          props: true,
        },
        {
          path: ":pathMatch(.*)*",
          name: "not-found",
          component: () => import("../views/NotFoundView.vue"),
        },
      ],
    },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (to.name === "home" && (to.hash === "#about" || to.hash === "#posts")) {
      return { top: 0, behavior: "smooth" };
    }
    if (to.hash) {
      return { el: to.hash, behavior: "smooth" };
    }
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0 };
  },
});

export default router;
