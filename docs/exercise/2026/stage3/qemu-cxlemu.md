# 建模 AI 加速卡项目任务

本项目在 QEMU + CXLMemSim 构建的 CXL Type-2 加速器仿真环境中，围绕 Kimi K2.6（IQ1_M / ternary 量化）构建“先正确、后性能”的异构推理链路。开始前请先阅读讲义中的[建模 AI 加速卡][tutorial]。

项目以基线仓库 [vickiegpt/Concordia](https://github.com/vickiegpt/Concordia/tree/tmatmul) 的 `tmatmul` 分支和 `bench/kimi_k26_tps/` 基准为起点，核心优化对象是 back storage（后端存储 / 供数路径），并以固定 GPU 资源下的推理吞吐作为打榜指标。

## 项目方向

### 功能验证：Kimi K2.6 跑正确

- 在 VM 内经 shim 路径完整跑通 Kimi K2.6 IQ1_M。
- 确保 `concordia` 结果与 `baseline` 对齐；这是进入性能榜单的门槛。

### 核心优化：back storage

- 优化 Concordia AOF 与 CXLMemSim backing store。
- 围绕 `--ssd-backing-file` 探索缓存、预取、io_uring / O_DIRECT、页大小等方法，在固定 GPU 资源下提升供数效率。

### JIT：ternary kernel 动态 codegen

- 将 tmatmul 以三值低比特执行，扩展 `HetGPUBackendType` 或 Concordia tmatmul 路径。
- 与 dense 基线对比正确性和加速比。

### 进阶：多节点解耦推理

- 探索多节点下的 prefill / decode 解耦或 MoE expert 分片。
- 借助 CXLMemSim 分布式模式完成 KV cache 跨节点放置。

## 考核标准

- **性能（主）**：在相同 GPU 资源、VM 环境和 Kimi K2.6 workload 下，以 `run_kimi_k26_tps.sh` 采集到 CSV / JSONL 的推理吞吐 `tps` 打榜排名。
- **正确性（门槛）**：`concordia` 路径产出须与 `baseline` 对齐，跑不对者不计入榜单。
- **技术报告（必须）**：包含项目成果、代码链接、可复现的运行日志与配置。

## 交付物

- 可运行代码和明确的代码版本。
- 固定环境下的正确性结果与性能数据。
- 运行脚本、配置、原始 CSV / JSONL 和结果分析。
- 项目总结报告和代码链接。

[tutorial]: ../../../tutorial/2026/ch3/qemu-cxlemu.md
