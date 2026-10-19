const postalCode = '2804 XB';
const city = 'Gouda';

export const visitHours = {
  days: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  opens: '10:00', closes: '16:30',
} as const;

export const site = {
  name: 'Turuncu Café en Bakkerij',
  subtitle: 'Café • Bakkerij • Lunch',
  address: 'Lekkenburg 67',
  postalCode, city, countryCode: 'NL',
  postalAddress: `${postalCode} ${city}`,
  location: 'Winkelcentrum Bloemendaal',
  phone: '+31 6 36044912',
  phoneHref: 'tel:+31636044912',
  instagram: { handle: '@turuncugouda.nl', href: 'https://www.instagram.com/turuncugouda.nl/' },
  tiktok: { handle: '@turuncugouda', href: 'https://www.tiktok.com/@turuncugouda' },
  directionsHref: 'https://www.google.com/maps/dir/?api=1&destination=Lekkenburg%2067%2C%202804%20XB%20Gouda',
  reservationMessage: 'Stuur je reserveringsaanvraag via het formulier. Je reservering is pas definitief nadat Turuncu deze heeft bevestigd. Liever direct contact? Bel ons of stuur een bericht via Instagram.',
} as const;

export const openingHours = [
  { days: 'Maandag', hours: 'Gesloten' },
  { days: 'Dinsdag t/m zaterdag', hours: `${visitHours.opens}–${visitHours.closes}` },
  { days: 'Zondag', hours: 'Gesloten' },
] as const;
