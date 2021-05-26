<template>
  <div>{{ msg }}</div>
</template>

<script>
export default {
  /* jiai-register: inject */
  data() {
    return {
      msg: "test-compd1d"
    };
  },
  components: {
    /* jiai-register: extend */
  }
};
</script>

<style module>
.red {
  color: red;
}
</style>

