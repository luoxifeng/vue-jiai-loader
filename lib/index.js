
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
const __JIAI_REGISTER_INJECT__ = '/* jiai-register: inject */'
const __JIAI_REGISTER_EXTEND__ = '/* jiai-register: extend */'
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
  } = descriptor

  const hasTemplate = descriptor.template
  const srcInTemplate = hasTemplate && descriptor.template.src
  const langInTemplate = hasTemplate && descriptor.template.lang
  const hasScript = descriptor.script
  const srcInScript = hasScript && descriptor.script.src

  let canUse = (
    options.register ||
    hasTemplate && descriptor.template.attrs['jiai-register'] !== 'false'
  )
  // option jiai-register
  if (canUse) {
    if (!incomingQuery.type) {
      if (srcInTemplate) {
        loaderContext.emitWarning(new Error('use jiai-loader can not use src in template'))
        return source
      }
  
      if (langInTemplate) {
        loaderContext.emitWarning(new Error('use jiai-loader can not use lang in template'))
        return source
      }
  
      if (!hasScript) {
        loaderContext.emitWarning(new Error('use jiai-loader must have template and script both'))
        return source
      }

      if (srcInScript) {
        loaderContext.emitWarning(new Error('use jiai-loader can not use lang in script'))
        return source
      }
    }
  }

  if (!incomingQuery.type) return source

  canUse = canUse && (
    incomingQuery.type === 'script' &&
    !srcInTemplate &&
    !langInTemplate &&
    hasScript &&
    !srcInScript
  )

  if (!canUse) return source

  let importCode = ''
  let components = []
  const htmlParser = new htmlparser2.Parser({
    onopentag(name, attrs) {
      const importPath = attrs['jiai-register']
      if (importPath) {
        const componentName = capitalize(name)
        importCode += `\nimport ${componentName} from '${importPath}'`
        components.push(`${componentName}`)
      }
    },
  })

  htmlParser.write(descriptor.template.content)
  htmlParser.end()
  
  if (importCode) {
    const componentsCode = components.join(', ')
    // 分析魔法注释是不是合法 如果不合法才会编译代码分析注入
    let isInjectCommentValid = false
    let isExtendCommentValid = false

    // let fastMode = false
    let content = `${importCode}\n ${script.content}`

    if (content.includes(__JIAI_REGISTER_EXTEND__)) {
      isInjectCommentValid = true
      content = content.replace(__JIAI_REGISTER_EXTEND__, componentsCode)
    }

    if (content.includes(__JIAI_REGISTER_INJECT__)) {
      isExtendCommentValid = true
      content = content.replace(__JIAI_REGISTER_INJECT__, `components: { ${ccomponentsCode} },`)
    }

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
    if (!isInjectCommentValid && !isExtendCommentValid) {
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
    }
   
    source = source.slice(0, script.start) + content + source.slice(script.end)
  }

  return source
}




