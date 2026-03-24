<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { site } from '../site'
import { posts } from '../data/posts'
import { formatDate } from '../utils/format'

const route = useRoute()

/** #about → 仅关于；其余（含无 hash、#posts）→ 仅文章列表 */
const showAbout = computed(() => route.hash === '#about')
const showPosts = computed(() => route.hash !== '#about')
</script>

<template>
  <main class="main">
    <section
      v-show="showAbout"
      class="intro"
      id="about"
      aria-labelledby="intro-heading"
    >
      <h1 id="intro-heading" class="intro__heading">
        Hi~ 我是 {{ site.author }}
      </h1>
      <p class="intro__text">
        我把这里当作一间朝北的小书房：窗台上不一定有名贵花草，但总有没读完的书、没写完的句子，和偶尔从生活里捡回来的光。路上遇见的云、旧诗里的一句、深夜突然想明白的事，都会慢慢落成字。
      </p>
      <p class="intro__text intro__text--second">
        若你也相信日子值得被轻轻记下，可点导航里的「文章」——愿那些字像一张便签纸，递到你手里时，还带着一点远方的风。
      </p>
    </section>

    <section
      v-show="showPosts"
      id="posts"
      class="posts"
      aria-labelledby="posts-heading"
    >
      <h2 id="posts-heading" class="posts__title">近期文章</h2>
      <ul class="post-list">
        <li v-for="post in posts" :key="post.slug">
          <article class="post-card">
            <time class="post-card__date" :datetime="post.date">{{
              formatDate(post.date)
            }}</time>
            <h3 class="post-card__title">
              <RouterLink
                class="post-card__link"
                :to="{ name: 'post', params: { slug: post.slug } }"
              >
                {{ post.title }}
              </RouterLink>
            </h3>
            <p class="post-card__excerpt">{{ post.excerpt }}</p>
            <ul class="post-card__tags" aria-label="标签">
              <li v-for="tag in post.tags" :key="tag" class="post-card__tag">
                {{ tag }}
              </li>
            </ul>
          </article>
        </li>
      </ul>
    </section>
  </main>
</template>
