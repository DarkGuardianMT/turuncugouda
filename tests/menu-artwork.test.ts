import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

test('both full menu artworks retain the original dimensions and unchanged source bytes', async () => {
  const sources = [
    ['menu-1.png', 'ea4605681c2f2c913c4a815494ffe659f94592e8ad53d8efbafbd48cafdd3aff'],
    ['menu-2.png', '13def7ec67873fe967e874aa01e65f464dd27ffc608fdd9a4abccfb397532a6f'],
  ];
  for (const [source, hash] of sources) {
    const bytes = await readFile(`src/assets/menu/${source}`);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 997); assert.equal(metadata.height, 2000);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, 'The presentation must not alter the original artwork');
  }
});

test('website crops remove only the top flyer header and preserve every remaining pixel', async () => {
  for (const [index, top] of [[1, 382], [2, 384]]) {
    const image = sharp(`src/assets/menu/menu-web-${index}.webp`);
    const metadata = await image.metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 997); assert.equal(metadata.height, 2000 - top);
    const expected = await sharp(`src/assets/menu/menu-${index}.png`)
      .extract({ left: 0, top, width: 997, height: 2000 - top }).removeAlpha().raw().toBuffer();
    const actual = await image.removeAlpha().raw().toBuffer();
    assert.deepEqual(actual, expected, 'Prices, names, contact text and bottom content remain pixel-for-pixel unchanged');
  }
});
