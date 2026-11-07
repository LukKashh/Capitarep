const assets = import.meta.glob<{ default: { url: string } }>("/src/assets/*.asset.json", {
  eager: true,
});

const LOCAL_ART_MAP: Record<string, string> = {
  // Characters & Portraits
  avatar: "/assets/game/characters/avatar.png",

  // Environments & Backgrounds
  skyline: "/assets/game/environments/skyline.png",
  "entry-city": "/assets/game/environments/skyline.png",
  penthouse: "/assets/game/environments/penthouse.png",
  suburban: "/assets/game/environments/suburban.png",
  business_district: "/assets/game/environments/business_district.png",
  industrial_zone: "/assets/game/environments/industrial_zone.png",
  resort: "/assets/game/environments/resort.png",

  // Real Estate Properties
  house: "/assets/game/realestate/house.png",
  apartment: "/assets/game/realestate/apartment.png",
  commercial: "/assets/game/realestate/commercial.png",
  mall: "/assets/game/realestate/mall.png",
  hotel: "/assets/game/realestate/hotel.png",
  terrace: "/assets/game/realestate/house.png",

  // Business Buildings
  lemon: "/assets/game/buildings/lemon.png",
  cafe: "/assets/game/buildings/cafe.png",
  retail: "/assets/game/buildings/retail.png",
  supermarket: "/assets/game/buildings/supermarket.png",
  office: "/assets/game/buildings/office.png",
  factory: "/assets/game/buildings/factory.png",
  warehouse: "/assets/game/buildings/warehouse.png",
  refinery: "/assets/game/buildings/refinery.png",
  mine: "/assets/game/buildings/mine.png",
  farm: "/assets/game/buildings/farm.png",

  // Achievement Ranks
  bronze: "/assets/game/achievements/bronze.png",
  silver: "/assets/game/achievements/silver.png",
  gold: "/assets/game/achievements/gold.png",
  master: "/assets/game/achievements/master.png",
  elite: "/assets/game/achievements/elite.png",
  "diamond-rank": "/assets/game/achievements/elite.png",
  crown: "/assets/game/achievements/master.png",

  // Collectibles & Vehicles
  car: "/assets/game/collectibles/car.png",
  suv: "/assets/game/collectibles/suv.png",
  sedan: "/assets/game/collectibles/sedan.png",
  supercar: "/assets/game/collectibles/supercar.png",
  watch: "/assets/game/collectibles/watch.png",
  art: "/assets/game/collectibles/art.png",
  diamond: "/assets/game/collectibles/diamond.png",
  goldbars: "/assets/game/collectibles/goldbars.png",
  jet: "/assets/game/collectibles/supercar.png",
  yacht: "/assets/game/collectibles/car.png",

  // Commodities & Markets
  gold_commodity: "/assets/game/markets/gold_commodity.png",
  oil_commodity: "/assets/game/markets/oil_commodity.png",
  silver_commodity: "/assets/game/markets/silver_commodity.png",
  copper_commodity: "/assets/game/markets/copper_commodity.png",
  wheat_commodity: "/assets/game/markets/wheat_commodity.png",
  lumber_commodity: "/assets/game/markets/lumber_commodity.png",

  // Research
  research: "/assets/game/research/rd.png",
};

export function art(name: string): string {
  if (LOCAL_ART_MAP[name]) {
    return LOCAL_ART_MAP[name];
  }
  const legacy = assets[`/src/assets/${name}.webp.asset.json`]?.default.url;
  if (legacy && !legacy.includes("/__l5e/")) {
    return legacy;
  }
  return LOCAL_ART_MAP.house;
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
  aero: "factory",
};

export function companyImage(id: string): string {
  const name = companyArt[id] || "office";
  return art(name);
}

export function propertyImage(category: string): string {
  const c = (category || "").toLowerCase();
  if (c.includes("hotel") || c.includes("hospitality")) return art("hotel");
  if (c.includes("commercial") || c.includes("office") || c.includes("retail") || c.includes("pod"))
    return art("commercial");
  if (c.includes("apartment") || c.includes("condo") || c.includes("living"))
    return art("apartment");
  if (c.includes("industrial") || c.includes("warehouse") || c.includes("logistics"))
    return art("warehouse");
  if (c.includes("land") || c.includes("farm") || c.includes("plot")) return art("farm");
  if (c.includes("mall") || c.includes("plaza") || c.includes("center")) return art("mall");
  if (c.includes("house") || c.includes("residential") || c.includes("home") || c.includes("room"))
    return art("house");
  return art("house");
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
