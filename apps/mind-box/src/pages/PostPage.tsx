import { Link, useNavigate, useParams } from "react-router";
import { getPostBySlug } from "../data/posts";
import { formatDate } from "../utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
      <main className="flex flex-1 flex-col gap-4 py-8">
        <p className="text-muted-foreground">找不到这篇文章。</p>
        <Button variant="link" className="h-auto w-fit p-0" asChild>
          <Link to="/#posts">返回首页</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col py-8">
      <nav
        className="mb-6 flex flex-wrap items-center justify-between gap-4"
        aria-label="文章导航"
      >
        <Button variant="ghost" size="sm" type="button" onClick={goBack}>
          ← 返回
        </Button>
        <Button variant="ghost" size="sm" className="h-auto" asChild>
          <Link to="/#posts">全部文章</Link>
        </Button>
      </nav>

      <article
        className="flex flex-col gap-6"
        aria-labelledby={`post-title-${post.slug}`}
      >
        <header className="flex flex-col gap-3 border-b border-border pb-5">
          <time className="text-sm text-muted-foreground" dateTime={post.date}>
            {formatDate(post.date)}
          </time>
          <h1
            id={`post-title-${post.slug}`}
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            {post.title}
          </h1>
          <ul className="flex flex-wrap gap-1.5" aria-label="标签">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="outline">{tag}</Badge>
              </li>
            ))}
          </ul>
        </header>
        <div className="flex flex-col gap-4">
          {post.body.map((para, i) => (
            <p key={i} className="leading-relaxed text-muted-foreground">
              {para}
            </p>
          ))}
        </div>
      </article>

      <Separator className="my-8" />

      <footer>
        <Button variant="link" className="h-auto w-fit p-0" asChild>
          <Link to="/#posts">← 回到首页</Link>
        </Button>
      </footer>
    </main>
  );
}
