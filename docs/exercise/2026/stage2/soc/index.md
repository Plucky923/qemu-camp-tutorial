专业阶段 SoC 方向的实验围绕 G233 虚拟开发板的板级建模与外设驱动展开。

你需要按照 [G233 SoC 硬件手册](g233-datasheet.md) 给出的硬件参数，完成 GPIO、PWM、WDT、SPI 控制器与 Flash 存储器件的设备建模。

## 实验概览

| 项目 | 说明 |
|------|-----|
| 测试框架 | QTest（宿主机侧编译运行） |
| 测试位置 | `tests/gevico/qtest/test-*.c` |
| 测题数量 | 10 题 × 10 分 = 100 分 |
| 运行命令 | `make -f Makefile.camp test-soc` |

## 文档

- [SoC 实验手册](g233-exper-manual.md) — 实验流程与测题说明
- [G233 SoC 硬件手册](g233-datasheet.md) — 外设寄存器与中断映射
