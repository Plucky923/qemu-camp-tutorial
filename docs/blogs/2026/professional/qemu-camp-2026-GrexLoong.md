# QEMU 训练营 2026 专业阶段总结

!!! note "主要贡献者"

    - 作者：[@GrexLoong](https://github.com/GrexLoong)

---

## 1. 背景介绍

我目前在芯片公司实习，任务是给自研的 RISC-V 芯片做 QEMU 接入，让它能在虚拟环境中跑起来。来之前只有嵌入式开发的经验，打开 QEMU 源码就懵了——百万行级别的 C 代码，完全不知道从哪下手。

训练营专业阶段有 CPU、SoC、GPGPU、Rust 四个方向。我选了 CPU 方向，因为实习的核心就是在 QEMU 的 RISC-V target 中增加自定义指令支持，而 CPU 方向教的正是从指令译码到 TCG 翻译再到行为模型实现的完整链路。带着具体的工程问题来学，方向很明确。

---

## 2. 实验概述

CPU 方向的任务是在 G233 虚拟机器上实现 Xg233ai 自定义指令扩展。这个扩展在 RISC-V 的 custom-3 编码空间（opcode `0x7B`）中定义了 10 条 R-type 指令，共享 funct3 `6`，通过 funct7 来区分彼此：

| 指令       | funct7 | 功能                     | 类别        |
| ---------- | ------ | ------------------------ | ----------- |
| `dma`    | 6      | FP32 矩阵转置搬运        | 数据搬运    |
| `gemm`   | 14     | INT32 4×4 矩阵乘法      | AI 线性层   |
| `sort`   | 22     | INT32 数组冒泡排序       | 数据处理    |
| `vadd`   | 30     | INT32[16] 向量逐元素加法 | AI 残差连接 |
| `crush`  | 38     | 8-bit → 4-bit 压缩打包  | 量化压缩    |
| `expand` | 54     | 4-bit → 8-bit 解压展开  | 量化解压    |
| `vdot`   | 70     | INT32[16] 向量点积归约   | AI 点积     |
| `vrelu`  | 86     | INT32 向量 ReLU 激活     | AI 激活     |
| `vscale` | 102    | INT32[16] 向量标量乘     | AI 归一化   |
| `vmax`   | 118    | INT32 向量最大值归约     | AI 池化     |

10 条指令中 6 条是 AI 推理加速类，4 条是通用数据处理类。在完成基础实验之后，我还做了进阶实验一：把 `vadd` 从 helper 调用改为内联 TCG IR 实现。

---

## 3. 一条指令从编码到执行

这是整个实验收获最大的部分——弄清楚了一条自定义 RISC-V 指令在 QEMU 里是怎么从 32 位二进制变成实际行为的。以 `vdot`（向量点积归约，funct7=70）为例，整个过程经过四个层次。

**3.1 编码**

Xg233ai 的所有指令都是 32 位定长的 R-type 格式，每位都有明确的含义：

```
31        25 24    20 19    15 14    12 11      7 6       0
+-----------+--------+--------+--------+---------+---------+
|  funct7   |  rs2   |  rs1   | funct3 |   rd    | opcode  |
|  7 bits   | 5 bits | 5 bits | 3 bits | 5 bits  | 7 bits  |
+-----------+--------+--------+--------+---------+---------+
```

具体到 vdot：funct7 = `1000110`（十进制 70），opcode = `1111011`（`0x7B`，RISC-V custom-3 空间），funct3 = `110`（`6`）。opcode 和 funct3 共同确定了"这是 Xg233ai 家族的指令"，funct7 再区分家族里的具体成员。rs1、rs2、rd 各 5 位，可以编码 32 个通用寄存器——不过 Xg233ai 的指令大多把它们当内存地址或控制参数用，不全是寄存器编号。

**3.2 Decodetree 译码**

QEMU 用 decodetree 工具来做指令识别，这是一个编译时的代码生成器。在 `Xg233ai.decode` 文件中，先定义字段和格式模板：

```
# 字段：从 32 位指令中提取位段
%rs2  20:5       ← 从 bit 20 开始取 5 位
%rs1  15:5       ← 从 bit 15 开始取 5 位
%rd    7:5       ← 从 bit  7 开始取 5 位

# 格式模板：用 . 表示变量位，0/1 表示固定位
@r    .......  ..... ..... ... ..... ....... &r  %rs2 %rs1 %rd
       ^7bits  ^5bits ^5bits^3bits^5bits^7bits
       funct7   rs2    rs1  funct3  rd   opcode
```

然后每条指令只需指定自己的 funct7：

```
vdot    1000110  ..... ..... 110 ..... 1111011 @r
sort    0010110  ..... ..... 110 ..... 1111011 @r
dma     0000110  ..... ..... 110 ..... 1111011 @r
...
```

`@r` 模板引用告诉 decodetree：funct7 和 opcode/funct3 是固定值用来匹配，rs2/rs1/rd 三个字段是变量，匹配成功后提取出来填到 `arg_r` 参数结构体里。

在 `meson.build` 中声明了对 decode 文件的处理：

```python
decodetree.process('Xg233ai.decode',
    extra_args: '--static-decode=decode_Xg233ai')
```

编译时 decodetree 工具将 `.decode` 文件转换为 `decode-Xg233ai.c.inc`，其中 `decode_Xg233ai()` 函数本质就是一个大的 switch-case——根据 funct7 的值分发到对应的 `trans_*` 函数。这个生成文件在 `translate.c` 中被 include 并注册到译码器表中。

整个数据流如下：

```
RISC-V 32-bit 指令字
        │
        ▼
┌──────────────────────────────┐
│ ① Decodetree 译码             │  Xg233ai.decode
│   模式匹配 → 提取 rs1/rs2/rd  │  → decode-Xg233ai.c.inc (自动生成)
└──────────────┬───────────────┘
               │ arg_r {rd, rs1, rs2}
               ▼
┌──────────────────────────────┐
│ ② Translate 翻译              │  insn_trans/trans_xg233ai.c.inc
│   生成 TCG IR，调用 helper    │
└──────────────┬───────────────┘
               │ gen_helper_xxx()
               ▼
┌──────────────────────────────┐
│ ③ Helper 执行                 │  xg233ai_helper.c
│   读写客户机内存，完成计算     │
└──────────────────────────────┘
```

**3.3 Translate 翻译**

译码之后进入 translate 阶段，这是 TCG 前端的核心。`trans_vdot` 在 `trans_xg233ai.c.inc` 中定义：

```c
static bool trans_vdot(DisasContext *ctx, arg_r *a)
{
    TCGv rd    = dest_gpr(ctx, a->rd);             // 创建 rd 的写入目标
    TCGv src_a = get_gpr(ctx, a->rs1, EXT_NONE);   // 读 rs1（向量 A 地址）
    TCGv src_b = get_gpr(ctx, a->rs2, EXT_NONE);   // 读 rs2（向量 B 地址）
    gen_helper_vdot(rd, tcg_env, src_a, src_b);     // 生成 helper 调用
    gen_set_gpr(ctx, a->rd, rd);                    // 结果写回寄存器
    return true;
}
```

这里有一个容易忽略的细节：rd 用的是 `dest_gpr` 而非 `get_gpr`。`get_gpr` 读取寄存器的当前值，适合 rs1、rs2 这种只读的操作数。`dest_gpr` 为写入目标创建一个新的临时变量——当 rd 恰好是 RISC-V 的零寄存器（x0）时，`dest_gpr` 会返回一个可安全丢弃的临时值，后续 `gen_set_gpr` 能正确处理"写入 x0 即丢弃"的语义。这是 QEMU RISC-V translator 的标准范式：读用 `get_gpr`，写用 `dest_gpr`。

这里藏着 10 条指令中最重要的设计差异。vdot 和 vmax 是"归约型"——输入是内存中的数组，但输出是单个标量值，需要通过寄存器返回，所以 translate 层要多写一行 `gen_set_gpr`。其余 8 条是"内存操作型"——输入和输出都是内存中的数组，结果直接写到客户机内存里了，不需要回写寄存器。这个区分在 `helper.h` 的声明中也能一眼看出来：

```c
DEF_HELPER_3(vdot,  tl, env, tl, tl)     // 归约型：返回 tl，3 个参数
DEF_HELPER_4(vrelu, void, env, tl, tl, tl)  // 内存操作型：返回 void，4 个参数
```

**3.4 Helper 执行**

`gen_helper_vdot` 最终调用 `xg233ai_helper.c` 中的 `HELPER(vdot)`。helper 运行在宿主机（x86）上，但操作的是客户机（RISC-V）内存，不能直接用 C 指针解引用。QEMU 为 helper 提供了 `cpu_ldl_data` / `cpu_stl_data` 系列函数来做正常的 guest 内存访问——它们会走完整的 MMU 翻译路径，在地址不合法时触发 guest 异常，行为与真实硬件一致：

vdot 的完整 helper 实现如下：

```c
target_ulong HELPER(vdot)(CPURISCVState *env, target_ulong a_addr,
                           target_ulong b_addr)
{
    int64_t acc = 0;
    for (int i = 0; i < 16; i++) {
        int32_t ua = (int32_t)cpu_ldl_data(env, a_addr + i * 4);  // 读 A[i]
        int32_t ub = (int32_t)cpu_ldl_data(env, b_addr + i * 4);  // 读 B[i]
        acc += (int64_t)ua * (int64_t)ub;                           // INT64 累加
    }
    return (target_ulong)acc;
}
```

注意累加器用了 INT64 而非 INT32——因为 16 个 INT32 乘积的和可能远超 32 位范围。`cpu_ldl_data` 返回的是 32 位无符号值，显式转为 `int32_t` 后再由编译器自动扩展到 INT64 参与乘法。这种"宽累加器"的设计在真实芯片的向量点积指令里也是标准做法。

不同指令对客户机内存的访问策略也不一样。以 `sort` 为例，冒泡排序需要反复交换数组元素，如果每次 swap 都要走 guest 内存访问，开销极大。helper 的做法是先用 GLib 的 `g_new` 在宿主机堆上分配一块临时内存，把整个数组读进来：

```c
int32_t *A = g_new(int32_t, N);          // 宿主机临时缓冲区
for (uint64_t i = 0; i < N; i++) {
    A[i] = (int32_t)cpu_ldl_data(env, addr + i * 4);  // 批量读到宿主机
}
// 在宿主机上做冒泡排序（纯 C，无访问开销）
if (K > 1) {
    for (uint64_t i = 0; i < K - 1; i++)
        for (uint64_t j = 0; j < K - i - 1; j++)
            if (A[j] > A[j + 1]) { swap(A[j], A[j+1]); }
}
// 排序完成后批量写回客户机内存
for (uint64_t i = 0; i < N; i++) {
    cpu_stl_data(env, addr + i * 4, (uint32_t)A[i]);  // 批量写回
}
g_free(A);
```

对于字节粒度的操作（如 `crush`），对应的函数是 `cpu_ldub_data`（读 8-bit）和 `cpu_stb_data`（写 8-bit）。

---

## 4. 进阶实验：Helper → 内联 TCG IR

基础实验完成后，我做了进阶实验一：把 `vadd` 指令从 helper 调用改为在 translate 阶段直接生成 TCG IR。

vadd 是固定 16 元素的向量逐元素加法，操作足够简单，适合做内联化。原来的写法是一行 `gen_helper_vadd(tcg_env, dst, src_a, src_b)` 调用 C helper。进阶版改为用 TCG 原语直接在 translate 回调中展开循环：

```c
TCGv addr = tcg_temp_new();
TCGv va = tcg_temp_new();
TCGv vb = tcg_temp_new();

for (int i = 0; i < 16; i++) {
    tcg_gen_addi_tl(addr, src_a, i * 4);                  // addr = src_a + i*4
    tcg_gen_qemu_ld_tl(va, addr, ctx->mem_idx, MO_TEUL);  // va = mem[addr]
    tcg_gen_addi_tl(addr, src_b, i * 4);
    tcg_gen_qemu_ld_tl(vb, addr, ctx->mem_idx, MO_TEUL);  // vb = mem[addr]
    tcg_gen_add_tl(va, va, vb);                             // va = va + vb
    tcg_gen_addi_tl(addr, dst, i * 4);
    tcg_gen_qemu_st_tl(va, addr, ctx->mem_idx, MO_TEUL);  // mem[addr] = va
}
```

这里用到的 TCG 原语各司其职：`tcg_gen_addi_tl` 计算地址偏移，`tcg_gen_qemu_ld_tl` 和 `tcg_gen_qemu_st_tl` 生成客户机内存访问的 TCG IR，`tcg_gen_add_tl` 做实际加法。`MO_TEUL` 表示 32 位小端无符号访问，`ctx->mem_idx` 告诉 TCG 后端当前 CPU 的内存访问权限级别。

两种方式的对比：

| 维度     | Helper 版                            | 内联 TCG IR 版                   |
| -------- | ------------------------------------ | -------------------------------- |
| 实现位置 | xg233ai_helper.c（C 函数）           | trans_xg233ai.c.inc（译码回调）  |
| 执行开销 | 每次调 helper 要保存/恢复 CPU 上下文 | 直接内联到翻译块，零调用开销     |
| 表达能力 | 完整 C 语言，可以写任意复杂逻辑      | 受限于 TCG 原语集合              |
| 适用场景 | 复杂控制流（sort、gemm）             | 简单固定长度操作（vadd、vscale） |

做完这个实验后给我最大的启发是：**helper 是零件，不是骨架**。decodetree 译码和 translate 翻译这两层完全不需要动，只改底层实现方式，所有测试依然通过。能区分"可变零件"和"不变骨架"，比学会某条指令的具体写法重要得多。

---

## 5. 6/10 是 AI 指令这件事

做完实验回头一看，10 条指令里有 6 条跟 AI 推理直接相关。一开始以为只是选题偏好，后来对着业界的指令集看了看，发现每条都能找到对应：

- `gemm`（4×4 矩阵乘法）→ 对应 Intel AMX、ARM SME、NVIDIA Tensor Core 的矩阵乘单元。AI 推理 80% 以上的计算量都归约为矩阵乘法，谁把 GEMM 做快谁就赢得了推理市场。
- `vdot`（向量点积）→ 对应 Intel VNNI 的 `vpdpbusd`、ARM SVE 的 `sdot`。8-bit/16-bit 量化点积是 INT8 量化推理的核心运算。
- `vrelu` / `vmax` / `vscale` → 对应 SIMD 向量化的激活、池化、归一化操作，是神经网络推理管线中除矩阵乘之外最频繁的逐元素操作。

训练营的指令设计不是在凑数——`gemm` + `vadd` 是线性层，`vrelu` 是激活层，`vdot` + `vscale` 是注意力层，`vmax` 是池化层，`crush`/`expand` 是量化/解量化。10 条指令恰好覆盖了神经网络推理的全部关键阶段。这是 Domain-Specific Architecture 思想的教学版本：针对一个特定领域（AI 推理）设计专用指令集，每条指令加速一个关键算子。

---

## 6. 总结

来训练营之前，我对 QEMU 的理解基本上停留在"会用命令行启动虚拟机"。几周下来，从对着 R-type 编码表琢磨 opcode 和 funct7 的区别开始，到 decodetree 的模式匹配、translate 层的寄存器读写、helper 里用 `cpu_ldl_data` / `cpu_stl_data` 逐元素访问客户机内存，再到进阶实验里把 helper 替换成内联 TCG IR——一步步走过来，最大的变化不是会写某条指令了，而是对"QEMU 怎么执行指令"这件事有了一个完整的心理地图。

实习中我要做的也是给自定义 RISC-V 指令写模拟支持，训练营教的 decode → translate → helper 这三层能直接用上。而且因为做过了进阶实验，知道 helper 这层不是死的，它可以是纯 C、可以是 TCG IR、也可以根据实际工程需要调整实现方式。这个"骨架不变、零件可换"的认识，大概是这次训练营专业阶段的学习对我最有用的收获。
