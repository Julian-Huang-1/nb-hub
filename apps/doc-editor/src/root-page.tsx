import FullSetupPage from "@/pages/full-setup/page";
import { AuthPage } from "@/pages/auth/page";
import { authClient } from "@/lib/auth-client";

export default function RootPage() {
  const { data: session, isPending, refetch } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
        正在检查登录态...
      </div>
    );
  }

  if (!session) {
    return <AuthPage onAuthed={() => void refetch()} />;
  }

  return (
    <div>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <span className="max-w-[220px] truncate text-gray-700">{session.user.email}</span>
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
      <FullSetupPage />
    </div>
  );
}
