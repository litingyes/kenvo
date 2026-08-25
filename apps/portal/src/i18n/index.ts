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
        'Kenvo is a local-first AI writing studio. Autonomous writing agents create novels, screenplays, and prompts right in your local folders.',
    },
    nav: {
      docs: 'Docs',
      github: 'GitHub',
      releases: 'Releases',
    },
    hero: {
      tagline: 'Write what you imagine, and beyond.',
      description:
        'Kenvo is a local-first AI writing studio. Autonomous writing agents plan, draft, and revise novels, screenplays, and prompts as real Markdown files in your own folders — you steer, they write.',
      ctaPrimary: 'Download',
      ctaSecondary: 'View on GitHub',
    },
    features: {
      title: 'A studio built for writing with agents',
      items: [
        {
          title: 'Autonomous Writing Agents',
          description:
            'Novelist, Screenwriter, Prompt Engineer, and a general Writer — each with its own craft instructions and project templates.',
        },
        {
          title: 'Real Files, Your Folders',
          description:
            'Agents read and write Markdown directly in the project folder you choose. Everything stays usable in any editor.',
        },
        {
          title: 'Steer Mid-Run',
          description:
            'Interrupt the agent while it works: redirect the plot, rename a character, change the tone — no need to restart.',
        },
        {
          title: 'Multi-provider Models',
          description:
            'OpenAI, Anthropic, DeepSeek, Moonshot, Alibaba Cloud, and xAI via a local agent server, with per-agent model assignment.',
        },
        {
          title: 'Long-form Continuity',
          description:
            'Chapters, characters, and worldbuilding stay consistent as agents re-read the project before writing more.',
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
        'Kenvo 是一个本地优先的 AI 写作工作台。自主写作 Agent 在你的本地文件夹中直接创作小说、剧本与 Prompt。',
    },
    nav: {
      docs: '文档',
      github: 'GitHub',
      releases: '发布',
    },
    hero: {
      tagline: 'Write what you imagine, and beyond.',
      description:
        'Kenvo 是一个本地优先的 AI 写作工作台。写作 Agent 在你选择的文件夹里构思、起草、修改小说、剧本与 Prompt——你掌舵，它落笔。',
      ctaPrimary: '下载',
      ctaSecondary: '在 GitHub 上查看',
    },
    features: {
      title: '为「与 Agent 一起写作」而生的工作台',
      items: [
        {
          title: '自主写作 Agent',
          description:
            'Novelist、Screenwriter、Prompt Engineer 与通用 Writer，各自拥有专属写作指令与项目模板。',
        },
        {
          title: '真实文件，你的文件夹',
          description: 'Agent 直接在你选择的项目文件夹中读写 Markdown，任何编辑器都能继续创作。',
        },
        {
          title: '运行中随时掌舵',
          description: 'Agent 工作时也能插话：改剧情、换人设、调语气，无需打断重来。',
        },
        {
          title: '多 Provider 模型',
          description:
            '通过本地 Agent 服务接入 OpenAI、Anthropic、DeepSeek、Moonshot、阿里云与 xAI，每个 Agent 可指派不同模型。',
        },
        {
          title: '长篇一致性',
          description: '章节、人物与世界观保持连贯——Agent 落笔前会先重读项目。',
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
