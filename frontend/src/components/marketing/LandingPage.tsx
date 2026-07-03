import Link from "next/link";
import { AuthAwareLink } from "@/components/auth/AuthAwareLink";
import { Icon } from "@/components/ui/Icon";
import { absoluteUrl, siteConfig } from "@/lib/site";

const features = [
  {
    icon: "lightbulb",
    title: "灵感不流失",
    description:
      "走路、刷手机时的感触随手记录，截图与链接一键入库，灵感库 + 选题库帮你从碎片到成稿。",
  },
  {
    icon: "forum",
    title: "对话式打磨",
    description:
      "不满意就继续聊。像和编辑协作一样改结构、补论据、调语气，直到内容真正像你自己写的。",
  },
  {
    icon: "devices",
    title: "一稿多发",
    description:
      "同一选题自动生成公众号深度长文、小红书共鸣笔记、抖音口播脚本，各平台风格独立适配。",
  },
  {
    icon: "visibility",
    title: "发布前预览",
    description:
      "在工作室里直接预览各平台最终呈现效果，标题、封面、正文一次到位，减少发布前的反复调整。",
  },
  {
    icon: "psychology",
    title: "去 AI 味表达",
    description:
      "内置 humanizer 流水线，弱化模板感与营销腔，保留观察型创作者的真实、有温度、有分寸。",
  },
  {
    icon: "palette",
    title: "个人风格记忆",
    description:
      "设置你的语气、禁用词与个人片段，让每次生成更贴近你的表达习惯，而不是千篇一律的 AI 文案。",
  },
];

const steps = [
  {
    step: "01",
    title: "捕捉灵感",
    description: "一句话观察、截图或链接，先存下来再说。",
  },
  {
    step: "02",
    title: "对话成稿",
    description: "AI 搭结构、写初稿，你通过对话逐段修改至满意。",
  },
  {
    step: "03",
    title: "多平台发布",
    description: "预览公众号 / 小红书 / 抖音版本，复制导出即可发布。",
  },
];

const platforms = [
  {
    name: "微信公众号",
    icon: "article",
    tag: "深度长文",
    description: "适合社会观察、生活记录类深度内容，结构化段落与可读排版。",
    color: "bg-[#07c160]/10 text-[#07a050]",
  },
  {
    name: "小红书",
    icon: "auto_awesome",
    tag: "共鸣笔记",
    description: "短句分段、emoji 点缀、强共鸣开头，贴近笔记阅读习惯。",
    color: "bg-[#ff2442]/10 text-[#e01f3d]",
  },
  {
    name: "抖音",
    icon: "videocam",
    tag: "口播脚本",
    description: "钩子开场 + 口语化表达 + 分镜提示，直接对着镜头说。",
    color: "bg-inverse-surface/10 text-inverse-surface",
  },
];

const faqs = [
  {
    question: "PostCraft 和普通 AI 写作工具有什么不同？",
    answer:
      "PostCraft 不是一键生成爆款文案的工具，而是面向个人观察型创作者的工作台。它覆盖灵感沉淀、选题规划、对话式改稿、多平台适配与发布预览的完整链路，强调真实表达而非模板化内容。",
  },
  {
    question: "支持哪些内容平台？",
    answer:
      "目前支持微信公众号长文、小红书笔记和抖音口播脚本三种格式，可在创作工作室中实时预览各平台呈现效果，并一键复制或导出。",
  },
  {
    question: "需要配置 API Key 才能使用吗？",
    answer:
      "配置 DeepSeek 或 OpenAI API Key 后可获得完整的 AI 创作能力；未配置时系统会使用本地模板演示，方便先体验完整流程。",
  },
  {
    question: "适合什么样的创作者？",
    answer:
      "适合同时在多个平台发布内容的个人创作者，尤其是做生活观察、社会话题、消费避坑、农村生活记录等有观点、有温度的深度内容，而非营销矩阵批量发文。",
  },
  {
    question: "数据存储在哪里？",
    answer:
      "PostCraft 采用本地 SQLite 数据库，灵感、选题与草稿数据保存在你自己的环境中，适合注重隐私的个人创作者。",
  },
];

const useCases = [
  "农村老人健康观察",
  "消费陷阱与避坑指南",
  "环境污染与生活安全",
  "普通人生活记录",
  "社会现象深度评论",
];

function JsonLd() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.shortName,
    alternateName: "PostCraft",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: siteConfig.description,
    url: absoluteUrl("/"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CNY",
    },
    featureList: features.map((f) => f.title).join(", "),
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: absoluteUrl("/"),
    description: siteConfig.description,
    inLanguage: "zh-CN",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
    </>
  );
}

export function LandingPage() {
  return (
    <>
      <JsonLd />

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-outline-variant/20 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-headline text-xl font-bold text-primary">
            PostCraft
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              功能
            </a>
            <a
              href="#workflow"
              className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              如何使用
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              常见问题
            </a>
          </nav>
          <AuthAwareLink
            href="/workspace"
            className="rounded-xl bg-accent-cta px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            免费开始创作
          </AuthAwareLink>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pb-20 pt-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#fff8f1_0%,_transparent_50%)]" />
          <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="pointer-events-none absolute -right-32 top-40 h-80 w-80 rounded-full bg-accent-cta/5 blur-3xl" />

          <div className="relative mx-auto max-w-6xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#fde6d2] bg-[#fff8f1] px-4 py-1.5 text-sm font-medium text-accent-cta">
                  <Icon name="auto_awesome" className="text-[18px]" />
                  个人观察型内容创作工作台
                </div>
                <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.15] tracking-tight text-on-surface">
                  把生活观察，
                  <br />
                  <span className="text-primary">整理成可发布的好内容</span>
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-on-surface-variant/85">
                  {siteConfig.tagline}。从一句话灵感到公众号长文、小红书笔记、抖音脚本，
                  通过对话不断打磨，预览满意再发布。
                </p>
                <div className="flex flex-wrap gap-4">
                  <AuthAwareLink
                    href="/workspace"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent-cta px-8 py-4 text-base font-bold text-white shadow-lg shadow-accent-cta/20 transition-all hover:opacity-90 hover:shadow-xl"
                  >
                    立即免费体验
                    <Icon name="arrow_forward" className="text-[20px]" />
                  </AuthAwareLink>
                  <a
                    href="#workflow"
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-8 py-4 text-base font-semibold text-on-surface transition-colors hover:border-primary/30 hover:bg-surface-container-low"
                  >
                    了解工作流程
                  </a>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {useCases.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-surface-container px-3 py-1 text-xs font-medium text-on-surface-variant"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hero visual mockup */}
              <div className="relative hidden lg:block">
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl shadow-primary/5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-error/60" />
                    <div className="h-3 w-3 rounded-full bg-secondary-container" />
                    <div className="h-3 w-3 rounded-full bg-primary/40" />
                    <span className="ml-2 text-xs text-on-surface-variant/50">创作工作室</span>
                  </div>
                  <div className="space-y-4 rounded-xl border border-outline-variant/20 bg-[#fff8f1] p-5">
                    <p className="text-sm text-on-surface-variant/70">输入灵感</p>
                    <p className="font-headline text-base font-semibold leading-relaxed text-on-surface">
                      农村老人重疾增多，可能和劣质商品、环境污染有关——这个观察值得写成一篇有温度的内容。
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {platforms.map((p) => (
                      <div
                        key={p.name}
                        className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 text-center"
                      >
                        <Icon name={p.icon} className="mb-1 text-[20px] text-primary" />
                        <p className="text-[11px] font-semibold text-on-surface-variant">{p.tag}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
                    <Icon name="forum" className="text-[20px] text-primary" />
                    <p className="text-sm text-on-surface-variant">
                      继续对话：「第二段再口语一点，加入一个具体案例」
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pain points */}
        <section className="border-y border-outline-variant/20 bg-surface-container-low px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-sm font-semibold uppercase tracking-widest text-primary">
              为什么需要 PostCraft
            </p>
            <h2 className="font-headline mx-auto mt-3 max-w-2xl text-center text-3xl font-bold text-on-surface">
              不缺想法，缺的是从灵感到发布的完整链路
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "water_drop", title: "灵感易流失", desc: "感触来了没地方记，过后想写却忘了" },
                { icon: "repeat", title: "改稿成本高", desc: "结构、论据、语气、标题反复调整" },
                { icon: "sync_alt", title: "一稿难多发", desc: "各平台表达方式完全不同" },
                { icon: "preview", title: "发布前心里没底", desc: "看不清最终在各平台的呈现" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 text-center"
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon name={item.icon} className="text-[24px] text-primary" />
                  </div>
                  <h3 className="font-headline font-bold text-on-surface">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant/80">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">核心功能</p>
              <h2 className="font-headline mt-3 text-3xl font-bold text-on-surface">
                为个人创作者设计的完整工作流
              </h2>
              <p className="mt-4 text-on-surface-variant/80">
                不是单纯的 AI 写作，而是覆盖灵感 → 选题 → 创作 → 预览 → 发布的个人内容工作台。
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="snippet-card rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-8"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon name={feature.icon} className="text-[24px] text-primary" />
                  </div>
                  <h3 className="font-headline text-lg font-bold text-on-surface">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-on-surface-variant/85">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="bg-inverse-surface px-6 py-20 text-inverse-on-surface">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-inverse-on-surface/60">
                三步上手
              </p>
              <h2 className="font-headline mt-3 text-3xl font-bold">从灵感到发布，只需三步</h2>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {steps.map((item, i) => (
                <div key={item.step} className="relative">
                  {i < steps.length - 1 && (
                    <div className="absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] bg-inverse-on-surface/15 md:block" />
                  )}
                  <div className="text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-inverse-on-surface/10 font-headline text-2xl font-bold">
                      {item.step}
                    </div>
                    <h3 className="font-headline text-xl font-bold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-inverse-on-surface/70">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-14 text-center">
              <AuthAwareLink
                href="/workspace"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-cta px-8 py-4 text-base font-bold text-white transition-opacity hover:opacity-90"
              >
                进入工作台开始创作
                <Icon name="arrow_forward" className="text-[20px]" />
              </AuthAwareLink>
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">多平台适配</p>
              <h2 className="font-headline mt-3 text-3xl font-bold text-on-surface">
                一稿多发，各平台风格独立优化
              </h2>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {platforms.map((platform) => (
                <article
                  key={platform.name}
                  className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-8"
                >
                  <div className={`mb-4 inline-flex rounded-lg px-3 py-1 text-xs font-bold ${platform.color}`}>
                    {platform.tag}
                  </div>
                  <div className="mb-4 flex items-center gap-3">
                    <Icon name={platform.icon} className="text-[28px] text-primary" />
                    <h3 className="font-headline text-xl font-bold text-on-surface">{platform.name}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-on-surface-variant/85">{platform.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-outline-variant/20 bg-surface-container-low px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">常见问题</p>
              <h2 className="font-headline mt-3 text-3xl font-bold text-on-surface">你可能想了解的</h2>
            </div>
            <div className="mt-12 space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-xl border border-outline-variant/30 bg-surface-container-lowest"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-headline font-semibold text-on-surface [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <Icon
                      name="expand_more"
                      className="shrink-0 text-[24px] text-on-surface-variant transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="border-t border-outline-variant/20 px-6 py-5 text-sm leading-relaxed text-on-surface-variant/85">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-4xl rounded-3xl border border-[#fde6d2] bg-[#fff8f1] px-8 py-16 text-center">
            <h2 className="font-display text-3xl font-bold text-on-surface md:text-4xl">
              今天的一个观察，可能就是明天的爆款内容
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-on-surface-variant/80">
              打开 PostCraft，用一句话灵感开始你的第一篇多平台内容。免费使用，本地部署，数据自己掌控。
            </p>
            <AuthAwareLink
              href="/workspace"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent-cta px-10 py-4 text-base font-bold text-white shadow-lg shadow-accent-cta/20 transition-all hover:opacity-90"
            >
              免费开始创作
              <Icon name="rocket_launch" className="text-[20px]" />
            </AuthAwareLink>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/20 bg-surface-container-low px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <p className="font-headline text-lg font-bold text-primary">{siteConfig.name}</p>
            <p className="mt-1 text-sm text-on-surface-variant/70">{siteConfig.tagline}</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 text-sm text-on-surface-variant">
            <AuthAwareLink href="/workspace" className="transition-colors hover:text-primary">
              工作台
            </AuthAwareLink>
            <AuthAwareLink href="/inspirations" className="transition-colors hover:text-primary">
              灵感库
            </AuthAwareLink>
            <AuthAwareLink href="/topics" className="transition-colors hover:text-primary">
              选题库
            </AuthAwareLink>
            <a href="#faq" className="transition-colors hover:text-primary">
              常见问题
            </a>
          </nav>
          <p className="text-xs text-on-surface-variant/50">
            © {new Date().getFullYear()} PostCraft. 个人观察型内容创作工作台。
          </p>
        </div>
      </footer>
    </>
  );
}
