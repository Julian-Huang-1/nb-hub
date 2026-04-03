import { Link, Outlet, useLocation } from "react-router";
import { ScrollBehavior } from "../components/ScrollBehavior";
import { site } from "../site";

export default function BlogLayout() {
  const location = useLocation();
  const navPostsActive =
    (location.pathname === "/" && location.hash !== "#about") ||
    location.pathname.startsWith("/posts/");
  const navAboutActive =
    location.pathname === "/" && location.hash === "#about";

  return (
    <div className="blog">
      <ScrollBehavior />
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" to="/#posts">
            <span className="brand__title">{site.title}</span>
            <span className="brand__tagline">{site.tagline}</span>
          </Link>
          <nav className="nav" aria-label="主导航">
            <Link
              className={
                navPostsActive ? "nav__link nav__link--active" : "nav__link"
              }
              to="/#posts"
            >
              文章
            </Link>
            <Link
              className={
                navAboutActive ? "nav__link nav__link--active" : "nav__link"
              }
              to="/#about"
            >
              关于
            </Link>
          </nav>
        </div>
      </header>

      <Outlet />

      <footer className="site-footer">
        <p className="site-footer__copy">
          © {new Date().getFullYear()} {site.title} · 以文字对抗遗忘~
        </p>
      </footer>
    </div>
  );
}
