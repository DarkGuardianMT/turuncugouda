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

export const photos = {
  hero: { image: borekCoffee, alt: 'Börek en koffie op een houten tafel' },
  cafe: { image: latte, alt: 'Koffie met latte art op tafel, met bloemen op de achtergrond' },
  bakery: { image: bakery, alt: 'Een goudbruine taart op een glazen schaal' },
  lunch: { image: menemen, alt: 'Menemen met brood en een schaaltje boter' },
  atmosphere: { image: counterTulips, alt: 'De toonbank van Turuncu met tulpen en gebak' },
} as const;

export const galleryPreview = [
  { image: sesameBread, alt: 'Sesambroodjes op een houten tafel' },
  { image: cake, alt: 'Een aangesneden taart op een glazen schaal' },
  { image: cakeDisplay, alt: 'Gebak onder glazen stolpen op de toonbank' },
  { image: interior, alt: 'Tafels, stoelen en banken in het café' },
  { image: chocolateCake, alt: 'Een aangesneden taart met donkere en lichte lagen' },
  { image: pastries, alt: 'Hartige gebakjes op een bakplaat' },
];

export const gallery = [
  photos.hero,
  photos.atmosphere,
  photos.bakery,
  ...galleryPreview,
  photos.cafe,
  photos.lunch,
  { image: borekDisplay, alt: 'Hartige taart en gebak op de toonbank' },
  { image: counterPortrait, alt: 'Een vrouw achter de toonbank met gebak onder stolpen' },
];

export const highlights = [
  { title: 'Café', photo: photos.cafe },
  { title: 'Bakkerij', photo: photos.bakery },
  { title: 'Lunch', photo: photos.lunch },
];
