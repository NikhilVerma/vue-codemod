import { defineInlineTest, defineSnapshotTest } from 'jscodeshift/src/testUtils'
import transform from '../vue2-class-component-to-native-typescript'

defineInlineTest(
  transform,
  {},
  `import { Component } from 'vue-class-component'`,
  `import { defineComponent } from "vue";`,
  'removes vue-class-component'
)

defineSnapshotTest(
  // { default: transform, parser: 'tsx' },
  transform,
  { parser: 'tsx' },
  `
import Component from 'vue-class-component';
import Vue from 'vue';
import { Prop, Watch } from 'vue-property-decorator';
import TestComponent1 from './TestComponent1/TestComponent1.vue';
import TestComponent2 from './TestComponent2/TestComponent2.vue';
import { ExampleType } from './ExampleType';

type ABC = { a: string };

@Component({
  name: "MyComponent",
  components: {
    TestComponent1,
    TestComponent2,
  },
})
export default class TestComponent extends Vue {
  @Prop example2?: ExampleType[];

  @Prop({ default: undefined }) project?: project;

  @Prop({ default: true }) example!: ExampleType[];

  @Prop() prop1!: string;

  @Prop({ default: 0 }) prop2!: number;

  @Prop({ required: true }) env!: environment | null;

  @Prop({ type: Array, required: true }) arr!: environment[]

  @Prop({ required: true }) assignTo!: "project" | "environment";

  @Prop({ required: true }) assignTo2!: { b: 6} | ABC;

  @Watch('prop1', { deep: true, immediate: true})
  onProp1Changed() {
    console.log('Example watcher')
  }

  data1 = true;

  nullable: string | null = null;

  get computed1(): boolean {
    return !!this.prop2;
  }

  method1() {
    console.log('Example method')
  }

  created() {
    console.log('created hook')
  }

  get someProp(): string {
    return someStore.someValue;
  }
}
`,
  'removes vue-class-component2'
)
