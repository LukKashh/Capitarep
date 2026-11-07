import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputPublicDir = path.join(rootDir, ".output", "public");
const clientDir = path.join(rootDir, "dist", "client");
const distDir = path.join(rootDir, "dist");

console.log("[prepare-dist] Preparing build artifacts in", distDir);

// 1. Ensure dist exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 2. Copy all files from .output/public into dist if it exists
if (fs.existsSync(outputPublicDir)) {
  fs.cpSync(outputPublicDir, distDir, { recursive: true });
  console.log("[prepare-dist] Copied .output/public to dist");
}

// Also copy from dist/client into dist if it exists
if (fs.existsSync(clientDir)) {
  fs.cpSync(clientDir, distDir, { recursive: true });
  console.log("[prepare-dist] Copied dist/client to dist root");
}

// Also copy server files to dist/server in case runner needs them
const outputServerDir = path.join(rootDir, ".output", "server");
if (fs.existsSync(outputServerDir)) {
  const distServerDir = path.join(distDir, "server");
  fs.mkdirSync(distServerDir, { recursive: true });
  fs.cpSync(outputServerDir, distServerDir, { recursive: true });
  console.log("[prepare-dist] Copied .output/server to dist/server");
}

// 3. Locate index-*.js and styles-*.css in dist/assets
const assetsDir = path.join(distDir, "assets");
let indexJsFile = "";
let styleCssFile = "";

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  indexJsFile = files.find((f) => f.startsWith("index-") && f.endsWith(".js")) || "";
  styleCssFile = files.find((f) => f.startsWith("styles-") && f.endsWith(".css")) || "";
}

console.log("[prepare-dist] Found entry JS:", indexJsFile, "CSS:", styleCssFile);

// 4. Prerender index.html, /auth, and 404.html using compiled SSR server
let prerenderSucceeded = false;
try {
  const serverPath = path.join(distDir, "server", "server.js");
  if (fs.existsSync(serverPath)) {
    const { default: server } = await import(serverPath);
    if (server && typeof server.fetch === "function") {
      // Prerender "/"
      const resIndex = await server.fetch(new Request("http://localhost:3000/"), {}, {});
      if (resIndex.status === 200) {
        const indexHtml = await resIndex.text();
        fs.writeFileSync(path.join(distDir, "index.html"), indexHtml, "utf-8");
        console.log("[prepare-dist] Successfully prerendered dist/index.html via server SSR");
        prerenderSucceeded = true;
      }

      // Prerender "/auth"
      const resAuth = await server.fetch(new Request("http://localhost:3000/auth"), {}, {});
      if (resAuth.status === 200) {
        const authDir = path.join(distDir, "auth");
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
        const authHtml = await resAuth.text();
        fs.writeFileSync(path.join(authDir, "index.html"), authHtml, "utf-8");
        console.log("[prepare-dist] Successfully prerendered dist/auth/index.html via server SSR");
      }

      // Prerender "/404"
      const res404 = await server.fetch(new Request("http://localhost:3000/404"), {}, {});
      const notFoundHtml = await res404.text();
      fs.writeFileSync(path.join(distDir, "404.html"), notFoundHtml, "utf-8");
      console.log("[prepare-dist] Successfully prerendered dist/404.html via server SSR");
    }
  }
} catch (err) {
  console.warn("[prepare-dist] SSR prerender encountered issue, writing fallback:", err);
}

// Fallback if SSR prerendering did not produce index.html
if (!prerenderSucceeded) {
  const fallbackHtml = `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0b0b12" />
    <title>Capitalfortune</title>
    <meta name="description" content="Wealth & Business simulator tycoon with cloud save and cooperative corporations powered by Firebase Firestore" />
    <meta property="og:title" content="Capitalfortune" />
    <meta property="og:description" content="Wealth & Business simulator tycoon with cloud save and cooperative corporations powered by Firebase Firestore" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" />
    ${styleCssFile ? `<link rel="stylesheet" href="/assets/${styleCssFile}" />` : ""}
    ${indexJsFile ? `<link rel="modulepreload" href="/assets/${indexJsFile}" />` : ""}
    <script>
      window.$_TSR = window.$_TSR || {
        buffer: [],
        initialized: false,
        router: { manifest: {}, matches: [] },
        e: function () {},
        h: function () {}
      };
    </script>
  </head>
  <body class="dark bg-background text-foreground">
    <div id="root"></div>
    ${indexJsFile ? `<script type="module" src="/assets/${indexJsFile}"></script>` : ""}
  </body>
</html>
`;
  fs.writeFileSync(path.join(distDir, "index.html"), fallbackHtml, "utf-8");
  fs.writeFileSync(path.join(distDir, "404.html"), fallbackHtml, "utf-8");
  console.log("[prepare-dist] Generated fallback dist/index.html with window.$_TSR stub");
}

fs.writeFileSync(path.join(distDir, ".nojekyll"), "", "utf-8");

// 5. Verification
const distFiles = fs.readdirSync(distDir);
console.log(
  `[prepare-dist] dist directory now contains ${distFiles.length} root items:`,
  distFiles.join(", "),
);
