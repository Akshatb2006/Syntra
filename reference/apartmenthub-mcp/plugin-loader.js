import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadPlugins() {
  const pluginsDir = join(__dirname, "plugins");
  const files = await readdir(pluginsDir);
  const plugins = [];

  for (const file of files) {
    if (!file.endsWith(".js")) continue;
    const modulePath = pathToFileURL(join(pluginsDir, file)).href;
    const mod = await import(modulePath);
    if (typeof mod.register !== "function") {
      console.warn(`Plugin ${file} has no register() export — skipping`);
      continue;
    }
    plugins.push({
      name: mod.name || file.replace(".js", ""),
      register: mod.register,
    });
  }

  return plugins;
}
