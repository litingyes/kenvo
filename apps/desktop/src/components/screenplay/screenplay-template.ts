import { api } from '@/lib/electron/api'

export const SHORT_DRAMA_TEMPLATE = 'short-video-drama' as const

export type ProjectTemplate = typeof SHORT_DRAMA_TEMPLATE | 'blank'

function templateFiles(title: string): Record<string, string> {
  return {
    'README.md': `---\ntype: project\ntemplate: ${SHORT_DRAMA_TEMPLATE}\n---\n# ${title}\n\n这是一个面向 AI 视频生成的短视频网剧项目。\n`,
    'outline.md': `---\ntype: outline\nstatus: outline\n---\n# ${title} · 总纲\n\n## 一句话梗概\n\n- \n\n## 全剧节奏\n\n- 开场钩子：\n- 中段升级：\n- 最终回收：\n\n## 分集地图\n\n| 集数 | 标题 | 核心冲突 | 结尾卡点 | 状态 |\n| --- | --- | --- | --- | --- |\n| 01 | 待命名 | 待补充 | 待补充 | outline |\n`,
    'story-bible.md': `---\ntype: story-bible\nstatus: outline\n---\n# 视觉与生成设定\n\n## 统一风格\n\n- 画幅：\n- 影像风格：\n- 光线与色彩：\n- 镜头基调：\n\n## 角色一致性规则\n\n- \n\n## 不要生成\n\n- \n`,
    'characters/_index.md': `---\ntype: characters\n---\n# 人物库\n\n记录每个角色的外观、服装、声音、行为习惯和当前人物弧线。\n`,
    'episodes/01/outline.md': `---\ntype: episode\nid: ep-01\norder: 1\nstatus: outline\nhook: 深夜，一个不该出现的人敲响了便利店的门。\ncliffhanger: 真相刚要说出口，灯突然全部熄灭。\n---\n# 第 01 集 · 待命名\n\n## 本集目标\n\n- \n\n## 场景顺序\n\n- 01-01-example：示例场，创建后可删除。\n`,
    'episodes/01/scenes/01-01-example.md': `---\ntype: scene\nid: ep-01-scene-01\nepisode: 01\norder: 1\nstatus: draft\nexample: true\nduration: 8\nlocation: 深夜便利店门口\ntime: 夜\ncharacters: [陌生人, 店员]\nsummary: 一个浑身湿透的陌生人冲到便利店门口，要求店员立刻关灯。\nconflict: 店员不相信陌生人，陌生人却说门外有人正在找他。\nturn: 便利店玻璃上出现了第三个人的倒影。\n---\n# 场景 01 · 深夜便利店门口\n\n## 场景概览\n\n- **摘要**：一个浑身湿透的陌生人冲到便利店门口，要求店员立刻关灯。\n- **冲突**：店员不相信陌生人，陌生人却说门外有人正在找他。\n- **戏剧变化**：便利店玻璃上出现了第三个人的倒影。\n\n## 镜头 01 · 3 秒\n\n- **画面**：暴雨中的便利店，招牌灯在水雾里忽明忽暗，一个浑身湿透的陌生人冲入画面。\n- **动作**：陌生人回头确认街角，手掌重重拍在玻璃门上。\n- **镜头**：远景快速推近到中近景，略带手持晃动，保持人物压迫感。\n- **光色**：冷蓝雨夜与便利店内部的暖黄色形成强烈对比。\n- **声音**：雨声、急促脚步声、门铃声，陌生人喘息但没有说话。\n- **连续性**：陌生人的黑色外套、左手伤口和湿透的头发在后续镜头保持一致。\n\n## 镜头 02 · 5 秒\n\n- **画面**：店员隔着玻璃看向陌生人，货架灯光映在她紧张的眼睛里。\n- **动作**：陌生人指向店内灯光，店员迟疑着伸手碰向开关。\n- **镜头**：肩后近景，在两人之间保持玻璃反光，缓慢横移。\n- **光色**：暖黄灯光逐渐被冷蓝雨光吞没。\n- **声音**：店员压低声音问“你是谁？”，远处传来听不清的人声。\n- **连续性**：玻璃反射中短暂出现第三个人的倒影，但真实街道中不能出现该人物。\n`,
    'continuity/setups-payoffs.md': `---\ntype: continuity\n---\n# 伏笔与回收\n\n| 伏笔 | 首次出现 | 计划回收 | 当前状态 |\n| --- | --- | --- | --- |\n| 示例：玻璃中的第三个倒影 | 第 01 集 / 场 01 | 待补充 | setup |\n`,
    'continuity/checklist.md': `---\ntype: checklist\n---\n# 剧本维护清单\n\n- [ ] 每场都有明确的画面、动作和声音\n- [ ] 每集开头有钩子\n- [ ] 每集结尾有卡点\n- [ ] 角色外观、服装和道具保持一致\n- [ ] 镜头之间的空间、时间和动作衔接清晰\n`,
  }
}

export async function bootstrapShortDramaProject(
  rootPath: string,
  title: string,
): Promise<string[]> {
  const created: string[] = []
  const files = templateFiles(title)
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = `${rootPath}/${relativePath}`
    if (await api.fs.exists(absolutePath)) continue
    const parent = absolutePath.slice(0, absolutePath.lastIndexOf('/'))
    if (parent) await api.fs.mkdir(parent, true)
    await api.fs.writeTextFile(absolutePath, content)
    created.push(relativePath)
  }
  return created
}
