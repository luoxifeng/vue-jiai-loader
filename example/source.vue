<template>
  <div>
    <test-com jiai-on="./test.vue">M</test-com>
    <test />
    <test-com1 jiai="./test1.vue">M</test-com1>
    <test-com1>M</test-com1>

    <test-com1>M</test-com1>
    <test-com1>M</test-com1>
    <test jiai="./test.vue" jiai-aa>M</test>
    <test-com2 jiai-aa>M</test-com2>
    {{msg}}
  </div>
</template>
<!--
jiai-on jiai-in 不能同时出现

jiai-on jiai-in 必须有值

jiai-xxx 分组

-->
<script  >
export default {
  data() {
    return {
      msg: "xddxc12s",
    };
  },
};
</script>

<style module>
.red {
  color: red;
}
</style>

