import sharp from 'sharp';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../src/assets/menu/', import.meta.url);

// Elke snijlijn is afzonderlijk gekozen, met circa 32px ruimte boven de eerste categoriekop.
for (const [index, top] of [[1, 382], [2, 384]]) {
  const source = fileURLToPath(new URL(`menu-${index}.png`, directory));
  const target = fileURLToPath(new URL(`menu-web-${index}.webp`, directory));
  const { width, height } = await sharp(source).metadata();
  if (width !== 997 || height !== 2000) throw new Error('Controleer de uitsnede bij gewijzigd bronformaat.');
  await sharp(source).extract({ left: 0, top, width, height: height - top })
    .webp({ lossless: true, effort: 6 }).toFile(target);
  console.log(`menu-web-${index}.webp: x=0, y=${top}, ${width} × ${height - top}px, ${(await stat(target)).size} bytes`);
}
