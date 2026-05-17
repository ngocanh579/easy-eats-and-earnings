// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Plugin tùy chỉnh: loại bỏ componentTagger (lovable-tagger) khỏi danh sách plugin.
// componentTagger là thứ tạo ra banner "Edit with Lovable" ở góc dưới phải.
function removeLovableTagger(): Plugin {
  return {
    name: "remove-lovable-tagger",
    enforce: "post",
    config(config) {
      if (Array.isArray(config.plugins)) {
        config.plugins = config.plugins.filter((p: unknown) => {
          if (!p || typeof p !== "object") return true;
          const plugin = p as Plugin;
          return plugin.name !== "lovable-tagger";
        });
      }
    },
  };
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [removeLovableTagger()],
});
