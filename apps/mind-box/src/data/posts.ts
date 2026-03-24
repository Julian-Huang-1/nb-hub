export interface Post {
  slug: string
  title: string
  date: string
  excerpt: string
  tags: string[]
  /** 正文段落，一段一个字符串 */
  body: string[]
}

export const posts: Post[] = [
  {
    slug: 'hello-blog',
    title: '你好，博客',
    date: '2025-03-20',
    excerpt: '这是第一篇示例文章。把这里的标题与摘要换成你自己的内容即可。',
    tags: ['随笔'],
    body: [
      '欢迎来到这个用 Vite 与 Vue 搭起来的小站。你可以把这里当成起点：改站点信息、加文章、再接上自己的部署流程。',
      '文章数据目前写在 `src/data/posts.ts` 里。要加一篇新文，只要在 `posts` 数组里追加一项，并保证 `slug` 在站内唯一即可。',
      '路由使用 `/posts/<slug>`，构建后是静态文件，部署时记得让服务器把所有路径回退到 `index.html`（SPA 常见配置）。',
    ],
  },
  {
    slug: 'vite-vue-notes',
    title: '用 Vite 与 Vue 搭建静态站点的一点笔记',
    date: '2025-03-15',
    excerpt: '本地开发、构建与部署流程的简要记录，方便日后查阅。',
    tags: ['前端', '工具'],
    body: [
      '本地开发：`npm run dev`，改组件会热更新。',
      '生产构建：`npm run build`，产物在 `dist/`。预览用 `npm run preview`。',
      '若站点部署在子路径下，需要在 `vite.config.ts` 里设置 `base`，并在路由里使用同一 `base`（可用 `import.meta.env.BASE_URL`）。',
    ],
  },
  {
    slug: 'reading-list',
    title: '最近在读的书单',
    date: '2025-03-01',
    excerpt: '技术书与闲书混在一起，读完再写短评。',
    tags: ['阅读'],
    body: [
      '读书这件事，贵在坚持记两笔。这里先占个位，日后按本补短评与摘录。',
      '技术类优先读官方文档与成体系的书；闲书随便翻，有意思再展开写长文。',
    ],
  },
]

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug)
}
