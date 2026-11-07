const assets = import.meta.glob<{ default: { url: string } }>("/src/assets/*.asset.json", {
  eager: true,
});
export function art(name: string): string {
  return assets[`/src/assets/${name}.webp.asset.json`]?.default.url ?? "";
}
const companyArt: Record<string, string> = {
  lemon: "lemon",
  cafe: "cafe",
  bakery: "retail",
  logistics: "warehouse",
  hotel: "hotel",
  studio: "office",
  factory: "factory",
  supermarket: "supermarket",
  farm: "farm",
  refinery: "refinery",
  mine: "mine",
  retail: "retail",
  gym: "office",
  foodtruck: "cafe",
  clinic: "commercial",
  arena: "mall",
  aero: "jet",
};
export function companyImage(id: string): string | undefined {
  const name = companyArt[id];
  return name ? art(name) : undefined;
}
export function propertyImage(category: string): string {
  const c = category.toLowerCase();
  return art(
    c.includes("hotel")
      ? "hotel"
      : c.includes("commercial") || c.includes("office")
        ? "commercial"
        : c.includes("apartment")
          ? "apartment"
          : c.includes("industrial")
            ? "warehouse"
            : c.includes("land")
              ? "farm"
              : c.includes("mall")
                ? "mall"
                : "house",
  );
}
export function rankArt(tier: string): string {
  return art(
    (
      {
        Beginner: "bronze",
        Intermediate: "silver",
        Advanced: "gold",
        Expert: "master",
        Master: "elite",
      } as Record<string, string>
    )[tier] ?? "bronze",
  );
}
