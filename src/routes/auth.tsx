import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { art } from "@/components/game/art";
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  loginWithEmail,
  registerWithEmail,
  loginAsGuest,
} from "@/lib/firebase";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "signin" | "signup" } => ({
    ...(s.mode === "signin" || s.mode === "signup" ? { mode: s.mode } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Capitalfortune" },
      {
        name: "description",
        content: "Create your Capitalfortune account or sign in to continue your cloud-saved game.",
      },
      { property: "og:title", content: "Sign in — Capitalfortune" },
      { property: "og:description", content: "Create an account to start your empire from $0." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.currentUser) {
      navigate({ to: "/home", replace: true });
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate({ to: "/home", replace: true });
    });
    return () => unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await registerWithEmail(email, password);
        toast.success("Account created successfully!");
      } else {
        await loginWithEmail(email, password);
        toast.success("Signed in successfully!");
      }
      navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google!");
      navigate({ to: "/home", replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function guest() {
    setBusy(true);
    try {
      await loginAsGuest();
      toast.success("Playing as Guest!");
      navigate({ to: "/home", replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Guest sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="entry-screen min-h-screen pb-10">
      <img src={art("entry-city")} alt="Capitalfortune city" className="entry-backdrop" />
      <div className="mx-auto max-w-sm px-5 pt-16">
        <Link to="/" className="text-sm text-muted-foreground">
          ← Capitalfortune
        </Link>
        <h1 className="mt-6 text-3xl font-bold">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your progress is cloud-saved with Firebase.
        </p>

        <div className="mt-8 space-y-3">
          <Button
            variant="secondary"
            type="button"
            onClick={google}
            disabled={busy}
            className="h-11 w-full flex items-center justify-center gap-2"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Continue with Google
          </Button>

          <Button
            variant="outline"
            type="button"
            onClick={guest}
            disabled={busy}
            className="h-10 w-full text-xs"
          >
            Play instantly as Guest
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or with email
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full bg-gradient-primary">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <Button
          variant="ghost"
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </Button>
      </div>
    </main>
  );
}
