<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getPostBySlug } from '../data/posts'
import { formatDate } from '../utils/format'

const props = defineProps<{
  slug: string
}>()

const router = useRouter()

const post = computed(() => getPostBySlug(props.slug))

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'home' })
  }
}
</script>

<template>
  <main v-if="post" class="main post-view">
    <nav class="post-nav" aria-label="文章导航">
      <button type="button" class="post-back" @click="goBack">← 返回</button>
      <RouterLink class="post-nav__home" :to="{ name: 'home' }">全部文章</RouterLink>
    </nav>

    <article class="post-article" :aria-labelledby="'post-title-' + post.slug">
      <header class="post-article__header">
        <time class="post-article__date" :datetime="post.date">{{ formatDate(post.date) }}</time>
        <h1 :id="'post-title-' + post.slug" class="post-article__title">{{ post.title }}</h1>
        <ul class="post-article__tags" aria-label="标签">
          <li v-for="tag in post.tags" :key="tag" class="post-card__tag">{{ tag }}</li>
        </ul>
      </header>
      <div class="post-article__body">
        <p v-for="(para, i) in post.body" :key="i" class="post-article__para">{{ para }}</p>
      </div>
    </article>

    <footer class="post-article__footer">
      <RouterLink class="post-article__more" :to="{ name: 'home' }">← 回到首页</RouterLink>
    </footer>
  </main>

  <main v-else class="main post-view post-view--empty">
    <p class="post-missing">找不到这篇文章。</p>
    <RouterLink class="post-article__more" :to="{ name: 'home' }">返回首页</RouterLink>
  </main>
</template>
