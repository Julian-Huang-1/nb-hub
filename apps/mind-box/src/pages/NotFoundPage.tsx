import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <main className="main not-found">
      <h1 className="not-found__title">页面不存在</h1>
      <p className="not-found__text">链接可能已失效，或地址输入有误!</p>
      <Link className="post-article__more" to="/#posts">
        返回首页
      </Link>
    </main>
  );
}
