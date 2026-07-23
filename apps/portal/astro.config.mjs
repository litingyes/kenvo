import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
  // TODO: replace with production domain when available
  site: 'https://kenvo.vercel.app',
  i18n: {
    locales: ['en-US', 'zh-CN'],
    defaultLocale: 'en-US',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: vercel(),
})
