import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TrendingUp, ArrowRight } from "lucide-react";
import { art } from "@/components/game/art";
import { Button } from "@/components/ui/button";
import { auth, onAuthStateChanged } from "@/lib/firebase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Capitalfortune — Build Wealth From $0" },
      {
        name: "description",
        content:
          "Start with nothing. Tap, acquire companies, trade stocks and crypto, collect rent and luxury assets, and build a corporation with friends.",
      },
      { property: "og:title", content: "Capitalfortune — Build Wealth From $0" },
      {
        property: "og:description",
        content:
          "A mobile-first wealth and business tycoon game with cloud saves and cooperative corporations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
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

  return (
    <main className="entry-screen flex min-h-screen flex-col justify-end">
      <img
        src={art("entry-city")}
        alt="Capitalfortune waterfront city"
        className="entry-backdrop"
      />
      <div className="mx-auto w-full max-w-md px-6 pb-12 pt-48">
        <TrendingUp className="game-icon mb-4 h-14 w-14" />
        <h1 className="brand-name text-3xl">
          Capital<span>fortune</span>
        </h1>
        <p className="mt-2 text-sm uppercase text-muted-foreground">Wealth Builder Tycoon</p>
        <div className="mt-8 space-y-3">
          <Button asChild size="lg" className="h-12 w-full">
            <Link to="/auth">
              Start playing <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-12 w-full">
            <Link to="/auth" search={{ mode: "signin" }}>
              Continue your empire
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
