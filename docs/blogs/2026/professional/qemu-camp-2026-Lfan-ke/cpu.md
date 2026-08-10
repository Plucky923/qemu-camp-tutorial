# QEMU CPU 方向

!!! note "主要贡献者"

    - 作者：[@Lfan-ke](https://github.com/Lfan-ke)

---

## 套路 QS :改 4 个文件 (按语义顺序走一遍) <!-- Quick Start 4 Beginner -->

以加一条 myadd(rd = rs1 + rs2) 为例，一条指令从"怎么认出来"到"怎么执行"分四步，正好对应四个文件。

### 第 1 步 编码/解码 - `target/riscv/insn32.decode`

告诉 decodetree 这条指令长什么样。自定义指令用 RISC-V custom opcode 空间 (0x0B/0x2B/0x5B/0x7B 四选一),复用现成 R 型格式 @r:

    myadd  0000000 ..... ..... 000 ..... 0001011 @r   # funct7=0000000 funct3=000 opcode=0001011(custom-0);其余位由 @r 抽取

decodetree 据此生成 decode_insn32(),匹配到这个位模式就派发到 trans_myadd。

### 第 2 步 参数怎么传进来 - 还是 .decode 的 &参数集

@r 绑定了 `&r rd rs1 rs2`(见下一节),decodetree 就为这条指令生成一个 `arg_r` 结构，里面是解码出来的 rd/rs1/rs2 三个寄存器号。trans 函数收到 `arg_r *a`,`a->rs1 / a->rs2 / a->rd` 就是操作数。要更多操作数 (如带立即数),自己定 &参数集：`&r2 rd rs1 rs2 imm`。

### 第 3 步 函数头部 - trans 与 helper 的签名

- trans 签名固定：`static bool trans_<指令名>(DisasContext *ctx, arg_<格式> *a)`,名字必须与 decode 里指令名一致，返回 bool(true=解码成功)。

        static bool trans_myadd(DisasContext *ctx, arg_r *a)

- 若要交给 helper，在 `target/riscv/helper.h` 声明原型：

        DEF_HELPER_FLAGS_2(myadd, TCG_CALL_NO_RWG_SE, tl, tl, tl)   # 名，flags, 返回类型，入参类型...; tl=target_ulong; NO_RWG_SE=无副作用可优化
        # 需要访存/副作用的 helper，第一个入参用 env:DEF_HELPER_FLAGS_4(mycopy, 0, void, env, tl, tl, tl)

### 第 4 步 语义/实现

trans 体 (`target/riscv/insn_trans/trans_rvi.c.inc`) 两种写法：

    // (a) 能用现成 TCG op 表达的,直接发,无函数调用开销
    static bool trans_myadd(DisasContext *ctx, arg_r *a)
    {
        TCGv s1 = get_gpr(ctx, a->rs1, EXT_NONE);   // 读源寄存器(x0 恒 0 已由 get_gpr 处理)
        TCGv s2 = get_gpr(ctx, a->rs2, EXT_NONE);
        TCGv d  = dest_gpr(ctx, a->rd);             // 目标寄存器的临时 TCGv
        tcg_gen_add_tl(d, s1, s2);                  // 发一条 TCG 加法:d = s1 + s2
        gen_set_gpr(ctx, a->rd, d);                 // 写回 rd(rd=x0 时自动丢弃)
        return true;                                // true=解码成功
    }
    // 简单算术其实有包装:return gen_arith(ctx, a, EXT_NONE, tcg_gen_add_tl, NULL); 等价上面

    // (b) 语义复杂(循环/访存/规约)的,交给 helper
    static bool trans_myadd(DisasContext *ctx, arg_r *a)
    {
        TCGv dest = dest_gpr(ctx, a->rd);
        gen_helper_myadd(dest,
                         get_gpr(ctx, a->rs1, EXT_NONE),
                         get_gpr(ctx, a->rs2, EXT_NONE));
        gen_set_gpr(ctx, a->rd, dest);   // 必须写回:dest_gpr 在窄操作(RV32-on-riscv64)/x0 时是临时量,漏 gen_set_gpr 结果会丢
        return true;
    }

helper 体 (`target/riscv/op_helper.c`,纯 C 语义):

    target_ulong HELPER(myadd)(target_ulong a, target_ulong b) { return a + b; }
    // 访存类要拿 env,用带 MMU 的 cpu_ldl_data(env, addr) / cpu_stl_data(env, addr, val),不能裸指针

四步对应四文件:decode=编码 + 声明参数抽取，.decode 的 &参数集=参数怎么传，helper.h=函数头，trans/op_helper.c=语义体。

## decodetree 记号:%字段 / &参数集 / @格式 (模板)

三种可复用记号：
- `%field` 字段抽取：从指令第几位取几位。`%rs1 15:5` = 从 bit15 取 5 位当 rs1。
- `&argset` 参数集:trans 函数收到的结构体 arg_<名> 有哪些字段。`&r rd rs1 rs2`。
- `@format`(@标签) 格式模板：把"固定位掩码 + 字段抽取 + 绑定哪个 &参数集"打包成可复用模板，多条指令共用。

真实 R 型模板 (insn32.decode):

    %rs2  20:5                                          # 字段 rs2 = 指令 bit20 起 5 位
    %rs1  15:5                                          # 字段 rs1 = bit15 起 5 位
    %rd    7:5                                          # 字段 rd  = bit7  起 5 位
    &r    rd rs1 rs2                                    # 参数集:trans 收到的 arg_r 里有 rd/rs1/rs2 三个字段
    @r    ....... ..... ..... ... ..... ....... &r %rs2 %rs1 %rd   # R 型模板:所有位留空(交由 pattern 填),绑 &r,并用上面的 % 把 rs2/rs1/rd 抽出来

一条指令引用它：

    add   0000000 ..... ..... 000 ..... 0110011 @r     # 只写死 funct7=0000000/funct3=000/opcode=0110011用于匹配,其余(rd/rs1/rs2)继承 @r

继承规则：
- pattern 里写死的 0/1 是"必须匹配"的位 (add 的 funct7=0000000、funct3=000、opcode=0110011);`.` 是"不关心，交给 @格式的字段抽取"。
- @格式提供字段位置 (%rs1/%rs2/%rd) 和 &参数集;pattern 没显式写的字段全从 @格式继承。pattern 里若再写某字段会覆盖 @格式的同名项。
- 结果:decodetree 解出 arg_r{rd,rs1,rs2},自动派发到 `trans_add(ctx, arg_r *a)`,a->rs1/rs2/rd 即寄存器号。
- 自定义指令就是自己定一个 @格式 (如 @r_heke)+ 各指令用 funct7 区分，复用同一套字段抽取。

## 坑
- .decode 位段和 trans 的参数结构 (arg_r/arg_i) 要对上，否则取错寄存器。
- helper 访存用带 MMU 的两参 `cpu_ldl_data(env, addr)` / `cpu_stl_data(env, addr, val)`,不能裸指针;需要精确异常回址时才用 `cpu_ld*_data_ra(env, addr, ra)`。
- 加了指令要 rebuild(decodetree 是构建期生成),改 .decode 不重构不生效。

## TCG 工作原理

上面写的 trans_/helper 最终是被 TCG 翻译执行的。TCG(Tiny Code Generator) 是 QEMU 的动态二进制翻译器：把 guest 指令先翻成与架构无关的 TCG 中间 op，再由后端翻成宿主机器码，以基本块 (TB,Translation Block) 为单位翻译 + 缓存复用。

- 流程：取指 → 前端 (`target/riscv/translate.c` + decodetree 生成的 `trans_*`) 把每条 guest 指令 `tcg_gen_*` emit 成 TCG op → 优化 → 后端 (`tcg/<host>/`) 生成宿主码 → 执行 → 到块尾跳下一 TB(chaining 直连，省回主循环)。
- 一个 TB = 到分支/跳转/页边界为止的一串指令;翻译一次、进 code cache，再遇到直接跑缓存 (热路径快)。
- helper:复杂或有副作用的语义 (访存、CSR、浮点、原子) 不适合直接 emit op，用 `gen_helper_xxx()` 调 C helper(`helper.h` 声明 + `op_helper.c` 实现)- 自定义指令的重语义就落在 helper 里。
- 看翻译：`-d in_asm`(翻译前 guest 汇编)、`-d op`(TCG 中间 op)、`-d out_asm`(生成的宿主码)。
- 与 KVM 对比:TCG 纯软件翻译、可跨架构、到处能跑但慢;KVM 宿主同架构时用硬件虚拟化直接跑，快但不能跨架构。

## 把自定义指令绑定到某个核

默认:.decode 里的指令对所有该 XLEN 的核都解码，是全局的。我们实战的指令就没门控 (TRANS_HEKE 直接调 helper、无 cfg 检查),所以任何 riscv64 都能跑 - 图省事，但不"属于"某个核。

要让指令只在指定核上有效，用"扩展开关"绑定，四步：
1. `target/riscv/cpu_cfg_fields.h.inc` 加一行 `BOOL_FIELD(ext_xheke)`。现代 QEMU 的 `RISCVCPUConfig` 字段由 `cpu_cfg.h` 里 `#define BOOL_FIELD(x) bool x;` + `#include "cpu_cfg_fields.h.inc"` 展开生成，别直接往 struct 里塞裸 `bool`。
2. `target/riscv/cpu.c` 两处：`ISA_EXT_DATA_ENTRY(xheke, PRIV_VERSION_1_12_0, ext_xheke)` 进 `isa_edata_arr[]` 登记 ISA 字符串 / 最低特权版本 (仅元数据);再在扩展属性数组 (如 `riscv_cpu_extensions[]`,厂商扩展用 `riscv_cpu_vendor_exts[]`) 加 `MULTI_EXT_CFG_BOOL("xheke", ext_xheke, false)` - 这一步才把 `-cpu rv64,xheke=true` 暴露成命令行属性。只加 ISA_EXT_DATA_ENTRY，命令行认不了这个属性。
3. trans 里门控：仿 xthead 定个宏 `REQUIRE_XHEKE(ctx) do { if (!ctx->cfg_ptr->ext_xheke) return false; } while(0)`,在每个 trans_heke_* 开头调;不支持就 return false -> 该核上视为非法指令。
4. 绑核：
   - 命令行开：只有 generic 核 (`rv64` / `rv32` / `max`) 允许命令行加扩展，`-cpu rv64,xheke=true`;vendor / 具名核 (thead-c908 等) 会被拒 ("'…' CPU does not allow enabling extensions")。要给具名核带上，在该 CPU 的 init 里设 `cpu->cfg.ext_xheke = true` 做成默认带。
   - 新建核：在新核的 class/instance init 里设 `cpu->cfg.ext_xheke = true`,这颗核天生带这套指令。

一句话：指令归属 = 一个 cfg 扩展位，trans 查 `ctx->cfg_ptr->ext_xheke`、核在自己 cfg 里开这个位;不门控就是全局。

### 示例：注册一个 heke 扩展并绑到某核

```c
/* 1) target/riscv/cpu_cfg_fields.h.inc - 加一行 (RISCVCPUConfig 字段由这个 .inc 经 BOOL_FIELD 展开) */
BOOL_FIELD(ext_xheke)                /* 我们的自定义扩展开关 */
/* 参考 cpu_cfg.h:
   struct RISCVCPUConfig {
   #define BOOL_FIELD(x) bool x;
   #include "cpu_cfg_fields.h.inc"
   }; */

/* 2a) target/riscv/cpu.c - isa_edata_arr[] 登记 ISA 字符串/最低特权版本 (仅元数据，不暴露命令行属性) */
static const RISCVIsaExtData isa_edata_arr[] = {
    /* ... */
    ISA_EXT_DATA_ENTRY(xheke, PRIV_VERSION_1_12_0, ext_xheke),
    /* 第二参=该扩展要求的最低特权规范版本 (cpu.h 里 PRIV_VERSION_1_10/11/12/13_0);
       CPU 的 priv_ver 低于它就不启用。自定义扩展填个合适基线即可，1.12 常用。 */
};

/* 2b) target/riscv/cpu.c - 扩展属性数组里加一行，才把 xheke 暴露成 -cpu ...,xheke=true 命令行属性 */
static const RISCVCPUMultiExtConfig riscv_cpu_extensions[] = {
    /* ... */
    MULTI_EXT_CFG_BOOL("xheke", ext_xheke, false),   /* 属性名 / cfg 字段 / 默认值 */
};

/* 3) target/riscv/insn_trans/trans_rvi.c.inc - 门控宏 (仿 xthead),每条 trans_heke_* 开头调 */
#define REQUIRE_XHEKE(ctx) do {              \
    if (!ctx->cfg_ptr->ext_xheke) {          \
        return false;   /* 该核没开这个扩展 -> 视为非法指令 */ \
    }                                        \
} while (0)

static bool trans_heke_vdot(DisasContext *ctx, arg_r *a)
{
    REQUIRE_XHEKE(ctx);                  /* 只有带 xheke 的核能过，否则非法指令 */
    gen_helper_heke_vdot(/* ... */);
    return true;
}

/* 4) target/riscv/cpu.c - 让某个核默认带上 (CPU 定义的 .cfg 初始化，仿 c906 开 xthead 的写法) */
static const RISCVCPUDef thead_c908_def = {
    /* ... */
    .cfg.ext_xheke = true,           /* c908 天生带 heke;别的核默认没有 */
};
```

打开方式二选一：核定义里 `.cfg.ext_xheke = true` 做成默认带;或 generic 核命令行 `-cpu rv64,xheke=true` 临时开 (靠第 2b 步的 MULTI_EXT_CFG_BOOL 属性)。

## 建模一个新 CPU

先分清两种情况：架构已存在 (只是要个新型号/新 ISA 组合) 还是架构本身不存在 (要从零建 target)。

### A. 架构已有 (riscv/arm/x86 ...)- 绝大多数情况

这类不碰指令翻译，只描述"这颗核是什么"。三个层次，由轻到重：

1. 直接选现成型号：`-cpu thead-c906` / `-cpu rv64` / `-cpu max`。无需写代码。(上游 target/riscv 现成的 T-Head 型号是 thead-c906;thead-c908 是我们在 k230 仓库里新增的。)
2. 选架构版本 / ISA 子集 (riscv 靠 ISA 字符串 + 扩展属性):
   - 基座 rv32 / rv64(定 XLEN),再叠扩展开关组合出想要的 ISA。
   - 例:RV32G = rv32 + IMAFD;RV64GCV_zfh = rv64 + IMAFDC + V + Zfh。命令行 `-cpu rv64,g=true,c=true,v=true,zfh=true`(或逐个 `i/m/a/f/d`、`zba/zbb/...` 属性)。
   - priv_spec 选特权规范版本 (1.10/1.11/1.12/1.13，见 priv_spec_from_str),决定有哪些 CSR/行为。vlen/elen 定向量宽度。
   - 底层就是 MISA 位 + cpu->cfg.ext_*(cpu_cfg.h) 两组开关;ISA 字符串只是它们的文本形式。
3. 加一款固定型号 (我们在 k230 仓库新增了 thead-c908，上游现成的是 c906):在 target/riscv/cpu.c 定义 TYPE_RISCV_CPU_THEAD_C908 + class/instance init，把上面的能力表一次填死:MISA、cfg.ext_*、priv_spec、mvendorid/marchid/mimpid(cpu_vendorid.h)、支持特权级、向量参数。私有 CSR/行为在 csr.c 加 csr_ops(读/写/预测)+ op_helper.c 写语义。之后 `-cpu thead-c908` 即可选，machine 用 cpu-type 字符串实例化。

一句话：已有架构下"建模一颗核" = 填一张能力表 (XLEN + MISA + 扩展 + priv_spec + vendorid + 私有 CSR);想加"新指令"才动前面那 4 个文件，两者正交。

### B. 架构不存在 - 要新建 target

见下一节"注册一个新架构"，比如`LeoArch·雷架构`。这才需要从零写解码/翻译/CPUClass。

## 注册一个新架构 (全新 target)

从零加一个 CPU 架构 (不是型号) 是大工程，目录 target/<arch>/,要素:
- cpu-qom.h / cpu.h / cpu.c:定义 CPUArchState(寄存器/PC/CSR)、TYPE_<ARCH>_CPU、CPUClass。关键是挂 TCGCPUOps(翻译回调:synchronize_from_tb、cpu_exec_enter、tlb_fill/异常、中断)。
- translate.c + insn.decode + helper.h + op_helper.c:decodetree 生成解码，trans_* 发 TCG,helper 写复杂语义 (和"加指令"同一套，只是从空起)。
- gdbstub.c + gdb-xml/<arch>-*.xml:寄存器暴露给 gdb。
- disas/<arch>.c:反汇编(-d in_asm)。
- machine.c:VMState 迁移。
- meson.build 注册这些源;Kconfig + configs/targets/ 加 <arch>-softmmu / <arch>-linux-user;hw/<arch>/ 放板子。
- MMU:softmmu 要实现 get_phys_page / tlb_fill;user-mode 只需 syscall + 信号。
CPUClass + TCGCPUOps 是"让 QEMU 知道怎么跑这个架构"的核心;其余是解码/调试/构建接线。参考现成最小 target(如 target/or1k、target/hppa)照抄骨架。

### 示例：最小架构 LeoHeco(3 类指令即图灵完备)

图灵完备只需三类能力：算术、可寻址的 (近乎) 无限内存、条件跳转。给 leoheco 就定这几条 (定长 32 位指令，8 个 32 位寄存器 r0-r7 + pc):

    add  rd, rs1, rs2     # 算术:rd = rs1 + rs2(减/逻辑都能由它 + 内存拼出)
    ld   rd, [rs1]        # 访存读:rd = mem[rs1](内存当无限"纸带")
    st   rs2, [rs1]       # 访存写:mem[rs1] = rs2
    beq  rs1, rs2, off    # 条件跳转:rs1==rs2 则 pc += off(循环/分支全靠它)

有 add(算)+ ld/st(无限存储)+ beq(条件控制流) 就能搭循环和任意计算 - 图灵完备。访存算一类、拆成读写就是 ld/st 两条。

骨架 (每个文件放什么，省略号处照 or1k/hppa 填):

```c
/* target/leoheco/cpu.h - CPU 状态 */
typedef struct CPUArchState {
    uint32_t r[8];     /* 通用寄存器 r0-r7 */
    uint32_t pc;       /* 程序计数器 */
} CPULeohecoState;

/* target/leoheco/translate.c - 全局 TCGv 映射到 env->r[](init_disas 时 tcg_global_mem_new 建),
   再把每条指令翻成 TCG */
static TCGv cpu_r[8];

static bool trans_add(DisasContext *ctx, arg_r *a) {
    tcg_gen_add_i32(cpu_r[a->rd], cpu_r[a->rs1], cpu_r[a->rs2]);            // rd = rs1 + rs2
    return true;
}
static bool trans_ld(DisasContext *ctx, arg_m *a) {
    tcg_gen_qemu_ld_i32(cpu_r[a->rd], cpu_r[a->rs1], ctx->mem_idx, MO_TEUL); // rd = mem[rs1]
    return true;
}
static bool trans_st(DisasContext *ctx, arg_m *a) {
    tcg_gen_qemu_st_i32(cpu_r[a->rs2], cpu_r[a->rs1], ctx->mem_idx, MO_TEUL); // mem[rs1] = rs2
    return true;
}
static bool trans_beq(DisasContext *ctx, arg_b *a) {
    TCGLabel *taken = gen_new_label();
    tcg_gen_brcond_i32(TCG_COND_EQ, cpu_r[a->rs1], cpu_r[a->rs2], taken);   // rs1==rs2 就跳
    gen_goto_tb(ctx, 0, ctx->base.pc_next);            // 不等：落到下一条
    gen_set_label(taken);
    gen_goto_tb(ctx, 1, ctx->base.pc_next + a->off);   // 相等：跳到 pc+off
    ctx->base.is_jmp = DISAS_NORETURN;                 // 本 TB 到此结束
    return true;
}
```

decode 侧 (target/leoheco/insn.decode) 给这四条各一个唯一 opcode + 定 &r(rd/rs1/rs2)、&m(rd/rs1 或 rs2/rs1)、&b(rs1/rs2/off)参数集,和前面加指令一模一样。剩下就是挂 TCGCPUOps(把 translate 接进主循环)、cpu.c 注册 TYPE_LEOHECO_CPU、meson/Kconfig/configs 接线，一个能跑的 leoheco-softmmu 就成形了。

## 模拟硬件 MMU(softmmu)

guest 访存用虚拟地址，要经 MMU 翻成物理地址。QEMU softmmu 用软件 TLB(每 CPU 一张) 加速:TCG 访存 op 先查软件 TLB，命中直接算宿主地址;未命中走 `tlb_fill` → 架构页表遍历填 TLB，再访存。

- RISC-V 路径：`riscv_cpu_tlb_fill` → `get_physical_address`(`target/riscv/cpu_helper.c`)。SATP 指页表基址 + 模式 (Sv39/Sv48/Sv57),按级查 PTE、校验权限位 (R/W/X/U/A/D),失败抛 page-fault 异常。
- 关键回调:CPU 的 `TCGCPUOps.tlb_fill`(填 TLB)、`get_phys_page_debug`(gdb/monitor 查地址用)。
- MMIO 区不进 TLB 快路径，走 `io_readx/io_writex` 派发到设备的 `MemoryRegionOps`(就是外设的 read/write 回调)。
- 查映射:monitor `info mtree`(内存图)、`info tlb` / `info mem`(当前地址翻译)。
- 不建 cache:QEMU 只有这张软件 TLB(地址翻译缓存),**不建 icache / dcache / L2 数据缓存**。`fence.i` / `cbo.*` / cache-flush CSR 当 no-op 或屏障处理——没真 cache 就不存在不一致，功能上照样对。icache 与 dcache 的区分本是"哈佛架构 (指令 / 数据分开各自 cache 与总线)vs 冯诺依曼架构 (统一)"那层微架构;QEMU 停在 ISA / 功能级，对软件呈现一块统一且始终一致的内存，不落地到这层。要 cache / 流水线的周期级精度得用 gem5 这类模拟器——功能级模拟器 (QEMU、Spike) 都不建 cache。

## 模拟中断与异常

异常 (同步，指令引发：非法指令 / 访存错 / ecall / page-fault) 和中断 (异步，外部拉线:timer / 软件 / 外设) 在 QEMU 里都走 CPU 的异常注入。

- RISC-V 陷入：`riscv_cpu_do_interrupt`(`target/riscv/cpu_helper.c`) 存 cause/epc/tval、按 `medeleg`/`mideleg` 决定陷到 M 还是 S 态、跳 `xtvec`。中断挂起位在 `mip`、使能在 `mie`、全局开关 `mstatus.MIE/SIE`。
- 外部中断进 CPU 的路：设备 `qemu_set_irq(irq, level)` → 中断控制器 (PLIC / CLINT / APLIC)→ CPU 的外部中断输入线 (`MEIP`/`SEIP`)。本方向 WDT 超时 → PLIC 源 4 → CPU MEIP(SoC 笔记 WDT 全流程即此链)。CLINT 管软件中断 (`MSIP`) 与 timer(`MTIP`/`mtimecmp`)。
- 建个会中断的设备：`sysbus_init_irq` 暴露 irq 线 → 板子 `sysbus_connect_irq(dev, 0, qdev_get_gpio_in(plic, N))` 接进 PLIC 第 N 线;电平语义 `qemu_set_irq(irq, 1/0)`,别只脉冲。
- 看中断：`-d int` 打印每次陷入 (cause/epc);monitor `info registers` 看 `mstatus`/`mip`/`mie`/`mcause`/`mepc`。

## 多核 CPU(SMP / AMP)

QEMU 里多核 = 多个 vCPU 对象;TCG 下 MTTCG 每个 vCPU 一条宿主线程并发跑。riscv 用 hart array 封装一组同构核：
- TYPE_RISCV_HART_ARRAY(hw/riscv/riscv_hart.c),属性 num-harts / hartid-base / cpu-type / resetvec。realize 时按 num-harts 造 num-harts 个同 cpu-type 的核，hartid 从 hartid-base 连续编号。
- SMP(同构多核):一个 hart array,num-harts=N。machine 里 `-smp N` 映射过去。中断控制器要按核给上下文:CLINT 每 hart 一组 mtimecmp/msip;PLIC 每 hart(每特权级) 一个 context。
- AMP(异构多核):用多个 hart array，各自 cpu-type 不同、hartid-base 不重叠 (如大核 array 从 0 起、小核另一段),再接到各自或共享的 CLINT/PLIC。这是通用 AMP 模式;注：我们的 k230.c 目前只建了单个 c908 hart array(同构小核，单 hart),尚未做大核 + 小核多 array。
- 超线程 (SMT，一个物理核俩上下文=俩逻辑核):就是 `-smp` 的 `threads` 维度。`-smp` 拓扑三件套满足 cpus = sockets × cores × threads:
  - sockets:插槽数 (几颗物理芯片/封装)。
  - cores:每插槽的物理核数。
  - threads:每物理核的硬件线程数 (超线程),>1 即一个物理核对外呈现多个逻辑核。
  例 `cpus=4,sockets=1,cores=2,threads=2` = 1 封装 × 2 物理核 × 每核 2 线程 = 4 个逻辑核。关键:QEMU 不真模拟共享流水线/执行单元 - 每个 thread 仍是一个独立完整的 vCPU(hart)、各跑一条宿主线程;`threads` 只改暴露给 guest 的拓扑层级 (经 ACPI / 设备树 cpu-map 告诉 guest"这俩逻辑核同属一个物理核",供 guest 调度),执行上和普通多核没差别。
- 建模要点：每 hart 的状态 (CSR/mhartid) 独立;共享的是内存和外设。跨核同步靠原子指令 (RVA)+ 中断 (IPI 经 CLINT msip)。qtest 里可 `-smp` 起多核验证 per-hart 中断路由。

命令示例：

    # SMP 同构 4 核(virt 板):hartid 0-3,CLINT/PLIC 各给 4 套 context
    qemu-system-riscv64 -machine virt -smp 4 -cpu rv64 -nographic \
        -bios default -kernel Image -append "console=ttyS0"

    # 带拓扑的完整写法(sockets×cores×threads 要等于 cpus)
    qemu-system-riscv64 -machine virt -smp cpus=4,sockets=1,cores=4,threads=1 ...

    # 超线程:2 物理核 × 每核 2 线程 = 4 逻辑核(guest 看到 4 个,且知道谁跟谁共享物理核)
    qemu-system-riscv64 -machine virt -smp cpus=4,sockets=1,cores=2,threads=2 ...

    # 进 guest 验证:nproc 应为 4;cat /proc/cpuinfo 看到 hart 0-3

    # AMP/异构(大小核)不能用 -smp 表达 - -smp 只造同构核。
    # 异构拓扑写死在板子代码里(多个 hart array),用户只选板子:
    qemu-system-riscv64 -machine k230 -m 2G -nographic ...   # 核数/大小核由 k230.c 固定

    # qtest 起多核验 per-hart 中断:
    QTEST_QEMU_BINARY=build/qemu-system-riscv64 tests/qtest/xxx-test   # 内部 qtest_init("-machine virt -smp 4")

## QEMU 与设备树 (DTS / DTB / FDT)

三个名词：
- DTS(Device Tree Source):人读的文本，描述硬件树 - cpus / memory / soc 下各外设节点，每节点带 compatible(驱动匹配名)、reg(地址 + 大小)、interrupts(中断号) 等。
- DTB(Device Tree Blob):DTS 用 `dtc` 编译出的二进制，内核/固件真正读的就是它。
- FDT(Flattened Device Tree):DTB 那个扁平二进制的格式/规范名;操作它的库是 libfdt,QEMU 内部就用 libfdt 建/改。关系:DTS --dtc--> DTB(即 FDT 格式)。

QEMU 两种角色：
1. 自动生成 (多数板子，如 virt):machine 代码用 QEMU 的 fdt 包装 (system/device_tree.c 的 `qemu_fdt_add_subnode` / `qemu_fdt_setprop` / `_setprop_cell` / `_setprop_string`) 按它实例化的 CPU/内存/外设,在内存里现搭一棵 FDT，和真实模拟硬件一致;多核拓扑写成 cpu-map(对应 sockets/cores/threads),再交给 guest。加了新设备就要加对应 DT 节点，guest 内核才会 probe。`-machine dumpdtb=out.dtb` 可把生成的 dump 出来看。
2. 用户传入：`-dtb file.dtb`(load_device_tree 加载) 提供自己的树，用于不自动生成的板子或想覆盖默认。K230 direct-boot 就是手写 DTB 用 `-dtb` 传 (见 k230 笔记)。

boot 交接 (riscv):QEMU 把 kernel + dtb 载进 RAM,`riscv_load_fdt` 放好 FDT，按 riscv 约定把 FDT 地址塞进启动 hart 的 a1，内核从 a1 读 FDT 发现硬件;RustSBI 也走这条接力。

常用命令：

    dtc -I dtb -O dts x.dtb -o x.dts     # 反编译 DTB 看内容
    dtc -I dts -O dtb x.dts -o x.dtb     # 编译回 DTB
    qemu-system-riscv64 -machine virt -machine dumpdtb=virt.dtb   # 导出 QEMU 自动生成的树
