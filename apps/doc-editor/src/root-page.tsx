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
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
            正在加载编辑器...
          </div>
        }
      >
        <FullSetupPage
          userEmail={user.email}
          onSignOut={async () => {
            await authClient.signOut();
            void refetch();
          }}
        />
      </Suspense>
    </div>
  );
}
