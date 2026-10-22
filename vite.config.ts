import { defineConfig } from "vite";

// GitHub Pages(プロジェクトサイト)は /<repo>/ 配下で配信される。Cloudflare Pages へ移す際は BASE_PATH=/ を指定する。
export default defineConfig({
  base: process.env.BASE_PATH ?? "/note-demo-site/",
});
