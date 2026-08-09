# QEMU Rust 方向

!!! note "主要贡献者"

    - 作者：[@Lfan-ke](https://github.com/Lfan-ke)

---

## 套路:Rust 设备 vs C 设备

设备本体 `rust/hw/<dev>/src/lib.rs`:
- `#[derive(qom::Object, hwcore::Device)]` 的 State 结构 - derive 自动 module_init 注册类型，不用手写 TypeInfo。
- 实现 traits:`ObjectType` / `ObjectImpl` / `DeviceImpl` / `SysBusDeviceImpl` / `ResettablePhasesImpl`。
- MMIO:`MemoryRegionOpsBuilder::<Self>::new().read(...).write(...).build()`,在 `unsafe init(ParentInit)` 里 `MemoryRegion::init_io`,`post_init` 里 `init_mmio`。
- 片外芯片行为直接内联进控制器的寄存器结构：一块 `mem: [u8; 256]` + 状态位 (i2c 的 ptr/page_base/got_addr、spi 的 FState/faddr/wel),用状态机模拟 AT24C02 / AT25 的命令时序，不是嵌入独立的 AT24C02/AT25 类型。

接进构建 + 板子：
- `rust/hw/<dev>/{meson.build, Cargo.toml}`;`rust/hw/meson.build` 加 `subdir('<dev>')`。
- Kconfig 加 `CONFIG_X_..._RUST`,`hw/riscv/Kconfig` 板子 select。
- create fn 写在 Rust 侧 (仿 pl011_create，它也是 Rust `#[no_mangle] pub unsafe extern "C" fn`):`State::new()` -> `sysbus_realize()` -> `mmio_map(0, addr)`,`g233.c`(C) 直接调这个导出的 C 符号实例化。

## C 实现 vs Rust 实现对比

本质一样 (都是 QOM/qdev 的 SysBusDevice + MMIO ops + reset + vmstate),差别在样板怎么写、安全怎么保：

| 维度 | C 设备 | Rust 设备 |
|---|---|---|
| 类型注册 | 手写 `TypeInfo` + `type_init()` | `#[derive(qom::Object, hwcore::Device)]` 自动 module_init 注册 |
| 状态结构 | `struct { SysBusDevice parent_obj; ... }` | `#[derive(...)]` 的 State，首字段是父类 |
| 实例/类构造 | `instance_init` / `class_init` 两个 C 函数 | 实现 `ObjectImpl` / `DeviceImpl` / `SysBusDeviceImpl` trait |
| MMIO ops | `static MemoryRegionOps{.read,.write}` + `memory_region_init_io` | `MemoryRegionOpsBuilder::<Self>::new().read().write().build()` + `MemoryRegion::init_io` |
| reset | `device_class_set_legacy_reset(dc, fn)` | 实现 `ResettablePhasesImpl` |
| 属性 | `DEFINE_PROP_*` + `device_class_set_props` | 声明式，或经 C 属性桥 |
| 内存安全 | 手动，易越界/UAF | 借用检查 + 类型系统兜底，`unsafe` 只在 FFI/MMIO 边界 |
| 与 C 互调 | 原生 | `#[no_mangle] extern "C"` 导出 create fn 给 C 调;调 C API 经 wrapper |
| 构建 | meson `system_ss.add(files('.c'))` | meson 编 Rust crate(`--enable-rust`)+ `Cargo.toml` |
| 参考模板 | hw/char/serial 等 | rust/hw/char/pl011(Rust 版) |

Rust 把样板用了 derive/trait 语法糖，变得极其简约。

## Rust FFI

QEMU 主体是 C,Rust 设备要能被 C 调、也要能调 C 的 memory_region/sysbus/qdev API，靠 FFI 双向打通：

- C 调 Rust:Rust 侧 `#[no_mangle] pub unsafe extern "C" fn g233_i2c_gpio_create(addr: u64) -> *mut DeviceState` 导出一个 C 符号;`g233.c` 声明原型后直接 `dev = g233_i2c_gpio_create(0x10013000)`,拿到 `DeviceState*` 再 `sysbus_mmio_map`。这是设备进板子的唯一入口。
- Rust 调 C:QEMU 的 C API 由 `rust.bindgen` 从 C 头生成 Rust 绑定 (unsafe extern),再在 crate 里封成安全 wrapper - `use bql/common/hwcore/qom/system/util::prelude::*` 引的就是这层封装。Rust 代码调 `MemoryRegionOpsBuilder` / `MemoryRegion::init_io` 等，底下都是 C。
- 类型桥：`#[derive(qom::Object, hwcore::Device)]` 自动生成 `TypeInfo` 注册 (module_init 期注册类型)、并把 Rust 的 State 结构摆成"首字段是 C 父类"的兼容布局，让 C 侧的 `SYS_BUS_DEVICE()` 向上转型成立。C 的 `DeviceState` / `MemoryRegion` 在 Rust 里是 opaque 绑定类型。
- unsafe 边界：只在 FFI 导出/导入点和 MMIO 回调入口标 `unsafe`,寄存器译码、状态机、EEPROM 时序全是安全 Rust。借用检查 + 类型系统把越界/UAF 挡在编译期。
- 构建：`./configure --enable-rust` 打开;Rust crate 经 meson `static_library(..., rust_abi: 'rust')` 编出，和 C 目标一起链进 `qemu-system-riscv64`(见下 meson 小结)。

## meson 小结

QEMU 用 meson 组织构建，加设备 (不管 C 还是 Rust) 都绕不开改 meson.build。这里把常用语法、配置、习惯收一份，细节回官文查。

> src: [Meson 语法](https://mesonbuild.com/Syntax.html)

- 无分号，`#` 注释。变量直接赋值 `x = 1`;类型有 string / int / bool / array `[...]` / dict `{...}`。字符串 `'...'`,多行 `'''...'''`,插值用 f-string `f'@var@'` 或 `'@0@'.format(x)`。
- 控制流：`if / elif / else / endif`、`foreach k, v : dict` ... `endforeach`。meson 故意不给自定义函数，逻辑靠内置函数 + 数组/字典。
- 逻辑与方法：`and / or / not`、`==`、`in`;`arr += x`、`d.get('k', default)`、`x.to_string()`。

> src: [Reference manual](https://mesonbuild.com/Reference-manual.html)

- `project('name', 'c', 'rust', version: 'x', default_options: [...])` 必须是首句。
- 内置对象：`meson`(当前构建，如 `meson.current_source_dir()` / `meson.project_version()`)、`host_machine` / `build_machine` / `target_machine`(`.cpu_family()` / `.system()` 判平台)。

> src: [构建目标](https://mesonbuild.com/Build-targets.html)

- `executable(name, sources, dependencies:, include_directories:, install:)`;库有 `static_library` / `shared_library` / `library`(由 `default_library` 选项决定)/ `both_libraries`。
- `files('a.c', 'b.c')` 取源文件对象;`include_directories('inc')` 取头目录;`custom_target` 跑任意命令产文件;`configure_file` 由模板 + 字典生成头 (如 config.h)。

> src: [依赖](https://mesonbuild.com/Dependencies.html)

- `dependency('glib-2.0', required: false, version: '>=2.66')` 找外部库 (走 pkg-config / cmake);`declare_dependency(link_with:, include_directories:)` 把本地库打包成依赖给别处 `dependencies:` 用;`subproject()` + wrap 拉子项目。

> src: [编译选项](https://mesonbuild.com/Build-options.html)

- 选项写在 `meson.options`(旧名 `meson_options.txt`):`option('foo', type: 'boolean', value: true)`;`get_option('foo')` 读。配置期 `-Dfoo=bar` 覆盖。内置选项 `buildtype`(debug/release)、`optimization`、`warning_level`、`default_library`。

> src: [source_set 模块](https://mesonbuild.com/Source-set-module.html)

- QEMU 特有：用 sourceset 按配置条件收源码。`system_ss.add(files('dev.c'))` 无条件编入;`system_ss.add(when: 'CONFIG_X', if_true: files('dev.c'))` 由 Kconfig 决定编不编。`common_ss` / `specific_ss` 等按作用域分。`subdir('sub')` 下钻子目录的 meson.build。

> src: [Rust 集成](https://mesonbuild.com/Rust.html)

- QEMU 用 `--enable-rust` 打开;Rust 设备编成 crate(`static_library(..., rust_abi: 'rust')`),经 `rust.bindgen` 生成 C 头绑定;`rust/hw/<dev>/meson.build` 声明该 crate,`rust/hw/meson.build` 里 `subdir('<dev>')` 接入。

> src: [命令用法](https://mesonbuild.com/Commands.html)

- 习惯：`meson setup build`(配置，生成 build/)→ `meson compile -C build`(等价 `ninja -C build`)→ `meson test -C build` → `meson configure build -Dfoo=bar`(改选项重配)。改了 meson.build 无需手动重配，`compile` 会自动重新生成 ninja 规则。

## ninja 小结

meson 只负责"配置 + 生成构建图",真正干活的后端默认是 ninja - `meson setup build` 在 build/ 里生成 `build.ninja`,`meson compile -C build` 本质就是调 `ninja -C build`。ninja 只做一件事：看时间戳做最小增量重建，所以快;它不写逻辑 (没 if/循环),逻辑都在 meson 里。

> src: [Ninja manual](https://ninja-build.org/manual.html)

- `ninja -C build` 建全部 (= `meson compile -C build`);`ninja -C build <target>` 只建某目标 (如 `ninja -C build qemu-system-riscv64` 增量重编)。
- `-j N` 并行度;`-n` dry-run(只打印不执行);`-v` 显示实际命令行;`-d explain` 解释为何重建。
- `ninja -C build -t targets` 列所有目标;`-t clean` 清理产物;`-t compdb > compile_commands.json` 出编译数据库给 clangd/IDE 跳转补全。
- `build.ninja` 是 meson 生成的声明式构建图，别手写;改了 `meson.build`,ninja 会先自动 re-run meson 再建，不用手动重配。
- 与 make 对比:make 能写规则逻辑但增量判断慢;ninja 把逻辑交给上层 (meson/cmake),自己专注"图 + 时间戳"把增量做到极快。QEMU 用 meson + ninja 正是这个分工。

## 示例总结

建模流程和 C 一样套路，不同在验证:Rust 有原生单元测试，加上 C 侧 qtest 两层。以本营 g233 上已 CI 100% 的 Rust I2C-GPIO 为例：

- 设备：`rust/hw/i2c-gpio`(`TYPE = c"g233-i2c-gpio"`,内嵌 AT24C02 EEPROM @0x50,8 字节页写回卷),create fn `g233_i2c_gpio_create(0x10013000)` 由 `g233.c` 实例化;另有 `rust/hw/spi`(@0x10019000，内嵌 AT25)。寄存器 CTRL/STATUS/ADDR/DATA/PRESCALE,STATUS 有 BUSY/ACK/DONE(无中断,全靠轮询)。
- Rust 单元测试 (测纯逻辑):在 crate 里 `#[cfg(test)] mod tests` 用 `#[test]` 写，如 `rust/hw/i2c` 的 `test_i2c_bus_create` / `read_write` / `nack`,不起虚机、直接测 I2CBus/EEPROM 语义。
- qtest(测 MMIO 行为):C harness `qtest_init("-machine g233 -m 2G")` + `qtest_writel/readl` 打 CTRL/DATA 走 bitbang I2C 时序，轮 STATUS 的 BUSY/ACK/DONE 判结果、验 EEPROM 页写回卷。
- 运行跑通：

```bash
cd build
# qtest:i2c-gpio bitbang
./pyvenv/bin/meson test --no-rebuild "qtest-riscv64/test-i2c-gpio-bitbang"   # OK 3 subtests passed
# Rust 单元测试套件
./pyvenv/bin/meson test --no-rebuild --suite rust                            # rust-i2c-unit OK 3 / 13-13 rust OK
# 或一把跑本方向全部
make -f Makefile.camp test-rust
```

## 技巧
- 直接抄 QEMU 现成 rust 设备 rust/hw/char/pl011 的 qdev/SysBusDevice 绑定和 MMIO ops 写法，改语义即可。
- 测试轮询各自的状态寄存器 (I2C-GPIO 轮 STATUS 的 BUSY/ACK/DONE;SPI 轮 SR 的 RXNE/TXE/OVERRUN,两套位不通用),都不需要中断 - 省掉 irq 接线。
- I2C page write 有回卷 (AT24C02 8 字节页边界)。SPI 有一个 CS 寄存器 (offset 0x0C),但传输不据它做帧定界;帧边界靠状态机里的"命令重识别"(在 ReadData/WriteData 态重新识别命令码) 切。

## 坑
- Rust 设备不接进 meson/Kconfig + 没写 C create fn -> 编进了也没人实例化，板子上不存在。
- 地址冲突:g233 原来的 Learn 占了 0x10013000,i2c-gpio 要用得先删/挪 Learn。
- qdev 公共头在 include/hw/core/qdev.h(上游 QEMU 同一位置，非本 fork 特有);hw/core/ 下只有 qdev-prop-internal.h 这类内部头。
