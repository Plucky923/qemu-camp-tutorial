# G233 CPU 指令扩展手册（教学版）

!!! warning "免责声明"
    本手册描述的是用于 QEMU 训练营的 **教学用自定义指令扩展（Xg233ai）** 的规格与编程模型，并不对应任何实体芯片。
    训练营可能在不另行通知的情况下调整实现细节；若手册与实际实现不一致，以测题/参考实现为准。

!!! note "主要贡献者"
    - 维护：[@zevorn](https://github.com/zevorn)

| 项目 | 值 |
| --- | --- |
| 目标读者 | 训练营学员、QEMU TCG 前端开发人员 |
| 适用范围 | `docs/exercise/2026/stage2/cpu/`（CPU 方向） |
| 文档状态 | Draft |
| 最后更新 | 2026-03-10 |

## 1. 概述

本手册定义 G233 虚拟 SoC 所搭载的 `riscv.g233.cpu` 处理器的 **自定义指令扩展 Xg233ai**。该扩展在 RISC-V custom-3 编码空间内定义了 10 条指令，覆盖以下两个类别：

- **通用数据处理**：矩阵转置、排序、位域压缩/解压
- **AI 推理加速**：向量点积、矩阵乘、ReLU 激活、向量缩放、最大值归约、向量加法

这些指令的设计目标是让学员在 QEMU TCG 前端实现完整的指令翻译流程（Decodetree 译码 → Helper / TCG ops 实现 → 测试验证）。

### 1.1 处理器概览

| 项目 | 值 |
| --- | --- |
| 处理器核名称 | `riscv.g233.cpu` |
| 基础 ISA | RV64GC (RVA23) |
| 自定义扩展 | Xg233ai（本手册） |

!!! note
    基础 ISA 的完整扩展列表与 CSR 行为，以训练营给出的 QEMU 配置与实现为准。本手册仅定义 Xg233ai 扩展指令。

## 2. 文档约定

### 2.1 数值与端序

- 除非特别说明，所有数值均为十六进制，形如 `0x0000_007B`。
- 内存中的多字节数据按 **小端序（little-endian）** 解释。
- 整型数据默认为 **有符号 32 位整数（INT32）**，即 C 语言的 `int32_t`。
- 浮点数据默认为 **IEEE 754 单精度（FP32）**，即 C 语言的 `float`。

### 2.2 伪代码记法

- `mem32[addr]`：从地址 `addr` 读/写一个 32 位值（4 字节，小端）。
- `gpr[x]`：通用寄存器 `x` 的值（64 位）。
- `XLEN`：寄存器位宽，本平台为 64。
- 数组下标从 0 开始；`A[i]` 等价于 `mem32[base_A + i * 4]`。

### 2.3 术语

- **未定义（undefined）**：实现可以产生任意结果；软件不得依赖其行为。
- **实现定义（implementation-defined）**：实现必须在某处给出选择；若未给出，软件仍不得依赖。

## 3. Xg233ai 指令扩展

### 3.1 编码概述

Xg233ai 的全部 10 条指令共享以下编码字段：

- **指令格式**：R-type（32 位定长）
- **opcode**：`1111011`（`0x7B`，RISC-V custom-3 编码空间）
- **funct3**：`110`

指令之间通过 **funct7** 区分。编码模板如下：

```text
31      25 24  20 19  15 14  12 11   7 6     0
+---------+------+------+------+------+-------+
| funct7  | rs2  | rs1  |funct3|  rd  | opcode|  R-type
+---------+------+------+------+------+-------+
|  7 bits | 5b   | 5b   | 110  | 5b   |1111011|
+---------+------+------+------+------+-------+
```

### 3.2 指令编码总表

| funct7 (bin) | funct7 (dec) | 助记符 | 类别 | 简要描述 |
| --- | --- | --- | --- | --- |
| `0000110` | 6 | `dma` | 数据搬运 | FP32 矩阵转置搬运 |
| `0001110` | 14 | `gemm` | AI 线性层 | INT32 4×4 矩阵乘法 |
| `0010110` | 22 | `sort` | 数据处理 | INT32 数组冒泡排序 |
| `0011110` | 30 | `vadd` | AI 残差连接 | INT32 向量逐元素加法 |
| `0100110` | 38 | `crush` | 量化压缩 | 8-bit → 4-bit 压缩打包 |
| `0110110` | 54 | `expand` | 量化解压 | 4-bit → 8-bit 解压展开 |
| `1000110` | 70 | `vdot` | AI 点积 | INT32 向量点积归约 |
| `1010110` | 86 | `vrelu` | AI 激活 | INT32 向量 ReLU |
| `1100110` | 102 | `vscale` | AI 归一化 | INT32 向量标量乘 |
| `1110110` | 118 | `vmax` | AI 池化 | INT32 向量最大值归约 |

### 3.3 操作数约定

由于 R-type 仅提供 3 个寄存器操作数（rd, rs1, rs2），Xg233ai 指令按照以下约定使用它们：

- **数组到数组的操作**（dma, sort, crush, expand, vrelu, vscale, vadd, gemm）：`rd` 编码目标内存地址或控制参数，指令不回写通用寄存器。
- **归约操作**（vdot, vmax）：指令将标量结果写入 `gpr[rd]`。

每条指令的操作数含义在下文独立定义。

---

### 3.4 `dma` — FP32 矩阵转置搬运

将一个 FP32 精度的二维矩阵从源地址读取，转置后写入目标地址。

```text
+---------+------+------+------+------+-------+
| 0000110 | rs2  | rs1  | 110  |  rd  |1111011|  dma
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 源矩阵在内存中的起始地址 |
| `rs2` | 矩阵规模选择：`0` → 8×8，`1` → 16×16，`2` → 32×32 |
| `rd` | 目标矩阵在内存中的起始地址 |

**伪代码**：

```text
N = {8, 16, 32}[gpr[rs2]]
for i in 0..N-1:
    for j in 0..N-1:
        dst[j * N + i] = src[i * N + j]      // FP32, 4 bytes each
where src = mem at gpr[rs1], dst = mem at gpr[rd]
```

!!! note
    `gpr[rs2]` 的值超出 `{0, 1, 2}` 时，行为为 **未定义**。源区域和目标区域不得重叠。

---

### 3.5 `sort` — INT32 数组冒泡排序

对内存中的 INT32 数组执行升序冒泡排序。

```text
+---------+------+------+------+------+-------+
| 0010110 | rs2  | rs1  | 110  |  rd  |1111011|  sort
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 数组在内存中的起始地址 |
| `rs2` | 数组的总元素数量 |
| `rd` | 参与排序的元素数量（从数组头部开始） |

**伪代码**：

```text
A = mem at gpr[rs1]                           // INT32 array
N = gpr[rs2]                                  // total elements (upper bound)
K = gpr[rd]                                   // elements to sort
for i in 0..K-2:
    for j in 0..K-i-2:
        if A[j] > A[j+1]:
            swap(A[j], A[j+1])
```

!!! note
    排序结果 **原地写回** 原数组。仅数组前 K 个元素参与排序，其余元素保持不变。`gpr[rs2]` 表示数组总长度，仅作为边界约束；排序算法本身仅使用 K。`gpr[rd] > gpr[rs2]` 时行为为 **未定义**。

---

### 3.6 `crush` — 8-bit → 4-bit 压缩打包

将源数组中每个 8-bit 元素的低 4 位两两打包为一个 8-bit 元素。

```text
+---------+------+------+------+------+-------+
| 0100110 | rs2  | rs1  | 110  |  rd  |1111011|  crush
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 源数组在内存中的起始地址（UINT8 元素） |
| `rs2` | 源数组的元素数量 N |
| `rd` | 目标数组在内存中的起始地址 |

**伪代码**：

```text
src = mem at gpr[rs1]                         // UINT8 array, N elements
dst = mem at gpr[rd]                          // UINT8 array, ceil(N/2) elements
for i in 0..N/2-1:
    dst[i]  = src[2*i] & 0x0F
    dst[i] |= (src[2*i + 1] & 0x0F) << 4
```

!!! note
    若 N 为奇数，最后一个元素单独打包到低 4 位，高 4 位置零。

---

### 3.7 `expand` — 4-bit → 8-bit 解压展开

将源数组中每个 8-bit 元素按 4-bit 拆分为两个 8-bit 元素。

```text
+---------+------+------+------+------+-------+
| 0110110 | rs2  | rs1  | 110  |  rd  |1111011|  expand
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 源数组在内存中的起始地址（UINT8 元素） |
| `rs2` | 源数组的元素数量 N |
| `rd` | 目标数组在内存中的起始地址 |

**伪代码**：

```text
src = mem at gpr[rs1]                         // UINT8 array, N elements
dst = mem at gpr[rd]                          // UINT8 array, 2*N elements
for i in 0..N-1:
    dst[2*i]     = src[i] & 0x0F
    dst[2*i + 1] = (src[i] >> 4) & 0x0F
```

---

### 3.8 `vdot` — INT32 向量点积

计算两个 INT32 向量的点积，结果写入目标寄存器。这是神经网络全连接层和注意力机制中的核心操作。

```text
+---------+------+------+------+------+-------+
| 1000110 | rs2  | rs1  | 110  |  rd  |1111011|  vdot
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 向量 A 在内存中的起始地址（INT32[16]） |
| `rs2` | 向量 B 在内存中的起始地址（INT32[16]） |
| `rd` | 目标寄存器，接收标量点积结果 |

**伪代码**：

```text
A = mem at gpr[rs1]                           // INT32[16]
B = mem at gpr[rs2]                           // INT32[16]
acc = 0                                       // INT64 accumulator
for i in 0..15:
    acc += (INT64)A[i] * (INT64)B[i]
gpr[rd] = acc[XLEN-1:0]                      // truncate to XLEN
```

!!! note
    向量长度固定为 **16 个元素**（64 字节）。累加使用 64 位精度以避免中间溢出，最终截断到 XLEN 位写入 `gpr[rd]`。

---

### 3.9 `vrelu` — INT32 向量 ReLU 激活

对内存中的 INT32 数组逐元素执行 ReLU 激活函数 `max(0, x)`，将结果写入目标数组。ReLU 是深度学习中最常见的激活函数。

```text
+---------+------+------+------+------+-------+
| 1010110 | rs2  | rs1  | 110  |  rd  |1111011|  vrelu
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 源数组在内存中的起始地址（INT32） |
| `rs2` | 数组元素数量 N |
| `rd` | 目标数组在内存中的起始地址 |

**伪代码**：

```text
src = mem at gpr[rs1]                         // INT32 array
dst = mem at gpr[rd]                          // INT32 array
N   = gpr[rs2]
for i in 0..N-1:
    dst[i] = (src[i] > 0) ? src[i] : 0
```

!!! note
    允许源和目标为同一地址（原地操作）。

---

### 3.10 `vscale` — INT32 向量标量乘

将 INT32 数组的每个元素乘以一个标量值，写入目标数组。用于批归一化中的缩放操作或量化时的 scale 系数应用。

```text
+---------+------+------+------+------+-------+
| 1100110 | rs2  | rs1  | 110  |  rd  |1111011|  vscale
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 源数组在内存中的起始地址（INT32） |
| `rs2` | 标量乘数（寄存器值，非地址） |
| `rd` | 目标数组在内存中的起始地址 |

**伪代码**：

```text
src   = mem at gpr[rs1]                       // INT32 array
dst   = mem at gpr[rd]                        // INT32 array
scale = gpr[rs2]                              // scalar multiplier
N     = 16                                    // fixed vector length
for i in 0..N-1:
    dst[i] = (INT32)((INT64)src[i] * scale)   // multiply, truncate to 32-bit
```

!!! note
    向量长度固定为 **16 个元素**。乘法使用 64 位中间精度，结果截断到 32 位。允许原地操作。

---

### 3.11 `vmax` — INT32 向量最大值归约

在 INT32 数组中找到最大值，将结果写入目标寄存器。用于最大池化（max pooling）和 argmax 操作。

```text
+---------+------+------+------+------+-------+
| 1110110 | rs2  | rs1  | 110  |  rd  |1111011|  vmax
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 源数组在内存中的起始地址（INT32） |
| `rs2` | 数组元素数量 N |
| `rd` | 目标寄存器，接收最大值 |

**伪代码**：

```text
A   = mem at gpr[rs1]                         // INT32 array
N   = gpr[rs2]
max = A[0]
for i in 1..N-1:
    if A[i] > max:
        max = A[i]
gpr[rd] = sign_extend(max, 32)                // sign-extend to XLEN
```

!!! note
    `N = 0` 时行为为 **未定义**。结果做 32 位到 XLEN 的符号扩展。

---

### 3.12 `gemm` — INT32 4×4 矩阵乘法

计算两个 4×4 INT32 矩阵的乘积 C = A × B，将结果写入目标地址。矩阵乘法是神经网络线性层和 Transformer 注意力机制的基础运算。

```text
+---------+------+------+------+------+-------+
| 0001110 | rs2  | rs1  | 110  |  rd  |1111011|  gemm
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 矩阵 A 在内存中的起始地址（`INT32[4][4]`，行优先） |
| `rs2` | 矩阵 B 在内存中的起始地址（`INT32[4][4]`，行优先） |
| `rd` | 矩阵 C 在内存中的起始地址 |

**伪代码**：

```text
A = mem at gpr[rs1]                           // INT32[4][4], row-major
B = mem at gpr[rs2]                           // INT32[4][4], row-major
C = mem at gpr[rd]                            // INT32[4][4], row-major
for i in 0..3:
    for j in 0..3:
        acc = 0                               // INT64 accumulator
        for k in 0..3:
            acc += (INT64)A[i][k] * (INT64)B[k][j]
        C[i][j] = (INT32)acc
```

!!! note
    矩阵大小固定为 **4×4**（每个矩阵 64 字节）。A、B、C 三块内存区域不得重叠。累加使用 64 位精度。

---

### 3.13 `vadd` — INT32 向量逐元素加法

将两个 INT32 向量逐元素相加，结果写入目标地址。用于神经网络中的残差连接（ResNet skip connection）和偏置（bias）加法。

```text
+---------+------+------+------+------+-------+
| 0011110 | rs2  | rs1  | 110  |  rd  |1111011|  vadd
+---------+------+------+------+------+-------+
```

| 操作数 | 含义 |
| --- | --- |
| `rs1` | 向量 A 在内存中的起始地址（INT32[16]） |
| `rs2` | 向量 B 在内存中的起始地址（INT32[16]） |
| `rd` | 目标向量 C 在内存中的起始地址 |

**伪代码**：

```text
A = mem at gpr[rs1]                           // INT32[16]
B = mem at gpr[rs2]                           // INT32[16]
C = mem at gpr[rd]                            // INT32[16]
for i in 0..15:
    C[i] = A[i] + B[i]                       // INT32 wrapping add
```

!!! note
    向量长度固定为 **16 个元素**（64 字节）。加法溢出按二进制补码回绕。允许目标与某个源地址相同（原地操作）。

## 4. 指令与 AI 推理流程的映射

下表展示 Xg233ai 指令如何映射到典型神经网络推理管线中的各个阶段：

```text
输入数据
  │
  ├─ [dequant] ──→ expand (4-bit → 8-bit 解压)
  │
  ├─ [线性层] ──→ gemm (矩阵乘) + vadd (偏置加法)
  │
  ├─ [激活层] ──→ vrelu (ReLU 激活)
  │
  ├─ [注意力] ──→ vdot (Q·K 点积) + vscale (缩放 1/√d)
  │
  ├─ [池化层] ──→ vmax (最大池化)
  │
  ├─ [残差连接] ──→ vadd (跳跃连接)
  │
  ├─ [量化输出] ──→ crush (8-bit → 4-bit 压缩)
  │
  └─ [数据搬运] ──→ dma (矩阵转置)
```

## 5. 编程示例

### 5.1 客户机侧内联汇编

由于标准编译器不识别 Xg233ai 指令，客户机程序需要使用 `.insn` 伪指令编码：

```c
/* R-type encoding: .insn r opcode, funct3, funct7, rd, rs1, rs2 */

/* vdot: dot product of two INT32[16] vectors */
static inline long vdot(const int *a, const int *b)
{
    long result;
    asm volatile(
        ".insn r 0x7b, 6, 70, %0, %1, %2"
        : "=r"(result)
        : "r"(a), "r"(b)
        : "memory"
    );
    return result;
}

/* vrelu: apply ReLU to INT32 array */
static inline void vrelu(int *dst, const int *src, long n)
{
    asm volatile(
        ".insn r 0x7b, 6, 86, %0, %1, %2"
        :
        : "r"(dst), "r"(src), "r"(n)
        : "memory"
    );
}

/* gemm: 4x4 matrix multiply C = A * B */
static inline void gemm(int *c, const int *a, const int *b)
{
    asm volatile(
        ".insn r 0x7b, 6, 14, %0, %1, %2"
        :
        : "r"(c), "r"(a), "r"(b)
        : "memory"
    );
}
```

### 5.2 简单推理流水线

```c
#define VEC_LEN 16

int weights[4][4];    /* pre-loaded model weights */
int bias[VEC_LEN];
int input[VEC_LEN];
int hidden[VEC_LEN];
int output[VEC_LEN];

/* Step 1: Linear layer (simplified) */
gemm(hidden, (int *)weights, input);

/* Step 2: Add bias */
vadd(hidden, hidden, bias);

/* Step 3: ReLU activation */
vrelu(hidden, hidden, VEC_LEN);

/* Step 4: Find max (for classification) */
long max_val = vmax(hidden, VEC_LEN);
```
