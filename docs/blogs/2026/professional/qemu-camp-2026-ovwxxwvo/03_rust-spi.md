# RUST 实验 - RUST SPI 控制器（QTest）  

!!! note "主要贡献者"  

    - 作者：[@ovwxxwvo](https://github.com/ovwxxwvo)  

完整实现代码可参考仓库([qemu-camp-2026-exper-ovwxxwvo](https://github.com/gevico/qemu-camp-2026-exper-ovwxxwvo))  

---  

#### 项目主要目录结构  
```  
./rust/hw/ssi/  
├── ssi_core             // ssi通用核心实现  
│   └── src  
│       ├── core.rs  
│       └── lib.rs  
├── ssi_slave            // ssi各种从机外设实现  
│   └── src  
│       ├── at25.rs  
│       └── lib.rs  
├── rust_spi             // spi具体控制器实现  
│   └── src  
│       ├── bindings.rs  
│       ├── registers.rs  
│       ├── device.rs  
│       └── lib.rs  
```  

#### 项目混合编程对接文件  
```  
./rust/hw/ssi/rust_spi/wrapper.h        // 专供bindgen解析的适配头，修复工具解析报错并引入标准C头文件  
./rust/hw/ssi/rust_spi/src/bindings.rs  // 导入bindgen生成的QEMU的C接口绑定代码，Rust通过其调用C侧接口  

./include/hw/ssi/rust_spi.h             // 声明C接口函数符号，供C代码调用Rust实现  
./rust/hw/ssi/rust_spi/src/lib.rs       // 导出Rust功能实现，对接C声明接口函数符号  

./include/hw/riscv/g233.h               // 声明项目相关内存映射枚举  
./hw/riscv/g233.c                       // 调用控制器create实现  
```  

#### 项目构建所需修改文件  
```  
./hw/ssi/Kconfig                    // SSI驱动配置，新增RUST_SPI编译项，关联Rust实现驱动  
./hw/riscv/Kconfig                  // RISC-V主板配置，GEVICO_G233平台新增RUST_SPI外设依赖  

./rust/Cargo.toml                   // 顶层workspace添加相应crate，再`cargo clean`  

./rust/hw/ssi/Kconfig               // 添加子项  
./rust/hw/ssi/meson.build           // 添加子项  

./rust/hw/ssi/rust_spi/meson.build  // 注意添加bindgen相关  
./rust/hw/ssi/rust_spi/Cargo.toml   // 注意信赖相对路径层级  
```  

---  

#### RUST_SPI主控的极简实现框架(仿pl011，未涉及中断)  
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

#### RUST_SPI主控的业务函数调用链条  
```  
rust_spi_create -> RUSTSPIState::new -> ... -> RUSTSPIState::init -> SSI_Bus::new  
    RUSTSPIState::realize    -> SSIBus::attach -> AT25Slave::new  
    RUSTSPIState::reset_hold -> RUSTSPIRegisters::reset  
    RUSTSPIState::read  -> RUSTSPIRegisters::read  -> SSI_Bus::transfer_read  -> AT25Slave::recv  
    RUSTSPIState::write -> RUSTSPIRegisters::write -> SSI_Bus::transfer_write -> AT25Slave::send  
```  

---  

#### SSI协议数据流转  
```  
  /--MOSI-<-- 8addr+8data+8data+... --<-MOSI--\  
 / /-MISO->-- 8addr+8data+8data+... -->-MISO-\ \  
SPI device                                SPI controller  
 \ \-SCLK---- .12345678...12345678. ----Sclk-/ /  
  \---CS-----      NCS|NSS(CS)      -----CS---/  
```  

#### SSI_BUS的实现框架（通过RUST实验一核心代码稍作修改）  
```  
pub struct SSIBus {  
    devices: Vec<Box<dyn SSISlave>>,  // 挂载在总线上的从机列表  
    current_addr: Option<u8>,         // 当前正在通信的从机地址  
    is_recv: bool                     // 本次传输是主机读或主机写的标记  
}  

impl SSIBus {  
    pub fn new             // 创建SSI总线，初始化设备列表及当前寻址地址  
    pub fn device_count    // 统计SSI总线上挂载的从设备数量  
    pub fn is_busy         // 判断总线是否正在传输  

    pub fn attach          // 挂载SSI从机到SSI总线  
    pub fn start_transfer  // 返回开始信号，保存地址，确定主机读写  
    pub fn end_transfer    // 返回结束信号，设置地址为空  
    pub fn send            // 发送数据，调用从机发送函数  
    pub fn recv            // 接收数据，调用从机接收函数  
    pub fn transfer_write  // 封装完整写流程：起始写传输+连续写入字节+结束传输  
    pub fn transfer_read   // 封装完整读流程：起始读传输+连续读取字节+结束传输  
}  
```  

#### SSI_SLAVE的实现框架（通过RUST实验一测试代码稍作修改，AT25）  
```  
pub struct AT25Slave {  
    pub addr: u8,          // 从机设备地址  
    pub regs: [u8; 256],   // EEPROM存储数组  
    pub pointer: u8,       // 存储读写指针  
    pub first_byte: bool,  // 标记首字节  
}  

impl SSISlave for AT25Slave {  
    fn address  // 获取设备地址  
    fn event    // 响应总线事件  
    fn send     // 发送主机数据，并设置存储读写指针  
    fn recv     // 接收主机数据，并设置存储读写指针  
}  
```  

---  

#### RUST_SPI主控的寄存器写根据SSI协议的实现  
```  

```  

---  

#### 总结  
- RUST和C的多语言混合编程，工程搭建繁琐，占据大半时间。  
- 了解QEMU设备的实现框架，理清函数调用链路，  
  关键就是实现主控寄存器基于协议的读写逻辑。  
- RUST_SPI主控为极简实现未涉及中断内容。  
- SSI_Bus的实现是在实验一核心代码上稍作修改完成。  
- AT25_Slave的实现是在实验一测试代码上稍作修改完成。  
- 项目未用到GDB调试，有待进一步学习，不懂知识由豆包协助推进。  

