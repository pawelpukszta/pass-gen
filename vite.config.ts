import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build inlines all JS and CSS into a single dist/index.html, so the tool
// can be opened straight from disk or published as one self-contained page.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
  },
});
