# RUST 实验 - I2C 总线（Rust 单元测试）  

!!! note "主要贡献者"  

    - 作者：[@ovwxxwvo](https://github.com/ovwxxwvo)  

---  
## 背景介绍  

- 个人背景  
计算机爱好者，`archlinux`用户，`shell`脚本写配置居多。  
写过一些自用应用插件，比如`tmux|fish|yazi|nvim`。  
写过一个大语言模型的训练评估推理的学习demo，用`pytorch`。  
- 参加训练营的动机  
在想编程这个兴趣是否能作为工作，可惜有逻辑没算法。  
做的话就是底层一点，系统相关或是ai相关。  
也许想自己写一个操作系统（我是咸鱼）。  

---  
## 专业阶段  

- 重新组织文件目录  
```  
./rust/  
├── Cargo.toml               # 顶层workspace添加i2c_core，再`cargo clean`  
├── hw  
│   ├── i2c  
│   │   ├── i2c_core         # 原i2c内文件移入i2c_core  
│   │   │   ├── build.rs  
│   │   │   ├── Cargo.toml   # 相关文件名修改为i2c_core  
│   │   │   ├── meson.build  # 相关文件名修改为i2c_core  
│   │   │   └── src  
│   │   │       ├── lib.rs   # 保留i2c-bus和i2c-slave实现  
│   │   │       ├── core.rs  # 对外开放core  
│   │   │       └── test.rs  # 剥离测试文件  
│   │   │  
│   │   ├── Kconfig          # 子目录添加i2c_core  
│   │   ├── meson.build      # 子目录添加i2c_core  
```  

- 需要新建或修改的文件路径  
```  
./rust/Cargo.toml  
./rust/hw/i2c/Kconfig  
./rust/hw/i2c/meson.build  
```  

- `./rust/Cargo.toml` # 顶层workspace添加i2c_core，再`cargo clean`  
```  
[workspace]  
resolver = "2"  
members = [  
    "hw/i2c/i2c_core",  
    "hw/char/pl011",  
    "hw/timer/hpet",  
    "tests",  
]  
```  

- `./rust/hw/i2c/Kconfig` # 子目录添加i2c_core  
```  
config X_I2C_CORE_RUST  
    bool  
```  

- `./rust/hw/i2c/meson.build` # 子目录添加i2c_core  
```  
subdir('i2c_core')  
```  

- `i2c_core`及`meson.build`|`cargo.toml`的具体实现可参考我的仓库  
[qemu-camp-2026-exper-ovwxxwvo](https://github.com/gevico/qemu-camp-2026-exper-ovwxxwvo)  

---  
## 总结  

泽文老师课程框架比较清晰，视频音频也非常清晰，很难得。  

- RUST系统编程语言感觉就是在用`match`和`if let`穷尽所有的`option`|`result`。  
- QEMU搭建的RUST和C的混合编程框架体验总体是没有什么问题，  
  就是配置繁琐，特别是后面c调用rust会涉及更多文件。  
- 顶层`workspace`添加相应的`crate`，这样lsp才能生效，必要时`cargo clean`。  
- RUST实验-I2C总线，更像是rustling的延续，具体实现不太难。  
  文件结构调整是对齐pl011，后续可以作更好的拓展,结构更合理。  
  一种协议一个文件夹，核心实现和控制器实现都作为一个`crate`。  
- RUST的三个实验，工程搭建比业务实现还要多花一些时间。  
  `i2c`|`spi`的协议内容和控制器实现，是靠豆包协助推进。  
  调试相关内容在三个实验中没有涉及，有待进一步学习。  

给后续学员的建议是加油。我个人偏向，先想后做，先架构后实现。  

