import { defineSnapshotTest } from 'jscodeshift/src/testUtils'
import transform from '../vue2-class-component-to-native-typescript'

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
  // @Prop arrTypeSimpleDecorator?: ExampleType[];
  @Prop arrTypeSimpleDecorator?: ExampleType[];

  // @Prop({ default: undefined }) undefinedDefault?: project;
  @Prop({ default: undefined }) undefinedDefault?: project;

  // @Prop({ default: true }) propWithDefault!: ExampleType[];
  @Prop({ default: true }) propWithDefault!: ExampleType[];

  // @Prop() forcedString!: string;
  @Prop() forcedString!: string;

  // @Prop({ default: 0 }) numberWithDefault!: number;
  @Prop({ default: 0 }) numberWithDefault!: number;

  // @Prop({ required: true }) unionTypeRequired!: someType | null;
  @Prop({ required: true }) unionTypeRequired!: someType | null;

  // @Prop({ type: Array, required: true }) arrayTypeRequired!: environment[]
  @Prop({ type: Array, required: true }) arrayTypeRequired!: environment[]

  // @Prop({ required: true }) stringUnionRequired!: "project" | "environment";
  @Prop({ required: true }) stringUnionRequired!: "project" | "environment";

  // @Prop({ required: true }) complexUnionRequired!: { b: 6 } | ABC;
  @Prop({ required: true }) complexUnionRequired!: { b: 6 } | ABC;

  // @Prop({ required: false, type: String, default: "+ ADD NEW" }) optionalStringWithDefault!: string;
  @Prop({ required: false, type: String, default: "+ ADD NEW" }) optionalStringWithDefault!: string;

	@Prop({
		type: String,
		default: "aggressive",
		validator(value: string): boolean {
			return ["aggressive", "passive"].indexOf(value) !== -1;
		}
	})
	readonly validationProp?: Mode;

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
  'removes vue-class-component'
)
