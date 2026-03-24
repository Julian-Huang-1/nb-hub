<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { site } from '../site'
import { posts } from '../data/posts'
import { formatDate } from '../utils/format'
</script>

<template>
  <main class="main">
    <section class="intro" id="about" aria-labelledby="intro-heading">
      <h1 id="intro-heading" class="intro__heading">你好，我是 {{ site.author }}</h1>
      <p class="intro__text">
        这里是我整理文字的地方：技术笔记、读书摘要与日常随想都会放在同一屋檐下。你可以在下方浏览近期文章，或修改
        <code>src/site.ts</code> 与 <code>src/data/posts.ts</code>，把它变成完全属于你的博客。
      </p>
    </section>

    <section class="posts" aria-labelledby="posts-heading">
      <h2 id="posts-heading" class="posts__title">近期文章</h2>
      <ul class="post-list">
        <li v-for="post in posts" :key="post.slug">
          <article class="post-card">
            <time class="post-card__date" :datetime="post.date">{{ formatDate(post.date) }}</time>
            <h3 class="post-card__title">
              <RouterLink class="post-card__link" :to="{ name: 'post', params: { slug: post.slug } }">
                {{ post.title }}
              </RouterLink>
            </h3>
            <p class="post-card__excerpt">{{ post.excerpt }}</p>
            <ul class="post-card__tags" aria-label="标签">
              <li v-for="tag in post.tags" :key="tag" class="post-card__tag">{{ tag }}</li>
            </ul>
          </article>
        </li>
      </ul>
    </section>
  </main>
</template>
