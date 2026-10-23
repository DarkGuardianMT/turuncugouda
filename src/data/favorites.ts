import coffeeAndPastries from '../assets/photos/ig-07.webp';
import { gallery, photos, type GalleryPhoto } from './gallery';

export const favorites = [
  {
    id: 'koffie', title: 'Koffie & drankjes',
    photos: [
      photos.cafe,
      photos.hero,
      {
        image: coffeeAndPastries, alt: 'Koffie op tafel met gebak en broodjes',
        title: 'Koffie & iets lekkers', description: 'Een koffiemoment aan tafel.',
        category: 'Café', objectPosition: '50% 70%',
      },
    ],
  },
  {
    id: 'bakkerij', title: 'Bakkerij',
    photos: gallery.filter(({ title }) => ['Uit de bakkerij', 'Sesambroodjes', 'Een puntje taart'].includes(title)),
  },
  {
    id: 'lunch', title: 'Lunch',
    photos: [photos.lunch, ...gallery.filter(({ title }) => ['Hartige gebakjes', 'In de vitrine'].includes(title))],
  },
] satisfies { id: string; title: string; photos: GalleryPhoto[] }[];
