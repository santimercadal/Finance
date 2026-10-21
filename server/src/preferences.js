import { getJSON, setJSON } from "./storage.js";
import { userKey } from "./users.js";

// How the user set up the app: the screen it opens on, the theme and the order
// and visibility of the home panels. Stored on the server so the phone and the
// computer share it.

export const PANELS = ["market", "hero", "actions", "news", "ideas", "metrics", "allocation", "positions", "tip"];
const START_PAGES = ["portfolio", "news", "ideas", "explore"];
const THEMES = ["system", "light", "dark"];

export const DEFAULTS = {
  startPage: "portfolio",
  theme: "system",
  panels: PANELS.map((id) => ({ id, visible: true })),
};

// Keeps known values only. Panels missing from a saved order (new ones added
// in a later version) are appended, visible.
export function cleanPreferences(p = {}) {
  const seen = new Set();
  const panels = (Array.isArray(p.panels) ? p.panels : [])
    .filter((x) => PANELS.includes(x?.id) && !seen.has(x.id) && seen.add(x.id))
    .map((x) => ({ id: x.id, visible: x.visible !== false }));
  for (const id of PANELS) if (!seen.has(id)) panels.push({ id, visible: true });
  return {
    startPage: START_PAGES.includes(p.startPage) ? p.startPage : DEFAULTS.startPage,
    theme: THEMES.includes(p.theme) ? p.theme : DEFAULTS.theme,
    panels,
  };
}

export async function loadPreferences() {
  return cleanPreferences((await getJSON(userKey("preferences")).catch(() => null)) ?? DEFAULTS);
}

export async function savePreferences(p) {
  const clean = cleanPreferences(p);
  await setJSON(userKey("preferences"), clean);
  return clean;
}
