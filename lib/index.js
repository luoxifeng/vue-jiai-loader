
const path = require('path')
const hash = require('hash-sum')
const qs = require('querystring')
const loaderUtils = require('loader-utils')
const { parse } = require('@vue/component-compiler-utils')
const htmlparser2 = require('htmlparser2')
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const template = require('@babel/template').default;
const generator = require('@babel/generator').default;

const capitalize = str => {
  str = str.replace(/-(\w)/g, (_, c) => c ? c.toUpperCase() : '')
  return str.charAt(0).toUpperCase() + str.slice(1)
}
const createJiaiComponents = components => template.ast(`const __jiai_inject_components__ = { ${components} }`)
const jiaiRuntimeMerge = template.ast('const __jiai_runtime_merge__ = (t, s) => (t.components = Object.assign(t.components || {}, s), t)');
const jiaiRewriteExport = template.ast('__jiai_runtime_merge__(__jiai_origin_export__, __jiai_inject_components__);')

function loadTemplateCompiler (loaderContext) {
  try {
    return require('vue-template-compiler')
  } catch (e) {
    if (/version mismatch/.test(e.toString())) {
      loaderContext.emitError(e)
    } else {
      loaderContext.emitError(new Error(
        `[vue-loader] vue-template-compiler must be installed as a peer dependency, ` +
        `or a compatible compiler implementation must be passed via options.`
      ))
    }
  }
}

module.exports = function jiaiLoader(source) {
  const loaderContext = this

  const stringifyRequest = r => loaderUtils.stringifyRequest(loaderContext, r)

  const {
    target,
    request,
    minimize,
    sourceMap,
    rootContext,
    resourcePath,
    resourceQuery = ''
  } = loaderContext

  const rawQuery = resourceQuery.slice(1)
  const inheritQuery = `&${rawQuery}`
  const incomingQuery = qs.parse(rawQuery)
  const options = loaderUtils.getOptions(loaderContext) || {}

  if (incomingQuery.type && incomingQuery.type !== 'script') return source

  const isServer = target === 'node'
  const isShadow = !!options.shadowMode
  const isProduction = options.productionMode || minimize || process.env.NODE_ENV === 'production'
  const filename = path.basename(resourcePath)
  const context = rootContext || process.cwd()
  const sourceRoot = path.dirname(path.relative(context, resourcePath))


  const descriptor = parse({
    source,
    compiler: options.compiler || loadTemplateCompiler(loaderContext),
    filename,
    sourceRoot,
    needMap: sourceMap
  })
  const {
    script,
    template,
  } = descriptor

  /**
   * 判断是否启用了jiai
   * 组件内 script 标签上的优先级高于全局
   */
  let enforceUse = false
  let canUse = options.register
  let inner = script.attrs['jiai-register']
  if (inner === 'true' || inner === true) {
    canUse = true
    enforceUse = true
  } else if (inner === 'false' || inner === false) {
    canUse = false
  }

  // 禁用了jiai
  if (!canUse) return source

  /**
   * 虽然启用了jiai, 但是jiai分析代码需要满足特定条件
   * 因为jiai需要结合 template块的内容 和 script块的内容 来分析
   * 所以必须要求 .vue 文件必须同时包含 template 和 script
   * 且这两块的内容不能通过 src 的方式引用文件， 否则无法分析
   * 原因在于通过src引用的文件，不能同时进入jiai-loader, 
   * 且jiai-loader也不能去读取通过src引用的文件
   */

  // 未分块时
  if (!incomingQuery.type) {
    /**
     * 如果 script 配置了 jiai 
     * 就会强制启用 jiai, 此时会对 template 以及 script 进行合法性验证
     * 如果不合法提示错误
     */
    if (enforceUse) {
      if (script.src) {
        return this.callback(new Error('use jiai-loader can not use src in script'), source) 
      }

      if (!template) { // template不存在
        return this.callback(new Error('use jiai-loader must have template'), source)
      }

      if (template.src) { // template 不能存在 src
        return this.callback(new Error('use jiai-loader can not use src in template'), source)
      } 

      if (template.lang) { // template 不能存在 lang
        return this.callback(new Error('use jiai-loader can not use lang in template'), source)
      }
    }
    return source
  }

  const isInvalidTemplate = !template || (template.src || template.lang)
  if (script.src || isInvalidTemplate) return source
  
  /**
   * 运行到这里，已经满足 jiai 运行的条件了
   * 解析 template 内容
   * TODO: 这个地方的逻辑需要重构以支持import 分组 to jia
   * 需要把解析出来的组件名以及引用路径,导入类型组成如下结构
   * {
   *    importType: 'default' or 'inner'
   *    importPath: '../../xxx/index.vue'
   *    componentName: 'FooComponent',
   *    componentGroup: 'xxx' or undefined
   * }
   * 因为要分组，所以需要把解析的组件都处理完以后 才能决定最终生成的代码
   */
  /**
    在解析过程中需要一个映射表 map 
    {
      FooComponent: [
        {
          importType: 'default' or 'inner'
          importPath: '../../xxx/index.vue'
          componentName: 'FooComponent',
          componentGroup: undefined 
        },
        {
          importType: 'default' or 'inner'
          componentName: 'FooComponent',
          componentGroup: undefined 
        },
        ....
      ],
      MooComponet: [...]
    }

    在解析完成之后对map的每一项的得到的注册列表做聚合
    得到 
      importTypes 代表同一个组件出现的注册方式 有且只能是一种 importTypes.length === 1
      importPaths 代表同一个组件出现的引用路径 有且只能是一种 importPaths.length === 1
      componentGroups 代表同一个组件出现的引用路径
    因为同一个组件名代表同一种组件，一种组件的 导入方式 导入路径 从属于的分组只能是一种
    所以如果得到 importType， importPath， componentGroup


   */
  let importCode = ''
  let components = []
  const map = {}
  const htmlParser = new htmlparser2.Parser({
    onopentag(name, attrs) {
      const importPath = attrs['jiai-on']
      if (importPath) {
        if (map[name]) return
        map[name] = true
        const componentName = capitalize(name)
        importCode += `\nimport ${componentName} from '${importPath}'`
        components.push(`${componentName}`)
      }
    },
  })

  htmlParser.write(template.content)
  htmlParser.end()

  /**
   * 如果从 template 里面没有分析出使用了 jiai, 则返回原始内容
   */
  if (!importCode) return source

  
  const componentsCode = components.join(', ')
  // 分析魔法注释是不是合法 如果不合法才会编译代码分析注入
  let content = `${importCode}\n ${script.content}`

  /**
   * parse js code
   * 1. 查找 export default xxx
   * 2. 覆写
   *    const __jiai_origin_export__ = xxx
   *    const __jiai_inject_components__ = { XXXX, YYYY }
   *    const __jiai_runtime_merge__ = (t, s) => (t.components = Object.assign(t.components || {}, s), t)
   * 3. 生成 export default __jiai_runtime_merge__(__jiai_origin_export__, __jiai_inject_components__)
   * 
   */
  const ast = parser.parse(content, { 
    sourceType: 'module'
  })

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const nodeDeclaration = path.node.declaration;
      const jiaiOriginExport = t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier('__jiai_origin_export__'), 
          nodeDeclaration
        )
      ]);
      const jiaiInjectComponents = createJiaiComponents(componentsCode)

      path.insertBefore([
        jiaiOriginExport,
        jiaiInjectComponents,
        jiaiRuntimeMerge
      ])
      path.node.declaration = jiaiRewriteExport 
    }
  })
  content = generator(ast).code;
  
  source = source.slice(0, script.start) + content + source.slice(script.end)

  return source
}

