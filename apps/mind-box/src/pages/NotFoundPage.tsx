import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        页面不存在
      </h1>
      <p className="leading-relaxed text-muted-foreground">
        链接可能已失效，或地址输入有误!
      </p>
      <Button variant="link" className="h-auto w-fit p-0" asChild>
        <Link to="/#posts">返回首页</Link>
      </Button>
    </main>
  );
}
