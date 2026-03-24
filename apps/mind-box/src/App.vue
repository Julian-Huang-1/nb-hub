<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { site } from './site'
</script>

<template>
  <div class="blog">
    <header class="site-header">
      <div class="site-header__inner">
        <RouterLink class="brand" :to="{ name: 'home' }">
          <span class="brand__title">{{ site.title }}</span>
          <span class="brand__tagline">{{ site.tagline }}</span>
        </RouterLink>
        <nav class="nav" aria-label="主导航">
          <RouterLink class="nav__link" :to="{ name: 'home' }">文章</RouterLink>
          <RouterLink class="nav__link" :to="{ path: '/', hash: '#about' }">关于</RouterLink>
        </nav>
      </div>
    </header>

    <RouterView />

    <footer class="site-footer">
      <p class="site-footer__copy">
        © {{ new Date().getFullYear() }} {{ site.title }} · 以文字对抗遗忘
      </p>
    </footer>
  </div>
</template>
