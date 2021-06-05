<template>
  <div>
    <test-com jiai-register="./test.vue">M</test-com>
    <test />
    <test-com1 jiai-register="./test1.vue">M</test-com1>
    <test-com1>M</test-com1>

    <test-com1>M</test-com1>
    <test-com1>M</test-com1>
    <test jiai-register="./test.vue">M</test>
    <test-com1>M</test-com1>
    {{msg}}
  </div>
</template>

<script src='./kk.js' jiai-register="true">
export default {
  data() {
    return {
      msg: "xddx",
    };
  },
};
</script>

<style module>
.red {
  color: red;
}
</style>

