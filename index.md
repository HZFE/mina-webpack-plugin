# mina-webpack-plugin

## 使用 webpack 开发原生小程序的优势

1. 比使用小程序开发者工具自带编译功能或使用 gulp，用 webpack 进行小程序开发更靠近 web 开发的体验，webpack 社区庞大，解决方案更多。
   - 正常使用 npm 包；
   - tree shaking；
   - 使用 webpack loader / plugin；
   - alias。
2. 如果你没有一份代码支持多端的需求，那么相比使用各大小程序框架，使用 webpack 开发原生小程序：
   - 不用担心框架不再维护；
   - 不用学习不同框架的各类语法糖；
   - 不用在踩小程序坑的基础上还要踩框架的坑。

## mina-webpack-plugin 介绍

### 作用

1. 读取 app.json 配置自动收集所有入口模块；
2. 配合 splitChunk 把通用依赖自动引入进文件中；

### 使用方法

```bash
npm i @hzfe/mina-webpack-plugin --save-dev
```

```js
{
  plugins: [
    /**
     * 可以传一个对象参数
     * options = {
     *   extensions: [".js"], // defalt
     *   assetsChunkName: "__assets_chunk_name__", // default
     * }
     **/
    new MinaPlugin(),
  ];
}
```

## 相关项目

- [小程序 webpack 开发模板](https://github.com/HZFE/mina-boilerplate)
- [wxml-loader](https://github.com/HZFE/wxml-loader)

## License

[MIT](./LICENSE)
