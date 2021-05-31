<template >
  <div>
    <!-- <test-com jiai-register="./test.vue">M</test-com> -->
    <test />
    <test-com1 jiai-register="./test1.vue">M</test-com1>
    <test-com1>M</test-com1>

    <test-com1>M</test-com1>
    <test-com1>M</test-com1>
    <test jiai-register="./test.vue">M</test>
    <test-com1>M</test-com1>
  </div>
</template>

<script>
export default {
  data() {
    return {
      msg: "",
    };
  },
};
</script>

<style module>
.red {
  color: red;
}
</style>

