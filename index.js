const path = require("path");
const fs = require("fs");
const SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");
const MultiEntryPlugin = require("webpack/lib/MultiEntryPlugin");
/* eslint import/no-extraneous-dependencies: "off" */
const { ConcatSource } = require("webpack-sources");
const replaceExt = require("replace-ext");
const globby = require("globby");
const SingleEntryDependency = require("webpack/lib/dependencies/SingleEntryDependency");
const MultiEntryDependency = require("webpack/lib/dependencies/MultiEntryDependency");
const MultiModuleFactory = require("webpack/lib/MultiModuleFactory");
/* eslint no-shadow: "off" */

// https://www.npmjs.com/package/ensure-posix-path
function ensurePosix(filepath) {
  if (path.sep !== "/") {
    return filepath.split(path.sep).join("/");
  }
  return filepath;
}

function unifiedSep(filepath) {
  return filepath.replace(/[\\/]/g, path.sep);
}

// https://www.npmjs.com/package/required-path
function requiredPath(pathStr) {
  if (path.isAbsolute(pathStr)) {
    return pathStr;
  } else {
    return `./${pathStr}`;
  }
}

module.exports = class MinaPlugin {
  constructor(options = {}) {
    // 在make阶段要做的事情集合
    this.makeCbs = [];
    // 所有入口文件的相对路径的数组集合
    this.entries = [];
    // 插件配置
    this.options = {
      extensions: [".js"],
      assetsChunkName: "__assets_chunk_name__",
      ...options,
    };
  }

  apply(compiler) {
    const {
      options: { assetsChunkName },
    } = this;

    // 不使用内置的 entryOption 插件
    compiler.hooks.entryOption.tap("MinaPlugin", () => {
      return true;
    });

    // 初始化 dep 的 factory 关系、 处理 chunk 相关的东西
    compiler.hooks.compilation.tap("MinaPlugin", (compilation, param) => {
      try {
        const { normalModuleFactory } = param;
        // 初始化 dep 的 factory 关系
        this.initDepFactories(compilation, { normalModuleFactory });

        // splitChunk 会把一些通用依赖从业务代码中抽出来 比如 vendor 等。
        // 在web开发中 这些依赖脚本通过 script 标签注入即可
        // 碍于小程序中没有 script 我们需要在相关业务代码模块中写入 require vendor 文件
        this.concatDepTemplate(compilation, compilation.mainTemplate);
        this.concatDepTemplate(compilation, compilation.chunkTemplate);

        // seal 阶段 处理 template 字符串
        compilation.hooks.beforeChunkAssets.tap("MinaPlugin", () => {
          const assetsChunkIndex = compilation.chunks.findIndex(
            ({ name }) => name === assetsChunkName
          );

          if (assetsChunkIndex > -1) {
            compilation.chunks.splice(assetsChunkIndex, 1);
          }
        });
      } catch (error) {
        console.error(error);
      }
    });

    // 添加模块
    compiler.hooks.make.tapAsync("MinaPlugin", (compilation, callback) => {
      try {
        let doneCount = 0;
        const cb = (err) => {
          if (err) {
            callback(err);
          } else {
            doneCount += 1;
            if (doneCount === this.makeCbs.length) {
              callback(null);
            }
          }
        };

        this.makeCbs.forEach((fn) => {
          fn(compilation, cb);
        });
      } catch (error) {
        callback(error);
      }
    });

    // run
    compiler.hooks.run.tap("MinaPlugin", (compiler) => {
      this.handleEntries(compiler);
    });

    // watchRun
    compiler.hooks.watchRun.tap("MinaPlugin", (compiler) => {
      this.handleEntries(compiler);
    });
  }

  handleEntries(compiler) {
    try {
      const {
        options: { extensions, assetsChunkName },
      } = this;
      const { context: ctx, entry } = compiler.options;

      // 重置
      this.entries = [];
      this.makeCbs = [];

      // 找到小程序所有的入口文件路径（不带有文件后缀）
      this.analyzeAppJson(ctx, entry);

      // 为小程序脚本文件按需调用 SingleEntryPlugin 触发 addEntry 动作
      this.entries.forEach((item) => {
        const curPath = this.getFullScriptPath(path.resolve(ctx, item));
        if (curPath) {
          const p = this.itemToPlugin(ctx, curPath, item);
          this.makeCbs.push(p);
        }
      });

      // 为小程序脚本配套的其他后缀类型资源调用 MultiEntryPlugin 触发 addEntry 动作
      // todo: `${resource}.*` 太草率
      // note: https://github.com/mrmlnc/fast-glob#pattern-syntax
      const _patterns = this.entries
        .map(ensurePosix)
        .map((resource) => `${resource}.*`);
      const assetsEntries = globby.sync(_patterns, {
        cwd: ctx,
        nodir: true,
        realpath: true,
        ignore: [...extensions.map((ext) => `**/*${ext}`)],
        dot: false,
      });

      const ap = this.itemToPlugin(
        ctx,
        assetsEntries
          .concat([...this.tabBarIcons])
          .map((item) => path.resolve(ctx, item)),
        assetsChunkName
      );
      this.makeCbs.push(ap);
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * @param {string} context entry相对于这个目录地址
   * @param {string} entry 入口文件的相对路径 app.js
   */
  analyzeAppJson(context, entry) {
    const curEntry = path.resolve(context, entry);
    const curConfig = replaceExt(curEntry, ".json");

    // 检查 app.json 配置
    const config = JSON.parse(fs.readFileSync(curConfig, "utf8"));
    const customPages = [];
    const tabBarIcons = new Set();
    const subPackages = config.subpackages || config.subPackages || [];

    // 遍历+递归收集依赖的组件
    const components = new Set();

    for (const page of config.pages) {
      this.getComponentEntries(
        context,
        components,
        path.resolve(context, page)
      );
    }

    let subPkgs = [];
    for (const subPkg of subPackages) {
      const { root, pages = [] } = subPkg;
      subPkgs = subPkgs.concat(pages.map((w) => path.join(root, w)));

      pages.forEach((page) => {
        this.getComponentEntries(
          context,
          components,
          path.resolve(context, path.join(root, page))
        );
      });
    }

    if (config.tabBar && typeof config.tabBar === "object") {
      const tabBarList = config.tabBar.list || [];
      for (const { iconPath, selectedIconPath } of tabBarList) {
        if (iconPath) {
          tabBarIcons.add(iconPath);
        }

        if (selectedIconPath) {
          tabBarIcons.add(selectedIconPath);
        }
      }

      const hasCustomTabBar = config.tabBar.custom;
      if (hasCustomTabBar) {
        customPages.push("custom-tab-bar/index");
      }
    }

    for (const page of customPages) {
      this.getComponentEntries(
        context,
        components,
        path.resolve(context, page)
      );
    }

    this.tabBarIcons = tabBarIcons;
    this.entries = [
      "app",
      ...config.pages,
      ...subPkgs,
      ...customPages, // 目前只有自定义tabbar页面需要用到这个
      ...components,
    ];
  }

  /**
   * 递归收集所有相对于 compiler.options.context 的依赖文件的路径
   * @param {string} context
   * @param {Set} curSet
   * @param {string} curPath
   */
  getComponentEntries(context, curSet, curPath) {
    const { usingComponents = {} } = JSON.parse(
      fs.readFileSync(`${curPath}.json`, "utf8")
    );

    const curBase = path.dirname(curPath);

    for (const val of Object.values(usingComponents)) {
      if (val.indexOf("plugin://") === 0) {
        continue;
      }

      const cpn = val.startsWith("/")
        ? path.join(context, val)
        : path.resolve(curBase, val);
      const relativeCpn = path.relative(context, cpn);

      if (!curSet.has(relativeCpn)) {
        curSet.add(relativeCpn);
        this.getComponentEntries(context, curSet, cpn);
      }
    }
  }

  initDepFactories(compilation, { normalModuleFactory }) {
    // 参考SingleEntryPlugin
    compilation.dependencyFactories.set(
      SingleEntryDependency,
      normalModuleFactory
    );

    // 参考MultiEntryPlugin
    const multiModuleFactory = new MultiModuleFactory();
    compilation.dependencyFactories.set(
      MultiEntryDependency,
      multiModuleFactory
    );
  }

  addSingleEntry(context, entry, name) {
    return (compilation, callback) => {
      const dep = SingleEntryPlugin.createDependency(entry, name);
      compilation.addEntry(context, dep, name, callback);
    };
  }

  addMultiEntry(context, entries, name) {
    return (compilation, callback) => {
      const dep = MultiEntryPlugin.createDependency(entries, name);
      compilation.addEntry(context, dep, name, callback);
    };
  }

  /**
   * 来源 webpack/lib/EntryOptionPlugin.js
   * @param {string} context context path
   * @param {string | string[]} item entry array or single path
   * @param {string} name entry key name
   * @returns {SingleEntryPlugin | MultiEntryPlugin} returns either a single or multi entry plugin
   */
  itemToPlugin(context, item, name) {
    if (Array.isArray(item)) {
      return this.addMultiEntry(context, item.map(unifiedSep), name);
    }
    return this.addSingleEntry(context, unifiedSep(item), unifiedSep(name));
  }

  getFullScriptPath(_path) {
    const {
      options: { extensions },
    } = this;

    for (const ext of extensions) {
      const fullPath = _path + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return "";
  }

  isRuntimeExtracted(compilation) {
    // note: 具体查阅 Chunk.js
    return compilation.chunks.some(
      (c) => c.isOnlyInitial() && c.hasRuntime() && !c.hasEntryModule()
    );
  }

  concatDepTemplate(compilation, tpl) {
    tpl.hooks.renderWithEntry.tap("MinaPlugin", (source, curChunk) => {
      if (!this.isRuntimeExtracted(compilation)) {
        throw new Error(
          [
            "Please reuse the runtime chunk to avoid duplicate loading of javascript files.",
            "Simple solution: set `optimization.runtimeChunk` to `{ name: 'runtime.js' }` .",
            "Detail of `optimization.runtimeChunk`: https://webpack.js.org/configuration/optimization/#optimization-runtimechunk .",
          ].join("\n")
        );
      }

      // 不是入口 chunk 直接返回模板内容
      if (!curChunk.hasEntryModule()) {
        return source;
      }

      const dependencies = [];

      // note: 找到当前 chunk 依赖的其它所有 chunk
      curChunk.groupsIterable.forEach((group) => {
        group.chunks.forEach((chunk) => {
          // 始终认为 output.filename 是 chunk.name 来做处理
          const filename = ensurePosix(
            path.relative(path.dirname(curChunk.name), chunk.name)
          );

          if (chunk === curChunk || ~dependencies.indexOf(filename)) {
            return;
          }

          dependencies.push(filename);
        });
      });

      // 在源码前面拼接代码依赖的 chunk
      source = new ConcatSource(
        `;${dependencies
          .map((file) => `require('${requiredPath(file)}');`)
          .join("")}`,
        source
      );

      return source;
    });
  }
};
