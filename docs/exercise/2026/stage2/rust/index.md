专业阶段 Rust 方向的实验要求使用 Rust 语言实现 I2C 总线、GPIO I2C 控制器和 SPI 控制器，集成到 G233 SoC。

实验通过 Rust 单元测试（验证核心逻辑）和 QTest（验证设备集成）共同评分。

## 实验概览

| 项目 | 说明 |
|------|-----|
| 测试框架 | Rust 单元测试（3 题） + QTest（7 题） |
| 测试位置 | `rust/hw/i2c/src/lib.rs` + `tests/gevico/qtest/test-i2c-*.c` / `test-spi-rust-*.c` |
| 测题数量 | 10 题 x 10 分 = 100 分 |
| 运行命令 | `make -f Makefile.camp test-rust` |

## 文档

- [Rust 实验手册](rust-exper-manual.md) — 实验流程、寄存器映射与测题说明
- [Rust 编程指南](rust-lang-manual.md) — Rust in QEMU 编程参考
