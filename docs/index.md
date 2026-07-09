# QEMU Training Camp

<style>
body:has(.home-page) .md-main__inner {
  display: block;
  max-width: none;
  padding: 0;
}

body:has(.home-page) .md-sidebar {
  display: none;
}

body:has(.home-page) .md-content {
  max-width: none;
}

body:has(.home-page) .md-content__inner {
  background: transparent;
  border: 0;
  box-shadow: none;
  margin: 0;
  padding: 0 1.14286rem 1.6rem;
}

body:has(.home-page) .md-content__inner > h1:first-child {
  height: 1px;
  margin: 0;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

.home-page {
  --home-primary: var(--md-primary-fg-color, #2196f3);
  --home-primary-dark: #1565c0;
  --home-primary-soft: rgba(33, 150, 243, 0.08);
  --home-bg: #f6f6f6;
  --home-card: #ffffff;
  --home-card-soft: #fbfbfb;
  --home-text: #333333;
  --home-text-strong: #222222;
  --home-muted: #666666;
  --home-subtle: #999999;
  --home-border: #e8e8e8;
  --home-shadow: 0 0.2rem 0.7rem rgba(0, 0, 0, 0.045);
  --home-shadow-hover: 0 0.45rem 0.8rem rgba(0, 0, 0, 0.12);
  --home-radius: 0.4rem;
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 65.6rem;
}

.home-hero {
  align-items: center;
  background: var(--home-card);
  border-radius: var(--home-radius);
  box-shadow: var(--home-shadow);
  display: flex;
  min-height: 19rem;
  overflow: hidden;
  padding: 2.55rem;
  position: relative;
}

.home-hero::before {
  background: linear-gradient(90deg, var(--home-card) 0%, rgba(255, 255, 255, 0.9) 44%, rgba(255, 255, 255, 0.2) 100%);
  content: "";
  inset: 0;
  position: absolute;
  z-index: 1;
}

.home-hero__image {
  height: 100%;
  inset: 0;
  object-fit: cover;
  object-position: center;
  position: absolute;
  width: 100%;
}

.home-hero__content {
  max-width: 28rem;
  position: relative;
  z-index: 2;
}

.home-eyebrow {
  color: var(--home-primary-dark);
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  margin-bottom: 0.55rem;
}

.home-hero__title {
  color: var(--home-text-strong);
  font-size: 2.55rem;
  font-weight: 750;
  line-height: 1.12;
  margin: 0;
}

.home-hero__desc {
  color: var(--home-muted);
  font-size: 1rem;
  line-height: 1.7;
  margin: 0.9rem 0 0;
}

.home-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.65rem;
}

.home-button {
  align-items: center;
  background: transparent;
  border: 1px solid var(--home-text-strong);
  border-radius: 1.2rem;
  color: var(--home-text-strong) !important;
  display: inline-flex;
  font-size: 0.76rem;
  font-weight: 700;
  min-height: 2.3rem;
  padding: 0.45rem 1.2rem;
  text-decoration: none !important;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.home-button:hover {
  border-color: var(--home-primary-dark);
  color: var(--home-primary-dark) !important;
}

.home-button--primary {
  background: var(--home-primary);
  border-color: var(--home-primary);
  color: #ffffff !important;
}

.home-button--primary:hover {
  background: var(--home-primary-dark);
  border-color: var(--home-primary-dark);
  color: #ffffff !important;
}

.home-stat-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 1.14286rem 0;
}

.home-stat,
.home-section,
.home-list-panel {
  background: var(--home-card);
  border-radius: var(--home-radius);
  box-shadow: var(--home-shadow);
}

.home-stat {
  border: 1px solid var(--home-border);
  min-height: 6rem;
  padding: 1rem;
}

.home-stat__value {
  color: var(--home-text-strong);
  display: block;
  font-size: 1.45rem;
  font-weight: 800;
  line-height: 1.2;
}

.home-stat__label {
  color: var(--home-muted);
  display: block;
  font-size: 0.68rem;
  line-height: 1.55;
  margin-top: 0.45rem;
}

.home-section,
.home-list-panel {
  margin-top: 1.14286rem;
  padding: 1.14286rem;
}

.home-section__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.95rem;
}

.home-section__head h2 {
  border: 0;
  color: var(--home-text-strong);
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
  padding: 0;
}

.home-section__head a {
  color: var(--home-subtle);
  font-size: 0.72rem;
  font-weight: 650;
  text-decoration: none;
}

.home-section__head a:hover {
  color: var(--home-primary);
}

.home-entry-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1.35fr 1fr 1fr;
}

.home-entry-card,
.home-product-card,
.home-list-item {
  text-decoration: none !important;
}

.home-entry-card {
  background: var(--home-card-soft);
  border: 1px solid var(--home-border);
  border-radius: var(--home-radius);
  color: var(--home-text);
  display: flex;
  flex-direction: column;
  min-height: 9rem;
  padding: 1.25rem;
  transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.home-entry-card--wide {
  background: linear-gradient(125deg, var(--home-primary-soft) 0%, var(--home-card) 100%);
}

.home-entry-card:hover,
.home-product-card:hover {
  border-color: rgba(33, 150, 243, 0.45);
  box-shadow: var(--home-shadow-hover);
}

.home-entry-card__kicker {
  color: var(--home-primary-dark);
  font-size: 0.66rem;
  font-weight: 700;
}

.home-entry-card__title {
  color: var(--home-text-strong);
  font-size: 1.1rem;
  font-weight: 750;
  line-height: 1.35;
  margin-top: 0.5rem;
}

.home-entry-card__desc {
  color: var(--home-muted);
  font-size: 0.72rem;
  line-height: 1.65;
  margin-top: 0.55rem;
}

.home-product-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.home-product-card {
  background: var(--home-card);
  border: 1px solid var(--home-border);
  border-radius: var(--home-radius);
  color: var(--home-text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.home-product-card img {
  aspect-ratio: 16 / 9;
  background: var(--home-card-soft);
  object-fit: cover;
  width: 100%;
}

.home-product-card span {
  color: var(--home-text-strong);
  font-size: 0.9rem;
  font-weight: 750;
  line-height: 1.35;
  padding: 0.85rem 0.85rem 0;
}

.home-product-card p {
  color: var(--home-muted);
  font-size: 0.68rem;
  line-height: 1.6;
  margin: 0;
  padding: 0.35rem 0.85rem 0.95rem;
}

.home-list-item {
  align-items: center;
  border-radius: var(--home-radius);
  color: var(--home-text);
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 0.55rem 0.65rem;
  transition: background 150ms ease;
}

.home-list-item:hover {
  background: var(--home-primary-soft);
}

.home-list-item:hover span {
  color: var(--home-primary);
}

.home-list-item span {
  color: var(--home-text-strong);
  font-size: 0.78rem;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-list-item small {
  color: var(--home-subtle);
  flex-shrink: 0;
  font-size: 0.62rem;
}

.home-gallery {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1.2fr 1fr 1fr;
}

.home-gallery img {
  aspect-ratio: 4 / 3;
  border-radius: var(--home-radius);
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.home-partner-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(8, minmax(0, 1fr));
}

.home-partner-logo {
  align-items: center;
  background: var(--home-card-soft);
  border: 1px solid var(--home-border);
  border-radius: var(--home-radius);
  display: flex;
  grid-column: span 2;
  justify-content: center;
  min-height: 4.8rem;
  padding: 0.8rem 1rem;
  transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.home-partner-logo:hover {
  background: var(--home-primary-soft);
  border-color: rgba(33, 150, 243, 0.45);
  box-shadow: var(--home-shadow-hover);
}

.home-partner-logo img {
  display: block;
  max-height: 2.4rem;
  max-width: 100%;
  object-fit: contain;
}

@media screen and (min-width: 76.1876em) {
  .home-partner-logo:last-child:nth-child(4n + 1) {
    grid-column: 4 / span 2;
  }

  .home-partner-logo:nth-last-child(2):nth-child(4n + 1) {
    grid-column: 3 / span 2;
  }
}

.home-partner-note {
  color: var(--home-subtle);
  font-size: 0.68rem;
  line-height: 1.5;
  margin: 0.75rem 0 0;
  text-align: right;
}

.home-about {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-columns: 1.4fr 1fr;
}

.home-about h2 {
  border: 0;
  color: var(--home-text-strong);
  font-size: 1.3rem;
  margin: 0;
  padding: 0;
}

.home-about p {
  color: var(--home-muted);
  font-size: 0.76rem;
  line-height: 1.75;
  margin: 0.6rem 0 0;
}

.home-about__meta {
  background: var(--home-card-soft);
  border: 1px solid var(--home-border);
  border-radius: var(--home-radius);
  display: grid;
  gap: 0.55rem;
  padding: 0.85rem;
}

.home-about__meta span {
  color: var(--home-muted);
  font-size: 0.68rem;
  line-height: 1.45;
}

@media screen and (max-width: 76.1875em) {
  .home-stat-grid,
  .home-product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-partner-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .home-partner-logo:last-child:nth-child(3n + 1) {
    grid-column: 3 / span 2;
  }

  .home-partner-logo:nth-last-child(2):nth-child(3n + 1) {
    grid-column: 2 / span 2;
  }

  .home-entry-grid,
  .home-gallery,
  .home-about {
    grid-template-columns: 1fr;
  }
}

@media screen and (max-width: 44.984375em) {
  body:has(.home-page) .md-content__inner {
    padding: 0 0.8rem 1rem;
  }

  .home-hero {
    min-height: 17rem;
    padding: 1.15rem;
  }

  .home-hero::before {
    background: linear-gradient(90deg, var(--home-card) 0%, rgba(255, 255, 255, 0.92) 72%, rgba(255, 255, 255, 0.4) 100%);
  }

  .home-hero__title {
    font-size: 1.75rem;
  }

  .home-stat-grid,
  .home-product-grid {
    grid-template-columns: 1fr;
  }

  .home-partner-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .home-partner-logo:last-child:nth-child(2n + 1) {
    grid-column: 2 / span 2;
  }
}
</style>

<div class="home-page">
  <section class="home-hero">
    <img class="home-hero__image" src="image/qemu-camp-hero-bg.png" alt="QEMU 训练营科技渐变背景" />
    <div class="home-hero__content">
      <span class="home-eyebrow">QEMU Training Camp</span>
      <p class="home-hero__title">QEMU 训练营</p>
      <p class="home-hero__desc">以模拟器/虚拟化技术为底座的 CPU/GPGPU 体系结构相关的开放学习与实践平台，全程免费，资料开源，社区共建。</p>
      <div class="home-hero__actions">
        <a class="home-button home-button--primary" href="tutorial/2026/">开始学习</a>
        <a class="home-button" href="exercise/2026/">查看实验</a>
      </div>
    </div>
  </section>

  <section class="home-stat-grid" aria-label="累计训练营数据">
    <div class="home-stat">
      <span class="home-stat__value">2167</span>
      <span class="home-stat__label">累计报名人数</span>
    </div>
    <div class="home-stat">
      <span class="home-stat__value">637</span>
      <span class="home-stat__label">累计覆盖高校</span>
    </div>
    <div class="home-stat">
      <span class="home-stat__value">433</span>
      <span class="home-stat__label">累计覆盖企业</span>
    </div>
    <div class="home-stat">
      <span class="home-stat__value">140</span>
      <span class="home-stat__label">累计覆盖城市</span>
    </div>
  </section>

  <section class="home-section">
    <div class="home-section__head">
      <h2>学习入口</h2>
      <a href="tutorial/2026/">全部讲义</a>
    </div>
    <div class="home-entry-grid">
      <a class="home-entry-card home-entry-card--wide" href="tutorial/2026/">
        <span class="home-entry-card__kicker">Tutorial</span>
        <span class="home-entry-card__title">QEMU 训练营 2026 讲义</span>
        <span class="home-entry-card__desc">从开发环境、QOM、MemoryRegion 到 TCG、CPU 建模、PCIe、Rust 建模和项目实践。</span>
      </a>
      <a class="home-entry-card" href="exercise/2026/">
        <span class="home-entry-card__kicker">Exercise</span>
        <span class="home-entry-card__title">实验手册</span>
        <span class="home-entry-card__desc">覆盖 C、Rust、CPU、SoC、GPU 等方向的阶段实验。</span>
      </a>
      <a class="home-entry-card" href="blogs/">
        <span class="home-entry-card__kicker">Blog</span>
        <span class="home-entry-card__title">技术博客</span>
        <span class="home-entry-card__desc">训练营成员复盘、建模笔记、软件栈探索和开源协作经验。</span>
      </a>
    </div>
  </section>

  <section class="home-section">
    <div class="home-section__head">
      <h2>项目预览</h2>
      <a href="tutorial/2026/ch3/">全部项目</a>
    </div>
    <div class="home-product-grid">
      <a class="home-product-card" href="tutorial/2026/ch3/qemu-k230/">
        <img src="image/home-direction-soc.jpg" alt="K230 星务计算单元 QEMU 建模示意" />
        <span>K230 星务计算单元建模</span>
        <p>基于 QEMU 上游 K230 machine，推进 RustSBI 适配、外设补全和安全实验支撑。</p>
      </a>
      <a class="home-product-card" href="tutorial/2026/ch3/qemu-cxlemu/">
        <img src="image/home-direction-gpgpu.jpg" alt="CXLMemSim 与 QEMU 推理后端优化示意" />
        <span>CXLMemSim 推理后端优化</span>
        <p>在 QEMU + CXLMemSim 的 CXL Type-2 仿真环境中优化 Kimi K2.6 供数路径。</p>
      </a>
      <a class="home-product-card" href="tutorial/2026/ch3/qemu-agent/">
        <img src="image/home-direction-cpu.jpg" alt="大模型 Agent 自动化外设建模示意" />
        <span>Agent 自动化外设建模</span>
        <p>围绕 STM32 等 MCU 外设，探索参考手册、驱动代码到 QEMU 模型的自动化生成。</p>
      </a>
      <a class="home-product-card" href="tutorial/2026/ch3/qemu-wine-ce/">
        <img src="image/home-direction-rust.jpg" alt="Wine-CE RISC-V 适配 x86 应用示意" />
        <span>Wine-CE 跨架构应用兼容</span>
        <p>基于 Wine、Box64 与 QEMU user 协作，在 RISC-V 等平台适配 x86 应用和游戏。</p>
      </a>
    </div>
  </section>

  <section class="home-section">
    <div class="home-section__head">
      <h2>最新动态</h2>
      <a href="news/2026/qemu-camp-project-stage-2026-07-03/">更多</a>
    </div>
    <a class="home-list-item" href="news/2026/qemu-camp-project-stage-2026-07-03/">
      <span>QEMU 训练营 2026 项目阶段正式开启</span>
      <small>2026.07.03</small>
    </a>
    <a class="home-list-item" href="news/2026/qemu-camp-meetup-2026-04-05/">
      <span>启航！QEMU 训练营 2026 开营，深耕虚拟化与体系结构教学新征程</span>
      <small>2026.04.05</small>
    </a>
    <a class="home-list-item" href="news/2026/qemu-camp-update-2026-03-17/">
      <span>QEMU 训练营 2026 正式开放报名！2000 个名额等你来</span>
      <small>2026.03.17</small>
    </a>
    <a class="home-list-item" href="news/2026/qemu-camp-meetup-2026-02-28/">
      <span>QEMU 训练营 2026 二月工作推进会顺利召开，实验体系初步成型</span>
      <small>2026.02.28</small>
    </a>
    <a class="home-list-item" href="news/2026/qemu-camp-update-2026-01-31/">
      <span>聚焦开源与云原生！GTOC & CNB 首次线下 Meetup 完美收官</span>
      <small>2026.01.31</small>
    </a>
    <a class="home-list-item" href="news/2026/qemu-camp-meetup-2026-01-30/">
      <span>QEMU 训练营 2026 第一次工作推进会顺利召开，各项筹备有序落地</span>
      <small>2026.01.30</small>
    </a>
  </section>

  <section class="home-section">
    <div class="home-section__head">
      <h2>社区活动</h2>
      <a href="news/2026/qemu-camp-update-2026-01-31/">查看报道</a>
    </div>
    <div class="home-gallery">
      <img src="image/cnb-and-gtoc-meetup-01.jpg" alt="GTOC 与 CNB Meetup 活动现场" />
      <img src="image/cnb-and-gtoc-meetup-02.jpg" alt="GTOC 与 CNB Meetup 嘉宾分享" />
      <img src="image/cnb-and-gtoc-meetup-03.jpg" alt="GTOC 与 CNB Meetup 合影交流" />
    </div>
  </section>

  <section class="home-section" aria-label="合作伙伴">
    <div class="home-section__head">
      <h2>合作伙伴</h2>
    </div>
    <div class="home-partner-grid">
      <div class="home-partner-logo">
        <img src="image/partners/hust.png" alt="华中科技大学开放原子开源俱乐部 logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/cnb.png" alt="腾讯云 CNB 社区 logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/rv2036.png" alt="甲辰计划 logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/os2edu.png" alt="开源操作系统社区 logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/kubuds.svg" alt="苦芽科技 logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/metax.svg" alt="沐曦 logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/opencamp.png" alt="OpenCamp 训练营社区 logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/kendryte.svg" alt="Kendryte 勘智 logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/zettai.png" alt="Zett.ai logo" loading="lazy" />
      </div>
      <div class="home-partner-logo">
        <img src="image/partners/linux-tools.png" alt="Linux 工具社区 logo" loading="lazy" />
      </div>
    </div>
    <p class="home-partner-note">PS: 合作伙伴排名不分先后</p>
  </section>

  <section class="home-section home-about">
    <div>
      <h2>关于 QEMU 训练营</h2>
      <p>QEMU 训练营是在清华大学陈渝老师团队的倡议下，由格维开源社区发起，并与华中科技大学开放原子俱乐部联合主办的公益性技术训练营，旨在搭建一个以模拟器/虚拟化技术为底座的 CPU/GPGPU 体系结构相关的开放学习与实践平台，全程免费，资料开源，社区共建。</p>
    </div>
    <div class="home-about__meta">
      <span>发起组织：格维开源社区</span>
      <span>维护团队：QEMU 训练营项目组</span>
      <span>文档许可：CC BY-SA 4.0</span>
      <span>代码许可：MIT</span>
    </div>
  </section>
</div>
