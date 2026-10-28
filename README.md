# vue-visual-simulator
This page was developed in order to allow you to simulate your character costume using a render [API](https://github.com/zhad3/zrenderer).

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
make install
```
This installs the project dependencies. The equivalent npm command is
`npm install`.

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
