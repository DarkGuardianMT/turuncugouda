import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const source = 'src/assets/turuncufavicon.png';
const sizes = [16, 32, 48, 180];
const images = await Promise.all(sizes.map((size) => sharp(source)
  .resize(size, size, { fit: 'contain' }).ensureAlpha().png({ compressionLevel: 9 }).toBuffer()));

await mkdir('public', { recursive: true });
for (const [index, name] of [[0, 'favicon-16x16.png'], [1, 'favicon-32x32.png'], [3, 'apple-touch-icon.png']]) {
  await writeFile(`public/${name}`, images[index]);
  console.log(`${name}: ${sizes[index]}×${sizes[index]}, ${images[index].length} bytes`);
}

// Eén ICO met drie PNG-afbeeldingen, zonder extra conversiedependency.
const frames = images.slice(0, 3);
const directory = Buffer.alloc(6 + frames.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
const ico = Buffer.concat([directory, ...frames]);
await writeFile('public/favicon.ico', ico);
console.log(`favicon.ico: 16×16, 32×32, 48×48, ${ico.length} bytes`);
