import { Plugin } from 'unified';

declare module 'remark-latex' {
  const plugin: Plugin; // Or a more specific plugin type if known, e.g., import { Plugin } from 'unified'; const plugin: Plugin;
  export default plugin;
}