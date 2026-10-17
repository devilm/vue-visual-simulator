# vue-visual-simulator
This page was developed in order to allow you to simulate your character costume using a render [API](https://github.com/zhad3/zrenderer).

Character previews are drawn in a client-side Canvas 2D view. The default male
Novice uses browser-side SPR/ACT decoding for all eight idle directions and
does not call the render API. Other character configurations still use the
existing renderer API.

## Canvas renderer migration

The migration uses a static asset subset; the full extracted game data is too
large to include in this repository. The browser decoder currently targets the default male Novice, all 42
hairstyles, nine hair colors, eight clothing colors, and 11 selectable actions.

Prepare the local Novice SPR/ACT assets on Windows from an extracted resource
directory whose `data` folder contains the required Ragnarok resources:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\prepare-novice-assets.ps1 `
  -ResourceRoot "C:\path\to\extracted-resources"
```

The generated `public/local-assets/novice/` files are intentionally
git-ignored. They are loaded by the browser at runtime; do not commit or deploy
them unless you have the rights to redistribute those game assets.

The browser decodes indexed/RLE SPR images, ACT sprite placement, animation
frames and transforms, and IMF layer priorities before compositing the body
and selected hairstyle on Canvas 2D. Other character configurations continue
to use the existing renderer API.

Do not add the full extracted game data to the repository. Only the curated
assets needed by the supported simulator options should be deployed as static
files.

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
