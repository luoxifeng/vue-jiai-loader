
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
   * ?????????????????????jiai
   * ????????? script ?????????????????????????????????
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

  // ?????????jiai
  if (!canUse) return source

  /**
   * ???????????????jiai, ??????jiai????????????????????????????????????
   * ??????jiai???????????? template???????????? ??? script???????????? ?????????
   * ?????????????????? .vue ???????????????????????? template ??? script
   * ????????????????????????????????? src ???????????????????????? ??????????????????
   * ??????????????????src????????????????????????????????????jiai-loader, 
   * ???jiai-loader????????????????????????src???????????????
   */

  // ????????????
  if (!incomingQuery.type) {
    /**
     * ?????? script ????????? jiai 
     * ?????????????????? jiai, ???????????? template ?????? script ?????????????????????
     * ???????????????????????????
     */
    if (enforceUse) {
      if (script.src) {
        return this.callback(new Error('use jiai-loader can not use src in script'), source) 
      }

      if (!template) { // template?????????
        return this.callback(new Error('use jiai-loader must have template'), source)
      }

      if (template.src) { // template ???????????? src
        return this.callback(new Error('use jiai-loader can not use src in template'), source)
      } 

      if (template.lang) { // template ???????????? lang
        return this.callback(new Error('use jiai-loader can not use lang in template'), source)
      }
    }
    return source
  }

  const isInvalidTemplate = !template || (template.src || template.lang)
  if (script.src || isInvalidTemplate) return source
  
  /**
   * ?????????????????????????????? jiai ??????????????????
   * ?????? template ??????
   * TODO: ??????????????????????????????????????????import ?????? to jia
   * ???????????????????????????????????????????????????,??????????????????????????????
   * {
   *    importType: 'default' or 'inner'
   *    importPath: '../../xxx/index.vue'
   *    componentName: 'FooComponent',
   *    componentGroup: 'xxx' or undefined
   * }
   * ?????????????????????????????????????????????????????????????????? ?????????????????????????????????
   */
  /**
    ??????????????????????????????????????? map 
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

    ????????????????????????map?????????????????????????????????????????????
    ?????? 
      importTypes ?????????????????????????????????????????? ????????????????????? importTypes.length === 1
      importPaths ?????????????????????????????????????????? ????????????????????? importPaths.length === 1
      componentGroups ??????????????????????????????????????????
    ??????????????????????????????????????????????????????????????? ???????????? ???????????? ?????????????????????????????????
    ?????????????????? importType??? importPath??? componentGroup


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
   * ????????? template ?????????????????????????????? jiai, ?????????????????????
   */
  if (!importCode) return source

  
  const componentsCode = components.join(', ')
  // ????????????????????????????????? ?????????????????????????????????????????????
  let content = `${importCode}\n ${script.content}`

  /**
   * parse js code
   * 1. ?????? export default xxx
   * 2. ??????
   *    const __jiai_origin_export__ = xxx
   *    const __jiai_inject_components__ = { XXXX, YYYY }
   *    const __jiai_runtime_merge__ = (t, s) => (t.components = Object.assign(t.components || {}, s), t)
   * 3. ?????? export default __jiai_runtime_merge__(__jiai_origin_export__, __jiai_inject_components__)
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

