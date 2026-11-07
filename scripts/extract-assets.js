import sharp from "sharp";
import fs from "fs";
import path from "path";

const BASE_IN = "public/assets/aistudio";
const BASE_OUT = "public/assets/game";

// Ensure output directories exist
const dirs = [
  "buildings",
  "realestate",
  "environments",
  "collectibles",
  "characters",
  "achievements",
  "research",
  "markets",
];

for (const d of dirs) {
  fs.mkdirSync(path.join(BASE_OUT, d), { recursive: true });
}

// 1. Asset Pack 01 (`file_000000004afc82469e0b67e49b5950fd_e71386b3.png` - 1536x1024)
// Business Buildings (Row 1): Lemonade, Cafe, Retail, Supermarket, Office
// Business Buildings (Row 2): Factory, Warehouse, Refinery, Mine, Farm
// Real Estate: Residential, Apartment, Office Building, Shopping Mall, Hotel
// Collectibles & Vehicles: Sports Car, SUV, Sedan, Supercar, Watch, Mona Lisa, Diamond, Gold Bars
// Achievements: Bronze, Silver, Gold, Purple/Platinum, Master/Elite

const AP01 = path.join(BASE_IN, "file_000000004afc82469e0b67e49b5950fd_e71386b3.png");

// 2. Asset Pack 07 (`file_00000000b628824698b8fdbdb82e878d_a12dd038.png` - 1536x1024)
// Environments (Left column): City Skyline, Business District, Industrial Zone, Port & Logistics, Suburban, Farmland, Resort, Mountain
// Main Menu Background: Penthouse Skyline (Center)

const AP07 = path.join(BASE_IN, "file_00000000b628824698b8fdbdb82e878d_a12dd038.png");

// 3. Asset Pack 05 (`file_000000005eac824697477ed3c842d657_304e6144.png` - 1536x1024)
// R&D Facility, Warehouse Facility, Metal Processing Facility, Employee Manager Avatars

const AP05 = path.join(BASE_IN, "file_000000005eac824697477ed3c842d657_304e6144.png");

// 4. Asset Pack 04 (`file_00000000ebd48246862566eea8797003_fd31a8b0.png` - 1536x1024)
// Commodity Investment Asset Cards: Gold, Oil, Silver, Copper, Wheat, Lumber

const AP04 = path.join(BASE_IN, "file_00000000ebd48246862566eea8797003_fd31a8b0.png");

async function extract() {
  console.log("Starting asset extraction & slicing...");

  // --- BUILDINGS (from AP01) ---
  // Row 1 Buildings (Lemonade, Cafe, Retail, Supermarket, Office)
  // Approximate coordinates in AP01 (1536x1024):
  // X range: ~410 to 1140, Y range: ~235 to 370 (Row 1), ~410 to 545 (Row 2)
  const buildingCrops = [
    { name: "lemon.png", left: 408, top: 232, width: 140, height: 135 },
    { name: "cafe.png", left: 556, top: 232, width: 140, height: 135 },
    { name: "retail.png", left: 704, top: 232, width: 140, height: 135 },
    { name: "supermarket.png", left: 850, top: 232, width: 140, height: 135 },
    { name: "office.png", left: 998, top: 232, width: 140, height: 135 },
    { name: "factory.png", left: 408, top: 412, width: 140, height: 135 },
    { name: "warehouse.png", left: 556, top: 412, width: 140, height: 135 },
    { name: "refinery.png", left: 704, top: 412, width: 140, height: 135 },
    { name: "mine.png", left: 850, top: 412, width: 140, height: 135 },
    { name: "farm.png", left: 998, top: 412, width: 140, height: 135 },
  ];

  for (const b of buildingCrops) {
    await sharp(AP01)
      .extract({ left: b.left, top: b.top, width: b.width, height: b.height })
      .resize(400, 380, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.join(BASE_OUT, "buildings", b.name));
  }

  // --- REAL ESTATE (from AP01) ---
  // Row 3 Real Estate: Residential, Apartment, Office Building, Shopping Mall, Hotel (Y: ~615 to 745)
  const propertyCrops = [
    { name: "house.png", left: 408, top: 615, width: 140, height: 130 },
    { name: "apartment.png", left: 556, top: 615, width: 140, height: 130 },
    { name: "commercial.png", left: 704, top: 615, width: 140, height: 130 },
    { name: "mall.png", left: 850, top: 615, width: 140, height: 130 },
    { name: "hotel.png", left: 998, top: 615, width: 140, height: 130 },
  ];

  for (const p of propertyCrops) {
    await sharp(AP01)
      .extract({ left: p.left, top: p.top, width: p.width, height: p.height })
      .resize(500, 360, { fit: "cover" })
      .toFile(path.join(BASE_OUT, "realestate", p.name));
  }

  // --- COLLECTIBLES & VEHICLES (from AP01) ---
  // Vehicles: Sports Car, SUV, Sedan, Supercar (Y: ~795 to 870)
  // Items: Watch, Mona Lisa, Diamond, Gold Bars (Y: ~795 to 870)
  const collectibleCrops = [
    { name: "car.png", left: 408, top: 795, width: 95, height: 75 },
    { name: "suv.png", left: 508, top: 795, width: 95, height: 75 },
    { name: "sedan.png", left: 608, top: 795, width: 95, height: 75 },
    { name: "supercar.png", left: 708, top: 795, width: 95, height: 75 },
    { name: "watch.png", left: 825, top: 795, width: 70, height: 75 },
    { name: "art.png", left: 898, top: 795, width: 70, height: 75 },
    { name: "diamond.png", left: 973, top: 795, width: 70, height: 75 },
    { name: "goldbars.png", left: 1048, top: 795, width: 70, height: 75 },
  ];

  for (const c of collectibleCrops) {
    await sharp(AP01)
      .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.join(BASE_OUT, "collectibles", c.name));
  }

  // --- ENVIRONMENTS (from AP07) ---
  // Left column items (1536x1024):
  // X: 15, Width: 290. Y offsets:
  // City Skyline: Y=138, H=110
  // Business District: Y=265, H=110
  // Industrial Zone: Y=390, H=110
  // Port & Logistics: Y=515, H=110
  // Suburban / Residential: Y=640, H=110
  // Rural / Farmland: Y=765, H=110
  // Coastal / Resort: Y=890, H=105
  // Main Menu Penthouse: X=320, Y=140, W=750, H=320
  const envCrops = [
    { name: "skyline.png", left: 15, top: 138, width: 290, height: 110 },
    { name: "business_district.png", left: 15, top: 265, width: 290, height: 110 },
    { name: "industrial_zone.png", left: 15, top: 390, width: 290, height: 110 },
    { name: "port.png", left: 15, top: 515, width: 290, height: 110 },
    { name: "suburban.png", left: 15, top: 640, width: 290, height: 110 },
    { name: "farmland.png", left: 15, top: 765, width: 290, height: 110 },
    { name: "resort.png", left: 15, top: 890, width: 290, height: 105 },
    { name: "penthouse.png", left: 320, top: 140, width: 750, height: 320 },
  ];

  for (const e of envCrops) {
    await sharp(AP07)
      .extract({ left: e.left, top: e.top, width: e.width, height: e.height })
      .resize(800, 450, { fit: "cover" })
      .toFile(path.join(BASE_OUT, "environments", e.name));
  }

  // --- CHARACTERS / PORTRAITS (from AP05 & AP01) ---
  // Tycoon Avatar from AP01 logo card: X=25, Y=240, W=100, H=100
  // Managers from AP05: X=1120, Y=740, W=55, H=55
  await sharp(AP01)
    .extract({ left: 25, top: 240, width: 100, height: 100 })
    .resize(256, 256)
    .toFile(path.join(BASE_OUT, "characters", "avatar.png"));

  const managers = [
    { name: "manager_1.png", left: 1120, top: 742, width: 55, height: 55 },
    { name: "manager_2.png", left: 1120, top: 802, width: 55, height: 55 },
    { name: "manager_3.png", left: 1120, top: 862, width: 55, height: 55 },
  ];

  for (const m of managers) {
    await sharp(AP05)
      .extract({ left: m.left, top: m.top, width: m.width, height: m.height })
      .resize(180, 180)
      .toFile(path.join(BASE_OUT, "characters", m.name));
  }

  // --- ACHIEVEMENTS / RANKS (from AP01) ---
  // Badges at bottom right of AP01 (Y: 900, X: 1160 to 1500)
  const rankCrops = [
    { name: "bronze.png", left: 1160, top: 900, width: 60, height: 60 },
    { name: "silver.png", left: 1230, top: 900, width: 60, height: 60 },
    { name: "gold.png", left: 1300, top: 900, width: 60, height: 60 },
    { name: "master.png", left: 1370, top: 900, width: 60, height: 60 },
    { name: "elite.png", left: 1440, top: 900, width: 60, height: 60 },
  ];

  for (const r of rankCrops) {
    await sharp(AP01)
      .extract({ left: r.left, top: r.top, width: r.width, height: r.height })
      .resize(200, 200, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.join(BASE_OUT, "achievements", r.name));
  }

  // --- RESEARCH & FACILITIES (from AP05) ---
  // Facility Overview: X=295, Y=355, W=240, H=125
  // Warehouse Overview: X=295, Y=530, W=240, H=125
  // R&D Overview: X=840, Y=530, W=240, H=125
  await sharp(AP05)
    .extract({ left: 295, top: 355, width: 240, height: 125 })
    .resize(600, 310)
    .toFile(path.join(BASE_OUT, "research", "facility.png"));

  await sharp(AP05)
    .extract({ left: 295, top: 530, width: 240, height: 125 })
    .resize(600, 310)
    .toFile(path.join(BASE_OUT, "research", "warehouse.png"));

  await sharp(AP05)
    .extract({ left: 840, top: 530, width: 240, height: 125 })
    .resize(600, 310)
    .toFile(path.join(BASE_OUT, "research", "rd.png"));

  // --- COMMODITIES (from AP04) ---
  // Gold, Crude Oil, Silver, Copper, Wheat, Lumber (Y: 500, X: 280 to 1180)
  const commCrops = [
    { name: "gold_commodity.png", left: 280, top: 500, width: 140, height: 80 },
    { name: "oil_commodity.png", left: 430, top: 500, width: 140, height: 80 },
    { name: "silver_commodity.png", left: 580, top: 500, width: 140, height: 80 },
    { name: "copper_commodity.png", left: 730, top: 500, width: 140, height: 80 },
    { name: "wheat_commodity.png", left: 880, top: 500, width: 140, height: 80 },
    { name: "lumber_commodity.png", left: 1030, top: 500, width: 140, height: 80 },
  ];

  for (const cm of commCrops) {
    await sharp(AP04)
      .extract({ left: cm.left, top: cm.top, width: cm.width, height: cm.height })
      .resize(400, 230)
      .toFile(path.join(BASE_OUT, "markets", cm.name));
  }

  console.log("Extraction complete!");
}

extract().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});
