# QEMU 训练营基础阶段 C 语言
hello，欢迎各位来到qemu训练营。这是qemu训练营的起始，大家不如立一个flage，比如我一定要完成qemu训练营全部流程，不要半途而费。

`qemu_camp_basic_c`[https://classroom.github.com/a/AgHjM77H] 是 QEMU 训练营基础阶段的 C 语言练习仓库，核心内容位于 `qemu_camp_basic_c/c_exercise` 目录。

这个题库把 OpenCamp 原有的基础阶段和专业阶段 C 题目整合成了一套连续编号的练习，共 `40` 题，适合按顺序完成，也适合按专题挑选训练。

此文档不会过多的赘述语法细节，个人认为使用AI辅助语法学习效率奇高。如果你是0基础同学，可以和gpt，claude老师讨论学习。

## 快速开始

### 1. 进入目录

```bash
cd qemu_camp_basic_c
```

### 2. 查看可用命令

```bash
make help
```

### 3. 编译检查器并列出全部题目

```bash
make c-checker
make list
```

### 4. 检查单道题

可以使用编号，也可以使用完整题目名。

```bash
make check 01
make check 21_singly_linked_list_josephus
```

### 5. 查看提示

```bash
make hint 14
make hint 40_bloom_filter_bitmap
```

### 6. 检查全部题目

```bash
make check-all
```

### 7. 运行单道题程序

```bash
cd c_exercise
./run.sh 01_insert_sort
./run.sh 20_mybash
```

### 8. 启动持续检查

```bash
make watch
```

## 题库结构

### 基础信息

- 总题数：`40`
- 计分方式：每题 `5` 分，满分 `200` 分
- 题目来源：OpenCamp 基础阶段 + 专业阶段 C 题库整合

### 阶段划分

| 编号范围 | 阶段 | 说明 |
| --- | --- | --- |
| `01-20` | 基础阶段 | 数据结构、基础算法、字符串与文件处理、命令解释器 |
| `21-40` | 进阶阶段 | 链表、树、哈希、位图、线程安全、宏技巧、系统编程 |

### 题目主题分组

#### 01-10：基础算法与字符串

1. `01_insert_sort` - 插入排序
2. `02_merge_sort` - 归并排序
3. `03_quick_sort` - 快速排序
4. `04_linear_search` - 线性查找
5. `05_binary_search` - 折半查找
6. `06_stack_maze` - 栈解决迷宫问题
7. `07_queue_maze` - 队列实现广度搜索迷宫问题
8. `08_circular_queue` - 环形队列实现约瑟夫环问题
9. `09_word_counter` - 统计单词个数
10. `10_my_strcpy` - 字符串拷贝

#### 11-20：解释器、文件与工具实现

11. `11_command_interpreter` - 命令解释器
12. `12_student_management` - 学生信息管理
13. `13_universal_sorter` - 通用排序接口
14. `14_calculator` - 四则运算
15. `15_url_parser` - URL 参数解析器
16. `16_mysed` - 简单流处理器
17. `17_myfile` - ELF 文件头查看
18. `18_mywc` - 词频统计器
19. `19_mytrans` - 查字典翻译
20. `20_mybash` - 命令解释器项目

#### 21-30：链表、树与底层基础能力

21. `21_singly_linked_list_josephus` - 单链表约瑟夫环
22. `22_doubly_circular_queue` - 双向循环链表队列
23. `23_circular_linked_list_josephus` - 环形链表约瑟夫环
24. `24_prev_binary_tree` - 二叉树前序遍历
25. `25_counter_letter` - 排序二叉树字母统计
26. `26_hash_counter` - Hash 表词频统计
27. `27_asm_gcd` - 内联汇编求最大公约数
28. `28_operator_overflow` - 无符号运算溢出检测
29. `29_swap_endian` - 字节序转换
30. `30_debug_print` - 调试宏 `DEBUG_PRINT`

#### 31-40：工程能力与系统编程进阶

31. `31_event_handler` - 简单事件处理器
32. `32_container_of_macro` - `container_of` 宏实现
33. `33_garray_dynamic_array` - 动态数组
34. `34_protocol_header_parser` - 协议头解析器
35. `35_elf_info_parser` - ELF 信息查看工具
36. `36_lru_cache` - LRU 缓存淘汰算法
37. `37_bitmap_operations` - 位图操作
38. `38_thread_safe_ring_buffer` - 线程安全环形缓冲区
39. `39_strtok_r_thread_safe` - 线程安全字符串分割器
40. `40_bloom_filter_bitmap` - Bloom 过滤器

## 常用命令速查

```bash
# 在 qemu_camp_basic_c 目录执行
make help
make c-checker
make list
make check 01
make check 15_url_parser
make hint 15
make check-all
make watch
make clean
```

## 学习建议

### 推荐顺序

1. 先完成 `01-10`，建立基础语法、数组、指针和简单数据结构能力
2. 再完成 `11-20`，训练字符串处理、文件处理和模块化组织
3. 最后进入 `21-40`，强化链表、树、位运算、宏、并发与系统编程思维

### 做题建议

- 优先保证程序可编译，再逐步修正逻辑
- 先通过单题检查，再执行 `make check-all`
- 多利用 `make hint <题号>` 查看方向提示
- 遇到包含 `Makefile` 的题目，优先阅读题目目录下的实现组织方式
- `20_mybash` 是相对完整的小项目，结构会比前面的单文件题更复杂

## 自动评测说明

当前仓库已经接入 GitHub Actions 自动评测流程。推送到主分支后，工作流通常会：

1. 编译 `c-checker`
2. 执行 `./c-checker check-all`
3. 生成测试汇总结果
4. 在配置好 OpenCamp 所需 secrets 后回传成绩

`pull_request` 场景一般只执行评测，不做成绩回传。

## 相关文件

- 题库说明：`qemu_camp_basic_c/c_exercise/README.md`
- 顶层命令入口：`qemu_camp_basic_c/Makefile`
- 题库主命令入口：`qemu_camp_basic_c/c_exercise/Makefile`
- 单题运行脚本：`qemu_camp_basic_c/c_exercise/run.sh`
- 持续检查脚本：`qemu_camp_basic_c/c_exercise/watch.sh`

## 一句话总结

如果你只想记住最重要的使用方式，可以直接按下面这个流程来：

```bash
cd qemu_camp_basic_c
make c-checker
make list
make check 01
make check-all
```
