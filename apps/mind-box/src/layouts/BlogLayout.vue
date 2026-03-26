<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { site } from "../site";

const route = useRoute();

const navPostsActive = computed(
  () =>
    (route.name === "home" && route.hash !== "#about") || route.name === "post",
);

const navAboutActive = computed(
  () => route.name === "home" && route.hash === "#about",
);
</script>

<template>
  <div class="blog">
    <header class="site-header">
      <div class="site-header__inner">
        <RouterLink class="brand" :to="{ name: 'home', hash: '#posts' }">
          <span class="brand__title">{{ site.title }}</span>
          <span class="brand__tagline">{{ site.tagline }}</span>
        </RouterLink>
        <nav class="nav" aria-label="主导航">
          <RouterLink
            class="nav__link"
            :class="{ 'nav__link--active': navPostsActive }"
            :to="{ name: 'home', hash: '#posts' }"
          >
            文章
          </RouterLink>
          <RouterLink
            class="nav__link"
            :class="{ 'nav__link--active': navAboutActive }"
            :to="{ name: 'home', hash: '#about' }"
          >
            关于
          </RouterLink>
        </nav>
      </div>
    </header>

    <RouterView />

    <footer class="site-footer">
      <p class="site-footer__copy">
        © {{ new Date().getFullYear() }} {{ site.title }} · 以文字对抗遗忘~
      </p>
    </footer>
  </div>
</template>
