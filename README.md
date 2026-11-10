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

### Google Analytics 4

Analytics is disabled until a valid Measurement ID is configured, and is never
loaded by `npm run serve`.

1. Create a GA4 property in [Google Analytics](https://analytics.google.com/).
	Set its reporting timezone to Thailand (Bangkok).
2. Add a Web data stream using the public GitHub Pages URL and copy its
	Measurement ID (`G-...`). No API key or private credentials are needed.
3. Set `VUE_APP_GA_MEASUREMENT_ID=G-YOUR_ID` in `.env.production` (or in the
	gitignored `.env.production.local`). This ID is public and included in the
	browser bundle. Rebuild and deploy `docs/` using the existing workflow.
	Changing the environment file without rebuilding does not update the site.

Version Thai
เข้า Google Analytics แล้วล็อกอินด้วยบัญชี Google ได้เลยครับ ใช้งาน GA4 แบบมาตรฐานได้ฟรี

กด เริ่มวัดผล (Start measuring) แล้วตั้งชื่อบัญชี
สร้าง Property เช่น RO Costume Simulator ตั้งประเทศเป็นไทยและ timezone เป็น Bangkok
กรอกข้อมูลธุรกิจและเลือกเป้าหมายตามที่ระบบถาม
ในขั้นเก็บข้อมูล เลือก Web
ใส่ URL เว็บ GitHub Pages ที่ใช้งานจริง ตั้งชื่อ stream แล้วกด Create stream
หน้า Web stream details จะแสดง Measurement ID รูปแบบ G-XXXXXXXXXX

The two measurements are:

| Measurement | Meaning |
| --- | --- |
| `page_view` | An automatic GA4 page view, including page reloads. Use Total users or Sessions instead when comparing visitors or visits. |
| `dress_up_started` | The first character customization in a GA session: selecting a job, gender, hair, color, equipment, effect, outfit or mount. |

Restoring a saved character, resetting, rotating, changing animation and browsing
menus do not start a play. The event includes only `interaction_type` (the
mutation name), not the character data. GA4's session ID and local storage prevent
repeat play events on reload or in another tab in the same session. With storage
blocked, deduplication only lasts for the current page. Ad blockers can prevent
collection entirely, so these numbers are estimates, not an exact visitor counter.

Verify the deployed site in GA4's Realtime report: opening the page should produce
a `page_view`; selecting an item should produce `dress_up_started`; selecting
more items or reloading and selecting again in the same session should not produce
another play event. Standard reports can take 24-48 hours to process new events.

For daily totals, create a Free form exploration with Date and Event name as
dimensions and Event count as the metric. Filter Event name to `page_view` and
`dress_up_started`, put Date in rows and Event name in columns. This compares
daily page loads with play sessions, not unique people. Use Total users for
estimated unique visitors. The configured property timezone controls day boundaries.

Before enabling GA4 publicly, publish an appropriate privacy notice and implement
consent collection where required for your audience. The integration disables
Google signals and ad personalization, but GA4 still uses analytics cookies; it
does not include a consent banner or consent management platform.

Run the focused tracking tests with Node.js 18 or newer:

```
npm run test:analytics
```
