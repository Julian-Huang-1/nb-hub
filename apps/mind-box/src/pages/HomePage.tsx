import { Link, useLocation } from "react-router";
import { posts } from "../data/posts";
import { site } from "../site";
import { formatDate } from "../utils/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const { hash } = useLocation();
  const showAbout = hash === "#about";
  const showPosts = hash !== "#about";

  return (
    <main className="flex flex-1 flex-col py-8">
      <section
        hidden={!showAbout}
        className="flex flex-col gap-4"
        id="about"
        aria-labelledby="intro-heading"
      >
        <h1
          id="intro-heading"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Hi~ 我是 {site.author}
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          我把这里当作一间朝北的小书房：窗台上不一定有名贵花草，但总有没读完的书、没写完的句子，和偶尔从生活里捡回来的光。路上遇见的云、旧诗里的一句、深夜突然想明白的事，都会慢慢落成字。
        </p>
        <p className="leading-relaxed text-muted-foreground">
          若你也相信日子值得被轻轻记下，可点导航里的「文章」——愿那些字像一张便签纸，递到你手里时，还带着一点远方的风。
        </p>
      </section>

      <section
        hidden={!showPosts}
        id="posts"
        className="flex flex-col gap-5"
        aria-labelledby="posts-heading"
      >
        <h2
          id="posts-heading"
          className="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
        >
          近期文章
        </h2>
        <ul className="flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.slug}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="gap-1">
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={post.date}
                  >
                    {formatDate(post.date)}
                  </time>
                  <CardTitle className="text-base">
                    <Link
                      className="text-foreground underline-offset-4 hover:text-primary hover:underline"
                      to={`/posts/${post.slug}`}
                    >
                      {post.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <ul className="flex flex-wrap gap-1.5" aria-label="标签">
                    {post.tags.map((tag) => (
                      <li key={tag}>
                        <Badge variant="secondary">{tag}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
