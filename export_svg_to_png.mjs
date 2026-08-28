import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Resvg } = require('./frontend/node_modules/@resvg/resvg-js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'frontend', 'public');

const renderMap = [
  // 1. Icon Only
  { svg: 'logo.svg', png: 'logo-dark.png', width: 512 },
  { svg: 'logo-light.svg', png: 'logo-light.png', width: 512 },
  { svg: 'logo-transparent.svg', png: 'logo-transparent.png', width: 512 },

  // 2. Horizontal Clean
  { svg: 'logo-horizontal-dark.svg', png: 'logo-horizontal-dark.png', width: 1200 },
  { svg: 'logo-horizontal-light.svg', png: 'logo-horizontal-light.png', width: 1200 },
  { svg: 'logo-horizontal-transparent.svg', png: 'logo-horizontal-transparent.png', width: 1200 },

  // 3. Horizontal With Tagline
  { svg: 'logo-horizontal-tagline-dark.svg', png: 'logo-horizontal-tagline-dark.png', width: 1320 },
  { svg: 'logo-horizontal-tagline-light.svg', png: 'logo-horizontal-tagline-light.png', width: 1320 },
  { svg: 'logo-horizontal-tagline-transparent.svg', png: 'logo-horizontal-tagline-transparent.png', width: 1320 },

  // 4. Vertical Clean
  { svg: 'logo-vertical-clean-dark.svg', png: 'logo-vertical-clean-dark.png', width: 1000 },
  { svg: 'logo-vertical-clean-light.svg', png: 'logo-vertical-clean-light.png', width: 1000 },
  { svg: 'logo-vertical-clean-transparent.svg', png: 'logo-vertical-clean-transparent.png', width: 1000 },

  // 5. Vertical With Tagline
  { svg: 'logo-vertical-dark.svg', png: 'logo-vertical-dark.png', width: 1000 },
  { svg: 'logo-vertical-light.svg', png: 'logo-vertical-light.png', width: 1000 },
  { svg: 'logo-vertical-transparent.svg', png: 'logo-vertical-transparent.png', width: 1000 },
  { svg: 'logo-vertical-dark.svg', png: 'logo-vertical-tagline-dark.png', width: 1000 },
  { svg: 'logo-vertical-light.svg', png: 'logo-vertical-tagline-light.png', width: 1000 },
  { svg: 'logo-vertical-transparent.svg', png: 'logo-vertical-tagline-transparent.png', width: 1000 },

  // 6. Product Premium Badge & Storefront Banner
  { svg: 'product-premium.svg', png: 'product-premium.png', width: 512 },
  { svg: 'storefront-banner.svg', png: 'storefront-banner.png', width: 1200 }
];

console.log('Rendering 1:1 vector SVGs to high-res PNGs with Resvg Rust engine...');

for (const item of renderMap) {
  const svgPath = path.join(publicDir, item.svg);
  const pngPath = path.join(publicDir, item.png);

  if (fs.existsSync(svgPath)) {
    const svg = fs.readFileSync(svgPath, 'utf8');
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: item.width
      },
      font: {
        loadSystemFonts: true,
        defaultFontFamily: 'Segoe UI'
      }
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    fs.writeFileSync(pngPath, pngBuffer);
    console.log(`✓ Exported ${item.svg} -> ${item.png} (${item.width}px)`);
  } else {
    console.warn(`! Missing ${item.svg}`);
  }
}

console.log('Done! All PNGs are now exact vector clones of SVGs.');
