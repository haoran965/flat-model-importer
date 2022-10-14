# Flat Model Importer

## 项目简介
在flat中引入3d模型, 同步相机位置和相机焦点位置, 以及相机的自动旋转.

## 安装部署指南

前置条件：至少需要安装了 `git`、`node 16`、`npm 8`。

1.  在 .env 文件里配置白板房间 UUID 和 Token

    请将本目录下的 .env.example 文件复制一份，重命名为 .env 或 .env.local 后，在里面填写必须的白板配置信息。你可以在 [Netless Workshop](https://workshop.netless.link) 申请专用的白板配置。

2. 执行 `npm install` 安装依赖

3. 执行 `npm start` 进行本地开发

## 技术栈
- typescript
- three.js

## 其他资料
- [Netless App 文档](https://github.com/netless-io/window-manager/blob/master/docs/develop-app.md)
- [THREE.js 文档](https://threejs.org/)