import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-svelte"],
  manifestVersion: 3,
  manifest: {
    browser_specific_settings: {
      gecko: {
        id: "vale@vale.sh",
        strict_min_version: "128.0",
        // Nothing is collected: the extension lints locally and stores only
        // its own configuration.
        data_collection_permissions: { required: ["none"] },
      },
    },
    name: "Vale",
    // The details page in each browser links here.
    homepage_url: "https://github.com/vale-cli/vale-web",
    description: "Your style guide, applied as you type. Lints in your browser; nothing leaves it.",
    permissions: ["storage", "unlimitedStorage", "activeTab"],
    // The engine is WebAssembly compiled from a file inside the package;
    // MV3's default policy forbids compiling it without this allowance.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    // Library packages are fetched from these hosts; any other package URL
    // asks for its origin when it is first synced.
    host_permissions: ["https://github.com/*", "https://raw.githubusercontent.com/*"],
    optional_host_permissions: ["https://*/*"],
    icons: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" },
    action: { default_title: "Vale" },
    commands: {
      "lint-field": {
        suggested_key: { default: "Alt+Shift+V" },
        description: "Check the focused field with Vale",
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    build: { target: "es2022" },
  }),
});
