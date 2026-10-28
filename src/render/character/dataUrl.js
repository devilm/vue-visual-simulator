// Base URL that hosts the `data/` asset tree (sprites, palettes, imf, effect textures).
//
// - Empty: assets are served from the same origin (`/data/...`, e.g. the dev server static folder).
// - Set (VUE_APP_DATA_BASE_URL, e.g. https://devilm.github.io/costume-ro): every `/data/...` path is fetched
//   from that host instead, so the assets can live in a separate GitHub Pages repository.
export const DATA_BASE_URL = String(process.env.VUE_APP_DATA_BASE_URL || "").replace(/\/+$/, "");

// Expands one resolver path into the URL(s) that should be tried, in order.
export function toFetchCandidates(path) {
  if (DATA_BASE_URL && path.startsWith("/data/")) {
    return [`${DATA_BASE_URL}${path}`];
  }

  const relative = path.startsWith("/") ? path.slice(1) : path;
  return relative === path ? [path] : [path, relative];
}

// Reorders resolver path candidates (which list NFD before NFC for Korean file names).
// The local dev server (macOS) keeps NFD names, but Git and GitHub Pages store NFC, so for the remote host
// the NFC form is tried first. The sort is stable and ASCII-only paths are unaffected.
export function orderPathCandidates(pathCandidates) {
  if (!DATA_BASE_URL) {
    return pathCandidates;
  }

  const isNfc = (path) => path === path.normalize("NFC");
  return [...pathCandidates.filter(isNfc), ...pathCandidates.filter((path) => !isNfc(path))];
}
