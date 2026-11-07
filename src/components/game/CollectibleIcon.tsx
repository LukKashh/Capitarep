import {
  Car,
  Gem,
  Image as ImageIcon,
  Landmark,
  Mail,
  Palette,
  Plane,
  Sailboat,
  Sparkles,
  Watch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { art } from "./art";
import type { Rarity } from "@/game/collectibles";

const ICONS: Record<string, typeof Car> = {
  vehicles: Car,
  aircraft: Plane,
  yachts: Sailboat,
  watches: Watch,
  paintings: Palette,
  stamps: Mail,
  antiques: Landmark,
  jewelry: Gem,
  nfts: Sparkles,
  luxprop: ImageIcon,
};
export const RARITY_TONE: Record<Rarity, string> = {
  Common: "text-muted-foreground border-border",
  Uncommon: "text-gain border-gain/40",
  Rare: "text-chart-4 border-chart-4/40",
  Epic: "text-primary border-primary/50",
  Legendary: "text-gold border-gold/50",
  Mythical: "text-loss border-loss/50",
};

export function CollectibleIcon({
  category,
  rarity,
  className,
}: {
  category: string;
  rarity: Rarity;
  className?: string;
}) {
  const I = ICONS[category] ?? Gem;
  const image = (
    {
      vehicles: "car",
      aircraft: "jet",
      yachts: "yacht",
      watches: "watch",
      paintings: "art",
      antiques: "crown",
      jewelry: "diamond",
      luxprop: "house",
    } as Record<string, string>
  )[category];
  return (
    <div
      className={cn(
        "game-panel relative flex items-center justify-center overflow-hidden rounded-lg border bg-muted/60",
        RARITY_TONE[rarity],
        className,
      )}
    >
      {image ? (
        <img src={art(image)} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
      ) : (
        <I className="game-icon h-1/2 w-1/2" />
      )}
    </div>
  );
}
