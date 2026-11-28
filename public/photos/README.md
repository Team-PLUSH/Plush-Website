# Photography

The redesign is built to carry real photos, and it only uses real ones: team
portraits from `public/team/`. There are no build, robot or competition photos
in the repo yet, so none are shown. Nothing on the site is a stock photo or a
stand-in for a PLUSH member, robot or event.

`home-1.jpg` … `home-8.jpg` in this folder are old gradient placeholders and are
not used anywhere. Replace or delete them freely.

## Art direction (applies automatically)

Any image inside a `.ph` frame gets the house treatment from `public/plush.css`:
black-and-white with a lavender wash at rest, full colour on hover. That is
what makes phone photos taken in different light look like one set.

- Export JPEG, ~1600 px on the long edge for full-width shots, 800 px for
  portraits, quality ~80. Keep files under ~250 KB.
- Always set `width`/`height` (the real pixel size) and `alt`, and add
  `loading="lazy"` unless the image is in the first screen.
- Only publish photos of students who have a signed media release.

## Adding a portrait

Drop `firstname-lastname.jpg` (square, 800 px) in `public/team/` and swap the
initials tile on the Team page for:

```html
<div class="ph"><img src="/team/firstname-lastname.jpg" alt="Firstname Lastname" width="800" height="800" loading="lazy" /></div>
```

## Adding build / robot / event photos

Good first shots: Droplet on the bench, hands on wiring or a swerve module,
the team around a laptop in CAD, and a full-team photo at an event.

A photo of Droplet fits well in the robot sections (home page and Robots page):
add it above the `.robot-spread` block, for example:

```html
<figure class="ph ph-wide fade"><img src="/photos/droplet-bench.jpg" alt="Droplet on the build bench" width="1600" height="1000" loading="lazy" /></figure>
```

`.ph` defaults to a 4:5 crop; add a `.ph-wide { aspect-ratio: 16 / 10; }` rule
in `plush.css` (or similar) for landscape shots.
