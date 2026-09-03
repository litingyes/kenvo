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
      title: 'Kenvo — Write what you imagine, and beyond.',
      description:
        'Kenvo is a local-first AI short-form screenplay workbench. Build outlines, episodes, scenes, and shot cards as Markdown in your own folders.',
    },
    nav: {
      docs: 'Docs',
      github: 'GitHub',
      releases: 'Releases',
    },
    hero: {
      tagline: 'Write what you imagine, and beyond.',
      description:
        'Kenvo is a local-first AI short-form screenplay workbench. Move from outline to episodes, scenes, and shot cards as real Markdown files in your own folders — you steer, it proposes.',
      ctaPrimary: 'Download',
      ctaSecondary: 'View on GitHub',
    },
    features: {
      title: 'A studio built for writing with agents',
      items: [
        {
          title: 'Screenplay production loop',
          description:
            'Go from outline to episodes, scenes, and shots with a focused Screenwriter agent built for short-form AI video.',
        },
        {
          title: 'Real Files, Your Folders',
          description:
            'Your screenplay remains Markdown in the folder you choose. Import existing files without overwriting them, then organize with a proposal.',
        },
        {
          title: 'Steer Mid-Run',
          description:
            'Interrupt the agent while it works: redirect the plot, rename a character, change the tone — no need to restart.',
        },
        {
          title: 'Multi-provider Models',
          description:
            'Connect the provider and model that fit your workflow through the local agent server.',
        },
        {
          title: 'Scene continuity',
          description:
            'Keep characters, props, spaces, and shot-to-shot continuity visible in the screenplay map and writing coach.',
        },
        {
          title: 'Local-first',
          description:
            'Projects, chats, and settings live in local files and SQLite. Your words never leave your machine except to the model APIs you choose.',
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
      title: 'Kenvo — Write what you imagine, and beyond.',
      description:
        'Kenvo 是一个本地优先的 AI 短视频剧本工作台。总纲、分集、场景和镜头都以 Markdown 保存在你的文件夹中。',
    },
    nav: {
      docs: '文档',
      github: 'GitHub',
      releases: '发布',
    },
    hero: {
      tagline: 'Write what you imagine, and beyond.',
      description:
        'Kenvo 是一个本地优先的 AI 短视频剧本工作台。Agent 帮你从总纲推进到分集、场景和镜头——你掌舵，它先提案。',
      ctaPrimary: '下载',
      ctaSecondary: '在 GitHub 上查看',
    },
    features: {
      title: '为「与 Agent 一起写作」而生的工作台',
      items: [
        {
          title: '短视频剧本闭环',
          description:
            '围绕短视频 AI 生成，从总纲、分集推进到场景和镜头卡片，使用专注的 Screenwriter Agent。',
        },
        {
          title: '真实文件，你的文件夹',
          description:
            '剧本始终是你文件夹里的 Markdown。导入不会覆盖文件，结构整理通过可审阅提案完成。',
        },
        {
          title: '运行中随时掌舵',
          description: 'Agent 工作时也能插话：改剧情、换人设、调语气，无需打断重来。',
        },
        {
          title: '多 Provider 模型',
          description: '通过本地 Agent 服务连接适合你工作流的 Provider 与模型。',
        },
        {
          title: '场景连续性',
          description: '在剧本地图和写作教练中保持人物、道具、空间与镜头衔接清晰。',
        },
        {
          title: '本地优先',
          description:
            '项目、对话与设置都保存在本地文件与 SQLite。除了你选择的模型 API，文字不离开你的机器。',
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
