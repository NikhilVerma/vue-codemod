import { defineInlineTest } from 'jscodeshift/src/testUtils'
import transform from '../vue2-class-component-to-native-typescript'

defineInlineTest(
  transform,
  {},
  `import { Component } from 'vue-class-component'`,
  `import { defineComponent } from "vue";`,
  'removes vue-class-component'
)

defineInlineTest(
  { default: transform, parser: 'tsx' },
  {},
  `
import Component from 'vue-class-component';
import Vue from 'vue';
import { Prop, Watch } from 'vue-property-decorator';
import TestComponent1 from './TestComponent1/TestComponent1.vue';
import TestComponent2 from './TestComponent2/TestComponent2.vue';
import { ExampleType } from './ExampleType';

@Component({
  components: {
    TestComponent1,
    TestComponent2,
  },
})
export default class TestComponent extends Vue {
  @Prop({ default: true }) example!: ExampleType[];

  @Prop() prop1!: string;

  @Prop({ default: 0 }) prop2!: number;

  @Watch('prop1', { deep: true, immediate: true})
  onProp1Changed() {
    console.log('Example watcher')
  }

  data1 = true;

  get computed1(): boolean {
    return !!this.prop2;
  }

  method1() {
    console.log('Example method')
  }

  created() {
    console.log('created hook')
  }
}
`,
  `import { defineComponent } from "vue";`,
  'xremoves vue-class-component'
)
