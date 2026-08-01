# RUST 实验 - RUST SSI 控制器（QTest）  

!!! note "主要贡献者"  

    - 作者：[@ovwxxwvo](https://github.com/ovwxxwvo)  

完整实现代码可参考仓库 ([qemu-camp-2026-exper-ovwxxwvo](https://github.com/gevico/qemu-camp-2026-exper-ovwxxwvo))  

---  

### 📁 项目主要目录结构  
```  
./rust/hw/ssi/  
├── ssi_core             // ssi通用核心实现  
│   └── src  
│       ├── core.rs  
│       └── lib.rs  
├── ssi_slave            // ssi各种从机外设实现  
│   └── src  
│       ├── at24c02.rs  
│       └── lib.rs  
├── rust_spi             // ssi具体控制器实现  
│   └── src  
│       ├── bindings.rs  
│       ├── registers.rs  
│       ├── device.rs  
│       └── lib.rs  
```  

- 项目文件结构的设计是为了减少 QEMU 的 C 代码对 RUST 代码的多次调用。  
- 主控设备实现的 crate(rust_spi) 是唯一提供给 QEMU 调用的接口，每个主控都是独立的 crate。  
- 主控总线和从机特性的实现的 crate(ssi_core) 仅在 RUST 内部供主控和从机的实现使用。  
- 从机外设的实现将在 crate(ssi_slave) 以 mod 形式存在，每个从机外设都为独立的 mod。  

### 🛠️ 项目构建所需修改文件  
```  
./hw/ssi/Kconfig                    // SSI驱动配置，新增RUST_SPI编译项，关联Rust实现驱动  
./hw/riscv/Kconfig                  // RISC-V主板配置，GEVICO_G233平台新增RUST_SPI外设依赖  

./rust/Cargo.toml                   // 顶层workspace添加相应crate  

./rust/hw/ssi/Kconfig               // 添加子项  
./rust/hw/ssi/meson.build           // 添加子项  

./rust/hw/ssi/rust_spi/meson.build  // 注意添加bindgen相关  
./rust/hw/ssi/rust_spi/Cargo.toml   // 注意依赖相对路径层级  
```  

- `./rust/Cargo.toml`顶层`workspace`添加相应的`crate`，  
  这样 lsp 才能生效，必要时`cargo clean`。  
- `./rust/hw/ssi/rust_spi/meson.build`文件中`_rust_spi_rs`需要添加  
  `{'.': _rust_spi_bindings_inc_rs},` 。  

### 🛠️ 项目混合编程对接文件  
```  
./rust/hw/ssi/rust_spi/wrapper.h        // 专供bindgen解析的适配头，修复工具解析报错并引入标准C头文件  
./rust/hw/ssi/rust_spi/src/bindings.rs  // 导入bindgen生成的QEMU的C接口绑定代码，Rust通过其调用C侧接口  

./include/hw/ssi/rust_spi.h             // 声明C接口函数符号，供C代码调用Rust实现  
./rust/hw/ssi/rust_spi/src/lib.rs       // 导出Rust功能实现，对接C声明接口函数符号  

./include/hw/riscv/g233.h               // 声明项目相关内存映射枚举  
./hw/riscv/g233.c                       // 调用控制器create实现  
```  

- `rust_spi_create`和`rust-spi`这两个符号在 C 和 RUST 中是对应的。  
- 主要涉及文件`./include/hw/ssi/rust_spi.h`和`./rust/hw/ssi/rust_spi/src/lib.rs`。  

---  

### 🧩 RUST_SPI 主控的极简实现框架  
```  
// QEMU硬件抽象层  
pub struct RUSTSPIRegisters {}  // 寄存器，存放设备所有寄存器  
pub struct RUSTSPIState {}      // QOM设备模型，存放设备运行状态  
pub struct RUSTSPIClass {}      // QOM设备类，存放设备固定属性  

// 业务特性，强制设备挂载系统总线并规定设备唯一ID  
trait RUSTSPIImpl: SysBusDeviceImpl + IsA<RUSTSPIState> {}  

// QEMU框架适配层  
impl RUSTSPIClass {}                           // 保存设备ID，调用父类初始化  
unsafe impl ObjectType for RUSTSPIState {}     // 绑定实例类对象，设备命名供QEMU使用  
impl RUSTSPIImpl for RUSTSPIState {}           // 定义设备ID  
impl ObjectImpl for RUSTSPIState {}            // 绑定设备完整生命周期函数  
impl DeviceImpl for RUSTSPIState {}            // 启用设备，创建设备硬件资源  
impl ResettablePhasesImpl for RUSTSPIState {}  // 复位回调，虚拟机复位时恢复硬件初始状态  
impl SysBusDeviceImpl for RUSTSPIState {}      // 挂载设备到系统总线，绑定MMIO访问入口  

// QEMU业务接口层  
impl RUSTSPIRegisters {}                       // 实现寄存器读写及复位逻辑  
impl RUSTSPIState {}                           // 实现数据收发工具函数  

// 导出设备创建函数  
pub unsafe extern "C" fn rust_spi_create()     // 创建实例化设备，供QEMU的C代码调用  
```  

- RUST_SPI 主控设备为极简实现，未实现中断逻辑和复位逻辑。(仿 pl011)  
- 寄存器的地址偏移和特定寄存器结构体在同 crate 的`registers.rs`中定义。  
- SSI 总线在`ssi_core`的 crate 中的`core.rs`中定义。  
- SSI 从机在`ssi_slave`的 crate 中进行不同外设的定义。  

### 🔗 RUST_SPI 主控的业务函数调用链条  
```  
rust_spi_create  
  └> RUSTSPIState::new  
  |    └> RUSTSPIState::init  
  |         └> MemoryRegion::init_io - RUSTSPI_OPS  
  |         └> RUSTSPIRegisters - Default::default()  
  |         └> SSI_Bus::new  
  └> RUSTSPIState::sysbus_realize  
       └> RUSTSPIState::realize -> SSIBus::attach -> AT25Slave::new  
```  
```  
qtest_readl  -> RUSTSPI_OPS.read  -> RUSTSPIState::read  -> RUSTSPIRegisters::read  

qtest_writel -> RUSTSPI_OPS.write -> RUSTSPIState::write -> RUSTSPIRegisters::write  
  ┌-----------------------------------------------------------┘  
  └> SSI_Bus::transfer_read  -> AT25Slave::recv  
  └> SSI_Bus::transfer_write -> AT25Slave::send  
```  

- `RUSTSPIState::init`初始化由`RUSTSPIState::new`构造间接调用。  
- `RUSTSPIState::realize`实体化由`RUSTSPIState::sysbus_realize`实现间接调用。  
- `SSIBus`分别在`RUSTSPIState`的`init`和`realize`中进行创建和从机挂载。  
- SSI 主从数据传输仅由写控制寄存器触发，写入其余寄存器和读取所有寄存器不触发总线通信。  

---  

### 🔄 SSI 协议数据流转  
```  
             sys-bus                      ssi-bus  
 risc-v --<----------->-- ssi-master --<----------->-- ssi-slave  
processor                 controller                   peripheral  
```  
```  
  /--MOSI-<-- 8addr+8data+8data+... --<-MOSI--\  
 / /-MISO->-- 8addr+8data+8data+... -->-MISO-\ \  
SPI device                                SPI controller  
 \ \-SCLK---- .12345678...12345678. ----Sclk-/ /  
  \---CS-----      NCS|NSS(CS)      -----CS---/  
```  

- SSI 协议，两线一时钟 (SCL) 一数据 (SDA)，单线进行数据收发。  

### 🧩 SSI_BUS 的实现框架  
```  
pub struct SSIBus {  
    devices: Vec<Box<dyn SSISlave>>,  
    current_cs: u8,  
}  

impl SSIBus {  
    pub fn new() -> Self {  
    pub fn device_count(&self) -> usize {  

    pub fn attach(&mut self, device: Box<dyn SSISlave> ) {  
    pub fn chip_select(&mut self, new_cs: u8) {  
    pub fn transfer(&mut self, val: u8) -> u8 {  
}  
```  

### 🧩 SSI_SLAVE 的实现框架  
```  
pub struct AT25Slave {  
    pub cs_id   : u8,  
    pub regs    : [u8; 256],  
    pub pointer : u8,  
    pub is_addr : bool,  
    pub is_write: bool,  
    pub is_read : bool,  
    pub sr      : u8,  
    pub send_sr : bool,  
}  

impl SSISlave for AT25Slave {  
    fn cs_id(&self) -> u8 {  
    fn set_cs(&mut self, _select: bool){  
    fn transfer(&mut self, data: u8) -> u8 {  
}  
```  

---  

### 📦 RUST_SPI 主控的寄存器写根据 SSI 协议的实现  
```  
impl RUSTSPIRegisters {  

    pub(self) fn read(&mut self, offset: RegisterOffset) -> u32 {  
    }  

    pub(self) fn write(&mut self, offset: RegisterOffset, value: u32, device: &RUSTSPIState) -> bool {  
        use RegisterOffset::*;  
        match offset {  
            CR1 => {  
                // let mut cr1 = Cr1::from(value);  
                let cr1 = Cr1::from(value);  
                match (cr1.spe(), cr1.mstr()) {  
                    (true, true) => {  
                        self.sr.set_txe(true);  
                    },  
                    (false, true) => {  
                        self.sr.set_txe(false);  
                        self.sr.set_rxne(false);  
                        self.sr.set_overrun(false);  
                    },  
                    _ => {},  
                };  
                self.cr1 = cr1  
            },  
            CS  => {  
                let mut ssi_bus = device.ssi_bus.borrow_mut();  
                ssi_bus.chip_select(value as u8);  
                self.cs = value;  
            },  
            DR  => {  
                let tx_byte = value as u8;  
                let mut ssi_bus = device.ssi_bus.borrow_mut();  
                let rx_byte = ssi_bus.transfer(tx_byte);  
                self.dr = rx_byte as u32;  
                self.sr.set_txe(true);  
                self.sr.set_rxne(true);  
            },  
            SR  => {},  
        }  
        false  
    }  

}  
```  
- SSI 主从数据传输由写控制寄存器触发，需实现 5 个逻辑分支：  

---  

### 📝 总结  

- 文中目录结构、文件清单、代码框架均可直接复用，更换协议就能移植其他外设。  
- RUST 和 C 的多语言混合编程工程搭建繁琐，可在着手实现具体逻辑前修改涉及文件。  
- 了解 QEMU 设备的实现框架，理清函数调用链路，关键业务代码是实现主控寄存器基于协议的读写逻辑。  
- 项目未用到 GDB 调试，有待进一步学习，不懂知识由豆包协助推进。  

