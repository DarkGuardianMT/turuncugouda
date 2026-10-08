export const site = {
  name: 'Turuncu Café en Bakkerij',
  subtitle: 'Café • Bakkerij • Lunch',
  address: 'Lekkenburg 67',
  postalAddress: '2804 XB Gouda',
  location: 'Winkelcentrum Bloemendaal',
  phone: '+31 6 36044912',
  phoneHref: 'tel:+31636044912',
  instagram: { handle: '@turuncugouda.nl', href: 'https://www.instagram.com/turuncugouda.nl/' },
  tiktok: { handle: '@turuncugouda', href: 'https://www.tiktok.com/@turuncugouda' },
  directionsHref: 'https://www.google.com/maps/dir/?api=1&destination=Lekkenburg%2067%2C%202804%20XB%20Gouda',
  reservationMessage: 'Wil je reserveren? Neem telefonisch contact met ons op of stuur ons een bericht via Instagram.',
} as const;

export const openingHours = [
  { days: 'Maandag', hours: 'Gesloten' },
  { days: 'Dinsdag t/m zaterdag', hours: '10:00–16:30' },
  { days: 'Zondag', hours: 'Gesloten' },
] as const;
