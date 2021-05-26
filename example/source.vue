<template>
  <div>
    <test-com jiai-register="./test.vue">M</test-com>
    <test-com1 jiai-register="./test1.vue">M</test-com1>
  </div>
</template>

<script>
export default {
  
  data() {
    return {
      msg: "fesdff111dddsddssddffgc"
    };
  },
  components: {
    // /* jiai-register: extend */
  },
  /* jiai-register: inject */
};
</script>

<style module>
.red {
  color: red;
}
</style>

