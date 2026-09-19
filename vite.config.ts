import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build ra MOT file HTML duy nhat (dist/index.html) de mo truc tiep bang trinh duyet,
// khong can cai dat gi them - tien cho anh em van hanh dung tren may tram.
const BUILD_ID = new Date()
  .toISOString()
  .replace(/[-:T]/g, '')
  .slice(0, 12);

export default defineConfig({
  base: './',
  define: {
    // Ma phien ban ban build - dung de bo ban ve luu tam cua phien ban cu,
    // neu khong nguoi dung cap nhat file moi nhung van thay du lieu cu.
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000,
    cssCodeSplit: false,
  },
});
