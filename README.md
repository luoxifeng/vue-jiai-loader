# vue-jiai-loader
Jia  AI 分析vue template 里面自定义组件 以及组件路径自动地import组件并且注册，以此可以在书写vue sfc的时候可以省略掉组件引用以及注册，让代码变得更简洁

## 使用对比

- 默认导入
```html
<!-- 普通写法 -->
<template >
  <div>
    <test-com0 />
    <test-com1 />
    <test-com2 />
    <test-com3 /> 
    <test-com4 /> 
    <test-com5 /> 
  </div>
</template>

<script>
import TestCom0 from './test-com0';
import TestCom1 from './test-com1';
import TestCom2 from './test-com2';
import TestCom3 from './test-com3';
import TestCom4 from './test-com4';
import TestCom5 from './test-com5';

export default {
  components: {
    TestCom0,
    TestCom1,
    TestCom2,
    TestCom3,
    TestCom4,
    TestCom5,
  },
  data() {
    return {
    };
  },
};
</script>

<!-- jiai写法 -->
<template >
  <div>
    <test-com0 jiai-on='./test-com0' />
    <test-com1 jiai-on='./test-com1' />
    <test-com2 jiai-on='./test-com2' />
    <test-com3 jiai-on='./test-com3' /> 
    <test-com4 jiai-on='./test-com4' /> 
    <test-com5 jiai-on='./test-com5' /> 
    <test-com0 /> <!-- 同名组件只需要注册一次 -->
  </div>
</template>

<script>
export default {
  data() {
    return {
    };
  },
};
</script>
```

- 混合导入
```html
<!-- 普通写法 -->
<template >
  <div>
    <test-com0 />
    <test-com1 />
    <test-com2 />
    <test-com3 /> 
    <test-com4 /> 
    <test-com5 /> 
  </div>
</template>

<script>
import TestCom0, {
  TestCom1,
  TestCom2,
  TestCom3,
  TestCom4,
  TestCom5,
} from './test-com';

export default {
  components: {
    TestCom0,
    TestCom1,
    TestCom2,
    TestCom3,
    TestCom4,
    TestCom5,
  },
  data() {
    return {
    };
  },
};
</script>

<!-- jiai写法 -->
<template >
  <div>
    <test-com0 jiai-xxx jiai-on='./test-com'/>
    <test-com1 jiai-xxx />
    <test-com2 jiai-xxx />
    <test-com3 jiai-xxx /> 
    <test-com4 jiai-xxx /> 
    <test-com5 jiai-xxx /> 
  </div>
</template>

<script>
export default {
  data() {
    return {
    };
  },
};
</script>
```

## webpack配置

```js
module.exports = {
  // ... some config
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: [
          'vue-loader', 
          {
            loader: 'vue-jiai-loader',
            options: {
              register: true,
            }
          }
        ]
      },
    }
  },
  // ... some config
}
```

## 原理


## 用法

- `jiai-on` 被解析成默认导入  
原始代码
```html
<template >
  <div>
    <test-com0 jiai-on='./test-com0' />
    <test-com1 jiai-on='./test-com1' />
    <test-com0 />
  </div>
</template>

<script>
export default {
  data() {
    return {
    };
  },
};
</script>
```
被jiai处理后
```html
<template >
  <div>
    <test-com0 jiai-on='./test-com0' />
    <test-com1 jiai-on='./test-com1' />
    <test-com0 />
  </div>
</template>

<script>
import TestCom0 from './test-com0'
import TestCom1 from './test-com1'

const __jiai_orign_export__ = {
  data() {
    return {
    };
  },
};
const __jiai_inject_components__ = { TestCom0, TestCom1 };
const __jiai_runtime_merge__ = (t, s) => (t.components = Object.assign(t.components || {}, s), t)
export default __jiai_runtime_merge__(__jiai_origin_export__, __jiai_inject_components__);
</script>
```


- jiai-in (待实现)
> 被解析成结构导入
```html
```

- jiai-xxx (待实现)
> 被解析成使用相同分组的导入
```html
```

## 注意
- 同名的组件只需要注册一次，后面出现的注册会被忽略
```html
<template >
  <div>
    <test-com0 jiai-on='./test-com0' />
    <test-com1 jiai-on='./test-com1' />
    <test-com0 jiai-on='./test-com2' />
  </div>
</template>

<script>
export default {
  data() {
    return {
    };
  },
};
</script>
```
上面的例子会被处理成

```html
<template >
  <div>
    <test-com0 jiai-on='./test-com0' />
    <test-com1 jiai-in='./test-com1' />
    <test-com0 jiai-on='./test-com2' /> <!-- 这里的注册会被忽略，尽管注册的地址不一样 -->
  </div>
</template>

<script>
import TestCom0 from './test-com0'
import { TestCom1 } from './test-com1'

const __jiai_orign_export__ = {
  data() {
    return {
    };
  },
};
const __jiai_inject_components__ = { TestCom0, TestCom1 };
const __jiai_runtime_merge__ = (t, s) => (t.components = Object.assign(t.components || {}, s), t)
export default __jiai_runtime_merge__(__jiai_origin_export__, __jiai_inject_components__);
</script>
```
从上面的处理结果来看，如果同名的组件注册多次，只会取第一次出现的注册，后面的注册（不管注册的地址是不是一样的）会被忽略，`同名的组件就是一个组件`


## 使用限制
- script 标签上启用jiai代表强制模式，不满足条件会报错
- template和script标签必须同时存在并且都不能采用src的方式引用
> 如果非强制模式，不满足条件会不处理，如果处于强制模式下，如果存在不满足条件下会报错
- template暂时只支持html，不支持pug等



