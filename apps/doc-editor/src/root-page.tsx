import { lazy, Suspense } from "react";
import { authClient } from "@/lib/auth-client";

const FullSetupPage = lazy(() => import("@/pages/full-setup/page"));
const AuthPage = lazy(() =>
  import("@/pages/auth/page").then((module) => ({ default: module.AuthPage })),
);

export default function RootPage() {
  const { data, isPending, refetch } = authClient.useSession();
  const user = data?.user;

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
        正在检查登录态...
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
            正在加载登录页...
          </div>
        }
      >
        <AuthPage onAuthed={() => void refetch()} />
      </Suspense>
    );
  }

  return (
    <div>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <span className="max-w-[220px] truncate text-gray-700">
          {user.email ?? "未绑定邮箱"}
        </span>
        <button
          className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
          onClick={async () => {
            await authClient.signOut();
            void refetch();
          }}
          type="button"
        >
          退出登录
        </button>
      </div>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
            正在加载编辑器...
          </div>
        }
      >
        <FullSetupPage />
      </Suspense>
    </div>
  );
}
