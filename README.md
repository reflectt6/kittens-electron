# 猫国建造者 桌面版

本项目是对网页游戏 [Kittens Game](https://kittensgame.com/)（作者 bloodrizer）的逆向分析与 Electron 桌面移植，旨在**技术交流与学习**。

桌面版增加了**本地文件存档**功能，存档保存在电脑本地，无需担心浏览器缓存清理导致数据丢失。

> ⚠️ **声明**
>
> 原版游戏已在 [Steam](https://store.steampowered.com/app/1097410/Kittens_Game/) 上架，请支持正版。
>
> 本项目仅用于 **技术交流与学习**，请勿用于商业用途。

## 下载与运行

在 [Releases](https://github.com/reflectt6/kittens-electron/releases) 页面下载最新的 `KittensGame-x.x.x.exe`，双击运行即可，无需安装。

## 基本操作

| 操作 | 方式 |
|---|---|
| 存档 | 菜单栏 **Game → Save**，或快捷键 `Ctrl+S` |
| 导出存档 | 菜单栏 **Game → Export**，或快捷键 `Ctrl+E` |
| 导入存档 | 菜单栏 **Game → Import**，或快捷键 `Ctrl+I` |
| 重置游戏 | 菜单栏 **Game → Reset** |
| 打开存档文件夹 | 菜单栏 **Help → Open Saves Folder** |

也可以在游戏界面顶部的链接栏直接点击 **Save**、**Restore**、**Export**、**Import** 等按钮。

关闭窗口时会弹出确认对话框，可选择 **Save & Quit** 在退出前自动存档。

## 存档位置

存档文件存放在：

```
%APPDATA%\kittens-game\saves\
```

每次存档会生成一个带时间戳的文件（如 `save_20260531_143022.txt`），同时保留一份 `latest.txt` 作为最新存档的副本。点击游戏界面的 **Restore** 可以从 `latest.txt` 恢复。

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式
npm start

# 打包为便携版 exe
npm run build
```

## 致谢

- 原作者 [bloodrizer](https://kittensgame.com/) 创造了这款精彩的游戏
- 感谢 Kittens Game 社区的所有反馈和测试
