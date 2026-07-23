# @kenvo/portal

Kenvo 对外的官方网站与文档入口，基于 [Astro](https://astro.build/) 7 构建。

## 技术栈

- Astro 7
- Tailwind CSS v4（CSS-first 配置）
- TypeScript
- Vercel adapter（静态输出）

## 开发

```bash
pnpm --filter @kenvo/portal dev
```

## 构建

```bash
pnpm --filter @kenvo/portal build
```

## 多语言

默认英文路径为 `/`，简体中文路径为 `/zh-CN/`。文案统一维护在 `src/i18n/index.ts`。

## 主题

主题系统与桌面端 Kenvo 品牌保持一致：

- primary: `#5e6ad2`
- accent: `#22c55e`
- 暗色背景：OLED 纯黑 `#050506`
- 亮色背景：纯白 `#ffffff`
- 字体：Geist Variable / Geist Mono Variable

支持 `light / dark / system` 三种模式，切换状态保存在 `localStorage` 的 `kenvo-portal-theme` 键中。

## 目录结构

```
src/
  components/   # 首页各区块组件
  i18n/         # 翻译字典
  layouts/      # 页面布局
  pages/        # 路由页面
  styles/       # 全局样式与主题变量
public/         # 静态资源（favicon 等）
```

## 授权

与主项目一致，采用 [AGPL-3.0](../LICENSE)。
