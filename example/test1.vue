<template>
  <div>{{ msg }}</div>
</template>

<script>
export default {
  /* jiai-register: inject */
  data() {
    return {
      msg: "test-comp-1-dddd"
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

