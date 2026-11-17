# Product photography - November 2026

Local implementation of the owner-approved Turkish visual report. Publication
still requires separate approval. No original supplied photograph or previous
repository image is deleted. The High Tea component and its temporary image,
Over ons counter photo, business data and backend configuration remain unchanged.

## Source mapping

The owner supplied `drive-download-20261117T214756Z-1-001.zip`. Original filenames
are recorded below; keep that archive separately from production output.
All new repository files are under `src/assets/photos/products/`.

| Original supplied file | Repository WebP | Placement |
| --- | --- | --- |
| `1 cappuccino.png` | `cappuccino.webp` | Hero, Café gallery, default social image |
| `2 cheesecake.jpg` | `cheesecake.webp` | Favorite 2, Zoet gallery |
| `3 tosti omelet.jpg` | `tosti-omelet.webp` | Favorite 4, Lunch gallery |
| `4 amandeltaart.jpg` | `amandeltaart.webp` | Bakkerij gallery |
| `5 avocado salade.jpg` | `avocadosalade.webp` | Favorite 5, Lunch gallery |
| `6 munt thee.png` | `muntthee.webp` | Café gallery |
| `7 gozleme.jpg` | `gozleme.webp` | Favorite 1, Lunch gallery |
| `8 aardbei matcha.jpg` | `aardbeienmatcha.webp` | Favorite 3, Café gallery |
| `9 brownie.jpg` | `brownie.webp` | Zoet gallery |
| `10 gember thee.jpg` | `gemberthee.webp` | Café gallery |
| `11 french toast.png` | `french-toast.webp` | Favorite 6, Lunch gallery |
| `12 homemade cookies.png` | `cookies.webp` | Bakkerij gallery |

## Image preparation and presentation

WebP imports use quality 90 and effort 6, EXIF orientation correction and a
maximum 2400px edge with no enlargement. No color filter, retouching, artificial
background or destructive source crop is applied. Astro produces responsive
page variants capped at source width; full-composition lightbox WebP images are
capped at 1600px width, quality 85, and loaded only on demand. The existing
`object-fit: contain` lightbox behavior preserves the full image.

Hero retains its 4:3 cover frame, eager/high-priority loading and original layout.
Favorites retain square frames; every gallery thumbnail uses the same 4:3 frame.
All thumbnails fill their frame with `object-fit: cover`, centered by default.
Per-photo `objectPosition` focuses the subject within the crop. Mixed portrait
frame ratios and per-photo contain/transparent-space overrides are removed.
Captions align below the images. Source photographs and full-composition
lightbox images remain unchanged. Short favorite names remain visible without
opening the lightbox.

The active gallery has 18 unique photos and the original five categories.
Retained previous assets: `borek-coffee`, `menemen`, `ig-00`, `counter-tulips`,
`interior-wide`, `ig-04`. Superseded `latte-art`, `ig-08`, `ig-03`, `ig-01`,
`cake-display`, `ig-06`, `borek-display` remain stored but are not active entries.
The old `ig-07` favorite also remains stored.

See [project context](../PROJECT_CONTEXT.md#photography-and-menu-references)
for gallery interaction and [development](DEVELOPMENT.md) for existing checks.
