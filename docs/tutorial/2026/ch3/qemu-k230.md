# 数字星务计算机

本文介绍 K230 星务计算单元项目需要的背景知识，包括 QEMU `k230` machine 的上游基线、启动链路、外设建模关注点和 QEMU 邮件列表协作方式。具体项目任务与考核标准见[数字星务计算机项目][project-task]。

!!! tip "技术背景"

    星务计算单元是人造卫星星务分系统的核心计算模块，完成遥测数据的采集和下传、星上网络管理、平台实践管理、整星安全等卫星的核心功能，并具备在轨程序注入的能力。基于中高端物联网芯片 Kendryte K230，RISC-V 开源的星务计算机将具有广阔的应用场景。本次任务专注于使用 K230 星务计算单元的硬件建模，将从 K230 的基本支持出发，直到能够支持星务系统基本安全模块的正常运转。

    ![](../../../image/qemu-k230-board.png)

!!! info "QEMU K230 上游补丁"

    K230 的 QEMU 板级支持已经合入上游。相关讨论见 [[PATCH v8 0/5] Add support for K230 board](https://lore.kernel.org/qemu-devel/cover.1781246408.git.chao.liu@processmission.com/)，合入后的官方文档见 [QEMU `k230` machine 文档](https://gitlab.com/qemu-project/qemu/-/blob/master/docs/system/riscv/k230.rst)。

    这组补丁由 Chao Liu 于 2026 年 6 月 12 日发送到 `qemu-devel` 和 `qemu-riscv` 邮件列表，在 QEMU 中新增了 `k230` machine，使其能够运行 U-Boot、OpenSBI 和标准 Linux kernel。当前上游实现支持 1 个 C908 little core、CLINT、PLIC、2 个 K230 WDT 和 5 个 UART。直接启动 Linux 的示例命令如下：

    ```shell
    $QEMU -M k230 \
          -kernel [Image] \
          -dtb [k230-qemu.dtb] \
          -initrd [rootfs.cpio.gz] \
          -nographic
    ```

    该 patch series 主要包含 5 个部分：

    1. `target/riscv`：添加 T-Head C908 / C908v CPU 支持。
    2. `hw/riscv`：添加 K230 board 的初始支持。
    3. `hw/watchdog`：添加 K230 WDT 初始模型。
    4. `tests/qtest`：添加 K230 watchdog 的 QTest 测试。
    5. `docs/system/riscv`：添加 `k230` machine 的官方文档。

    对本项目来说，已合入的 `k230` machine 提供了 K230 QEMU 建模的上游基线。后续 RustSBI 适配、外设模型补全、安全实验支撑等工作，应尽量基于该上游实现继续演进，并按 QEMU 社区规范整理 patch 和测试结果。

## 从 machine 基线继续开发

已合入的 `k230` machine 不是完整芯片模型，而是后续工作的起点。阅读和扩展这类 machine 时，可以按以下层次理解：

1. CPU 与启动链路：确认 CPU 型号、复位地址、BootROM、SBI、U-Boot / Linux 和 DTB 的传递关系。
2. 地址空间与中断：对照 SoC 手册确认内存布局、MMIO 区间、PLIC / CLINT 连接和设备 IRQ。
3. 外设最小模型：先实现系统软件实际访问的寄存器、reset 值与必要行为，再逐步补充完整功能。
4. 可验证性：为模型保留 trace 事件、QTest、启动日志和异常路径，保证行为能够被观察与复现。

建议先复习[主板建模流程][qemu-machine]、[外设建模流程][qemu-hw]、[模拟中断和异常][qemu-intr]和[常用调试方法][qemu-debug]。

!!! important "K230 相关成果上游贡献"

    完成 K230 QEMU 相关 Issue 后，请不要只停留在本仓库 PR 或 fork 仓库中。将可合入 QEMU 的改动整理为 patch series，直接发送到 `qemu-devel@nongnu.org` 和 `qemu-riscv@nongnu.org` 邮件列表，并根据 `scripts/get_maintainer.pl` 与 `MAINTAINERS` 抄送对应维护者和 reviewer。

    [QEMU `MAINTAINERS`](https://gitlab.com/qemu-project/qemu/-/raw/master/MAINTAINERS) 是 QEMU 上游维护的子系统联系人索引，用来确认某个目录、文件或功能模块当前应该抄送哪些 maintainer、reviewer 和邮件列表。它比手写固定人员清单更可靠，因为维护者分工和邮件地址可能随上游变化。

    阅读 `MAINTAINERS` 时重点关注以下字段：

    | 字段 | 作用 |
    | --- | --- |
    | `M:` | Maintainer，负责对应子系统或机器模型的维护者，patch 通常需要抄送。 |
    | `R:` | Reviewer，适合参与 review 的指定 reviewer 或长期贡献者。 |
    | `L:` | Mailing list，相关公开邮件列表；K230 相关 QEMU patch 至少应发送到 `qemu-devel@nongnu.org` 和 `qemu-riscv@nongnu.org`。 |
    | `F:` | File pattern，说明该条目覆盖哪些源码、测试或文档路径。 |
    | `S:` | Status，说明该子系统维护状态，例如 maintained、supported、odd fixes 等。 |

    实际发送 patch 前，建议在 QEMU 源码树中运行 `scripts/get_maintainer.pl <patchfile>`，用脚本根据改动文件自动生成最新收件人和抄送列表，再结合 `MAINTAINERS` 手动确认。

QEMU 相关代码贡献请参考 [QEMU Submitting a Patch](https://www.qemu.org/docs/master/devel/submitting-a-patch.html) 和 [QEMU Coding Style](https://www.qemu.org/docs/master/devel/style.html)。准备 patch 时需要注意：

1. 基于 QEMU 当前 `master` 分支开发，避免基于旧版本提交无法合入的 patch。
2. 将改动拆分为逻辑清晰的 patch series，每个 patch 都应能独立编译和验证；不要混入无关格式化、空白或重构改动。
3. Commit message 使用 `subsystem: single line summary` 格式，说明改动原因；每个提交必须包含 `Signed-off-by: Your Name <email>`。
4. 提交前运行 `scripts/checkpatch.pl <patchfile>`，并完成对应的构建、单元测试、QTest 或集成验证。
5. 使用 `git format-patch` / `git send-email`、`b4` 或 `git-publish` 生成并发送邮件形式的 patch，不要以附件方式发送。
6. Patch 发送到 `qemu-devel@nongnu.org` 和 `qemu-riscv@nongnu.org`，并通过 `MAINTAINERS` 或 `scripts/get_maintainer.pl` 抄送相关维护者。
7. 保持参与 review，按反馈修订后使用 `v2`、`v3` 等版本号重新发送，并在 cover letter 或 patch 注释中说明版本变化。

[project-task]: ../../../exercise/2026/stage3/qemu-k230.md
[qemu-debug]: ../ch1/qemu-debug.md
[qemu-hw]: ../ch2/qemu-hw.md
[qemu-intr]: ../ch2/qemu-intr.md
[qemu-machine]: ../ch2/qemu-machine.md
