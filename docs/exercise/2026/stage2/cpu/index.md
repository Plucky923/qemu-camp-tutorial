专业阶段 CPU 方向的实验围绕 G233 虚拟机的 Xg233ai 自定义指令扩展展开。

你需要按照 [CPU 指令扩展手册](cpu-datasheet.md) 给出的指令规格，在 QEMU TCG 前端完成指令翻译与实现。

## 实验概览

| 项目 | 说明 |
|------|-----|
| 测试框架 | TCG testcase（裸机 semihosting） |
| 测试位置 | `tests/gevico/tcg/riscv64/test-insn-*.c` |
| 测题数量 | 10 题 × 10 分 = 100 分 |
| 运行命令 | `make -f Makefile.camp test-cpu` |

## 文档

- [CPU 实验手册](cpu-exper-manual.md) — 实验流程与测题说明
- [CPU 指令扩展手册](cpu-datasheet.md) — Xg233ai 指令规格
