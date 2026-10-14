export interface MenuOption {
  name: string;
  price?: number | null;
  unit?: 'p.p.';
}

export interface MenuItem extends MenuOption {
  description?: string;
  variants?: MenuOption[];
  supplements?: MenuOption[];
}

export interface MenuCategory {
  name: string;
  description?: string;
  note?: string;
  items: MenuItem[];
  supplements?: MenuOption[];
}

export interface MenuGroup {
  id: string;
  name: string;
  categories: MenuCategory[];
}

export const menu: MenuGroup[] = [
  {
    id: 'ontbijt-brunch', name: 'Ontbijt & brunch',
    categories: [{
      name: 'Brunch club', note: 'Voorbereiding circa 15 minuten.',
      items: [
        { name: 'Dagvers ontbijt', description: 'brood, petit croissant, roerei, jam, granolabowl, belegen kaas, smeerkaas, fruit, thee of koffie', price: 12.5 },
        { name: 'Turuncu ontbijt', description: 'simit, feta, belegen kaas, smeerkaas, olijf, jam, tomaat, komkommer, roerei/sucuk, honing, Turkse thee', price: 12.5 },
        { name: 'Çılbır (Turkse eieren)', description: 'Turkse uitsmijter met gepocheerde eieren op knoflookyoghurt, licht pittige botersaus met chili', price: 10 },
        { name: 'Menemen', description: 'Turkse uitsmijter met tomaat, ui, jonge kaas en ei', price: 10 },
        { name: 'Roerei met sucuk', description: 'uitsmijter met Turkse worst', price: 9.5 },
        { name: 'Pannenkoek', description: 'met poedersuiker of siroop', price: 5.5 },
      ],
    }],
  },
  {
    id: 'lunch', name: 'Lunch',
    categories: [
      {
        name: 'Turuncu tosti’s',
        items: [
          { name: 'Tosti kaas', description: 'met jonge kaas', price: 7.5 },
          { name: 'Kindertosti', price: 4.5 },
          { name: 'Tosti kaas en sucuk', description: 'met jonge kaas en Turkse worst', price: 8.5 },
          { name: 'Tosti mozzarella', description: 'met pesto, mozzarella en tomaat', price: 8.5 },
          { name: 'Tosti omelet', description: '2 sneetjes tostibrood, omelet, sla, tomaat, jonge kaas, avocado (of salami)', price: 10 },
          { name: 'French toast', description: 'met vers fruit, honing en poedersuiker', variants: [
            { name: '1 snee', price: 7 }, { name: '2 sneetjes', price: 10 },
          ] },
        ],
      },
      { name: 'Soep van de week', items: [{ name: 'Soep van de week', description: 'geserveerd met brood', price: 6 }] },
      {
        name: 'Lekker op brood',
        items: [
          { name: 'Gezond', description: 'sla, tomaat, komkommer, eiersalade, bieslook', price: 8.5 },
          { name: 'Tonijn', description: 'sla, tonijnsalade, gepickelde rode ui', price: 9.5 },
          { name: 'Caprese', description: 'pesto, mozzarella, tomaat, rucola, pijnboompitten', price: 9.5 },
          { name: 'Smashed avocado', description: 'smashed avocado, rucola, cherrytomaat, granaatappeldressing', price: 10.5 },
          { name: 'Gepocheerde eieren', description: '2 gepocheerde eieren, avocado, kiemgroente, truffelmayonaise', price: 11.5 },
          { name: 'Zalm', description: 'gerookte zalm, gekruide roomkaas, rucola, wasabimayo, sesamzaadjes', price: 11.5 },
        ],
      },
      {
        name: 'Groene Genieters',
        items: [
          { name: 'Avocadosalade', description: 'avocado, komkommer, cherrytomaat, rode ui, rucola, walnoot', price: 10.5 },
          { name: 'Meddi salade', description: 'sla, feta, cherrytomaat, komkommer, olijf, rode ui', price: 9.5 },
        ],
      },
      {
        name: 'Wrap it up',
        items: [
          { name: 'Avocado / geitenkaas', description: 'avocado, geitenkaas, rucola, gegrilde paprika', price: 10.5 },
          { name: 'Groentelovers', description: 'hummus, gegrilde groente, feta, geroosterde kikkererwten', price: 9.5 },
        ],
      },
    ],
  },
  {
    id: 'bakkerij-zoet', name: 'Bakkerij & zoet',
    categories: [
      {
        name: 'Snel & Smaakvol — Croissants',
        items: [
          { name: 'Roombotercroissant', price: 2.5, supplements: [{ name: 'jonge kaas of jam', price: 0.5 }] },
          { name: 'Warme croissant', description: 'met chocoladepasta of pistache', price: 4.5 },
        ],
      },
      {
        name: 'Snel & Smaakvol — Börek',
        items: [
          { name: 'Aardappel', price: 3 },
          { name: 'Gehakt', price: 3.5 },
          { name: 'Feta kaas (su böreği)', price: 4.5 },
          { name: 'Paçanga', description: 'met Turkse pastrami, kaas, tomaat en paprika', price: 5.5 },
          { name: 'Kip en groente', description: 'met gekruide kipfilet, ui, wortel en doperwten, geserveerd met yoghurt', price: 7.5 },
        ],
      },
      {
        name: 'Gözleme', description: 'hartige gevulde Turkse pannenkoek',
        items: [
          { name: 'Jonge kaas en feta', price: 7.5 },
          { name: 'Spinazie, feta en jonge kaas', price: 8.5 },
          { name: 'Aardappel en jonge kaas', price: 8.5 },
        ],
      },
      {
        name: 'Gebakken Geluk',
        items: [
          { name: 'Cheesecake', price: 4.5 },
          { name: 'Tiramisu', price: 4 },
          { name: 'Appeltaart', price: 4 },
          { name: 'Amandeltaart', price: 4 },
          { name: 'Worteltaart', price: 4 },
          { name: 'Brownie', price: 3.5 },
          { name: 'Muffins', price: 3.5 },
          { name: 'Cookies', price: 3 },
          { name: 'Baklava', variants: [{ name: 'per stuk', price: 1.5 }, { name: '1 kilo', price: 30 }] },
        ],
        supplements: [{ name: 'Slagroom', price: 0.5 }],
      },
    ],
  },
  {
    id: 'koffie-thee', name: 'Koffie & thee',
    categories: [
      {
        name: 'Wereld van Koffie',
        items: [
          { name: 'Espresso', price: 3 },
          { name: 'Dubbele espresso', price: 3.5 },
          { name: 'Espresso macchiato', price: 3.5 },
          { name: 'Turkse koffie', price: 3 },
          { name: 'Koffie / americano', price: 3.25 },
          { name: 'Cappuccino', price: 3.5 },
          { name: 'Koffie verkeerd', price: 3.75 },
          { name: 'Flat white', price: 4 },
          { name: 'Café latte', price: 4 },
          { name: 'Latte macchiato', price: 4 },
          { name: 'Chai latte', price: 4 },
          { name: 'Dirty chai latte', price: 4.5 },
          { name: 'Warme matcha', price: 4 },
          // Productnaam uit de aangeleverde kaart; nog te bevestigen door de eigenaar.
          { name: 'Warme sinass', price: 4 },
          { name: 'Warme chocomel', price: 4 },
          { name: 'Babyccino', price: 2 },
        ],
        supplements: [
          { name: 'Decaf / havermelk', price: 0.5 },
          { name: 'Koffiesiroop (caramel, hazelnoot, vanille)', price: 0.5 },
          { name: 'Extra shot espresso', price: 1 },
        ],
      },
      {
        name: 'Thee',
        items: [
          { name: 'Verse munt / gember', price: 3.75 },
          { name: 'Kruiden-/fruitthee', price: 3 },
          { name: 'Zakje thee', price: 2.5 },
          { name: 'Turkse thee', variants: [{ name: 'Groot', price: 2.5 }, { name: 'Klein', price: 2 }] },
        ],
      },
    ],
  },
  {
    id: 'koude-dranken', name: 'Koude dranken',
    categories: [
      {
        name: 'Ice Ice Baby',
        items: [
          { name: 'Iced americano', price: 3.5 },
          { name: 'Iced latte', price: 4 },
          { name: 'Iced matcha latte', price: 4.5 },
          { name: 'Mango matcha', price: 5 },
          { name: 'Strawberry matcha', price: 5 },
          { name: 'Melk / karnemelk', price: 2 },
          { name: 'Affogato', description: 'vanille-ijs overgoten met espresso', price: 4.5 },
        ],
        supplements: [
          { name: 'Decaf / havermelk', price: 0.5 },
          { name: 'Koffiesiroop (caramel, hazelnoot, vanille)', price: 0.5 },
        ],
      },
      {
        name: 'Smoothies',
        // De mogelijke kopprijs van € 5,00 is niet bevestigd voor deze drie smaken.
        items: [
          { name: 'Aardbei', price: null },
          { name: 'Banaan', price: null },
          { name: 'Mango', price: null },
          { name: 'Mix', price: 5.5 },
        ],
      },
      {
        name: 'Mocktail Mania',
        items: [
          { name: 'Cool Lime', description: 'limoen, komkommer, munt', price: 4 },
          { name: 'Mimosa', description: 'jus d\'orange, druivensap, bruiswater', price: 4.5 },
          { name: 'Ginger', description: 'limoen, munt, alcoholvrij ginger beer', price: 4.5 },
        ],
      },
      {
        name: 'Sappen',
        items: [
          { name: 'Verse jus d\'orange', price: 4 },
          { name: 'Detox boost', description: 'wortel, sinaasappel, gember', price: 4.5 },
          { name: 'Refresh', description: 'komkommer, groene appel, gember', price: 4.5 },
          { name: 'Huisgemaakte limonade', description: 'balans tussen zoet en zuur', price: 3.5 },
        ],
      },
      {
        name: 'Softies',
        // Alleen expliciet aangeleverde prijzen worden gepubliceerd.
        items: [
          { name: 'Pepsi / Fanta / Sprite', price: 3 },
          { name: 'Ice Tea green / sparkling / peach', price: null },
          { name: 'Ginger ale / tonic / Rivella', price: null },
          { name: 'Cassis / alcoholvrij ginger beer', price: null },
          { name: 'Spa blauw / rood', price: 3 },
          { name: 'Chocomel / Fristi', price: 2.5 },
          { name: 'Capri-Sun / appelsap', price: null },
          { name: 'Ayran', description: 'Turkse yoghurtdrank', price: 3 },
          { name: 'Şalgam', description: 'gefermenteerde Turkse drank met paarse wortel', price: 3 },
        ],
      },
    ],
  },
  {
    id: 'high-tea', name: 'High Tea',
    categories: [{
      name: 'High Tea', note: 'Reserveer je High Tea 48 uur van tevoren.',
      items: [
        { name: 'Vanaf 2 personen', price: 22.5, unit: 'p.p.' },
        { name: 'Vanaf 4 personen', price: 20.5, unit: 'p.p.' },
      ],
    }],
  },
];
