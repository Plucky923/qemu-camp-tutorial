# 项目阶段

项目阶段面向真实工程问题和开源协作。学员在导师和助教指导下选择一个方向，完成需求理解、任务拆解、代码实现、调试验证和成果总结。

!!! tip "四个项目方向"

    - [数字星务计算机](qemu-k230.md)：适配 K230 启动链路、补全外设模型并支撑星务安全实验。
    - [建模 AI 加速卡](qemu-cxlemu.md)：在 QEMU + CXLMemSim 环境中优化 ternary 推理后端。
    - [大模型建模外设](qemu-agent.md)：构建并评估辅助 QEMU 外设建模的 Agent。
    - [应用跨平台转译](qemu-wine-ce.md)：完善 Wine-CE 的 RISC-V 构建、应用兼容和运行时支持。

## 时间安排

- 选题会议：6 月 28 日
- 项目阶段：6 月 29 日 ~ 8 月 08 日，共计 6 周

## 开始之前

项目任务页只描述要完成的工作、考核方式与交付物。背景知识、技术原理和延伸阅读统一放在[项目阶段学习资料][project-tutorial]中。建议先阅读所选方向的课程文章，再认领任务并建立可复现的开发与验证环境。

AI 可以用来学习、检索和调试，但提交内容必须是你自己能解释、能复现、能负责的。详细说明见本页末尾的“AI 开发提示”。

## AI 开发提示

!!! tip "先说结论"

    AI 可以参与生成代码、整理文档、分析日志和辅助调试，但不能替你承担工程责任。你提交的代码、文档和 patch，必须是你自己看得懂、解释得清、愿意负责的内容。

!!! note "适用范围"

    本节主要给 QEMU 训练营学员一个统一态度：

    - 可以用 AI 学概念、查 API、理思路、做静态分析、辅助调试，也可以让它生成代码草稿。
    - AI 生成的内容可以进入你的工作流，但不能绕过人工审查。
    - 你必须理解最终提交的语义、边界和测试结果。
    - 面向 Linux kernel / QEMU 上游时，优先遵守对应社区的最新规则。

!!! info "Linux 内核社区的态度"

    Linux 内核社区的态度可以概括为“开放使用，人工负责”。关键点是：

    1. AI 可以生成代码草稿，但不能代替人类签 `Signed-off-by`，DCO 责任必须由人类承担。
    2. 如果 AI 参与了实质性内容，建议在补丁中使用 `Assisted-by:` 进行透明标注。
    3. 提交前要能解释自己的改动，并准备好回应 review 问题。
    4. 工具可以帮你发现问题、辅助测试和生成草稿，但最终提交必须经过人工审查和确认。

    官方参考：

    - [AI Coding Assistants](https://docs.kernel.org/process/coding-assistants.html)
    - [Kernel Guidelines for Tool-Generated Content](https://docs.kernel.org/process/generated-content.html)
    - [Submitting patches](https://docs.kernel.org/process/submitting-patches.html)

!!! warning "QEMU 上游的态度"

    QEMU 目前对 AI 生成内容更保守：上游文档仍然要求拒绝被认为包含或衍生自 AI 生成内容的贡献。换句话说，训练营内部可以更开放地使用 AI 生成/改写代码，但如果目标是向 QEMU 上游投稿，需要关注并遵守上游当前政策。

    对 QEMU 上游投稿，训练营里建议采用更保守的策略：

    1. AI 可以作为提交内容来源之一，但最终版本必须经过人工审查、压缩和确认。
    2. 提交前自己完全理解改动，并能解释语义、边界和测试结果。
    3. 不要让 AI 替你解决许可证、版权和 DCO 问题。

    官方参考：

    - [QEMU Code Provenance](https://www.qemu.org/docs/master/devel/code-provenance.html)

!!! success "推荐工作流"

    1. 先读文档和源码，确认问题边界。
    2. 再让 AI 帮你梳理概念、列排查路径、生成小段草稿。
    3. 关键代码和关键结论必须自己复核。
    4. 先跑测试，再改代码，再跑测试。
    5. 最终提交前，问自己一句：这份改动我能不能当着 reviewer 解释清楚。

!!! danger "不要这样用 AI"

    - 不要直接复制 AI 生成的补丁后就提交。
    - 不要提交自己看不懂的代码。
    - 不要把 review、调试、测试和许可证判断都外包给 AI。
    - 不要为了“看起来快”而牺牲正确性、可追踪性和可维护性。

!!! info "给学员的一句话"

    AI 可以放大你的能力，但不能替你负责。你越能解释、验证和收敛自己的改动，AI 越有价值。

[project-tutorial]: ../../../tutorial/2026/ch3/index.md
