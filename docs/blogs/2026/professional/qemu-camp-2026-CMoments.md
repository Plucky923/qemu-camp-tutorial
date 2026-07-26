# QEMU 训练营 2026 专业阶段总结

!!! note "主要贡献者"

    - 作者：[@CMoments](https://github.com/CMoments)

---

## 背景介绍

大三在读。本来在 OS 训练营学习，因为要用 qemu，就找到了这个 QEMU 训练营。实验质量和教程很高，学习收获很多。

## 专业阶段

### SoC 实验与 GPIO

> QEMU Core 维护者 => 提供面包板、导线、插座（基础设施）
>
> QEMU 开发者 => 在面包板上插芯片、用导线连接（建模硬件设备）

GPIO——General Purpose Input And Output，GPIO 的层次结构是 QEMU 对导线的抽象。
在完成 Soc Flash 设备相关实验的时候，对于 SPI 控制器的片选信号以及中断信号的处理都需要处理，我很容易搞混，所以这里单独记录一些思考。

QEMU 的 Soc 实验都是在建模设备，也就是主板总线上的各种外设，CPU 通过总线，用内存地址访问外设。这些外设包括 PWM/UART/SPI/GPIO/WDT。内存地址访问用的总线控制器(MemoryRegion)由QEMU本身实现，但是每一个外设的寄存器接收CPU写入的数据，返回处理完的数据，完成设备功能，这个是建模的主要工作。另一个主要工作就是连线，设备的控制器要注册中断线，连接到模拟的硬件设备时还需要片选线。

在这些设备里边，我觉得最特殊的就是这个 GPIO，你会在 QEMU core 见这个名字，/hw/core/gpio.c。你在建模每个设备的时候还遇到了一个单独的外设：g233_gpio.c
这个就很容易混。每次连一个设备导线都必须通过`qdev_init_gpio_out()`;/`qdev_init_gpio_in(dev, s->in, 32)`完成，这是 qemu core 对导线建模的模块提供的接口，但是每个主板设备的 gpio 设备对应的是 GPIO 控制器的建模，这个 GPIO 控制器是由模拟主板的开发者完成建模的。
注意这里如果提起 GPIO 模块，就要区分是 qemu core 中提供的导线设备模型，还是说建模对象主板上的 GPIO 控制器设备模型。

什么是 GPIO 控制器？不同于 RAM，RAM 只需要存储数据，它的职责就是存储。CPU 对一个内存地址的写入后，如果这个地址对应的是 RAM，就直接数据存储完成功能。但如果地址对应的是一个外设，CPU 认为的内存实际上是一个虚拟的地址空间，是由各个外设的寄存器存储空间以及 RAM 的存储空间拼起来的逻辑视图。这个写入操作（地址 + 数据）首先会被总线控制器根据地址路由到对应的设备，但是设备可能有多个寄存器，需要一个模块去根据地址找到那个对应的寄存器，这个设备就是 GPIO 控制器。

比如：
CPU 执行 STORE 指令，产生内存写操作。GPIO 控制器收到写访问（地址 0x10012004，数据 0x00000001），根据寄存器偏移识别这是写 GPIO_OUT 寄存器，于是改变对应寄存器的引脚状态。

这里的“总线控制器”对应的实际硬件就是地址译码器，在 QEMU 中由 MemoryRegion 系统进行建模。
这里的“GPIO_in/GPIO_out”对应的实际硬件就是引脚与导线，在 QEMU 中由 gpio 系统进行建模。
这里的“GPIO 控制器”对应的实际硬件通常叫 GPIO 块，在 QEMU 中作为单独的设备进行建模，需要根据具体的建模主板定制。

你可以发现，GPIO 控制器很像总线控制器，都是在给数据寻址。总线控制器的寻址单元是设备，GPIO 控制器的寻址单元是寄存器，你去找一下实验的脉络：`board->gpio.basic->gpio.interrupt->pwm->wdt->spi->flash`，这些都是 GPIO 控制器，只是各自对应有不同的通信协议和中断处理/片选方式。

理清了实验的整体脉络，再来看 QEMU 提供的 GPIO 的层次结构，理解这个层次结构能够让建模的编程过程更容易，理解 QEMU core 为我们提供了什么样的工具。

### QEMU GPIO 的层次结构

试想需要为芯片间添加连线，比如说现在做 EDA 布线，连接一根线至少需要这些信息：

- 第一个线端的芯片名字 + 端口
- 第二个线端的芯片名字 + 端口
- 线名称 (ID)
物理设备能够自动检测信号变化进行响应，但是模拟器不行。模拟这个过程，代码还要区分发送端和接收端，发送端发什么电平的信号，接收端收到信号后如何响应 (回调函数)。
所以如果是一个模拟器的函数，至少应该要 6 个参数。

QEMU 怎么处理这个，GPIO 首先分了两种角色：输入/输出

#### 输出 GPIO

设备向外发送信号

```C
qemu_irq irq_output;  // 设备的状态结构中
// 在某个时刻：qemu_set_irq(irq_output, 1);  // 拉高信号
```

#### 输入 GPIO

```C
qemu_irq irq_input = qdev_get_gpio_in(other_dev, "irq");
// 当信号变化时，会触发预先设置的回调
```

`irq`，就是一个通用的信号线，实际上是一个结构体：

```C
/* Generic IRQ/GPIO pin infrastructure. */

typedef struct IRQState {
    Object parent_obj;
    qemu_irq_handler handler;
    void *opaque;
    int n;
} IRQState;

// 设置信号线
void qemu_set_irq(qemu_irq irq, int level);
```

处理最常见的中断线，很多设备自己的业务逻辑需要专用的连线，比如 SPI，那 GPIO 还提供了可以给导线命名的接口：

```C
// 创建命名的GPIO输出
// 设备 A：定义一个名为 "my-irq" 的输出引脚
qemu_irq irq;
qdev_init_gpio_out_named(DEVICE(dev), &irq, "my-irq", 1);
```

- &irq：指向 qemu_irq 变量的指针，用于存储生成的 IRQ 句柄

- 后续其他设备可以通过 qdev_connect_gpio_out_named() 将输出连接到输入

```C
// 设备 B：定义一个名为 "input" 的输入引脚，绑定回调函数
static void my_input_handler(void *opaque, int n, int level)
{
    MyDeviceState *s = opaque;
    // 处理电平变化
    if (level) {
        // 高电平触发的逻辑
    }
}
// 在设备初始化函数中
qdev_init_gpio_in_named(DEVICE(dev), my_input_handler, "input", 1);
```

最后就是怎么指定输入输出的设备 + 端口，QEMU 提供的解决方案就是分开在不同的代码文件中，比如 SysBus 总线：

```C
// g233_spi.c
static void g233_spi_realize(DeviceState *dev, Error **errp)
{
    G233SPIState *s = G233_SPI(dev);
    SysBusDevice *sbd = SYS_BUS_DEVICE(dev);
    
    // 封装：内部调用 qdev_init_gpio_out_named(dev, &s->irq, "sysbus-irq", 1)
    sysbus_init_irq(sbd, &s->irq);
}
```

```C
// g233.c - 创建 SPI 设备并连接中断到中断控制器
sysbus_create_simple(TYPE_G233_SPI,
                     s->memmap[VIRT_SPI].base,  // 基址
                     qdev_get_gpio_in(mmio_irqchip, SPI_IRQ));  // 中断引脚
```

这个中断处理是最常见的应用，但是也会有一点不太好理解，因为`sysbus_init_irq()`/`sysbus_create_simple` 是 SysBus 提供的便捷函数，开发者在这里省去了直接操作 GPIO 接口，但实际上是中断控制器内部注册的回调。`sysbus_create_simple`自动完成了连接和映射，，如果是手动完成：

```C
// 1. 创建设备
DeviceState *dev = qdev_new(TYPE_G233_SPI);
SysBusDevice *sbd = SYS_BUS_DEVICE(dev);

// 2. 手动连接中断
qemu_irq irq = qdev_get_gpio_in(mmio_irqchip, SPI_IRQ);
sysbus_connect_irq(sbd, 0, irq);  // 手动连接

// 3. 映射 MMIO
sysbus_mmio_map(sbd, 0, addr);

// 4. 实例化
qdev_realize(dev, NULL, &error_fatal);
```

再看一个自动 + 手动 GPIO 设置连线的例子就会更明了，比如 SPI 控制器的片选线：
SPI 控制器还是通过`sysbus_create_simple()`创建，自动连接中断，因为这是一个标准 SysBus 设备。

Flash 设备就通过`qdev_new()+qdev_realize()`的方式创建，然后手动连接 CS。(`ssi_realize_and_unref`就是对上边两个接口的封装，被 ssi.h 处理)

```C
// ====== 第1步：创建 SPI 控制器（自动方式） ======
DeviceState *spi_dev = sysbus_create_simple(TYPE_G233_SPI,
        s->memmap[VIRT_SPI].base,              // MMIO 自动映射
        qdev_get_gpio_in(mmio_irqchip, SPI_IRQ)); // 中断自动连接

// sysbus_create_simple 内部自动完成：
// 1. qdev_new(TYPE_G233_SPI)
// 2. sysbus_mmio_map(..., s->memmap[VIRT_SPI].base)  ← MMIO 映射
// 3. sysbus_connect_irq(..., 0, mmio_irqchip 的 SPI_IRQ) ← 中断连接
// 4. qdev_realize()  ← 实例化

// ====== 第2步：获取 SPI 总线 ======
SSIBus *spi_bus = (SSIBus *)qdev_get_child_bus(spi_dev, "spi");
// SPI 控制器在 realize 时创建了名为 "spi" 的子总线

// ====== 第3步：创建 Flash 设备并挂载到 SPI 总线 ======
DeviceState *flash_dev = qdev_new("w25x16");
qdev_prop_set_uint8(flash_dev, "cs", 0);
if (spi_bus) {
    ssi_realize_and_unref(flash_dev, spi_bus, &error_fatal);
}

// ====== 第4步：手动连接 CS（片选）引脚 ======    
qemu_irq flash_cs_in = qdev_get_gpio_in_named(flash_dev, SSI_GPIO_CS, 0);
qdev_connect_gpio_out_named(spi_dev,"cs",0,flash_cs_in);
    
```

#### GPIO 总结

总结可以发现，IRQ 作为中断线，是 GPIO 的一个特例，由 qemu core 的中断控制器模块与 GPIO 提供的接口进行了一个封装，提供了非常简洁的接口。Flash 设备的 SSI 总线则是手动对 GPIO 的一个封装，更能体现具体的实现细节。
也可以发现，这些 API 虽然多，但是离不开三种操作类型：

- 1️⃣ init 系列函数 - **创建** GPIO
- 2️⃣ connect 系列函数 - **连接** GPIO
- 3️⃣ get 系列函数 - **获取** GPIO

创建操作在设备的`realize()`侧完成，由设备本身负责，这样也就自然包含了线端的设备名和端口。连接和获取 GPIO 引用在板级代码完成。每个接口的参数数量在 2-3 个，保持易用性的同时职责分离，这体现了 QEMU 对复杂问题的巧妙抽象。

## 总结

**从“会用 QEMU”到“看懂 QEMU”。**
在 OS 训练营里，QEMU 对我只是一个跑内核的黑盒启动器；做完专业阶段，我才看清黑盒里的层次：QOM 用 C 的结构体和宏拼出了一套面向对象的设备框架，MemoryRegion 把“地址”从一段连续内存变成了由各外设寄存器和 RAM 拼起来的逻辑视图，GPIO/IRQ 则把芯片间的导线抽象成可编程的信号线。这三层合在一起，回答了我一开始最大的疑问——CPU 一条 STORE 指令，到底是怎么“写”进一个外设寄存器的。

**建模一个设备，其实是在回答几个固定的问题。**
走完 `board -> gpio -> interrupt -> pwm -> wdt -> spi -> flash` 这条线，我发现无论外设多复杂，建模的骨架是一样的：状态用结构体存、寄存器用 read/write 回调驱动、中断条件满足就 `qemu_set_irq`、和时间相关的量用“延迟追赶”算、最后在板级把引脚连起来。GPIO 是最纯粹的“寄存器设备”，把它彻底弄懂之后，PWM（多了时间）、WDT（多了倒计时和复位）、SPI（从终端设备变成总线桥接器）都只是在这个骨架上叠加一个新维度。这种“一个范式吃下整条产品线”的感觉，是我在专业阶段最大的收获。

**真正分清了 core 和 board 的分工。**
一开始我老把 `/hw/core/gpio.c` 和 `g233_gpio.c` 混为一谈。后来才理清：前者是 QEMU core 提供给所有人的“导线模型”（init / connect / get 三件套），后者才是针对 G233 这块板子定制的“GPIO 控制器”。core 负责提供面包板和导线，板级开发者负责插芯片、连线。分清这层之后，再看 `sysbus_init_irq`、`qdev_connect_gpio_out` 这些封装就不再绕。

**一点感受。**
做下来最大的体会是，qtest 能手动推进虚拟时钟这一点尤其关键——它把“时间”变成了我可以单步调试的变量，而不是只能干等的真实时间。最后给后来的同学几条建议：

- 先理清 `board -> 设备` 的整条数据通路再动手写代码，否则很容易在连线环节迷失；
- 一定区分清楚 core 的 GPIO 接口和板上的 GPIO 控制器，这是最大的混淆点；
- 卡住的时候去读 QEMU 自带设备（比如 PL011）的实现，框架套路高度一致；
- 善用 AI 辅助，但自己把概念理清（就像这篇记录）的价值，远大于直接让 AI 产出代码。
