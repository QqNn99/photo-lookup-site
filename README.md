# 照片名词查询网站

这是一个可部署的小型网站。管理员上传照片并填写对应名词，访问者在首页输入名词后会显示匹配照片。

## 本地运行

```bash
node server.js
```

打开 `http://localhost:3000`。

管理员页面：`http://localhost:3000/admin.html`

默认管理员密码：`admin123`

## 修改管理员密码

启动时设置环境变量：

```bash
ADMIN_PASSWORD=你的密码 node server.js
```

Windows PowerShell：

```powershell
$env:ADMIN_PASSWORD="你的密码"; node server.js
```

## 让所有人都能打开

需要把这个项目部署到一个公网服务器或平台，例如 Render、Railway、Fly.io、VPS 等。

部署时要注意：

- 运行命令：`node server.js`
- 端口：使用平台提供的 `PORT` 环境变量，本项目已支持
- 设置环境变量：`ADMIN_PASSWORD`
- 挂载持久化磁盘后，把环境变量 `STORAGE_DIR` 设为磁盘挂载路径
- 本项目会把数据写到 `$STORAGE_DIR/data/`，把图片写到 `$STORAGE_DIR/uploads/`
