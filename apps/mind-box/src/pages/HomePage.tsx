import { Link, useLocation } from "react-router";
import { posts } from "../data/posts";
import { site } from "../site";
import { formatDate } from "../utils/format";

export default function HomePage() {
  const { hash } = useLocation();
  const showAbout = hash === "#about";
  const showPosts = hash !== "#about";

  return (
    <main className="main">
      <section
        hidden={!showAbout}
        className="intro"
        id="about"
        aria-labelledby="intro-heading"
      >
        <h1 id="intro-heading" className="intro__heading">
          Hi~ 我是 {site.author}
        </h1>
        <p className="intro__text">
          我把这里当作一间朝北的小书房：窗台上不一定有名贵花草，但总有没读完的书、没写完的句子，和偶尔从生活里捡回来的光。路上遇见的云、旧诗里的一句、深夜突然想明白的事，都会慢慢落成字。
        </p>
        <p className="intro__text intro__text--second">
          若你也相信日子值得被轻轻记下，可点导航里的「文章」——愿那些字像一张便签纸，递到你手里时，还带着一点远方的风。
        </p>
      </section>

      <section
        hidden={!showPosts}
        id="posts"
        className="posts"
        aria-labelledby="posts-heading"
      >
        <h2 id="posts-heading" className="posts__title">
          近期文章
        </h2>
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="post-card">
                <time className="post-card__date" dateTime={post.date}>
                  {formatDate(post.date)}
                </time>
                <h3 className="post-card__title">
                  <Link
                    className="post-card__link"
                    to={`/posts/${post.slug}`}
                  >
                    {post.title}
                  </Link>
                </h3>
                <p className="post-card__excerpt">{post.excerpt}</p>
                <ul className="post-card__tags" aria-label="标签">
                  {post.tags.map((tag) => (
                    <li key={tag} className="post-card__tag">
                      {tag}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
