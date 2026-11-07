import { Building2, Gem } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function AssetsTabs({ active }: { active: "re" | "col" }) {
  return (
    <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1">
      <Link
        to="/realestate"
        className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-center text-sm font-medium ${active === "re" ? "game-button text-primary-foreground" : "text-muted-foreground"}`}
      >
        <Building2 className="h-4 w-4" />
        Real estate
      </Link>
      <Link
        to="/collectibles"
        className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-center text-sm font-medium ${active === "col" ? "game-button text-primary-foreground" : "text-muted-foreground"}`}
      >
        <Gem className="h-4 w-4" />
        Collectibles
      </Link>
    </div>
  );
}
