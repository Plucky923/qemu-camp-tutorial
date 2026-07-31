# GPGPU 博客

!!! note "主要贡献者"

    - 作者：[@Old-cpu](https://github.com/Old-cpu)

---

## 背景介绍

目前大三在读，软件工程专业，对 AI Compiler / AI infra 感兴趣，在 7 月份时才注意到训练营中有和 GPGPU 相关的内容，故选择参加进来。

## 专业阶段

笔者选择的是 GPGPU 方向，以及 GPGPU 进阶实验一。

## 学习内容

### 1. 项目结构

```Plaintext
$ hw/gpgpu git:(main) ✗ tree
├── gpgpu.c
├── gpgpu_core.c
├── gpgpu_core.h
├── gpgpu.h
├── Kconfig
├── meson.build
└── utils
    ├── inst.h  // 指令处理器
    ├── utils.c
    └── utils.h
```

`inst.h` 里我用的是 NEMU 风格的指令匹配宏，把机器码里的 opcode、rs、rt、rd 拆出来。

项目仓库：[qemu-camp-GPGPU/hw/gpgpu at main · CoEvolutio/qemu-camp-GPGPU](https://github.com/CoEvolutio/qemu-camp-GPGPU/tree/main/hw/gpgpu)



QEMU 设备模型和 EvoGPU 软件栈分别位于两个仓库中。前者提供 PCIe 设备、MMIO、VRAM 和 SIMT 执行模型，后者提供 Linux 驱动、runtime API、kernel binary 和测试样例。后面的分析沿着这两个层次展开。

```Plaintext
qemu-camp-GPGPU                         evo-gpu
|                                       |
+-- Kconfig / meson.build              +-- samples
+-- gpgpu.c                             |      |
|   PCI / BAR / MMIO / VRAM             |      v
+-- gpgpu_core.c                        +-- runtime/evo.c
|   SIMT / RV32 解释器                   |      |
+-- utils/utils.c                       v
    指令语义                        +-- driver/evo_gpu_drv.c
+-- utils/utils.h                       Linux PCI 驱动
    低精度转换                         |
                                       +-- include/evo_gpu_uapi.h
                                           设备 ABI

                         driver
                            |
                            v
                      QEMU GPGPU 设备
```

### 2. QEMU GPGPU 设备模型

QEMU GPGPU 建模可以从一次 kernel launch 展开。

guest CPU 先把程序和输入放进显存，再写一组控制寄存器，最后写下 `DISPATCH`。QEMU 收到这次写操作后，进入 `gpgpu_core_exec_kernel()`；从这里开始，一个个 block、warp 和 lane 被展开，kernel 的指令也就有了执行者。

于是整个外设可以抓成三条线：`gpgpu_ctrl_read()` / `gpgpu_ctrl_write()` 处理控制，`gpgpu_vram_read()` / `gpgpu_vram_write()` 暴露显存，`gpgpu_core_exec_kernel()` 把配置变成计算。建模文档在 `docs/specs/gpgpu.rst`，它描述的是 guest 能够看见、能够驱动的一块设备。

#### 2.1 GPGPU 外设接入 QEMU

设备接入由以下构建链完成：

```Plaintext
hw/Kconfig -> hw/meson.build -> hw/gpgpu/Kconfig -> hw/gpgpu/meson.build
```

`CONFIG_GPGPU` 打开后，QEMU 会把 `gpgpu.c`、`gpgpu_core.c`、`utils/utils.c` 编进来。此时命令行中的 `-device gpgpu` 才会生成这块 PCI 设备。

#### 2.2 SIMT 执行核心

`gpgpu.c` 把它放进 PCIe 世界：BAR、MMIO、VRAM、复位和中断都在这里。读者沿着 `DISPATCH` 往下走，会来到 `gpgpu_core.c`。这里才是 GPU 的味道最浓的地方。

项目用一个很朴素的方式模拟 SIMT：给每个线程留一份独立状态，再把 32 个线程放进一个 warp。`GPGPU_WARP_SIZE` 固定为 32，`GPGPUWarp` 里放着 32 个 `GPGPULane`。每个 lane 有自己的 `gpr`、`fpr`、`pc` 和 `mhartid`，因此同一个 kernel 被不同线程执行时，线程之间不会共用寄存器和程序计数器。

一次 dispatch 进入 `gpgpu_core_exec_kernel()` 后，执行器先根据 `grid_dim` 遍历 block，再根据 `block_dim` 每次取 32 个线程组成 warp。`gpgpu_core_init_warp()` 为这批 lane 设置相同的 kernel 起点，并用 `MHARTID_ENCODE()` 把 block、warp、lane 编进线程 ID。随后 `gpgpu_core_exec_warp()` 计算每个线程的 `thread_id`，填入 block、warp、lane 上下文，最后交给 `gpgpu_core_exec_lane()` 逐条解释 RISC-V 指令。

因此，这里的 SIMT 需要分成两个层面理解。线程组织方式遵循 GPU：一个 block 被切成多个 warp，每个 lane 通过线程坐标和 `mhartid` 找到自己的数据。执行方式则是解释器在宿主机上逐 lane 推进，并没有模拟真实 GPU 的并行发射和流水线。对于向量加法这样的 kernel，这已经足够产生正确的线程语义，也能让我们看清 grid、block、warp 和 lane 如何互相传递信息。

kernel 通过 `gpgpu_read_csr()` 读取这些上下文。`CSR_GPGPU_THREAD_ID_X`、`CSR_GPGPU_BLOCK_ID_X`、`CSR_GPGPU_WARP_ID` 和 `CSR_GPGPU_LANE_ID`，就是软件线程看到的“内置变量”。

```Plaintext
gpgpu_core_exec_kernel()
|
+-- 遍历 grid 中的 block
    |
    +-- 按 block_dim 每 32 个线程切分 warp
        |
        +-- gpgpu_core_init_warp()
        |   初始化 32 个 GPGPULane
        |
        +-- gpgpu_core_exec_warp()
            |
            +-- 填写 thread_id / block_id
            |   warp_id / lane_id / active_mask
            |
            +-- gpgpu_read_csr()
            |   kernel 读取线程上下文
            |
            +-- gpgpu_core_exec_lane()
                |
                +-- gpgpu_decode_exec()
                    逐条解释 RISC-V 指令
```

#### 2.3 低精度浮点扩展

低精度部分要看 `utils.c` 里的指令解释。`gpgpu_decode_exec()` 通过 `INSTPAT` 匹配自定义指令，再调用格式转换函数：

```Plaintext
gpgpu_f32_to_bf16()
gpgpu_f32_to_e4m3()
gpgpu_f32_to_e5m2()
gpgpu_f32_to_e2m1()
```

例如 `fcvt_bf16_s` 把 FP32 压成 BF16，`fcvt_s_bf16` 再还原回 FP32；E4M3、E5M2 和 E2M1 也各有对应的转换指令。`gpgpu_f32_to_bf16()`、`gpgpu_f32_to_e4m3()` 等函数处理具体的位宽、指数、尾数、舍入和溢出规则，转换后的编码暂时放在 lane 的浮点寄存器中。

这里需要把实现边界说清楚：当前代码重点实现的是低精度格式转换，以及 kernel 可以使用的转换指令；普通浮点加法仍然走 FP32 路径。它已经能用于验证量化和反量化的结果，距离拥有独立的 BF16/FP8 算术流水线还有一段距离。

```Plaintext
lane.fpr: FP32 bit pattern
        |
        v
INSTPAT 匹配 fcvt_* 指令
        |
        v
gpgpu_f32_to_*()
编码、舍入、饱和
        |
        v
BF16 / E4M3 / E5M2 / E2M1 编码
        |
        v
gpgpu_*_to_f32()
还原为 FP32，写回 lane.fpr

lane.fpr: FP32 bit pattern
        |
        +--> fadd.s 等普通浮点指令
             仍走 FP32 运算
```

#### 2.4 CPU 与 GPGPU 的数据交互

把视角切回 CPU，会发现控制和数据走了两条不同的路。BAR0 是控制通道，BAR2 是数据通道。

- 控制流：CPU 通过 BAR0 写入 kernel 地址、参数地址、grid/block、shared memory，最后写 `DISPATCH`

- 数据流：CPU 通过 BAR2 访问 VRAM，把 kernel binary、参数和输入数据放进去，再从 VRAM 取回结果

EvoGPU 的当前实现没有让用户态直接碰 BAR0。`evo_gpu_mmap()` 通过 `io_remap_pfn_range()` 把 BAR2 映射到 runtime，runtime 里的 `evoMemcpyHostToDevice()` 和 `evoMemcpyDeviceToHost()` 最终就是对这块映射区做 `memcpy`。设备模型中虽然有 DMA 寄存器和完成定时器，现有 miniCUDA 主路径还没有使用它们搬运数据。

#### 2.5 控制面与数据面

```Plaintext
+----------------------+
                         |      用户程序        |
                         +----------+-----------+
                                    |
                         +----------v-----------+
                         |    EvoGPU runtime    |
                         +-----+-----------+----+
                               |           |
                 memcpy        |           | ioctl(LAUNCH)
                               v           v
                    +----------+--+   +----+----------------+
                    | mmap BAR2   |   |    Linux 驱动       |
                    | VRAM 数据区 |   | evo_gpu_ioctl()     |
                    +------+------+   +---------+-----------+
                           ^                      |
                           | kernel 访存          | evo_gpu_writel()
                           |                      | iowrite32()
                    +------+-------+      +-------v--------+
                    |  QEMU GPGPU  |<-----| BAR0 MMIO 控制区 |
                    | SIMT 执行核心 |      +----------------+
                    +--------------+
```

读到这里，外设的轮廓就出来了：MMIO 负责把 CPU 的意图交给设备，VRAM 承接程序和数据，SIMT 核心负责兑现那次 launch。

### 3. EvoGPU 软件栈

到这里还只有一块能被写寄存器的卡。`evo-gpu` 接下来的工作，是把它变成普通 C 程序也能使用的计算设备。驱动贴着 PCI 设备走，runtime 只留下分配、拷贝和提交三组 API；它们合在一起，就是一套 miniCUDA 软件栈。

#### 3.1 用户态与内核态 ABI

```Plaintext
include/evo_gpu_uapi.h
docs/device_abi.md
docs/kernel_abi.md
docs/runtime_api.md
```

这里最重要的是两个 ioctl：

```Plaintext
EVO_GPU_IOCTL_GET_INFO
EVO_GPU_IOCTL_LAUNCH
```

这两个 ioctl 给内核态和用户态定下了接口：一个用来问设备有什么能力，一个携带 kernel 地址和启动参数。后面无论是 runtime 还是 sample，都只需要沿着这个边界说话。

#### 3.2 Linux PCI 驱动

`evo_gpu_probe()` 找到 QEMU 暴露的 PCI 设备，申请 PCI BAR，并用 `pci_iomap()` 得到 BAR0 的内核地址；BAR2 的物理地址和长度则记录下来，交给后面的 mmap 路径。驱动随后创建 `/dev/evo0`，runtime 所有操作都从这个文件描述符进入。

驱动的两个关键封装分别对应两条通道。`evo_gpu_readl()` / `evo_gpu_writel()` 把 `ioread32()` / `iowrite32()` 包起来，所有控制寄存器访问都从这里经过。`evo_gpu_ioctl()` 负责接收用户态请求，`evo_gpu_mmap()` 负责把 BAR2 交给用户态。

`EVO_GPU_IOCTL_GET_INFO` 会调用 `evo_gpu_readl()` 读取设备 ID、版本和 VRAM 大小，再通过 `copy_to_user()` 返回 runtime。`EVO_GPU_IOCTL_LAUNCH` 则通过 `copy_from_user()` 接收 kernel 参数，交给 `evo_gpu_launch()`。

`evo_gpu_launch()` 按顺序调用 `evo_gpu_writel()`：先写 kernel 地址和参数地址，再写 grid/block 和 shared memory，最后写 `EVO_GPU_REG_DISPATCH`。这个最后的写入抵达 QEMU 后，会进入 `gpgpu_ctrl_write()` 的 `GPGPU_REG_DISPATCH` 分支，设置 busy 状态并调用 `gpgpu_core_exec_kernel()`。MMIO 因此成为一条完整的执行控制链，而不只是一张寄存器表。

当前模型的执行还是同步的：QEMU 在处理 `DISPATCH` 这次 MMIO 写入时直接跑完整个 kernel，执行结束后才返回驱动。因此 EvoGPU 里暂时没有单独的等待 API，`evoLaunchKernel()` 返回时，结果已经写回 BAR2。这种实现很适合把调用链跑通，异步队列、中断通知和真正的并行调度还没有进入这条路径。

#### 3.3 Runtime API

```Plaintext
evoOpen()
evoClose()
evoMalloc()
evoMemcpyHostToDevice()
evoMemcpyDeviceToHost()
evoLoadKernelFromFile()
evoLaunchKernel()
```

这些 API 的名字已经很像 CUDA 的日常用法，调用关系也很容易顺着源码追下去：

- `evoOpen()` 打开 `/dev/evo0`，通过 `EVO_GPU_IOCTL_GET_INFO` 获取显存大小，再调用 `mmap()` 映射 BAR2

- `evoMalloc()` 在 runtime 的 bump allocator 中返回一个 VRAM 偏移

- `evoMemcpyHostToDevice()` / `evoMemcpyDeviceToHost()` 对映射后的 VRAM 做拷贝

- `evoLoadKernelFromFile()` 读取 RV32 kernel binary，并把它写入 VRAM

- `evoLaunchKernel()` 组装 `evo_gpu_kernel_params`，通过 `EVO_GPU_IOCTL_LAUNCH` 交给驱动

runtime 没有重新实现一套设备控制逻辑。它做的是把 C 调用变成两种底层动作：数据 API 操作 `dev->vram` 映射区，执行 API 提交 ioctl。真正的 MMIO 读写集中在驱动里，寄存器偏移也集中在 `evo_gpu_uapi.h`。

#### 3.4 完整执行流水线

```Plaintext
sample
  |
  | evoOpen / evoMalloc / evoMemcpy / evoLaunchKernel
  v
runtime/evo.c
  |
  +---------------------- ioctl ----------------------+
  |                                                    |
  +---------------------- mmap -----------------------+
                                                       v
driver/evo_gpu_drv.c                              /dev/evo0
  |                                                    |
  +-- BAR0: evo_gpu_writel() --> MMIO 控制寄存器        |
  |                                  |                |
  |                                  v                |
  |                         gpgpu_ctrl_write()        |
  |                                  |                |
  |                                  v                |
  |                         gpgpu_core_exec_kernel()  |
  |                                  |                |
  |                                  v                |
  |                         SIMT 解释执行              |
  |                                                   |
  +-- BAR2: VRAM <---------- kernel / 参数 / 结果 -----+
                                                       |
                                                       v
                                              evoMemcpyDeviceToHost()
```

从 `samples/vecadd_test.c` 出发，这条链可以具体写成：`evoOpen()` 建立连接；`evoMalloc()` 为 kernel、参数和输入输出分配 VRAM 偏移；`evoMemcpyHostToDevice()` 把数据写入 BAR2；`evoLoadKernelFromFile()` 把 RV32 指令放入 BAR2；`evoLaunchKernel()` 经 ioctl 触发 BAR0 的寄存器写入；QEMU 在 `DISPATCH` 处遍历 grid/block/warp/lane，执行结果留在 BAR2；最后 `evoMemcpyDeviceToHost()` 把结果读回 CPU。

```Plaintext
sample                 runtime                 driver                 QEMU / VRAM
  |                       |                       |                       |
  |-- evoOpen() --------->|                       |                       |
  |                       |-- open /dev/evo0 ---->|                       |
  |                       |-- ioctl(GET_INFO) --->|-- read BAR0 ---------->|
  |                       |<-- VRAM size ---------|                       |
  |                       |-- mmap(BAR2) -------->|-- map BAR2 ---------->|
  |                       |                       |                       |
  |-- evoMalloc() ------->|                       |                       |
  |-- evoMemcpyH2D() ---->|-- memcpy ------------>|---------------------->|
  |                       |                       |        写入 kernel、参数、输入
  |                       |                       |                       |
  |-- evoLaunchKernel() ->|-- ioctl(LAUNCH) ----->|                       |
  |                       |                       |-- MMIO 写配置 -------->|
  |                       |                       |-- MMIO 写 DISPATCH --->|
  |                       |                       |                        |
  |                       |                       |                gpgpu_core_exec_kernel()
  |                       |                       |                        |
  |                       |                       |<-- 结果写回 BAR2 -------|
  |                       |<-- ioctl 返回 ---------|                       |
  |<-- evoMemcpyD2H() ----|-- memcpy <------------|<----------------------|
  |                       |                       |                       |
```

这就是两个仓库接起来后的完整闭环：数据通过 BAR2 进入设备，控制通过 BAR0 发出，`gpgpu_core_exec_kernel()` 把一次 launch 展开成线程执行，结果再沿 BAR2 回到 CPU。文章真正需要抓住的主线，也就在这四个动作里：放数据、写控制、跑线程、取结果。

#### 3.5 项目结构

项目仓库：https://github.com/CoEvolutio/evo-gpu

```Plain Text
$ evo-gpu git:(main) tree
├── docs
│   ├── device_abi.md
│   ├── kernel_abi.md
│   └── runtime_api.md
├── driver
│   ├── evo_gpu_drv.c
│   ├── evo_gpu_drv.h
│   └── Makefile
├── include
│   └── evo_gpu_uapi.h
├── kernels
│   ├── elemul.h
│   ├── elemul.S
│   ......
│   ├── vecadd.h
│   └── vecadd.S
├── LICENSE
├── Makefile
├── README.md
├── runtime
│   ├── evo.c
│   └── evo.h
└── samples
    ├── elemul_test.c
    ├── info_test.c
    ......
    └── vecadd_test.c
```



附：这篇博客是我与 G 老师共同完成的，坦白说本人的写作风格更偏向意识流，容易想到哪里就写哪里。这可能导致文章在阅读体验上略显‘烧脑’——为了捕捉那些零散的知识，读者可能要先付出比学习内容本身更多的心力来梳通逻辑。因此在我原文的基础上 GPT 老师为我进行了美化处理，同时其他朋友的博客也为我的书写以及项目学习提供了诸多思路。

# 总结

总而言之，在 QEMU 的基础上搭建 GPGPU 外设的过程中，认识了 MMIO、BAR0 等概念，熟悉了通过 MMIO 控制寄存器完成显存上的数据搬运，使用自建的 RV 指令解释器实现 GPGPU 的计算能力，理解了低精度浮点格式的实现。

搭建 CUDA 软件栈的过程中，深度体验到驱动对 PCI 上的设备调用方式，对 Runtime 接口和底层硬件交互有了更直观的理解

