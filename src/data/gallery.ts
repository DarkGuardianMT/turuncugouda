import cappuccino from '../assets/photos/products/cappuccino.webp';
import cheesecake from '../assets/photos/products/cheesecake.webp';
import omeletToast from '../assets/photos/products/tosti-omelet.webp';
import almondCake from '../assets/photos/products/amandeltaart.webp';
import avocadoSalad from '../assets/photos/products/avocadosalade.webp';
import mintTea from '../assets/photos/products/muntthee.webp';
import gozleme from '../assets/photos/products/gozleme.webp';
import strawberryMatcha from '../assets/photos/products/aardbeienmatcha.webp';
import brownie from '../assets/photos/products/brownie.webp';
import gingerTea from '../assets/photos/products/gemberthee.webp';
import frenchToast from '../assets/photos/products/french-toast.webp';
import cookies from '../assets/photos/products/cookies.webp';
import borekCoffee from '../assets/photos/borek-coffee.webp';
import counterTulips from '../assets/photos/counter-tulips.webp';
import sesameBread from '../assets/photos/ig-00.webp';
import counterPortrait from '../assets/photos/ig-04.webp';
import interior from '../assets/photos/interior-wide.webp';
import menemen from '../assets/photos/menemen.webp';
import type { ImageMetadata } from 'astro';

export const galleryCategories = ['Café', 'Bakkerij', 'Lunch', 'Zoet', 'Sfeer'] as const;

export interface GalleryPhoto {
  image: ImageMetadata;
  alt: string;
  title: string;
  description: string;
  category: typeof galleryCategories[number];
  objectPosition?: string;
  objectFit?: 'contain';
  squarePreview?: boolean;
}

export const photos = {
  hero: { image: cappuccino, alt: 'Cappuccino met latte art, een koekje en een lepel op een witte schotel', title: 'Cappuccino', description: 'Een cappuccino met latte art en een koekje erbij.', category: 'Café', objectFit: 'contain' },
  cheesecake: { image: cheesecake, alt: 'Een punt cheesecake met een goudbruine bovenkant op een roze bord', title: 'Cheesecake', description: 'Een punt cheesecake op een roze bord.', category: 'Zoet', objectPosition: '50% 55%', objectFit: 'contain' },
  omeletToast: { image: omeletToast, alt: 'Een goudbruine tosti met omelet op een roze bord', title: 'Tosti omelet', description: 'Geroosterd brood met omelet ertussen.', category: 'Lunch', objectFit: 'contain' },
  almondCake: { image: almondCake, alt: 'Een punt amandeltaart met geschaafde amandelen op een roze bord', title: 'Amandeltaart', description: 'Een punt taart met geschaafde amandelen.', category: 'Bakkerij', objectPosition: '50% 55%', objectFit: 'contain' },
  avocadoSalad: { image: avocadoSalad, alt: 'Een salade met plakjes avocado, sla en kleurrijke groenten op een roze bord', title: 'Avocadosalade', description: 'Een kleurrijke salade met avocado.', category: 'Lunch' },
  mintTea: { image: mintTea, alt: 'Glazen mok met muntthee en citroen, naast honing en een koekje', title: 'Muntthee', description: 'Muntthee met citroen, honing en een koekje erbij.', category: 'Café', objectPosition: '50% 65%', squarePreview: true },
  gozleme: { image: gozleme, alt: 'Een goudbruin gebakken gözleme op een rond houten bord', title: 'Gözleme', description: 'Een goudbruin gebakken gözleme op een houten bord.', category: 'Lunch' },
  strawberryMatcha: { image: strawberryMatcha, alt: 'IJskoude matcha met groene, witte en rode lagen, een glazen rietje en aardbeien', title: 'Aardbeienmatcha', description: 'Matcha met ijs en aardbei, met de gekleurde lagen in beeld.', category: 'Café', objectPosition: '50% 60%', squarePreview: true },
  brownie: { image: brownie, alt: 'Een chocoladebrownie op een grijs bord met chocoladedruppels ernaast', title: 'Brownie', description: 'Een brownie met chocoladedruppels op en naast het bord.', category: 'Zoet', objectPosition: '50% 55%', squarePreview: true },
  gingerTea: { image: gingerTea, alt: 'Glazen mok met gemberthee, een koekje en een schijfje sinaasappel ernaast', title: 'Gemberthee', description: 'Gemberthee met een koekje en sinaasappel erbij.', category: 'Café', objectPosition: '50% 60%', squarePreview: true },
  frenchToast: { image: frenchToast, alt: 'French toast met aardbeien, slagroom en poedersuiker op een roze bord', title: 'French toast', description: 'French toast met aardbeien, slagroom en poedersuiker.', category: 'Lunch', objectPosition: '50% 60%', squarePreview: true },
  cookies: { image: cookies, alt: 'Een stapel chocoladekoekjes op een houten bord met stukjes chocolade ernaast', title: 'Cookies', description: 'Chocoladekoekjes, gestapeld op een houten bord.', category: 'Bakkerij', objectPosition: '50% 65%', squarePreview: true },
  borekCoffee: { image: borekCoffee, alt: 'Börek en koffie op een houten tafel', title: 'Börek en koffie', description: 'Een hartig hapje met een kop koffie erbij.', category: 'Lunch' },
  lunch: { image: menemen, alt: 'Menemen met brood en een schaaltje boter', title: 'Menemen', description: 'Een kijkje op tafel tijdens de lunch.', category: 'Lunch' },
  atmosphere: { image: counterTulips, alt: 'De toonbank van Turuncu met tulpen en gebak', title: 'Onze toonbank', description: 'Tulpen en gebak bij binnenkomst.', category: 'Sfeer' },
  sesameBread: { image: sesameBread, alt: 'Sesambroodjes op een houten tafel', title: 'Sesambroodjes', description: 'Een selectie broodjes uit de bakkerij.', category: 'Bakkerij' },
  interior: { image: interior, alt: 'Tafels, stoelen en banken in het café', title: 'Een kijkje binnen', description: 'De zithoek van Turuncu in beeld.', category: 'Sfeer' },
  counterPortrait: { image: counterPortrait, alt: 'Een vrouw achter de toonbank met gebak onder stolpen', title: 'Bij Turuncu', description: 'Een gezicht achter de toonbank.', category: 'Sfeer', objectPosition: '50% 25%' },
} satisfies Record<string, GalleryPhoto>;

export const gallery: GalleryPhoto[] = [
  photos.hero, photos.gozleme, photos.cheesecake,
  photos.atmosphere, photos.strawberryMatcha, photos.omeletToast,
  photos.avocadoSalad, photos.frenchToast, photos.interior,
  photos.almondCake, photos.mintTea, photos.cookies,
  photos.lunch, photos.brownie, photos.gingerTea,
  photos.borekCoffee, photos.sesameBread, photos.counterPortrait,
];
