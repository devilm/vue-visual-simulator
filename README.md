# vue-visual-simulator
This page was developed in order to allow you to simulate your character costume using a render [API](https://github.com/zhad3/zrenderer).

Character previews are drawn in a client-side Canvas 2D view. Characters on
the job board use browser-side SPR/ACT decoding when matching local assets are
available; unsupported combinations continue to use the existing renderer API.

## Canvas renderer migration

The migration uses a static asset subset; the full extracted game data is too
large to include in this repository. Local body sprites are prepared for both
genders and every job-board tile where matching game resources exist, including
the Doram jobs and costume-style selections. Headgear is prepared by gender;
garments use each available job/gender animation. The browser decoder supports
the available hairstyles and palettes plus 11 selectable actions. Missing body,
gender, hairstyle, palette, or equipment assets continue to use the renderer API.

Prepare all available local character and equipment assets on Windows from an
extracted resource directory whose `data` folder contains the required
Ragnarok resources:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\prepare-novice-assets.ps1 `
  -ResourceRoot "C:\path\to\extracted-resources"
```

The generated `public/local-assets/novice/` and `public/local-assets/jobs/`
files are intentionally git-ignored. They are loaded by the browser at runtime;
do not commit or deploy them unless you have the rights to redistribute those
game assets. Preparing job-specific garments can require several gigabytes of
local storage. Production builds exclude these files by default; to explicitly
include the generated assets in a deployment, set
`INCLUDE_LOCAL_GAME_ASSETS=true` before running the build.

The browser decodes indexed/RLE SPR images, ACT sprite placement, animation
frames and transforms, and IMF layer priorities before compositing the body,
selected hairstyle, equipped headgear, and garment on Canvas 2D. The asset
preparation script reads the local compiled accessory and robe metadata, then
prepares matching equipment files for available job/gender combinations with
all 104 supported actions. Garments are drawn over the body when facing sideways,
backward, or diagonally backward, with a small horizontal alignment adjustment
to center them on the character; the adjustment is not applied when facing
forward. The Giant Shark costume is drawn between the hairstyle and body layers,
so it covers overlapping hair without obscuring the character. Other equipment
without matching prepared assets continues to use the existing renderer API.

The prepared headgear and garment subset can be large. Generated assets are
git-ignored; do not add the full extracted game data to the repository or
deploy assets unless you have the rights to redistribute those game assets.

It's very easy to use, just select the equipments that you want to test.

Access: http://visualrag.com/

# Technologies
- Vue.js
- Bootstrap 5
- HTML

# Screenshots
![image](https://user-images.githubusercontent.com/10372732/235383426-62ed325e-9eb0-444f-bc31-7df82565ae84.png)

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

You can also start the development server with:
```
make run
```

### Compiles and minifies for production
```
npm run build
```

### Build for GitHub Pages (`docs/`)
```
make build
```

This creates the production build in `docs/`. The equivalent npm command is
`npm run build:docs`.

Then in GitHub repository settings:
- Go to **Settings** -> **Pages**
- Set **Build and deployment** source to **Deploy from a branch**
- Select your branch (for example `main`) and folder `/docs`

If your repository name is different from `vue-visual-simulator`, pass it to
make:
```
make build GH_PAGES_REPO=<your-repo-name>
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
