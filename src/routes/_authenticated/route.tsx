import { createFileRoute, redirect } from "@tanstack/react-router";
import { auth, onAuthStateChanged } from "@/lib/firebase";
import { AppShell } from "@/components/game/AppShell";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-mono text-muted-foreground">Loading Capitalfortune...</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: LoadingScreen,
  beforeLoad: async () => {
    const user = await new Promise((resolve) => {
      if (auth.currentUser) return resolve(auth.currentUser);
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 4000);
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(u);
      });
    });
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AppShell,
});
