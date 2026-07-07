# QEMU 训练营 2026 专业阶段总结

!!! note "主要贡献者"

    - 作者：[@zhaoguohan123](https://github.com/zhaoguohan123)

---

## 背景介绍

专业阶段我做的是 CPU/TCG 方向，主要是在 QEMU 的 RISC-V 后端里加一组自定义指令。刚开始做的时候，我对 QEMU 的印象还比较笼统：知道它能跑虚拟机，也知道 TCG 大概是做动态翻译的，但真到自己加一条指令时，才发现里面有好几层东西要串起来。

这次实现的扩展叫 `xg233ai`，包含矩阵转置、矩阵乘法、排序、向量加法、低比特压缩/展开、点积、ReLU、缩放和最大值等操作。我的实现方式比较直接：让 guest 程序通过 RISC-V 自定义指令把参数传进来，QEMU 在翻译阶段生成一个 helper call，运行时再进入 C helper 做真正的数据处理。

做完以后，我觉得这个实验最有价值的地方不是某一条指令本身，而是终于把 `.insn`、`insn32.decode`、`trans_*`、`gen_helper_*`、`helper_*` 这些名字放到了一条完整的链路里。

## 整体改动

这次主要改了几个地方：

- `target/riscv/insn32.decode`：描述新的指令编码；
- `target/riscv/insn_trans/trans_xg233ai.c.inc`：写每条指令的翻译函数；
- `target/riscv/helper.h`：声明 helper；
- `target/riscv/op_helper.c`：实现 helper 的具体行为；
- `target/riscv/translate.c`：把新的翻译文件 include 进 RISC-V 的翻译流程。

我后来把整个流程理解成下面这样：

```text
guest 里的 .insn
  -> 生成一条 RISC-V 自定义机器指令
  -> QEMU 取出这条指令的 opcode
  -> decode_insn32() 匹配 insn32.decode 里的规则
  -> 进入 trans_xg233ai_*()
  -> gen_helper_xg233ai_*() 生成 TCG helper call
  -> 运行时调用 helper_xg233ai_*()
  -> helper 读写 guest 内存，完成计算
```

这条线一开始看起来很绕，但只要分清“翻译阶段”和“运行阶段”，就顺很多。

## 从 guest 的 .insn 开始

以 `xg233ai_dma` 为例，guest 侧代码里会写类似这样的内联汇编：

```c
asm volatile(
    ".insn r 0x7b, 6, 6, %0, %1, %2"
    :
    : "r"(dst), "r"(src), "r"(grain)
    : "memory"
);
```

`.insn r` 会生成一条 R-type RISC-V 指令。这里的字段是：

```text
opcode = 0x7b
funct3 = 6
funct7 = 6
rd     = dst 所在寄存器
rs1    = src 所在寄存器
rs2    = grain 所在寄存器
```

这里有个点我一开始也容易想偏：`rd` 在标准 RISC-V 里经常表示目的寄存器，但在这条自定义指令里，我把它当成了一个输入参数，也就是 `dst` 地址。因为这条 asm 没有输出约束，所以 C 编译器也不会认为它修改了某个 C 变量。

QEMU 这边要认识这条指令，就需要在 `target/riscv/insn32.decode` 里写对应的 pattern：

```text
xg233ai_dma     0000110 ..... ..... 110 ..... 1111011 @r
```

其中 `0000110` 是 `funct7 = 6`，`110` 是 `funct3 = 6`，`1111011` 是 `opcode = 0x7b`。`@r` 表示按 R-type 格式解析，把 `rd`、`rs1`、`rs2` 提出来。

构建时，QEMU 会用 `scripts/decodetree.py` 根据 `insn32.decode` 生成 C 代码。生成后的逻辑大概相当于：

```c
if (insn 匹配 0000110 ..... ..... 110 ..... 1111011) {
    a.rd = extract32(insn, 7, 5);
    a.rs1 = extract32(insn, 15, 5);
    a.rs2 = extract32(insn, 20, 5);
    return trans_xg233ai_dma(ctx, &a);
}
```

所以这里的“进入 `trans_xg233ai_dma()`”，不是 guest 程序自己调用了这个 C 函数，而是 QEMU 在翻译 guest 指令时，自动生成的 decoder 匹配到了这条指令，然后调用了对应的翻译函数。

## trans 函数到底做什么

`trans_xg233ai_dma()` 的实现其实很短：

```c
static bool trans_xg233ai_dma(DisasContext *ctx, arg_r *a)
{
    gen_helper_xg233ai_dma(tcg_env,
                           get_gpr(ctx, a->rd, EXT_NONE),
                           get_gpr(ctx, a->rs1, EXT_NONE),
                           get_gpr(ctx, a->rs2, EXT_NONE));
    return true;
}
```

我一开始最容易混淆的是 `gen_helper_xg233ai_dma()`。看到这个名字，很自然会以为它就是执行 DMA 的地方。但实际上不是。它是在翻译阶段执行的，作用是生成一条 TCG IR，大意是：

```text
等运行到这里时，调用 helper_xg233ai_dma(env, dst, src, grain)
```

也就是说：

```text
gen_helper_* 负责生成调用
helper_*     才是真正被调用后干活的函数
```

TCG IR 可以理解成 QEMU 自己的中间表示。guest 里的一条 RISC-V 指令不会直接变成 host 机器码，中间会先经过 TCG：

```text
RISC-V guest 指令
  -> TCG IR
  -> host 机器码
```

所以 `trans_xg233ai_dma()` 发生在“翻译 guest 代码”的时候，而 `helper_xg233ai_dma()` 发生在“翻译好的代码真正运行”的时候。后面如果同一个 TB 已经被缓存，再跑到这段 guest 代码时，通常不会重新走一遍 `trans_*`，而是直接执行之前生成好的 host 代码。

这个区别对理解 QEMU 很关键。否则看到代码时会一直分不清：到底现在是在生成代码，还是正在执行 guest 指令的语义。

## helper.h 和 DEF_HELPER

在 `target/riscv/helper.h` 里，我给 `xg233ai_dma` 加了声明：

```c
DEF_HELPER_4(xg233ai_dma, void, env, tl, tl, tl)
```

这行可以粗略理解成声明了这样一个 helper：

```c
void helper_xg233ai_dma(CPURISCVState *env,
                        target_ulong dst,
                        target_ulong src,
                        target_ulong grain);
```

`DEF_HELPER_4` 里的 4 表示有 4 个参数。`env` 是 CPU 状态，`tl` 对 RISC-V 来说就是 `target_ulong` 这一类目标机字长相关的类型。

这个宏比较有意思的地方在于，`helper.h` 不只是被普通 include 一次。QEMU 会在不同地方用不同的宏定义去 include 它，于是同一行 `DEF_HELPER_4(...)` 会展开成不同东西：

```text
helper-proto.h.inc -> 生成 helper_xxx() 的 C 函数原型
helper-gen.h.inc   -> 生成 gen_helper_xxx() 这种翻译阶段接口
helper-info.c.inc  -> 生成 TCGHelperInfo 元数据
```

刚开始看这块会觉得绕，因为搜 `gen_helper_xg233ai_dma` 可能搜不到一个普通的函数体。后来才明白它是宏展开出来的，不是手写的函数。

## xg233ai_dma：8x8 矩阵转置

`xg233ai_dma` 的运行时逻辑在 `op_helper.c` 里。它会根据 `grain` 选择矩阵大小：

```c
switch (grain) {
case 0:
    n = 8;
    break;
case 1:
    n = 16;
    break;
case 2:
    n = 32;
    break;
default:
    n = 8;
    break;
}
```

以 `grain = 0` 为例，就是做 8x8 的 32-bit 矩阵转置。核心循环是：

```c
for (int i = 0; i < n; i++) {
    for (int j = 0; j < n; j++) {
        uint32_t val = xg233ai_ld_u32(env, src + (i * n + j) * 4, ra);
        cpu_stl_le_data_ra(env, dst + (j * n + i) * 4, val, ra);
    }
}
```

这里 `src` 指向 guest 内存里的一个按行连续存放的矩阵：

```text
a00 a01 a02 a03 a04 a05 a06 a07
a10 a11 a12 a13 a14 a15 a16 a17
a20 a21 a22 a23 a24 a25 a26 a27
a30 a31 a32 a33 a34 a35 a36 a37
a40 a41 a42 a43 a44 a45 a46 a47
a50 a51 a52 a53 a54 a55 a56 a57
a60 a61 a62 a63 a64 a65 a66 a67
a70 a71 a72 a73 a74 a75 a76 a77
```

读地址是：

```c
src + (i * 8 + j) * 4
```

也就是第 `i` 行第 `j` 列。写地址是：

```c
dst + (j * 8 + i) * 4
```

也就是写到第 `j` 行第 `i` 列。最后效果就是：

```text
dst[j][i] = src[i][j]
```

例如：

```text
src[0][1] -> dst[1][0]
src[2][5] -> dst[5][2]
src[7][3] -> dst[3][7]
```

结果矩阵会变成：

```text
a00 a10 a20 a30 a40 a50 a60 a70
a01 a11 a21 a31 a41 a51 a61 a71
a02 a12 a22 a32 a42 a52 a62 a72
a03 a13 a23 a33 a43 a53 a63 a73
a04 a14 a24 a34 a44 a54 a64 a74
a05 a15 a25 a35 a45 a55 a65 a75
a06 a16 a26 a36 a46 a56 a66 a76
a07 a17 a27 a37 a47 a57 a67 a77
```

这里所有地址后面都乘了 4，是因为矩阵元素按 32 bit 访问，一个元素 4 字节。

## helper 里怎么读写 guest 内存

`xg233ai_ld_u32()` 只是我自己包的一层：

```c
static uint32_t xg233ai_ld_u32(CPURISCVState *env, target_ulong addr,
                               uintptr_t ra)
{
    return cpu_ldl_le_data_ra(env, addr, ra);
}
```

`cpu_ldl_le_data_ra` 这个名字可以拆开看：

- `ldl`：load long，读 32 bit；
- `le`：little-endian，小端；
- `data`：普通数据访存，不是取指；
- `ra`：return address，出异常或调试时用来定位。

写内存用的是：

```c
cpu_stl_le_data_ra(env, dst + (j * n + i) * 4, val, ra);
```

这表示往 guest 内存写一个 32-bit 小端整数。这里要注意，`src` 和 `dst` 都是 guest 地址，不是 QEMU 进程里的 host 指针，不能直接解引用。必须通过 `cpu_ld*` / `cpu_st*` 这套接口，让 QEMU 按 guest 的内存语义去处理地址转换、权限检查和异常。

这一点对我来说也很重要。之前容易下意识把 helper 当成普通 C 程序来看，但在 QEMU 里，helper 处理的是 guest 状态，访存也应该走 QEMU 提供的接口。


## 调试和理解过程

这次做下来，最卡我的不是某个循环怎么写，而是 QEMU 这几层代码分别处在哪个阶段。

一开始我看到 `gen_helper_xg233ai_dma`，以为它会执行 `xg233ai_dma`。后来顺着 `DEF_HELPER_4`、`helper-gen.h.inc`、`helper-info.c.inc` 看下去，才意识到 `gen_helper_*` 只是翻译阶段的生成器。真正执行转置的是 `helper_xg233ai_dma`。

另一个容易混的点是 `trans_xg233ai_dma`。这个函数也不是 guest 直接调用的，而是 decodetree 生成出来的 `decode_insn32()` 在匹配到指令编码后调用的。也就是说，几个文件的分工大概是：

```text
insn32.decode        描述什么机器码算这条指令
trans_xg233ai.c.inc  描述这条指令翻译成什么 TCG IR
helper.h             声明 helper，并生成相关包装
op_helper.c          写真正的运行时行为
```

把这个关系想明白以后，再看其他 RISC-V 指令的实现就顺了很多。很多文件名虽然一开始吓人，但其实都在服务同一件事：把 guest 指令变成 host 能执行的代码。

## 总结

这次专业阶段让我对 QEMU 的 TCG 流程有了更具体的认识。以前看到 `.decode`、`trans_*`、`DEF_HELPER_*`、`helper_*` 这些名字，只知道它们和指令翻译有关，但说不清谁先谁后。现在至少能把新增一条指令的路径串起来：

```text
指令编码
  -> decodetree 匹配
  -> translator 生成 TCG IR
  -> helper 实现运行时语义
  -> guest 内存接口完成读写
```
