import type { CardListData, Config, IntegrationUserConfig, ThemeUserConfig } from 'astro-pure/types'

export const theme: ThemeUserConfig = {
  // [Basic]
  /** Title for your website. Will be used in metadata and as browser tab title.
   * 网站标题。将用于元数据以及浏览器标签标题。
   */
  title: "LZWcc's Blog",
  /** Will be used in index page & copyright declaration
   * 将用于首页和版权声明
   */
  author: 'LZWcc',
  /** Description metadata for your website. Can be used in page metadata.
   * 网站描述元数据，可用于页面元信息。
   */
  description: 'Stay hungry, stay foolish',
  /** The default favicon for your site which should be a path to an image in the `public/` directory.
   * 站点的默认 favicon，应当是 `public/` 目录下图片的路径。
   */
  favicon: '/favicon/favicon.ico',
  /** The default social card image for your site which should be a path to an image in the `public/` directory.
   * 站点的默认社交分享卡片图片，应当是 `public/` 目录下图片的路径。
   */
  socialCard: '/images/social-card.png',
  /** Specify the default language for this site.
   * 指定站点的默认语言
   */
  locale: {
    lang: 'en-US',
    attrs: 'en_US',
    // Date locale // 日期区域设置
    dateLocale: 'en-US',
    dateOptions: {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  },
  /** Set a logo image to show in the homepage.
   * 在首页显示的 logo 图片
   */
  logo: {
    src: '/src/assets/avatar.png',
    alt: 'Avatar'
  },

  titleDelimiter: '•',
  prerender: true, // pagefind search is not supported with prerendering disabled // 如果禁用预渲染，pagefind 搜索不受支持
  npmCDN: 'https://cdn.jsdelivr.net/npm',

  // Still in test // 仍在测试中
  head: [
    /* Telegram channel */
    // {
    //   tag: 'meta',
    //   attrs: { name: 'telegram:channel', content: '@cworld0_cn' },
    //   content: ''
    // }
  ],
  customCss: [],

  /** Configure the header of your site.
   * 配置站点的头部（导航）
   */
  header: {
    menu: [
      { title: 'Blog', link: '/blog' },
      { title: 'Projects', link: '/projects' },
      // { title: 'Links', link: '/links' },
      { title: 'About', link: '/about' }
    ]
  },

  /** Configure the footer of your site.
   * 配置站点的页脚
   */
  footer: {
    // Year format // 年份格式
    year: `© ${new Date().getFullYear()}`,
    // year: `© 2019 - ${new Date().getFullYear()}`,
    links: [
      // Registration link // 备案/注册链接
      {
        title: 'Moe ICP 114514',
        link: 'https://icp.gov.moe/?keyword=114514',
        style: 'text-sm' // Uno/TW CSS class
      },
      // 注意: 上面注释保留英文并添加中文说明
      {
        title: 'Travelling',
        link: 'https://www.travellings.cn/go.html',
        style: 'text-sm'
      },
      // Privacy Policy link // 隐私政策链接
      {
        title: 'Site Policy',
        link: '/terms/list',
        pos: 2 // position set to 2 will be appended to copyright line
        // pos: 2 表示此项将追加到版权行末尾
      }
    ],
    /** Enable displaying a “Astro & Pure theme powered” link in your site’s footer.
     * 在站点页脚显示 “Astro & Pure theme powered” 链接
     */
    credits: true,
    /** Optional details about the social media accounts for this site.
     * 可选的社交媒体账户信息
     */
    social: { github: 'https://github.com/LZWcc' }
  },

  // [Content] // [内容]
  content: {
    /** External links configuration
     * 外部链接配置
     */
    externalLinks: {
      content: ' ↗',
      /** Properties for the external links element
       * 外部链接元素的属性
       */
      properties: {
        style: 'user-select:none'
      }
    },
    /** Blog page size for pagination (optional)
     * 博客分页大小（可选）
     */
    blogPageSize: 8,
    // Currently support weibo, x, bluesky // 当前支持 weibo、x、bluesky
    share: ['weibo', 'x', 'bluesky']
  }
}

export const integ: IntegrationUserConfig = {
  // [Links] // [链接]
  // https://astro-pure.js.org/docs/integrations/links
  links: {
    // Friend logbook // 朋友日志
    logbook: [
      { date: '2025-03-16', content: 'Is there a leakage?' },
      { date: '2025-03-16', content: 'A leakage of what?' },
      { date: '2025-03-16', content: 'I have a full seat of water, like, full of water!' },
      { date: '2025-03-16', content: 'Must be the water.' },
      { date: '2025-03-16', content: "Let's add that to the words of wisdom." }
    ],
    // Yourself link info // 个人链接信息
    applyTip: [
      { name: 'Name', val: theme.title },
      { name: 'Desc', val: theme.description || 'Null' },
      { name: 'Link', val: 'https://astro-pure.js.org/' },
      { name: 'Avatar', val: 'https://astro-pure.js.org/favicon/favicon.ico' }
    ],
    // Cache avatars in `public/avatars/` to improve user experience.
    // 在 `public/avatars/` 缓存头像以提升用户体验。
    cacheAvatar: false
  },
  // [Search] // [搜索]
  pagefind: true,
  // Add a random quote to the footer (default on homepage footer)
  // 在页脚添加随机语录（默认在首页页脚显示）
  // See: https://astro-pure.js.org/docs/integrations/advanced#web-content-render
  // [Quote] // [引用]
  quote: {
    // - Hitokoto // 日语一言 API
    // https://developer.hitokoto.cn/sentence/#%E8%AF%B7%E6%B1%82%E5%9C%B0%E5%9D%80
    // server: 'https://v1.hitokoto.cn/?c=i',
    // target: `(data) => (data.hitokoto || 'Error')`
    // - Quoteable
    // https://github.com/lukePeavey/quotable
    // server: 'http://api.quotable.io/quotes/random?maxLength=60',
    // target: `(data) => data[0].content || 'Error'`
    // - DummyJSON
    server: 'https://dummyjson.com/quotes/random',
    target: `(data) => (data.quote.length > 80 ? \`\${data.quote.slice(0, 80)}...\` : data.quote || 'Error')`
  },
  // [Typography] // [排版]
  // https://unocss.dev/presets/typography
  typography: {
    class: 'prose text-base',
    // The style of blockquote font `normal` / `italic` (default to italic in typography)
    // 引用块字体样式：`normal` / `italic`（排版中默认斜体）
    blockquoteStyle: 'italic',
    // The style of inline code block `code` / `modern` (default to code in typography)
    // 行内代码样式：`code` / `modern`（排版中默认 `code`）
    inlineCodeBlockStyle: 'modern'
  },
  // [Lightbox] // [灯箱]
  // A lightbox library that can add zoom effect
  // 可以添加缩放效果的灯箱库
  // https://astro-pure.js.org/docs/integrations/others#medium-zoom
  mediumZoom: {
    enable: true, // disable it will not load the whole library
    // enable: true 表示启用；禁用时不会加载整个库
    selector: '.prose .zoomable',
    options: {
      className: 'zoomable'
    }
  },
  // Comment system // 评论系统
  waline: {
    enable: true,
    // Server service link // 服务端链接
    server: import.meta.env.VITE_WALINE_SERVER,
    // Refer https://waline.js.org/en/guide/features/emoji.html
    // 参考 Waline Emoji 文档
    emoji: ['bmoji', 'weibo'],
    // Refer https://waline.js.org/en/reference/client/props.html
    // 参考 Waline 客户端属性文档
    additionalConfigs: {
      // search: false,
      pageview: true,
      comment: true,
      locale: {
        reaction0: 'Like',
        placeholder: '欢迎评论（填写邮箱以接收回复，无需登录）'
        // 提示文本：欢迎评论（填写邮箱以接收回复，无需登录）
      },
      imageUploader: false
    }
  }
}

export const terms: CardListData = {
  title: 'Terms content',
  list: [
    {
      title: 'Privacy Policy',
      link: '/terms/privacy-policy'
    },
    {
      title: 'Terms and Conditions',
      link: '/terms/terms-and-conditions'
    },
    {
      title: 'Copyright',
      link: '/terms/copyright'
    },
    {
      title: 'Disclaimer',
      link: '/terms/disclaimer'
    }
  ]
}

const config = { ...theme, integ } as Config
export default config
