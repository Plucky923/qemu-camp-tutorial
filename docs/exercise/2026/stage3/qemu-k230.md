# 数字星务计算机项目任务

本项目基于 QEMU 上游 `k230` machine，推进 RustSBI 适配、K230 外设模型补全和星务安全实验支撑。开始前请先阅读讲义中的[数字星务计算机][tutorial]。

项目仓库：[gevico/qemu-camp-2026-k230](https://github.com/gevico/qemu-camp-2026-k230.git)

## 项目方向

### RustSBI 适配 K230

- 适配 K230 启动流程、内存布局和 DTB 传递。
- 在 QEMU `k230` machine 下完成从 BootROM、RustSBI 到下一阶段 U-Boot / Linux 的启动验证。
- 相关适配成果期望直接贡献到 [rustsbi/rustsbi](https://github.com/rustsbi/rustsbi.git)。

### 完善 K230 外设建模

- 围绕 Timer、RTC、GPIO、I2C、SPI、PWM、SD/eMMC、Mailbox 等外设补充 QEMU 模型。
- 按照 Issue 认领任务，补充 MMIO、IRQ / 中断、reset 行为、trace 支持和测试用例。
- 优先实现 SDK 或系统软件会访问的寄存器与功能，从最小可用模型开始渐进完善。

### 面向星务安全模块的仿真支撑

- 构建可观测、可注入、可验证的最小安全实验场景。
- 通过 trace、QMP、GDB、QTest 等工具观察关键寄存器、事件、中断和 MMIO 访问行为。
- 支持篡改关键数据或寄存器、触发 Watchdog 超时、模拟中断风暴或丢失、存储 / 通信异常注入等实验，并验证检测、响应与恢复流程。

## 上游贡献要求

完成 K230 QEMU 相关 Issue 后，不要只停留在项目仓库 PR 或个人 fork 中。将可合入 QEMU 的改动整理为 patch series，发送到 `qemu-devel@nongnu.org` 和 `qemu-riscv@nongnu.org` 邮件列表，并根据 `scripts/get_maintainer.pl` 与 `MAINTAINERS` 抄送对应维护者和 reviewer。

提交前需要：

1. 基于 QEMU 当前 `master` 分支开发，并将改动拆分为逻辑清晰、可独立编译和验证的 patch。
2. 按 QEMU 规范编写 commit message，并包含开发者本人的 `Signed-off-by`。
3. 运行 `scripts/checkpatch.pl`，完成对应构建、单元测试、QTest 或集成验证。
4. 使用 `git format-patch` / `git send-email`、`b4` 或 `git-publish` 发送 patch，并持续响应 review。

RustSBI 相关适配成果应按 RustSBI 项目的贡献流程提交到其上游仓库。

## 考核标准

1. 可运行代码：主要功能正确，能够在 K230 QEMU 环境中运行并完成对应方向的验证。
2. 测试与验证：提供单元测试或集成测试，覆盖正常场景和必要的异常场景，保留可复现的验证日志。
3. 工程质量：代码风格符合 QEMU / RustSBI 等相关项目规范，注释清晰，提交记录和 Issue / PR 进展可追踪。
4. 进阶成果加分：性能优化、故障注入与恢复验证、自动化回归测试、整理 patch 并尝试向上游贡献。

## 交付物

- 可运行的代码、构建方式和环境说明。
- 测试用例、复现步骤和验证日志。
- 项目总结，以及相关 Issue、PR 或上游 patch 链接。

[tutorial]: ../../../tutorial/2026/ch3/qemu-k230.md
