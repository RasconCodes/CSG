# Clay Stamp Maker

A browser-based tool for turning user-supplied TTF/OTF fonts into 3D-printable clay stamp models.

## Current prototype

- Static GitHub Pages architecture
- Runs in the browser
- Font files are read locally
- Letter selection
- Basic stamp + handle preview
- STL export prototype

## Run locally

Because the app uses JavaScript modules, serve the folder through a small local web server instead of opening `index.html` directly.

For example, with Python installed:

```text
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages — automatic deployment

This repository includes:

```text
.github/
└── workflows/
    └── pages.yml
```

The workflow automatically publishes the contents of the repository to GitHub Pages whenever you push to the `main` branch.

### First-time setup

1. Create a new GitHub repository. For example:
   `clay-stamp-maker`
2. Upload the contents of this project to the repository.
   - Make sure `.github/workflows/pages.yml` is included.
   - Do **not** upload the ZIP itself as the only repository file; upload/extract the project contents.
3. Push/commit everything to the `main` branch.
4. On GitHub, open:
   **Settings → Pages**
5. Under **Build and deployment**, set **Source** to:
   **GitHub Actions**
6. The `Deploy to GitHub Pages` workflow should run automatically.
7. After it succeeds, GitHub will show the site's Pages URL under **Settings → Pages**.

Future pushes to `main` will automatically redeploy the site.

## Roadmap

### v0.1
- [x] Basic UI
- [x] TTF/OTF local loading
- [x] Letter input
- [x] Basic 3D preview
- [x] STL export prototype
- [x] GitHub Pages workflow

### v0.2
- [ ] True font-outline-to-solid geometry
- [ ] Correct raised stamping face orientation
- [ ] True recessed identification letter
- [ ] Better handle geometry
- [ ] Printability checks
- [ ] Reliable STL normals/winding

### v0.3
- [ ] Alphabet batch generation
- [ ] Better preview controls
- [ ] Save/load presets
- [ ] Optional rounded/square stamp bases
