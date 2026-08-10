# QEMU SoC 方向

!!! note "主要贡献者"

    - 作者：[@Lfan-ke](https://github.com/Lfan-ke)

---

## QEMU 的三种形态:user / system / 各 arch

先分清跑的是哪种 qemu，命令和能力完全不同：

- `qemu-system-<arch>`（全系统模拟 / system emulation):模拟一整台机器 - CPU + 内存 + 中断控制器 + 外设 + 固件，能跑完整 OS(内核 + 驱动 + 用户态)。SoC / 板子 / 外设建模都在这里。例：`qemu-system-riscv64 -machine virt ...`。
- `qemu-<arch>`（用户态模拟 / linux-user):只跑一个用户态 ELF - 把它的指令翻成宿主指令、把它的 syscall 转成宿主 syscall，不模拟硬件也不跑目标内核。例：`qemu-riscv64 ./prog`。跨架构跑单个可执行文件用它 (box64/wine-ce 的"翻译层"就是这层思路)。
- 每个目标架构一个二进制:qemu-system-{riscv64,aarch64,x86_64,arm,...} 与 qemu-{riscv64,...}。选后端用 `-accel`:`tcg`(纯软件翻译，可跨架构、到处能跑)/ `kvm`(宿主同架构时用硬件虚拟化，快)。
- 配套工具 (不是模拟器):`qemu-img`(建/转换/查看磁盘镜像)、`qemu-nbd`(把镜像导出成块设备)、`qemu-ga`(guest agent) 等。

一句话：建 SoC/外设 → qemu-system;跑单个外来程序 → qemu-user;弄镜像 → qemu-img。本方向 (g233 板 + 外设) 全在 qemu-system-riscv64。

## 用 QEMU 跑 Windows 与 Windows 程序

两件事要分开：跑"整台 Windows 系统"和跑"单个 Windows 程序",走的路完全不同。

- 跑整台 Windows(system 模拟):`qemu-system-x86_64` 把 Windows 当 guest OS 装进虚机，和跑 Linux guest 一样 - `-cdrom win.iso` 装系统、`-drive` 挂系统盘、`-m`/`-smp` 给资源、`-vga std`/`-device` 配显卡网卡。Windows 内核 + 驱动全在虚机里跑。跨架构也行 (`qemu-system-aarch64` 跑 ARM 版 Windows),但纯 TCG 翻译会慢。
- 跑单个 Windows 程序 ≠ qemu-user 能直接干:qemu-user(linux-user) 只翻译 **Linux ELF** 的指令 + syscall,**既不认 Windows 的 PE 格式、也不实现 Win32 API**,所以 `qemu-x86_64 app.exe` 跑不起来。跑 Windows 程序要 **Wine** - Wine 不是模拟器，是把 Win32 API 调用翻成 Linux 调用的兼容层 (自带 PE 加载器 + Win32 实现),在同架构 Linux 上原生跑 x86 Windows 程序。
- 跨架构跑 Windows 程序 = Wine + 用户态指令翻译层叠起来 (本营 wine-ce 方向):要在 riscv64 / aarch64 上跑 x86 的 `.exe`,得两层 - 上层 Wine 管 Win32 API 与 PE 加载，下层把 x86 指令翻成本机指令。纯 qemu-user 做这层太重，实践用 **box64**(专做 x86-64 → 本机的用户态 dynarec，且集成 wine-preloader)。链条：`box64 wine app.exe` - box64 把 x86 指令 JIT 成 riscv64,wine 提供 Win32 环境。本营 wine-ce 已实证:riscv64 上 `box64 wine cmd /c "..."` 能跑真实 x86-64 PE。

一句话：整台 Windows 用 `qemu-system-x86_64`;同架构单个 Windows 程序用 Wine(非 qemu-user);跨架构单个 Windows 程序用 box64 + Wine(qemu-user 只跑 Linux ELF，不跑 PE)。

## 启动前置：各架构的固件与引导链 (UEFI / u-boot / SPL / SPI / SBI)

真机上 CPU 复位后不是直接跳内核，中间隔着一条固件/引导链，把机器从"上电复位态"一级级拉到"能加载并移交内核"。各架构链条不同，QEMU 用 `-bios`/`-pflash`/`-kernel` 顶替其中某几级。先认识几个通用件：

- BootROM(片内一级 ROM):上电第一条指令，固化在 SoC 里，只做最少的事 - 从 SPI-NOR / eMMC / SD 把下一级搬进片内 SRAM。
- SPL(Secondary Program Loader,U-Boot 的一级加载器):塞进片内 SRAM 的小号 U-Boot，负责初始化 DRAM 控制器，再把完整 U-Boot(或下一级固件) 从存储加载到 DRAM。DRAM 没起来前代码只能待在 SRAM，所以 SPL 必须小。
- SPI-NOR flash:固件常驻的存储介质，BootROM 通常就是从这颗 SPI flash 读第一段 (本方向建模的 SPI 控制器 + m25p80 正是这颗)。
- SBI / PSCI(运行时固件服务):M 态 (RISC-V)/ EL3(ARM) 常驻的一层，给 S 态内核提供开核、关机、置时钟等调用，内核跑起来后它一直在。
- UEFI:固件与 OS 之间的接口标准 (不是某个具体实现);EDK2、U-Boot 都能提供 UEFI，内核经它拿内存图、启动分区等。

各架构 (aa=aarch64 / x64=x86-64 / la=loongarch / rv=risc-v) 从上电到内核：

- rv:BootROM → SPL(U-Boot SPL，起 DRAM)→ SBI(M 态) → U-Boot proper(S 态)→ 内核。QEMU `-machine virt` 上 `-bios` 放 KuSBI(或 OpenSBI `fw_dynamic.bin` / RustSBI),再 `-kernel` 给内核;本方向 g233 直接 `-bios kusbi.bin -kernel Image` 跳过 U-Boot 两级到内核。SBI 之于 RISC-V ≈ PSCI 之于 ARM。
- aa:BootROM → TF-A(Trusted Firmware-A,BL1 → BL2 → BL31,BL31 常驻 EL3 提供 PSCI)→ UEFI(EDK2 或 U-Boot 充当)→ GRUB / systemd-boot → 内核。QEMU `-machine virt` 上 `-bios QEMU_EFI.fd`(EDK2 AAVMF) 或直接放 U-Boot;裸跑内核也可 `-kernel` 省掉引导器。
- x64:固件是 UEFI(OVMF = QEMU 上的 EDK2) 或传统 BIOS(SeaBIOS,QEMU 默认)→ bootloader(GRUB)→ 内核。x86 无 SPL / SBI，复位向量在 `0xFFFFFFF0`,固件自己把自己搬开。QEMU `-bios OVMF.fd`(或 pflash 挂 OVMF) 换 UEFI，不给就用内置 SeaBIOS。
- la:固件走 UEFI(EDK2 已支持 LoongArch)→ 内核。QEMU loongarch64 `-machine virt` 用 `-bios` 放其 UEFI 固件;LoongArch 有自己的复位入口，无 RISC-V 式 SBI 层。

### 各架构完整启动命令示例

```bash
# rv:XxSBI(SBI 固件,M 态)+ 直接跳内核,串口重定向到当前终端
qemu-system-riscv64 -machine virt -m 1G -smp 2 -nographic \
  -bios kusbi.bin \
  -kernel Image -append "console=ttyS0 root=/dev/vda ro" \
  -drive file=rootfs.img,format=raw,if=none,id=hd0 \
  -device virtio-blk-device,drive=hd0
# 不给 -bios 时 virt 用内置 OpenSBI(-bios default);本方向 g233 板:
qemu-system-riscv64 -machine g233 -m 1G -nographic -bios kusbi.bin -kernel Image
```

```bash
# aa:EDK2(AAVMF)UEFI 固件 -> 引导器 -> 内核
qemu-system-aarch64 -machine virt -cpu cortex-a72 -m 2G -smp 4 -nographic \
  -bios QEMU_EFI.fd \
  -drive file=disk.qcow2,format=qcow2,if=virtio
# 裸跑内核省掉 UEFI/引导器(aarch64 串口是 ttyAMA0):
qemu-system-aarch64 -machine virt -cpu cortex-a72 -m 2G -nographic \
  -kernel Image -append "console=ttyAMA0 root=/dev/vda" \
  -drive file=rootfs.img,format=raw,if=virtio
```

```bash
# x64:传统 BIOS(SeaBIOS,默认)装/跑系统盘
qemu-system-x86_64 -machine q35 -m 4G -smp 4 \
  -drive file=disk.qcow2,format=qcow2 -cdrom install.iso -boot d
# UEFI(OVMF):pflash 挂 code + vars 两片
qemu-system-x86_64 -machine q35 -m 4G \
  -drive if=pflash,format=raw,readonly=on,file=OVMF_CODE.fd \
  -drive if=pflash,format=raw,file=OVMF_VARS.fd \
  -drive file=disk.qcow2,format=qcow2
```

```bash
# la:EDK2(LoongArch)UEFI 固件 -> 内核
qemu-system-loongarch64 -machine virt -cpu la464 -m 4G -smp 4 -nographic \
  -bios QEMU_EFI.fd \
  -drive file=disk.qcow2,format=qcow2,if=virtio
# 裸跑内核:
qemu-system-loongarch64 -machine virt -cpu la464 -m 2G -nographic \
  -kernel vmlinuz -append "console=ttyS0,115200 root=/dev/vda" \
  -drive file=rootfs.img,format=raw,if=virtio
```

把上述 sbi.bin 换成 OpenSBI 的 `fw_dynamic.bin` 或 `-bios default` 等价可跑。

### rv 真实引导链:RustSBI + U-Boot 启动发行版

`-bios sbi.bin -kernel Image` 两级到内核是嵌入式调试的精简法;跑一个完整发行版则是完整链:QEMU 载入 M 态固件 → U-Boot SPL → U-Boot proper(解析引导配置、定位 EFI 应用、给内核传参)→ 内核 → 发行版根文件系统。RustSBI 是 SBI 规范的一份 Rust 实现 (M 态 SEE),其 Prototyper 是开箱即用的 SBI 固件 (角色同 OpenSBI),可直接当 `-bios`,也可打进 U-Boot 镜像里作 SBI 运行时。

RustSBI 官方「用 U-Boot + RustSBI 启动 Fedora」的实测命令：

> src: [booting-fedora-in-qemu-using-uboot-and-rustsbi](https://github.com/rustsbi/rustsbi/blob/main/prototyper/docs/booting-fedora-in-qemu-using-uboot-and-rustsbi.md)

```bash
qemu-system-riscv64 \
    -nographic -machine virt \
    -smp 4 -m 8G \
    -bios ./u-boot/spl/u-boot-spl \
    -device loader,file=./u-boot/u-boot.itb,addr=0x80200000 \
    -drive file=./fedora/Fedora.riscv64-40-20240429.n.0.qcow2,format=qcow2,if=none,id=hd0 \
    -device virtio-blk-device,drive=hd0
```

这里 `-bios` 放 U-Boot SPL 作第一段 M 态固件;`u-boot.itb`(U-Boot 的打包镜像树，含 RustSBI 作 SBI 运行时) 由 `-device loader` 塞到 DRAM 的 `0x80200000`。SPL 起来后加载 itb,RustSBI 提供 SBI 服务、U-Boot 在 S 态经 `-device virtio-blk-device,drive=hd0` 前端引导 `-drive` 挂的 Fedora qcow2(块设备后端 `if=none,id=hd0` 必须配一个前端设备才被 guest 看到)。涉及固件：`rustsbi-prototyper.bin`(RustSBI 二进制)、`u-boot-spl`、`u-boot.itb`。官方原命令还挂了 virtio-vga / rng / net / usb 等，此处只留引导必需的块设备。RustSBI 更完整的库 / Prototyper / HAL / 平台适配文档见：

> src: [RustSBI 文档 docs/src](https://github.com/rustsbi/rustsbi/tree/main/docs/src)

一句话:rv / aa 有"M 态 / EL3 运行时固件"(SBI / PSCI)+ SPL 起 DRAM 的完整链;x64 用 UEFI/BIOS 自搬;QEMU 把这些级用 `-bios`/`-pflash` 换掉，嵌入式调试常直接 `-bios <SBI 或固件> -kernel <Image>` 两级到内核。

## qemu-system 命令子树

机器/CPU/内存/加速：
- `-machine <name>[,opt]` 选板子 (如 `virt` / `g233`),子选项如 `dumpdtb=` / `accel=`。`-machine help` 列所有板。
- `-cpu <model>[,feat=on/off]` 选 CPU 型号/ISA。`-cpu help` 列型号。
- `-smp N` 或 `-smp cpus=N,sockets=,cores=,threads=` 核数/拓扑。
- `-m 2G` 内存大小。`-accel tcg|kvm`(也可写进 -machine accel=)。`-numa` 分 NUMA 节点。`-global drv.prop=val` 改某类设备默认属性。

启动/固件：
- `-bios file` M 态固件 (OpenSBI/RustSBI/u-boot);`-kernel Image` 内核;`-initrd` 初始 ramdisk;`-append "..."` 内核 cmdline;`-dtb file` 设备树。
- `-device loader,file=,addr=` 往内存任意地址塞数据/固件;`-pflash`/`-drive if=pflash` 挂 NOR flash 当固件盘;`-boot order=` 启动顺序。

设备/对象：
- `-device <type>[,prop=val][,id=]` 加一个可热插拔/带 id 的设备 (挂在某总线上，如 PCI/USB)。`-device help` 列所有;`-device <type>,help` 列该设备属性。
- `-object <type>,id=,...` 加"后端对象"(非总线设备):内存后端 memory-backend-*、rng、加密 secret、iothread 等。
- `-usb` 开 USB 控制器;`-nic`/`-netdev`/`-net` 网络 (见下)。

块/存储 (见"块设备"节):
- `-drive`(老式，前后端合一)、`-blockdev`(新式，前后端分开)、`-hda/-hdc/-cdrom/-sd/-mtdblock/-fda`(便捷简写)、`-pflash`、`-snapshot`(写入不落盘)、`-fsdev`/`-virtfs`(9p 共享目录)。

网络：
- `-netdev <backend>,id=`(后端:user/tap/bridge/socket)+ `-device <nic>,netdev=`(前端网卡),或 `-nic`(一步合一),老式 `-net`。

字符设备/串口/控制台/管理口：
- `-chardev <backend>,id=`(字符后端:stdio/pty/socket/file/null),给串口/monitor/qmp 当数据管道。
- `-serial <dev>` 串口接到哪 (如 `mon:stdio`);`-parallel`;`-nographic` 无图形、串口+monitor 复用当前终端 (嵌入式最常用)。
- `-monitor <dev>` 人机监控台 (HMP);`-mon`/`-qmp <dev>` QMP(机器可读 JSON 控制口，如 `-qmp unix:/tmp/q.sock,server,nowait`)。

显示：
- `-display gtk|sdl|none|curses`;`-nographic`;`-vnc :0`;`-vga <type>`;`-spice`;`-full-screen`。

调试/追踪/内省：
- `-d in_asm,int,exec,...` 打开翻译/中断/执行日志 (`-d help` 列项),`-D file` 写到文件，`-dfilter` 限地址范围。
- `-trace <event>` 打开 trace 事件 (设备里 trace-events 定义的那些);`-plugin` 加 TCG 插件。
- `-s` = `-gdb tcp::1234`(gdbstub);`-S` 启动即暂停等 gdb 连;`-icount` 确定性执行、`-accel tcg,one-insn-per-tb=on` 每条指令单独一个 TB(便于单步/精确断点;旧 `-singlestep` 在 QEMU 10 已移除)。
- `-monitor`/`-qmp` 里可 `info qtree`/`info mtree`(看设备树/内存图)、`dumpdtb`;`-dump-vmstate` 导出迁移格式。`-semihosting` 半主机 I/O。

迁移/快照/进程：
- `-incoming` 收迁移;`-loadvm`/`-snapshot`;`-only-migratable`。
- `-name`、`-uuid`、`-rtc base=`、`-pidfile`、`-daemonize`、`-sandbox on`、`-readconfig file`、`-nodefaults`(不加默认设备)、`-no-reboot`/`-no-shutdown`、`-watchdog-action`。

嵌入式/本方向最常用一行：`qemu-system-riscv64 -machine g233 -m 1G -nographic -bios fw.bin -kernel Image`(必要时 `-S -s` 挂 gdb、`-d in_asm` 看翻译、`-monitor` 里 `info qtree` 看设备)。

## QEMU 设备体系 (QOM / qdev / SysBusDevice)

- QOM(QEMU Object Model):万物皆 Object，有类型 (TypeInfo)、类 (class)、实例。`TYPE_*` 字符串标识类型，`OBJECT_DECLARE_SIMPLE_TYPE` 生成类型样板。
- qdev(DeviceState):可挂总线、有属性 (property)、有 realize(两阶段构造:instance_init 建结构 → realize 接资源)、有 reset/vmstate 的 Object。
- 总线归属决定"怎么加":
  - SysBusDevice(直接挂系统总线/MMIO):SoC 片内外设都是它 - `sysbus_init_mmio` 暴露寄存器窗口、`sysbus_init_irq` 暴露中断线，板子代码 `sysbus_mmio_map` + `sysbus_connect_irq` 接上。不能 `-device` 热插，只能板子代码实例化。
  - 有总线的设备 (PCIDevice/USBDevice/SSISlave/I2CSlave):挂在对应总线上，能 `-device <type>,bus=...` 命令行加。
- 设备大类 (源码目录):hw/char(串口)、hw/timer、hw/gpio、hw/rtc、hw/intc(中断控制器)、hw/net、hw/block+hw/sd(存储)、hw/ssi(SPI)、hw/i2c、hw/usb、hw/pci、hw/dma、hw/misc(杂项/sysctl)。建外设先去对应目录抄个最像的当模板。

## 块设备 (block layer)

QEMU 存储分"前端设备"和"后端镜像",中间是 block layer:

- 后端 (数据从哪来):一个镜像文件/主机块设备，格式 raw/qcow2 等。`-drive file=disk.qcow2,if=none,id=d0` 或新式 `-blockdev driver=qcow2,file.filename=disk.qcow2,node-name=d0`。
- 前端 (guest 看到的设备):把后端接到某个存储控制器/介质上。`-device virtio-blk-pci,drive=d0` / `-device sd-card,drive=d0` / SPI flash 挂到 SSI 总线。
- `-drive` 是"前后端合一"的老式简写 (if=virtio/ide/sd/pflash/none 决定前端);`-blockdev`+`-device` 是新式解耦写法。便捷简写 `-hda`/`-cdrom`/`-sd`/`-pflash`/`-mtdblock` 本质都是 -drive 的糖。
- 设备侧怎么拿数据：设备 (如 SD、m25p80 flash) 通过 `blk_*` API(BlockBackend) 读写后端;没接 drive 时用内部 buffer。m25p80 就是 SSI 从设备 + 可选 -drive 提供 flash 内容。
- `-snapshot` 让写入只进临时层、不落原镜像 (跑坏了不脏原盘)。镜像本身用 `qemu-img create/convert/info` 管。

### 示例：造镜像 / 文件系统，挂进 guest 当存储设备

```bash
# 1) 造一块 64MB 空镜像(raw);或 qemu-img create -f qcow2 disk.qcow2 1G 造带格式的
dd if=/dev/zero of=disk.img bs=1M count=64

# 2) 整块镜像上做文件系统,塞点内容(loop 挂载需 root),df 看占用
mkfs.ext4 disk.img
sudo mount -o loop disk.img /mnt && echo hello | sudo tee /mnt/hi.txt && sudo umount /mnt
df -h disk.img

# 3a) 当 virtio 块设备挂进 guest(virt/g233 都支持,guest 里是 /dev/vda)
qemu-system-riscv64 -machine virt -m 1G -nographic -kernel Image \
  -append "console=ttyS0 root=/dev/vda" \
  -drive file=disk.img,format=raw,if=none,id=d0 \
  -device virtio-blk-device,drive=d0

# 3b) 当 SD 卡挂(需板子带 SD/MMC 控制器,如 K230 的 dwmmc;guest 里是 /dev/mmcblk0)
#   简写:-drive file=disk.img,format=raw,if=sd
#   解耦:-drive file=disk.img,format=raw,if=none,id=sd0 -device sd-card,drive=sd0
```

要点：后端 (`disk.img`) 决定"数据在哪",前端 (`virtio-blk-device` / `sd-card`) 决定"guest 看到什么设备";`if=sd`/`if=virtio` 是 `-drive` 的前端简写。riscv virt 默认无 SD 控制器，SD 例子要在有 MMC 的板子 (如 K230) 上跑;virtio-blk 在 virt/g233 直接可用。

## 套路：用 C 建模一个 MMIO 外设 WDT

以本营 g233 板上已 CI 100% 的看门狗 WDT 为例，走完整一遍：设备本体 → 接进构建 → 接进板子 (连到 gevico-cv1 CPU，经 PLIC)→ qtest → 跑通。下面代码取自可运行的作业仓 (qtest 现场 7/7 PASS);其中 feed 清 TIMEOUT、CTRL 的 RSTEN 位按 g233 datasheet 补全 (本营最简参考实现省了这两处，补上后 7 个 qtest 仍全过)。WDT 寄存器 (base 0x10010000):CTRL 0x00(EN bit0 / INTEN bit1 / RSTEN bit2 超时复位使能)、LOAD 0x04、VAL 0x08(RO 倒计数)、SR 0x0C(TIMEOUT bit0,W1C)、KEY 0x10(0x5A5A5A5A 喂狗=重装计数并清 TIMEOUT / 0x1ACCE551 上锁);超时 + INTEN → PLIC IRQ 4。

### 设备本体 `hw/heke/wdt/heke_wdt.c`

```c
/* MMIO 读：按 offset 译码寄存器;VAL 现算 (compute-on-read),不每 tick 存 */
static uint64_t heke_wdt_read(void *opaque, hwaddr addr, unsigned size)
{
    HEKEWDTState *s = HEKE_WDT(opaque);
    switch (addr) {
    case RW_CTRL: return s->ctrl;
    case RW_LOAD: return s->load;
    case RO_VAL:  return heke_wdt_val(s);   /* 由 deadline - now 现算当前计数 */
    case RW_SR:   return s->sr;
    default:      return 0;
    }
}
/* MMIO 写:CTRL 使能起停 timer;SR 写 1 清 TIMEOUT;KEY 喂狗/上锁 */
static void heke_wdt_write(void *opaque, hwaddr addr, uint64_t val, unsigned size)
{
    HEKEWDTState *s = HEKE_WDT(opaque);
    bool was_en;
    switch (addr) {
    case RW_CTRL:
        if (s->locked) break;                            /* 上锁后 CTRL 只读 */
        was_en = s->ctrl & WDT_CTRL_EN;
        s->ctrl = val & (WDT_CTRL_EN | WDT_CTRL_INTEN);
        if (!was_en && (s->ctrl & WDT_CTRL_EN))  heke_wdt_arm(s);   /* 0->1 起表 */
        else if (was_en && !(s->ctrl & WDT_CTRL_EN)) timer_del(s->timer);
        break;
    case RW_LOAD: s->load = val; break;
    case RW_SR:
        s->sr &= ~(val & WDT_SR_TIMEOUT);                /* W1C */
        if (!(s->sr & WDT_SR_TIMEOUT)) qemu_set_irq(s->irq, 0);
        break;
    case WO_KEY:
        if (val == WDT_KEY_FEED) {                       /* 喂狗：重装计数 + 清 TIMEOUT(datasheet) */
            if (s->ctrl & WDT_CTRL_EN) heke_wdt_arm(s);
            s->sr &= ~WDT_SR_TIMEOUT; qemu_set_irq(s->irq, 0);
        }
        else if (val == WDT_KEY_LOCK) s->locked = true;
        break;
    }
}
static const MemoryRegionOps heke_wdt_ops = {
    .read = heke_wdt_read, .write = heke_wdt_write,
    .endianness = DEVICE_LITTLE_ENDIAN,
    .impl  = {.min_access_size = 4, .max_access_size = 4},   /* 内部按 4 字节实现 */
    .valid = {.min_access_size = 4, .max_access_size = 4},   /* 只接受 4 字节访问 */
};
/* 超时回调：置 TIMEOUT,INTEN 则拉中断线 (电平语义) */
static void heke_wdt_timer_cb(void *opaque)
{
    HEKEWDTState *s = HEKE_WDT(opaque);
    s->sr |= WDT_SR_TIMEOUT;
    if (s->ctrl & WDT_CTRL_INTEN) qemu_set_irq(s->irq, 1);
}
/* instance_init:建 MMIO 窗口 + 中断线 + 虚拟时钟定时器 (不碰外部资源) */
static void heke_wdt_init(Object *obj)
{
    HEKEWDTState *s = HEKE_WDT(obj);
    SysBusDevice *sbd = SYS_BUS_DEVICE(obj);
    memory_region_init_io(&s->iomem, obj, &heke_wdt_ops, s, TYPE_HEKE_WDT, REG_END);
    sysbus_init_mmio(sbd, &s->iomem);                /* 暴露寄存器窗口给板子映射 */
    sysbus_init_irq(sbd, &s->irq);                   /* 暴露一根中断线 */
    s->timer = timer_new_ns(QEMU_CLOCK_VIRTUAL, heke_wdt_timer_cb, s);
}
static void heke_wdt_class_init(ObjectClass *klass, const void *data)
{
    DeviceClass *dc = DEVICE_CLASS(klass);
    device_class_set_legacy_reset(dc, heke_wdt_reset);   /* 复位回寄存器初值 */
    dc->vmsd = &heke_wdt_vmstate;                        /* 迁移字段 */
}
static const TypeInfo heke_wdt_info = {
    .name = TYPE_HEKE_WDT, .parent = TYPE_SYS_BUS_DEVICE,
    .instance_size = sizeof(HEKEWDTState),
    .instance_init = heke_wdt_init,
    .class_init = heke_wdt_class_init,
};
static void heke_wdt_register_types(void) { type_register_static(&heke_wdt_info); }
type_init(heke_wdt_register_types)
```

头 `include/hw/heke/wdt.h`:`#define TYPE_HEKE_WDT "heke-wdt"` + `OBJECT_DECLARE_SIMPLE_TYPE(HEKEWDTState, HEKE_WDT)` + `struct HEKEWDTState { SysBusDevice parent_obj; MemoryRegion iomem; qemu_irq irq; QEMUTimer *timer; uint32_t ctrl, load, sr; bool locked; int64_t deadline; };` + `#define HEKE_WDT_FREQ 1000000`(1MHz,1 tick = 1us)+ `static const uint64_t HEKE_WDT_BASE_ADDR = 0x10010000;`。

### 接进构建 (缺则设备编不进二进制)

```
# hw/heke/wdt/meson.build:本 fork 的 heke 设备无条件编入,无 Kconfig 开关
riscv_ss.add(files('heke_wdt.c'))
# hw/heke/meson.build 里 subdir('wdt') 把子目录纳入
```

更上游标准写法是 `hw/<类>/Kconfig` 加 `config X` + meson `system_ss.add(when: 'CONFIG_X', if_true: files())` + 板子 `select X`;K230 那套走这条，两条别混。

### 接进板子 `hw/riscv/g233.c`(连到 gevico-cv1 CPU)

```c
/* HEKE WDT 0x10010000 IRQ 4 */
DeviceState *wdt_dev = qdev_new(TYPE_HEKE_WDT);
sysbus_realize_and_unref(SYS_BUS_DEVICE(wdt_dev), &error_fatal);
sysbus_mmio_map(SYS_BUS_DEVICE(wdt_dev), 0, HEKE_WDT_BASE_ADDR);   /* 映射寄存器窗口 */
sysbus_connect_irq(SYS_BUS_DEVICE(wdt_dev), 0,                     /* 中断接进 PLIC 第 4 线 */
                   qdev_get_gpio_in(mmio_irqchip, 4));
```

`mmio_irqchip` 是板子建的 SiFive PLIC(`sifive_plic_create`);中断链是 **WDT irq → PLIC 源 4 → PLIC → hart 外部中断 → CPU**。g233 的 CPU 不是通用型号，而是本营自定义的 `TYPE_RISCV_CPU_GEVICO_CV1`(gevico-cv1,rv64，由 `mc->default_cpu_type` 指定),经 `machine->cpu_type` 造进 hart 数组。所以这一步就是把外设"焊"进 g233 SoC、连上 gevico-cv1 核。

### qtest `tests/gevico/qtest/test-wdt-timeout.c`

qtest 对 `-machine g233` 起一个不跑指令流的测试机，拿 MMIO 读写 + 推进虚拟时钟验行为 (不跑内核、不需固件):

```c
#define WDT_BASE     0x10010000ULL
#define PLIC_BASE    0x0C000000ULL
#define PLIC_PENDING (PLIC_BASE + 0x1000)

static inline bool plic_irq_pending(QTestState *qts, int irq)
{
    uint32_t word = qtest_readl(qts, PLIC_PENDING + (irq / 32) * 4);
    return (word >> (irq % 32)) & 1;
}
/* 超时置位 + 拉中断：小 LOAD -> 推进虚拟时钟 -> SR.TIMEOUT + PLIC 源 4 pending */
static void test_wdt_interrupt(void)
{
    QTestState *qts = qtest_init("-machine g233 -m 2G");
    qtest_writel(qts, WDT_BASE + 0x04, 0x10);                 /* LOAD */
    qtest_writel(qts, WDT_BASE + 0x00, WDT_CTRL_EN | WDT_CTRL_INTEN);
    qtest_clock_step(qts, 500000000);                         /* 推 500ms 虚拟时间 */
    g_assert_cmpuint(qtest_readl(qts, WDT_BASE + 0x0C) & WDT_SR_TIMEOUT, !=, 0);
    g_assert_true(plic_irq_pending(qts, 4));                  /* 验中断到了 PLIC */
    qtest_quit(qts);
}
```

另外 6 个子测:config(读写 CTRL/LOAD)、countdown(VAL 递减)、feed(喂狗重载)、timeout_flag、timeout_clear(SR W1C)、lock(上锁后 CTRL 只读)。`qtest_clock_step` 推进 `QEMU_CLOCK_VIRTUAL`,让定时器到点 - qtest 里时间不会自流，得手动步进。

### 测试跑通

```bash
cd build && ./pyvenv/bin/meson test --no-rebuild --print-errorlogs "qtest-riscv64/test-wdt-timeout"
# -> 1/1 qemu:qtest-riscv64/test-wdt-timeout OK  2.77s  7 subtests passed
```

`make -f Makefile.camp test-soc` 一把跑全部 10 个 SoC qtest(board-g233 / gpio×2 / pwm / wdt / spi×5),把通过数写进 `build/soc-result.log` 供评分。

## 挂片外芯片 (SSI + m25p80 Flash)

SPI 控制器建 SSIBus，片外挂现成 m25p80。m25p80 把每个型号注册成独立 QOM 类型，型号名直接当类型：

```c
BusState *bus = qdev_get_child_bus(spi_ctrl, "spi");     // SPI 控制器的 SSI 总线
DeviceState *flash = qdev_new("w25x16");                 // 型号名即类型
qdev_prop_set_uint8(flash, "cs", 0);
ssi_realize_and_unref(flash, SSI_BUS(bus), &error_fatal);
qdev_connect_gpio_out_named(spi_ctrl, "cs", 0,          // 控制器 CS 输出 ->
    qdev_get_gpio_in_named(flash, SSI_GPIO_CS, 0));      //   flash 的片选输入
```
型号 w25x16(JEDEC EF3015)/w25x32(EF3016)。板子 Kconfig `select SSI_M25P80`。要给 flash 内容，建 flash 时接后端:realize 前 `qdev_prop_set_drive(flash, "drive", drive_get(IF_MTD, 0, i))`,命令行 `-drive if=mtd,format=raw,file=fw.bin`;裸 `-drive if=none` 只建后端、不连到 flash。本营参考实现没接后端，flash 起始为空。

## SoC 主频与时钟树

QEMU 里两套"时间"要分清:QEMUClock 管"虚拟时间怎么走",Clock 框架管"频率怎么在 SoC 里分发"。

- QEMUClock:四种时钟源 - `QEMU_CLOCK_VIRTUAL`(只在 VM 运行时前进，设备定时器都挂它)、`QEMU_CLOCK_REALTIME`(跟宿主墙钟)、`QEMU_CLOCK_HOST`(跟系统时间，会被改)、`QEMU_CLOCK_VIRTUAL_RT`(icount 模式)。`QEMUTimer` 挂在某个 clock 上到点回调。设备建模一律用 `QEMU_CLOCK_VIRTUAL`,行为才跟 guest 执行对齐 (本方向 WDT 就是 `timer_new_ns(QEMU_CLOCK_VIRTUAL, cb, s)`)。
- Clock 框架 (QOM 时钟树):建模真实 SoC 的主频 / PLL / 分频 / 门控。设备开 input/output clock 端口，时钟从源头 (晶振/PLL) 一级级 `clock_propagate` 到下游设备，频率变化经 `ClockEvent` 回调通知。常用 API:`clock_new` / `clock_set_hz` / `clock_get_hz` / `clock_propagate`、`qdev_init_clock_in` / `qdev_init_clock_out` 建端口、`vmstate_clock` 存迁移。
- 主频/分频两种建模：
    - 简法 (固定频率):设备自带一个常量频率直接算 tick。本方向 WDT 用 `#define HEKE_WDT_FREQ 1000000`(1MHz),`TICK_NS = 1e9 / FREQ`,`deadline = now + load * TICK_NS`。够用、不接时钟树。
    - 正法 (接时钟树):设备建 input clock 端口，主频由上游 PLL/分频器 `clock_propagate` 灌进来，`clock_get_hz(clk)` 取当前频率算周期;主频变 (改分频) 时 `ClockEvent` 回调重算。适合要真实反映时钟树、支持动态调频的场景。
- qtest 里虚拟时间不自流：`qtest_clock_step(qts, ns)` 手动推进 `QEMU_CLOCK_VIRTUAL`,让 WDT 这类定时器到点 (见上面 WDT qtest)。

## 调试:monitor / qtest / gdb stub / 日志

- HMP monitor(人机监控台):`-monitor stdio`(或 `-nographic` 下 `Ctrl-a c` 在串口与 monitor 间切),运行时内省 - `info qtree`(设备树)、`info mtree`(内存/MMIO 映射，查外设映在哪个地址)、`info registers`(CPU 寄存器)、`info irq`、`xp /Nx addr`(读物理内存)、`system_reset`。建完外设先 `info qtree` / `info mtree` 确认设备在、地址对。QMP(`-qmp`) 是同一套的机器可读 JSON 版。
- gdb stub(调 guest 里跑的东西):`-s` = `-gdb tcp::1234`,`-S` 启动即冻结等连;另一端 `riscv64-linux-gnu-gdb vmlinux -ex "target remote localhost:1234"`,下断点 / 单步 / 看寄存器。调内核、SBI、裸机程序都靠它。
- qtest(单元测外设，不跑 CPU 指令流):libqtest 起 `-machine <board>`,`qtest_writel/readl` 直接读写 MMIO 寄存器，`qtest_clock_step` 推虚拟时钟，`qtest_get_irq` 或读 PLIC pending 验中断。本方向四个设备全靠 qtest 打分 (见上面 WDT 全流程)。跑：`meson test "qtest-riscv64/<name>"` 或 `make -f Makefile.camp test-soc`。
- `-d` 日志 (看翻译 / CPU 状态):`-d in_asm`(翻译前 guest 汇编)、`-d out_asm`(TCG 生成的宿主码)、`-d op`(TCG 中间 op)、`-d exec`(执行的每个 TB)、`-d int`(中断/异常)、`-d cpu`(CPU 状态);`-D file` 写文件、`-dfilter <range>` 限地址。`-d help` 列全。调"跑飞了 / 取指异常"最先开 `-d in_asm,int`。
- trace 事件 (细粒度、低开销):设备 `trace-events` 里定义的点，`-trace "heke_wdt_*"` 或 `-trace events=list.txt` 打开;monitor 里 `info trace-events` 列、`trace-event <name> on` 动态开。比 `-d` 更有针对性。

## 技巧
- 中断线是"电平"语义：算出 masked 后 `qemu_set_irq(irq, level)`,别只在事件点脉冲一下。
- 定时器类 (WDT) 用 QEMUTimer + 读时现算 (compute-on-read) 当前计数，别每 tick 存一次。
- 时钟推进测试用 `qtest_clock_step(qts, ns)`;`info qtree`/`info mtree`(monitor) 看设备树/内存图定位地址。
- 从最像的现成设备 (hw/char、hw/timer、hw/sd) 抄骨架改语义，最省事。

## 坑
- 设备目录漏 meson 的 subdir/riscv_ss.add 就编不进 (qtest 读全 0、无 device);Kconfig-select 那类坑只在用 CONFIG 开关的设备 (如 K230 系列) 上才有。
- 本 fork 头文件位置有改:qdev-properties 在 `hw/core/`,error_fatal 要 `qapi/error.h`。
- 同一 build 目录别并发跑多个 ninja，会互相死锁。
- W1C 寄存器 (状态位写 1 清) 别写成普通存储;RO 寄存器写要忽略。
- SysBusDevice 不能 `-device` 命令行热插，只能板子代码实例化;要能 `-device` 加就得挂在真实总线 (PCI/SSI/I2C) 上。
