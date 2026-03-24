<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="main not-found">
    <h1 class="not-found__title">页面不存在</h1>
    <p class="not-found__text">链接可能已失效，或地址输入有误。</p>
    <RouterLink class="post-article__more" :to="{ name: 'home' }">返回首页</RouterLink>
  </main>
</template>
