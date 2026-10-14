import borekCoffee from '../assets/photos/borek-coffee.webp';
import borekDisplay from '../assets/photos/borek-display.webp';
import cakeDisplay from '../assets/photos/cake-display.webp';
import counterTulips from '../assets/photos/counter-tulips.webp';
import sesameBread from '../assets/photos/ig-00.webp';
import cake from '../assets/photos/ig-01.webp';
import pastries from '../assets/photos/ig-03.webp';
import counterPortrait from '../assets/photos/ig-04.webp';
import chocolateCake from '../assets/photos/ig-06.webp';
import bakery from '../assets/photos/ig-08.webp';
import interior from '../assets/photos/interior-wide.webp';
import latte from '../assets/photos/latte-art.webp';
import menemen from '../assets/photos/menemen.webp';
import type { ImageMetadata } from 'astro';

export interface GalleryPhoto {
  image: ImageMetadata;
  alt: string;
  title: string;
  description: string;
  category: 'Café' | 'Bakkerij' | 'Lunch' | 'Zoet' | 'Sfeer';
  objectPosition?: string;
}

export const photos = {
  hero: { image: borekCoffee, alt: 'Börek en koffie op een houten tafel', title: 'Börek en koffie', description: 'Een hartig hapje met een kop koffie erbij.', category: 'Lunch' },
  cafe: { image: latte, alt: 'Koffie met latte art op tafel, met bloemen op de achtergrond', title: 'Koffiemoment', description: 'Een kop koffie tussen de bloemen.', category: 'Café', objectPosition: '50% 85%' },
  bakery: { image: bakery, alt: 'Een goudbruine taart op een glazen schaal', title: 'Uit de bakkerij', description: 'Een goudbruine taart op de toonbank.', category: 'Bakkerij' },
  lunch: { image: menemen, alt: 'Menemen met brood en een schaaltje boter', title: 'Menemen', description: 'Een kijkje op tafel tijdens de lunch.', category: 'Lunch' },
  atmosphere: { image: counterTulips, alt: 'De toonbank van Turuncu met tulpen en gebak', title: 'Onze toonbank', description: 'Tulpen en gebak bij binnenkomst.', category: 'Sfeer' },
} as const;

export const galleryPreview: GalleryPhoto[] = [
  { image: sesameBread, alt: 'Sesambroodjes op een houten tafel', title: 'Sesambroodjes', description: 'Een selectie broodjes uit de bakkerij.', category: 'Bakkerij' },
  { image: pastries, alt: 'Hartige gebakjes op een bakplaat', title: 'Hartige gebakjes', description: 'Een bakplaat vol hartige lekkernijen.', category: 'Bakkerij' },
  { image: cake, alt: 'Een aangesneden taart op een glazen schaal', title: 'Een puntje taart', description: 'Taart om even bij stil te staan.', category: 'Zoet' },
  { image: cakeDisplay, alt: 'Gebak onder glazen stolpen op de toonbank', title: 'Zoete lekkernijen', description: 'Een kijkje onder de glazen stolpen.', category: 'Zoet' },
  { image: interior, alt: 'Tafels, stoelen en banken in het café', title: 'Een kijkje binnen', description: 'De zithoek van Turuncu in beeld.', category: 'Sfeer' },
  { image: chocolateCake, alt: 'Een aangesneden taart met donkere en lichte lagen', title: 'Laag voor laag', description: 'Een aangesneden taart van dichtbij.', category: 'Zoet' },
];

export const gallery: GalleryPhoto[] = [
  photos.hero,
  photos.cafe,
  photos.bakery,
  photos.lunch,
  photos.atmosphere,
  ...galleryPreview,
  { image: borekDisplay, alt: 'Hartige taart en gebak op de toonbank', title: 'In de vitrine', description: 'Hartig en zoet naast elkaar op de toonbank.', category: 'Bakkerij' },
  { image: counterPortrait, alt: 'Een vrouw achter de toonbank met gebak onder stolpen', title: 'Bij Turuncu', description: 'Een gezicht achter de toonbank.', category: 'Sfeer', objectPosition: '50% 25%' },
];

export const highlights: { title: string; photo: GalleryPhoto }[] = [
  { title: 'Café', photo: photos.cafe },
  { title: 'Bakkerij', photo: photos.bakery },
  { title: 'Lunch', photo: photos.lunch },
];
