# vue-jiai-loader
Jia  AI 分析vue template 里面自定义组件 以及组件路径自动地import组件并且注册，以此可以在书写vue sfc的时候可以省略掉组件引用以及注册，让代码变得更简洁

## 效果

- 普通写法
```html
<template >
  <div>
    <test-com0 />
    <test-com1 />
    <test-com2 />
    <test-com3 /> 
    <test-com4 /> 
    <test-com5 /> 
    <test-com6 /> 
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
```
- 使用jiai写法
```html
<template >
  <div>
    <test-com0 jiai-register='./test-com0' />
    <test-com1 jiai-register='./test-com1' />
    <test-com2 jiai-register='./test-com2' />
    <test-com3 jiai-register='./test-com3' /> 
    <test-com4 jiai-register='./test-com4' /> 
    <test-com5 jiai-register='./test-com5' /> 
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
## 魔法注释 (可选)

- inject `/* jiai-register: inject */`
```html
```

- extend `/* jiai-register: extend */`
```html
```

## 使用限制
- template和script标签必须同时存在并且都不能采用src的方式引用
- template暂时只支持html，不支持pug等


