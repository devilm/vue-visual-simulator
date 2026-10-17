# vue-visual-simulator
This page was developed in order to allow you to simulate your character costume using a render [API](https://github.com/zhad3/zrenderer).

Character previews are drawn in a client-side Canvas 2D view. The default male
Novice idle frame is generated locally as a PNG and does not call the render
API. Other character configurations still use the existing renderer API.

## Canvas renderer migration

The migration is being developed as a static asset subset; the full extracted
game data is too large to include in this repository. The first vertical slice
targets the default male Novice, head 1, idle frame, and default palettes.

Generate the local Novice preview on Windows using a compatible
[`zrenderer` release](https://github.com/zhad3/zrenderer/releases) and an
extracted resource directory whose `data` folder contains the required
Ragnarok resources:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\render-novice-preview.ps1 `
  -RendererPath "C:\path\to\zrenderer.exe" `
  -ResourceRoot "C:\path\to\extracted-resources"
```

The generated `public/local-assets/novice-default.png` is intentionally
git-ignored. It is used for local development and must not be committed or
deployed unless you have the rights to redistribute that game asset.

1. Convert supported `.SPR`/`.ACT` data and required metadata into browser
   assets and frame/layer descriptions.
2. Load curated static assets in the browser and composite them with Canvas 2D.
3. Add directions, palettes, headgear, garments, and other jobs incrementally,
   comparing output with the current renderer.
4. Remove the render API request only after the supported character options
   render correctly without it.

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
