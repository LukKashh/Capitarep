# Implementation Plan: Game Asset Slicing, Upscaling & Complete Texture Integration

Fix all broken/missing image elements identified across the application by programmatically extracting, slicing, upscaling, and mapping texture assets from the 10 provided reference sheets in `/public/assets/aistudio/`.

---

## 1. Audit & Identification of Missing/Broken Image Elements

Based on the attached user screenshots and full code audit, the following elements currently display broken image icons, empty placeholder boxes, or text alt-tags due to stale remote 404 URLs (`/__l5e/assets-v1/...`):

| View / Location                                  | Element                    | Current Issue                                            | Root Cause                                |
| :----------------------------------------------- | :------------------------- | :------------------------------------------------------- | :---------------------------------------- |
| **Top Header HUD** (`AppShell.tsx`)              | Profile Avatar Thumbnail   | Displays broken image icon in top left corner            | `art("avatar")` returns remote 404 URL    |
| **Private Profile** (`profile.tsx`)              | Top Banner Image           | Displays text `Capitalfortune skyline` with broken icon  | `art("skyline")` returns remote 404 URL   |
| **Private Profile** (`profile.tsx`)              | Tycoon Avatar Card         | Displays text `Tycoon portrait` with broken icon         | `art("avatar")` returns remote 404 URL    |
| **Real Estate Marketplace** (`realestate.tsx`)   | Property Card Thumbnails   | Displays large empty black rectangle above property info | `propertyImage(category)` returns 404 URL |
| **Real Estate Detail** (`realestate_.$inst.tsx`) | Main Property Banner       | Displays empty space or broken image frame               | `propertyImage(category)` returns 404 URL |
| **Business Empire** (`empire.tsx` & `$inst.tsx`) | Business Building Previews | Empty frame or missing thumbnail image                   | `companyImage(defId)` returns 404 URL     |
| **Achievements & Badges** (`achievements.tsx`)   | Tier Rank Insignias        | Empty rank icons                                         | `rankArt(tier)` returns 404 URL           |
| **Collectibles** (`collectibles.tsx`)            | Luxury Asset Thumbnails    | Missing/broken item graphics                             | `art(id)` returns 404 URL                 |

---

## 2. Extraction, Slicing & Upscaling Pipeline

We will install `sharp` to run a Node.js image extraction script that crops, isolates, and upscales individual graphic assets from the high-resolution reference PNG sheets stored in `/public/assets/aistudio/`:

1. **Building & Real Estate Asset Pack (`file_0000000041f48246b5da8b69d26a1b63_29c44a09.png`)**:
   - Extract individual building graphics for: `lemonade`, `cafe`, `retail`, `supermarket`, `office`, `factory`, `warehouse`, `refinery`, `mine`, `farm`, `residential_house`, `apartment`, `commercial_office`, `shopping_mall`, `luxury_hotel`.
   - Upscale cropped PNG tiles with crisp bicubic interpolation and save to `/public/assets/game/buildings/`.

2. **Environment & Skyline Backdrops (`file_00000000b628824698b8fdbdb82e878d_a12dd038.png` & `file_000000004afc82469e0b67e49b5950fd_e71386b3.png`)**:
   - Extract `city_skyline` header banner, `business_district`, `industrial_zone`, `suburban`, and `resort` environment backgrounds.
   - Save to `/public/assets/game/scenes/`.

3. **Avatar Portraits & Insignias (`file_000000005eac824697477ed3c842d657_304e6144.png`)**:
   - Extract character portraits (`tycoon_avatar`, `manager_1`, `manager_2`, `manager_3`) and achievement rank badges (`bronze`, `silver`, `gold`, `master`, `elite`).
   - Save to `/public/assets/game/portraits/` and `/public/assets/game/badges/`.

---

## 3. Centralized Asset Mapper Refactoring (`src/components/game/art.ts`)

Re-architect `src/components/game/art.ts` to map all game keys directly to local `/assets/game/...` PNG paths:

- `art("avatar")` $\rightarrow$ `/assets/game/portraits/tycoon_avatar.png`
- `art("skyline")` $\rightarrow$ `/assets/game/scenes/city_skyline.png`
- `art("house")` $\rightarrow$ `/assets/game/buildings/residential_house.png`
- `art("apartment")` $\rightarrow$ `/assets/game/buildings/apartment.png`
- `art("commercial")` $\rightarrow$ `/assets/game/buildings/commercial_office.png`
- `art("hotel")` $\rightarrow$ `/assets/game/buildings/luxury_hotel.png`
- `art("mall")` $\rightarrow$ `/assets/game/buildings/shopping_mall.png`
- `art("farm")` $\rightarrow$ `/assets/game/buildings/farm.png`
- `art("cafe")`, `art("lemon")`, `art("factory")`, `art("refinery")`, `art("mine")`, `art("supermarket")`, `art("warehouse")`, etc. $\rightarrow$ corresponding extracted building PNGs.

---

## 4. Zero-Broken-Image Resilience & UI Enhancements

- Add an image wrapper component with fallback SVG mesh styling so that if any image fails to load for any reason, a polished dark neon gradient with domain icon is displayed instead of a broken browser icon.
- Ensure all `<img>` tags specify `referrerPolicy="no-referrer"` and appropriate `alt` attributes.

---

## 5. Verification & Testing

- Run `npm run build`, `compile_applet`, `lint_applet`, and `npm test` to verify 100% build health with zero errors.
