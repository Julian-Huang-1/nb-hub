import { Link, useNavigate, useParams } from "react-router";
import { getPostBySlug } from "../data/posts";
import { formatDate } from "../utils/format";

export default function PostPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const post = getPostBySlug(slug);

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/#posts");
    }
  }

  if (!post) {
    return (
      <main className="main post-view post-view--empty">
        <p className="post-missing">找不到这篇文章。</p>
        <Link className="post-article__more" to="/#posts">
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="main post-view">
      <nav className="post-nav" aria-label="文章导航">
        <button type="button" className="post-back" onClick={goBack}>
          ← 返回
        </button>
        <Link className="post-nav__home" to="/#posts">
          全部文章
        </Link>
      </nav>

      <article
        className="post-article"
        aria-labelledby={`post-title-${post.slug}`}
      >
        <header className="post-article__header">
          <time className="post-article__date" dateTime={post.date}>
            {formatDate(post.date)}
          </time>
          <h1 id={`post-title-${post.slug}`} className="post-article__title">
            {post.title}
          </h1>
          <ul className="post-article__tags" aria-label="标签">
            {post.tags.map((tag) => (
              <li key={tag} className="post-card__tag">
                {tag}
              </li>
            ))}
          </ul>
        </header>
        <div className="post-article__body">
          {post.body.map((para, i) => (
            <p key={i} className="post-article__para">
              {para}
            </p>
          ))}
        </div>
      </article>

      <footer className="post-article__footer">
        <Link className="post-article__more" to="/#posts">
          ← 回到首页
        </Link>
      </footer>
    </main>
  );
}
