import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    fs: {
      // 允许页面通过 /@fs/ 访问工作区根目录中的原始档案（报纸 PDF、照片、图纸）
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
