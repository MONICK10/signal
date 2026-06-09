import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  const outDir = join(root, 'public', 'icons');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const src = join(root, 'src', 'assets', 'logo.svg');

  for (const size of sizes) {
    await sharp(src)
      .resize(size, size)
      .png()
      .toFile(join(outDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }
  console.log('All icons generated.');
}

generateIcons().catch(console.error);
