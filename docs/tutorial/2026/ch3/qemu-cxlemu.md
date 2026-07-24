# 建模 AI 加速卡

本文梳理 CXL 加速器项目涉及的系统结构、数据路径与学习资料。具体优化任务、打榜规则和交付要求见[建模 AI 加速卡项目][project-task]。

!!! tip "技术背景"

    本项目在 QEMU + CXLMemSim 构建的 CXL Type-2 加速器仿真环境中，围绕真实大模型 Kimi K2.6（IQ1_M / ternary 量化）构建一条"先正确、后性能"的异构推理链路。Guest 内的 CUDA 应用无需改动，通过 `libnvcuda.so` shim（ZLUDA 路线）将 CUDA Driver API 翻译为设备命令，由 ternary 后端实际执行；Host 侧在 QEMU CXL Type-2 设备模型与 CXLMemSim backing store 之上，负责设备内存仿真与 KV/权重的存储供给。

    项目以基线仓库 `vickiegpt/Concordia`（`tmatmul` 分支，基准 `bench/kimi_k26_tps/`）为起点，核心优化对象是 **back storage（后端存储 / 供数路径）**，并以 Kimi K2.6 在固定 GPU 资源下的推理吞吐作为打榜指标。

## 系统链路

理解该系统时，可以沿一次推理请求的数据流拆成四层：

1. Guest 应用通过 CUDA Driver API 发起内存管理和 kernel 调用。
2. `libnvcuda.so` shim 将 API 调用翻译为设备命令，跨过 Guest 与虚拟设备的边界。
3. QEMU 中的 CXL Type-2 设备模型负责命令接收、MMIO、设备内存与中断等可见行为。
4. Host 侧 ternary 后端和 CXLMemSim backing store 完成实际计算与权重、KV 数据供给。

这一分层能帮助你判断瓶颈属于 API 翻译、设备协议、计算 kernel，还是后端存储。性能优化前应先建立正确性基线，并固定模型、GPU 资源、VM 配置和采集方式。

## 需要复习的讲义

- [GPGPU 原理][qemu-gpgpu]：理解设备前端、执行后端和 SIMT 基本概念。
- [PCIe 模拟方法][qemu-pcie]：理解 PCI 设备、BAR、MMIO 和中断在 QEMU 中的建模方式。
- [kernel 运行机制][qemu-gpgpu-kernel]：理解 kernel 下发、上下文与执行路径。
- [外设建模流程][qemu-hw]：回顾 QOM 设备实现、寄存器和 IRQ 的基本方法。

## 延伸阅读

- CXLMemSim - [GitHub](https://github.com/SlugLab/CXLMemSim) · [论文 arXiv](https://arxiv.org/abs/2303.06153)
- 基线仓库 Concordia - [GitHub（tmatmul 分支）](https://github.com/vickiegpt/Concordia/tree/tmatmul)
- hetGPU - [论文 arXiv](https://arxiv.org/abs/2506.15993)
- NVIDIA Dynamo - [Developer](https://developer.nvidia.com/dynamo) · [架构文档](https://docs.dynamo.nvidia.com/dynamo/design-docs/overall-architecture)
- QEMU 官方 CXL 文档 - [docs](https://www.qemu.org/docs/master/system/devices/cxl.html)

[project-task]: ../../../exercise/2026/stage3/qemu-cxlemu.md
[qemu-gpgpu]: ../ch2/qemu-gpgpu.md
[qemu-gpgpu-kernel]: ../ch2/qemu-gpgpu-kernel.md
[qemu-hw]: ../ch2/qemu-hw.md
[qemu-pcie]: ../ch2/qemu-pcie.md
