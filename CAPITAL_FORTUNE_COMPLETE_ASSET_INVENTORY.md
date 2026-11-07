# Capital Fortune — Complete Visual Asset Audit & Inventory

## 1. Application Visual Asset Audit & Status Summary

| Route / Component                                | Graphical Element          | Category     | Old Status        | Current Integrated Local Asset           | Result                  |
| :----------------------------------------------- | :------------------------- | :----------- | :---------------- | :--------------------------------------- | :---------------------- |
| **Top HUD (`AppShell.tsx`)**                     | Profile Avatar Thumbnail   | Character    | Broken Remote 404 | `/assets/game/characters/avatar.png`     | **Working Local Asset** |
| **Home Dashboard (`home.tsx`)**                  | City Skyline Banner        | Environment  | Broken Remote 404 | `/assets/game/environments/skyline.png`  | **Working Local Asset** |
| **Auth View (`auth.tsx`)**                       | Entry City Backdrop        | Environment  | Broken Remote 404 | `/assets/game/environments/skyline.png`  | **Working Local Asset** |
| **Private Profile (`profile.tsx`)**              | Skyline Banner             | Environment  | Broken Remote 404 | `/assets/game/environments/skyline.png`  | **Working Local Asset** |
| **Private Profile (`profile.tsx`)**              | Tycoon Portrait            | Character    | Broken Remote 404 | `/assets/game/characters/avatar.png`     | **Working Local Asset** |
| **Real Estate (`realestate.tsx`)**               | House Property Card        | Real Estate  | Empty 404 Box     | `/assets/game/realestate/house.png`      | **Working Local Asset** |
| **Real Estate (`realestate.tsx`)**               | Apartment Property Card    | Real Estate  | Empty 404 Box     | `/assets/game/realestate/apartment.png`  | **Working Local Asset** |
| **Real Estate (`realestate.tsx`)**               | Commercial Office Card     | Real Estate  | Empty 404 Box     | `/assets/game/realestate/commercial.png` | **Working Local Asset** |
| **Real Estate (`realestate.tsx`)**               | Hotel Property Card        | Real Estate  | Empty 404 Box     | `/assets/game/realestate/hotel.png`      | **Working Local Asset** |
| **Real Estate (`realestate.tsx`)**               | Shopping Mall Card         | Real Estate  | Empty 404 Box     | `/assets/game/realestate/mall.png`       | **Working Local Asset** |
| **Real Estate Detail (`realestate_.$inst.tsx`)** | Main Property Banner       | Real Estate  | Empty 404 Box     | Resolved via `propertyImage(category)`   | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Lemonade Stand             | Business     | Broken Remote 404 | `/assets/game/buildings/lemon.png`       | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Café                       | Business     | Broken Remote 404 | `/assets/game/buildings/cafe.png`        | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Retail Shop                | Business     | Broken Remote 404 | `/assets/game/buildings/retail.png`      | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Supermarket                | Business     | Broken Remote 404 | `/assets/game/buildings/supermarket.png` | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Office Building            | Business     | Broken Remote 404 | `/assets/game/buildings/office.png`      | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Factory                    | Business     | Broken Remote 404 | `/assets/game/buildings/factory.png`     | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Warehouse                  | Business     | Broken Remote 404 | `/assets/game/buildings/warehouse.png`   | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Refinery                   | Business     | Broken Remote 404 | `/assets/game/buildings/refinery.png`    | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Mine                       | Business     | Broken Remote 404 | `/assets/game/buildings/mine.png`        | **Working Local Asset** |
| **Business Empire (`empire.tsx`)**               | Farm                       | Business     | Broken Remote 404 | `/assets/game/buildings/farm.png`        | **Working Local Asset** |
| **Achievements (`achievements.tsx`)**            | Rank Badges (Bronze-Elite) | Achievements | Broken Remote 404 | `/assets/game/achievements/*.png`        | **Working Local Asset** |
| **Collectibles (`collectibles.tsx`)**            | Cars, Watches, Art, Jewels | Collectibles | Broken Remote 404 | `/assets/game/collectibles/*.png`        | **Working Local Asset** |
| **Corporation (`corporation.tsx`)**              | Corp Emblem Banner         | Corporation  | Broken Remote 404 | `/assets/game/achievements/elite.png`    | **Working Local Asset** |
| **Research (`research.tsx`)**                    | R&D Facility Photo         | Research     | Broken Remote 404 | `/assets/game/research/rd.png`           | **Working Local Asset** |

---

## 2. Extracted Asset Catalogue (Reference Sheets $\rightarrow$ Local PNG Files)

All assets extracted via Sharp image processing pipeline from reference sheets in `/public/assets/aistudio/`:

### A. Business Buildings (`public/assets/game/buildings/`)

- `lemon.png` (400x380) — Sunny Lemonade Stand
- `cafe.png` (400x380) — Espresso Café
- `retail.png` (400x380) — Corner Retail Shop
- `supermarket.png` (400x380) — Supermarket
- `office.png` (400x380) — Corporate Office Building
- `factory.png` (400x380) — Industrial Factory
- `warehouse.png` (400x380) — Logistics Warehouse
- `refinery.png` (400x380) — Petroleum Refinery
- `mine.png` (400x380) — Mineral Extraction Mine
- `farm.png` (400x380) — Agricultural Farm

### B. Real Estate (`public/assets/game/realestate/`)

- `house.png` (500x360) — Suburban House / Shared Room
- `apartment.png` (500x360) — Residential Apartment Complex
- `commercial.png` (500x360) — Micro Studio / Commercial Office
- `mall.png` (500x360) — Shopping Mall Plaza
- `hotel.png` (500x360) — Luxury Resort & Hotel

### C. Environments & Skylines (`public/assets/game/environments/`)

- `skyline.png` (800x450) — Capitalfortune City Skyline (Main Hub)
- `business_district.png` (800x450) — Financial Business District
- `industrial_zone.png` (800x450) — Heavy Industry Zone
- `port.png` (800x450) — Port & Logistics Hub
- `suburban.png` (800x450) — Suburban Neighborhood
- `farmland.png` (800x450) — Agricultural Countryside
- `resort.png` (800x450) — Coastal Resort & Beach
- `penthouse.png` (800x450) — Luxury Penthouse Window Backdrop

### D. Collectibles & Vehicles (`public/assets/game/collectibles/`)

- `car.png` (300x300) — Sports Car
- `suv.png` (300x300) — Luxury SUV
- `sedan.png` (300x300) — Executive Sedan
- `supercar.png` (300x300) — Exotic Supercar
- `watch.png` (300x300) — Solid Gold Watch
- `art.png` (300x300) — Mona Lisa Masterpiece
- `diamond.png` (300x300) — 10-Carat Diamond
- `goldbars.png` (300x300) — Bullion Gold Bars

### E. Achievement Ranks & Character Avatars

- Ranks: `bronze.png`, `silver.png`, `gold.png`, `master.png`, `elite.png` (`public/assets/game/achievements/`)
- Characters: `avatar.png`, `manager_1.png`, `manager_2.png`, `manager_3.png` (`public/assets/game/characters/`)
- Commodities: `gold_commodity.png`, `oil_commodity.png`, `silver_commodity.png`, `copper_commodity.png`, `wheat_commodity.png`, `lumber_commodity.png` (`public/assets/game/markets/`)

---

## 3. Centralized Asset Architecture (`src/components/game/art.ts`)

Re-architected lookup resolver:

- Maps all internal keys to `/assets/game/...` local PNGs.
- Eliminates obsolete `/__l5e/assets-v1/...` 404 remote endpoints.
- Ensures zero broken image frames across all 18 routes.
