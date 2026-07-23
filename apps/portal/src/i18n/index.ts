export const locales = ['en-US', 'zh-CN'] as const
export type Locale = (typeof locales)[number]

export interface Translations {
  meta: {
    title: string
    description: string
  }
  nav: {
    docs: string
    github: string
    releases: string
  }
  hero: {
    tagline: string
    description: string
    ctaPrimary: string
    ctaSecondary: string
  }
  features: {
    title: string
    items: Array<{
      title: string
      description: string
    }>
  }
  download: {
    title: string
    description: string
    button: string
    note: string
  }
  quickStart: {
    title: string
    copy: string
    copied: string
  }
  footer: {
    license: string
    links: {
      github: string
      releases: string
      issues: string
    }
  }
  theme: {
    light: string
    dark: string
    system: string
  }
  locale: {
    switchToEn: string
    switchToZh: string
  }
}

const dictionary: Record<Locale, Translations> = {
  'en-US': {
    meta: {
      title: 'Kenvo — AI-native terminal desktop workspace',
      description:
        'Kenvo brings terminal, file browsing, Git operations, and local AI capabilities into a single Electron desktop window.',
    },
    nav: {
      docs: 'Docs',
      github: 'GitHub',
      releases: 'Releases',
    },
    hero: {
      tagline: 'An AI-native terminal desktop workspace for developers.',
      description:
        'Kenvo brings terminal, file browsing, Git operations, and local AI capabilities into a single Electron desktop window, letting you switch seamlessly between the command line and AI assistance.',
      ctaPrimary: 'Download',
      ctaSecondary: 'View on GitHub',
    },
    features: {
      title: 'Everything in one workspace',
      items: [
        {
          title: 'Multi-session Terminal',
          description:
            'Launch real shell processes through Electron IPC with session tree grouping and sorting.',
        },
        {
          title: 'Git Workflow',
          description: 'Stage, commit, pull, push, fetch — plus AI-generated commit messages.',
        },
        {
          title: 'Extensible AI',
          description:
            'Local Hono agent server wired to OpenAI, Anthropic, DeepSeek, Moonshot, Alibaba Cloud, and xAI.',
        },
        {
          title: 'File & Path Info',
          description:
            'Right-side info panel shows path, command history, Git status, and file tree.',
        },
        {
          title: 'Themes',
          description: 'Light / dark / system modes with Kenvo, Ayu, and Catppuccin presets.',
        },
        {
          title: 'Local-first',
          description: 'Sessions, history, and settings persisted in SQLite and Electron Store.',
        },
      ],
    },
    download: {
      title: 'Get Kenvo',
      description: 'Download the latest release for macOS or build from source.',
      button: 'Download for macOS (arm64)',
      note: 'Windows and Linux builds are coming soon.',
    },
    quickStart: {
      title: 'Quick Start',
      copy: 'Copy',
      copied: 'Copied!',
    },
    footer: {
      license: 'Released under AGPL-3.0',
      links: {
        github: 'GitHub',
        releases: 'Releases',
        issues: 'Issues',
      },
    },
    theme: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    locale: {
      switchToEn: 'English',
      switchToZh: '简体中文',
    },
  },
  'zh-CN': {
    meta: {
      title: 'Kenvo — 面向开发者的 AI 原生终端桌面工作台',
      description: 'Kenvo 将终端、文件浏览、Git 操作和本地 AI 能力整合进一个 Electron 桌面窗口。',
    },
    nav: {
      docs: '文档',
      github: 'GitHub',
      releases: '发布',
    },
    hero: {
      tagline: '面向开发者的 AI 原生终端桌面工作台。',
      description:
        'Kenvo 将终端、文件浏览、Git 操作和本地 AI 能力整合进一个 Electron 桌面窗口，让你在命令行与 AI 辅助之间无缝切换。',
      ctaPrimary: '下载',
      ctaSecondary: '在 GitHub 上查看',
    },
    features: {
      title: '一个工作台，整合一切',
      items: [
        {
          title: '多会话终端',
          description: '通过 Electron IPC 启动真实 shell 进程，支持会话树分组与排序。',
        },
        {
          title: 'Git 工作流',
          description: '暂存、提交、拉取、推送、获取，并支持 AI 生成提交信息。',
        },
        {
          title: '可扩展 AI',
          description:
            '本地 Hono Agent 服务，可接入 OpenAI、Anthropic、DeepSeek、Moonshot、阿里云和 xAI。',
        },
        {
          title: '文件与路径信息',
          description: '右侧信息面板展示路径、命令历史、Git 状态与文件树。',
        },
        {
          title: '主题',
          description: '亮色 / 暗色 / 跟随系统，内置 Kenvo、Ayu、Catppuccin 预设。',
        },
        {
          title: '本地优先',
          description: '会话、历史与设置持久化到 SQLite 和 Electron Store。',
        },
      ],
    },
    download: {
      title: '获取 Kenvo',
      description: '下载 macOS 最新版本，或从源码构建。',
      button: '下载 macOS (arm64)',
      note: 'Windows 与 Linux 版本即将推出。',
    },
    quickStart: {
      title: '快速开始',
      copy: '复制',
      copied: '已复制',
    },
    footer: {
      license: '以 AGPL-3.0 协议发布',
      links: {
        github: 'GitHub',
        releases: '发布',
        issues: '问题',
      },
    },
    theme: {
      light: '浅色',
      dark: '深色',
      system: '跟随系统',
    },
    locale: {
      switchToEn: 'English',
      switchToZh: '简体中文',
    },
  },
}

export const getTranslations = (locale: Locale): Translations => dictionary[locale]
