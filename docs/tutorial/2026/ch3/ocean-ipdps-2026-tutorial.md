# OCEAN IPDPS 2026 Tutorial 课件

本页提供 OCEAN IPDPS 2026 Tutorial 课件的版本信息、在线预览和下载入口。

## 资源入口

!!! tip "推荐阅读方式"

    PDF 可直接在桌面端和移动端浏览器中打开，不需要安装 PowerPoint。

- [在线预览：PDF](https://github.com/gevico/qemu-camp-tutorial/releases/download/ocean-ipdps-2026-draft/OCEAN_IPDPS_2026_tutorial_draft.pdf)
- [下载源文件：PPTX](./OCEAN_IPDPS_2026_tutorial_draft.pptx)
- [下载页：GitHub Release](https://github.com/gevico/qemu-camp-tutorial/releases/tag/ocean-ipdps-2026-draft)
- [下载校验文件：SHA256SUMS](https://github.com/gevico/qemu-camp-tutorial/releases/download/ocean-ipdps-2026-draft/SHA256SUMS)

## 资源元数据

| 项目 | 信息 |
| --- | --- |
| 标题 | OCEAN: An Open-Source CXL Emulation Platform at Hyperscale |
| 版本 | `2026-draft` |
| 状态 | `draft`（草稿，不是正式定稿） |
| PPTX 格式 | Office Open XML Presentation（`.pptx`） |
| PDF 格式 | Portable Document Format（`.pdf`） |
| 页数 | 64 页 |
| PPTX 大小 | 9,704,568 bytes（约 9.25 MiB） |
| PPTX 源文件更新时间 | 2026-05-27（文件内部元数据） |
| 仓库文件更新时间 | 2026-07-01（当前源文件） |
| 来源 | IPDPS 2026 Tutorial / OCEAN 项目 |
| 维护者 | QEMU Camp Tutorial 维护者；课件内容维护者待在正式发布前补充 |
| PPTX SHA-256 | `74f49e9e66eb830fd38de9ff03287c85666a58a4c70c01144656f1b554f1263a` |

PDF 与 PPTX 不在文档站点中重复存储。PDF 由维护者在本地使用 LibreOffice 生成，经过
检查后作为 GitHub Release asset 手动发布。Release 中的 `SHA256SUMS` 同时记录 PDF 和
PPTX 的校验值。文档站点构建不会安装 Office 软件，也不会自动转换课件。

## 授权与署名

课件中的原创文字、原创图表和原创讲解内容，除另有注明外，按仓库文档部分采用的
CC BY-SA 4.0 国际许可证发布。再发布或改编时必须保留作者、来源和许可证说明，并以相同
许可证发布改编内容。

课件中的第三方素材不因课件发布而自动获得上述许可证。使用者必须逐项遵守素材原始许可：

- OCEAN、QEMU、CXLMemSim 等项目名称、Logo、截图和商标，须保留项目名称、来源链接和
  原作者署名；商标仅作项目指示，不表示获得额外商标授权。
- 论文、规格书、网页或其他外部来源的图片、图表和文字，须按照对应来源的许可证和引用
  要求使用；来源不允许再分发的素材不得从 PDF 或 PPTX 中单独提取、再发布或商用。
- 外部代码片段、数据集和示例，须保留各自的版权声明、许可证和引用信息。
- 字体须按照字体许可证使用。转换环境会使用可再分发字体；如果字体替换影响排版，应以
  PPTX 中的实际字体和其许可证为准。

目前仓库没有为该课件提供逐项第三方素材清单。课件维护者在发布 `final` 版本前必须补充
逐项署名和许可证记录；授权不明确的素材应先移除或改为仅提供外部链接。

## 预览兼容性边界

PDF 预览用于核对静态页面内容，不能完全替代 PowerPoint 播放：

- 动画、转场、逐步出现效果和演讲时序不会保留。
- 视频、音频、宏、嵌入对象和交互控件不会完整保留。
- 演讲者备注不会出现在普通 PDF 页面中。
- 未嵌入字体可能被替换，从而造成字形、换行或布局差异。
- SmartArt、3D 对象以及部分 SVG/EMF 图形可能与 PowerPoint 中的显示不同。

每次生成 PDF 后，维护者应检查页数，并抽查首页、中英文混排页、代码页、图片密集页和
最后一页，确认没有明显缺字、错位或空白页。需要完整动画、视频、备注或交互效果时，
请下载 PPTX 并使用兼容的演示软件打开。

## 生成与更新流程

1. 修改 `OCEAN_IPDPS_2026_tutorial_draft.pptx`，并更新本页版本、状态和时间。
2. 在本地使用 LibreOffice 转换，并记录 LibreOffice 版本和使用的字体环境：

   ```bash
   mkdir -p dist
   libreoffice --headless --convert-to pdf \
     --outdir dist \
     docs/tutorial/2026/ch3/OCEAN_IPDPS_2026_tutorial_draft.pptx
   ```

3. 使用 `pdfinfo` 检查 PDF 页数应为 64 页，并抽查关键页面；确认内容授权和第三方素材
   署名完整。
4. 计算校验值：

   ```bash
   sha256sum \
     docs/tutorial/2026/ch3/OCEAN_IPDPS_2026_tutorial_draft.pptx \
     dist/OCEAN_IPDPS_2026_tutorial_draft.pdf \
     > dist/SHA256SUMS
   ```

5. 手动创建或更新 GitHub Release，当前草稿使用 tag `ocean-ipdps-2026-draft`，上传
   `OCEAN_IPDPS_2026_tutorial_draft.pdf` 和 `SHA256SUMS`。
6. 在本 Issue 或关联 PR 中记录转换工具版本、源文件校验值、PDF 校验值和已知限制。

草稿和正式版本使用不同的 Release。正式版本应使用 `ocean-ipdps-2026-final`，并保留
草稿 Release，避免历史链接失效。当前 `ppt-slides.js` 只把 Markdown 中的 `---` 分页
渲染成站内演示模式，不读取 PPTX，也不与本课件自动同步，因此不作为本课件的预览实现。
