"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

var path = require("path");

var fs = require("fs");

var SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");

var MultiEntryPlugin = require("webpack/lib/MultiEntryPlugin");
/* eslint import/no-extraneous-dependencies: "off" */


var _require = require("webpack-sources"),
    ConcatSource = _require.ConcatSource;

var replaceExt = require("replace-ext");

var globby = require("globby");

var SingleEntryDependency = require("webpack/lib/dependencies/SingleEntryDependency");

var MultiEntryDependency = require("webpack/lib/dependencies/MultiEntryDependency");

var MultiModuleFactory = require("webpack/lib/MultiModuleFactory");
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
} // https://www.npmjs.com/package/required-path


function requiredPath(pathStr) {
  if (path.isAbsolute(pathStr)) {
    return pathStr;
  } else {
    return "./".concat(pathStr);
  }
}

module.exports = /*#__PURE__*/function () {
  function MinaPlugin() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck2["default"])(this, MinaPlugin);
    // 在make阶段要做的事情集合
    this.makeCbs = []; // 所有入口文件的相对路径的数组集合

    this.entries = []; // 插件配置

    this.options = _objectSpread({
      extensions: [".js"],
      assetsChunkName: "__assets_chunk_name__"
    }, options);
  }

  (0, _createClass2["default"])(MinaPlugin, [{
    key: "apply",
    value: function apply(compiler) {
      var _this = this;

      var assetsChunkName = this.options.assetsChunkName; // 不使用内置的 entryOption 插件

      compiler.hooks.entryOption.tap("MinaPlugin", function () {
        return true;
      }); // 初始化 dep 的 factory 关系、 处理 chunk 相关的东西

      compiler.hooks.compilation.tap("MinaPlugin", function (compilation, param) {
        try {
          var normalModuleFactory = param.normalModuleFactory; // 初始化 dep 的 factory 关系

          _this.initDepFactories(compilation, {
            normalModuleFactory: normalModuleFactory
          }); // splitChunk 会把一些通用依赖从业务代码中抽出来 比如 vendor 等。
          // 在web开发中 这些依赖脚本通过 script 标签注入即可
          // 碍于小程序中没有 script 我们需要在相关业务代码模块中写入 require vendor 文件


          _this.concatDepTemplate(compilation, compilation.mainTemplate);

          _this.concatDepTemplate(compilation, compilation.chunkTemplate); // seal 阶段 处理 template 字符串


          compilation.hooks.beforeChunkAssets.tap("MinaPlugin", function () {
            var assetsChunkIndex = compilation.chunks.findIndex(function (_ref) {
              var name = _ref.name;
              return name === assetsChunkName;
            });

            if (assetsChunkIndex > -1) {
              compilation.chunks.splice(assetsChunkIndex, 1);
            }
          });
        } catch (error) {
          console.error(error);
        }
      }); // 添加模块

      compiler.hooks.make.tapAsync("MinaPlugin", function (compilation, callback) {
        try {
          var doneCount = 0;

          var cb = function cb(err) {
            if (err) {
              callback(err);
            } else {
              doneCount += 1;

              if (doneCount === _this.makeCbs.length) {
                callback(null);
              }
            }
          };

          _this.makeCbs.forEach(function (fn) {
            fn(compilation, cb);
          });
        } catch (error) {
          callback(error);
        }
      }); // run

      compiler.hooks.run.tap("MinaPlugin", function (compiler) {
        _this.handleEntries(compiler);
      }); // watchRun

      compiler.hooks.watchRun.tap("MinaPlugin", function (compiler) {
        _this.handleEntries(compiler);
      });
    }
  }, {
    key: "handleEntries",
    value: function handleEntries(compiler) {
      var _this2 = this;

      try {
        var _this$options = this.options,
            extensions = _this$options.extensions,
            assetsChunkName = _this$options.assetsChunkName;
        var _compiler$options = compiler.options,
            ctx = _compiler$options.context,
            entry = _compiler$options.entry; // 重置

        this.entries = [];
        this.makeCbs = []; // 找到小程序所有的入口文件路径（不带有文件后缀）

        this.analyzeAppJson(ctx, entry); // 为小程序脚本文件按需调用 SingleEntryPlugin 触发 addEntry 动作

        this.entries.forEach(function (item) {
          var curPath = _this2.getFullScriptPath(path.resolve(ctx, item));

          if (curPath) {
            var p = _this2.itemToPlugin(ctx, curPath, item);

            _this2.makeCbs.push(p);
          }
        }); // 为小程序脚本配套的其他后缀类型资源调用 MultiEntryPlugin 触发 addEntry 动作
        // todo: `${resource}.*` 太草率
        // note: https://github.com/mrmlnc/fast-glob#pattern-syntax

        var _patterns = this.entries.map(ensurePosix).map(function (resource) {
          return "".concat(resource, ".*");
        });

        var assetsEntries = globby.sync(_patterns, {
          cwd: ctx,
          nodir: true,
          realpath: true,
          ignore: (0, _toConsumableArray2["default"])(extensions.map(function (ext) {
            return "**/*".concat(ext);
          })),
          dot: false
        });
        var ap = this.itemToPlugin(ctx, assetsEntries.concat((0, _toConsumableArray2["default"])(this.tabBarIcons)).map(function (item) {
          return path.resolve(ctx, item);
        }), assetsChunkName);
        this.makeCbs.push(ap);
      } catch (error) {
        console.error(error);
      }
    }
    /**
     * @param {string} context entry相对于这个目录地址
     * @param {string} entry 入口文件的相对路径 app.js
     */

  }, {
    key: "analyzeAppJson",
    value: function analyzeAppJson(context, entry) {
      var _this3 = this;

      var curEntry = path.resolve(context, entry);
      var curConfig = replaceExt(curEntry, ".json"); // 检查 app.json 配置

      var config = JSON.parse(fs.readFileSync(curConfig, "utf8"));
      var customPages = [];
      var tabBarIcons = new Set();
      var subPackages = config.subpackages || config.subPackages || []; // 遍历+递归收集依赖的组件

      var components = new Set();

      var _iterator = _createForOfIteratorHelper(config.pages),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var _page = _step.value;
          this.getComponentEntries(context, components, path.resolve(context, _page));
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }

      var subPkgs = [];

      var _iterator2 = _createForOfIteratorHelper(subPackages),
          _step2;

      try {
        var _loop = function _loop() {
          var subPkg = _step2.value;
          var root = subPkg.root,
              _subPkg$pages = subPkg.pages,
              pages = _subPkg$pages === void 0 ? [] : _subPkg$pages;
          subPkgs = subPkgs.concat(pages.map(function (w) {
            return path.join(root, w);
          }));
          pages.forEach(function (page) {
            _this3.getComponentEntries(context, components, path.resolve(context, path.join(root, page)));
          });
        };

        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          _loop();
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }

      if (config.tabBar && (0, _typeof2["default"])(config.tabBar) === "object") {
        var tabBarList = config.tabBar.list || [];

        var _iterator3 = _createForOfIteratorHelper(tabBarList),
            _step3;

        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var _step3$value = _step3.value,
                iconPath = _step3$value.iconPath,
                selectedIconPath = _step3$value.selectedIconPath;

            if (iconPath) {
              tabBarIcons.add(iconPath);
            }

            if (selectedIconPath) {
              tabBarIcons.add(selectedIconPath);
            }
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }

        var hasCustomTabBar = config.tabBar.custom;

        if (hasCustomTabBar) {
          customPages.push("custom-tab-bar/index");
        }
      }

      for (var _i = 0, _customPages = customPages; _i < _customPages.length; _i++) {
        var page = _customPages[_i];
        this.getComponentEntries(context, components, path.resolve(context, page));
      }

      this.tabBarIcons = tabBarIcons;
      this.entries = ["app"].concat((0, _toConsumableArray2["default"])(config.pages), (0, _toConsumableArray2["default"])(subPkgs), customPages, (0, _toConsumableArray2["default"])(components));
    }
    /**
     * 递归收集所有相对于 compiler.options.context 的依赖文件的路径
     * @param {string} context
     * @param {Set} curSet
     * @param {string} curPath
     */

  }, {
    key: "getComponentEntries",
    value: function getComponentEntries(context, curSet, curPath) {
      var _JSON$parse = JSON.parse(fs.readFileSync("".concat(curPath, ".json"), "utf8")),
          _JSON$parse$usingComp = _JSON$parse.usingComponents,
          usingComponents = _JSON$parse$usingComp === void 0 ? {} : _JSON$parse$usingComp;

      var curBase = path.dirname(curPath);

      for (var _i2 = 0, _Object$values = Object.values(usingComponents); _i2 < _Object$values.length; _i2++) {
        var val = _Object$values[_i2];

        if (val.indexOf("plugin://") === 0) {
          continue;
        }

        var cpn = val.startsWith("/") ? path.join(context, val) : path.resolve(curBase, val);
        var relativeCpn = path.relative(context, cpn);

        if (!curSet.has(relativeCpn)) {
          curSet.add(relativeCpn);
          this.getComponentEntries(context, curSet, cpn);
        }
      }
    }
  }, {
    key: "initDepFactories",
    value: function initDepFactories(compilation, _ref2) {
      var normalModuleFactory = _ref2.normalModuleFactory;
      // 参考SingleEntryPlugin
      compilation.dependencyFactories.set(SingleEntryDependency, normalModuleFactory); // 参考MultiEntryPlugin

      var multiModuleFactory = new MultiModuleFactory();
      compilation.dependencyFactories.set(MultiEntryDependency, multiModuleFactory);
    }
  }, {
    key: "addSingleEntry",
    value: function addSingleEntry(context, entry, name) {
      return function (compilation, callback) {
        var dep = SingleEntryPlugin.createDependency(entry, name);
        compilation.addEntry(context, dep, name, callback);
      };
    }
  }, {
    key: "addMultiEntry",
    value: function addMultiEntry(context, entries, name) {
      return function (compilation, callback) {
        var dep = MultiEntryPlugin.createDependency(entries, name);
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

  }, {
    key: "itemToPlugin",
    value: function itemToPlugin(context, item, name) {
      if (Array.isArray(item)) {
        return this.addMultiEntry(context, item.map(unifiedSep), name);
      }

      return this.addSingleEntry(context, unifiedSep(item), unifiedSep(name));
    }
  }, {
    key: "getFullScriptPath",
    value: function getFullScriptPath(_path) {
      var extensions = this.options.extensions;

      var _iterator4 = _createForOfIteratorHelper(extensions),
          _step4;

      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var ext = _step4.value;
          var fullPath = _path + ext;

          if (fs.existsSync(fullPath)) {
            return fullPath;
          }
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }

      return "";
    }
  }, {
    key: "isRuntimeExtracted",
    value: function isRuntimeExtracted(compilation) {
      // note: 具体查阅 Chunk.js
      return compilation.chunks.some(function (c) {
        return c.isOnlyInitial() && c.hasRuntime() && !c.hasEntryModule();
      });
    }
  }, {
    key: "concatDepTemplate",
    value: function concatDepTemplate(compilation, tpl) {
      var _this4 = this;

      tpl.hooks.renderWithEntry.tap("MinaPlugin", function (source, curChunk) {
        if (!_this4.isRuntimeExtracted(compilation)) {
          throw new Error(["Please reuse the runtime chunk to avoid duplicate loading of javascript files.", "Simple solution: set `optimization.runtimeChunk` to `{ name: 'runtime.js' }` .", "Detail of `optimization.runtimeChunk`: https://webpack.js.org/configuration/optimization/#optimization-runtimechunk ."].join("\n"));
        } // 不是入口 chunk 直接返回模板内容


        if (!curChunk.hasEntryModule()) {
          return source;
        }

        var dependencies = []; // note: 找到当前 chunk 依赖的其它所有 chunk

        curChunk.groupsIterable.forEach(function (group) {
          group.chunks.forEach(function (chunk) {
            // 始终认为 output.filename 是 chunk.name 来做处理
            var filename = ensurePosix(path.relative(path.dirname(curChunk.name), chunk.name));

            if (chunk === curChunk || ~dependencies.indexOf(filename)) {
              return;
            }

            dependencies.push(filename);
          });
        }); // 在源码前面拼接代码依赖的 chunk

        source = new ConcatSource(";".concat(dependencies.map(function (file) {
          return "require('".concat(requiredPath(file), "');");
        }).join("")), source);
        return source;
      });
    }
  }]);
  return MinaPlugin;
}();