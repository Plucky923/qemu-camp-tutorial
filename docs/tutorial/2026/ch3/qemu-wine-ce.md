# 应用跨平台转译

本文介绍 Wine-CE 中 Windows 兼容层、动态二进制翻译组件与宿主系统的协作关系。具体版本升级、应用测评和 RISC-V 支持任务见[应用跨平台转译项目][project-task]。

!!! tip "技术背景"

    Wine-CE（Chimera Edition，跨架构模拟器）是在非 x86 Linux 平台（如 RISC-V、ARM64）上运行 Windows 程序的兼容层。它基于 Wine、Box64 和 QEMU user 组件协作完成，只模拟客端指令架构相关的 Windows 动态链接库和 loader，并将针对 Unix 库的调用转发到主端执行。

    其核心原则是“非必要不模拟”：尽量把通用系统能力留给宿主环境处理，只保留 Windows 兼容层和必要的架构转换逻辑，从而获得更高的性能和更好的可维护性。

    ```bash
    +---------------------+                                  \
    |     Windows EXE     |                                   } application
    +---------------------+                                  /

    +---------+ +---------+                                  \
    | Windows | | Windows |                                   \ application & system DLLs
    |   DLL   | |   DLL   |                                   /
    +---------+ +---------+                                  /

    +---------+ +---------+     +-----------+  +--------+  \
    |  GDI32  | |  USER32 |     |           |  |        |   \
    |   DLL   | |   DLL   |     |           |  |  Wine  |    \
    +---------+ +---------+     |           |  | Server |     \ core system DLLs
    +---------------------+     |           |  |        |     / (on the left side)
    |    Kernel32 DLL     |     | Subsystem |  | NT-like|    /
    |  (Win32 subsystem)  |     |Posix, OS/2|  | Kernel |   /
    +---------------------+     +-----------+  |        |  /
                                            |        |
    +---------------------------------------+  |        |
    |                 NTDLL                 |  |        |
    +---------------------------------------+  +--------+
    +---------------------------------------+               \
    |         Qemuloader executable         |                } emulate loader
    +---------------------------------------+               /
    +---------------------------------------+               \
    |                 QEMU                  |                } special QEMU
    +---------------------------------------+               /
    +---------------------------------------------------+   \
    |                   Wine drivers                    |    } Wine specific DLLs
    +---------------------------------------------------+   /

    +------------+    +------------+     +--------------+   \
    |    libc    |    |   libX11   |     |  other libs  |    } unix shared libraries
    +------------+    +------------+     +--------------+   /  (user space)

    +---------------------------------------------------+   \
    |         Unix kernel (Linux,*BSD,Solaris,OS/X)     |    } (Unix) kernel space
    +---------------------------------------------------+   /
    +---------------------------------------------------+   \
    |                 Unix device drivers               |    } Unix drivers (kernel space)
    +---------------------------------------------------+   /
    ```

    Wine-CE 的整体路径可以概括为：

    1. Windows EXE 和应用级 DLL 保持原有 Windows 语义。
    2. 客端架构相关的 loader 与核心 DLL 负责完成 Windows API 入口衔接。
    3. QEMU user / Box64 负责客端指令架构的加载与动态翻译。
    4. Wine drivers、Unix 库和 Linux 内核负责宿主侧能力提供。

## 如何定位问题所在层

跨架构应用失败时，不应把所有问题都归因于“模拟器不兼容”。可以按边界逐层定位：

1. Loader 是否正确识别并装载了 Windows 可执行文件及其依赖。
2. Windows API 是否在 Wine 的 DLL 与 server 侧得到正确实现。
3. Guest 指令是否由 QEMU user / Box64 正确翻译，系统调用和信号上下文是否正确转换。
4. 宿主侧图形、音频、输入和 libc 等共享库是否满足程序需要。

记录问题时，应同时保存应用版本、Wine-CE 版本、宿主架构、运行参数、日志和最小复现步骤。这样才能判断修复应进入 Wine、QEMU、Box64，还是打包与环境配置层。

## 需要复习的讲义

- [虚拟技术历史][vm-history]：区分虚拟化、系统模拟和用户态模拟。
- [TCG 工作原理][qemu-tcg]：理解 Guest 指令到 Host 指令的动态翻译过程。
- [模拟客户机指令][qemu-insn]：理解 QEMU 前端如何解码并生成 TCG 操作。
- [常用调试方法][qemu-debug]：建立跨组件日志与调试习惯。

项目代码可从 [fan-wenjie/wine-ce](https://github.com/fan-wenjie/wine-ce) 获取。阅读仓库时，建议先确认各子模块版本与构建脚本，再沿一次最小应用启动过程梳理组件边界。

[project-task]: ../../../exercise/2026/stage3/qemu-wine-ce.md
[qemu-debug]: ../ch1/qemu-debug.md
[qemu-insn]: ../ch2/qemu-insn.md
[qemu-tcg]: ../ch2/qemu-tcg.md
[vm-history]: ../ch1/vm-history.md
