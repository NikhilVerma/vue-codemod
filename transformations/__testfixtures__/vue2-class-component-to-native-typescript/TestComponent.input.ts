//@ts-nocheck
import Component from 'vue-class-component'
import Vue from 'vue'
import { Prop, Watch } from 'vue-property-decorator'
import TestComponent1 from './TestComponent1/TestComponent1.vue'
import TestComponent2 from './TestComponent2/TestComponent2.vue'
import { ExampleType } from './ExampleType'

type ABC = { a: string }
type StrUnion = 'abc' | 'bcd'
type Mode = unknown
type environment = unknown
type project = unknown
type someType = unknown

@Component({
  name: 'MyComponent',
  components: {
    TestComponent1,
    TestComponent2,
  },
})
export default class TestComponent extends Vue {
  // @Prop arrTypeSimpleDecorator?: ExampleType[];
  @Prop arrTypeSimpleDecorator?: ExampleType[]

  // @Prop({ default: undefined }) undefinedDefault?: project;
  @Prop({ default: undefined }) undefinedDefault?: project

  // @Prop({ default: true }) propWithDefault!: ExampleType[];
  @Prop({ default: true }) propWithDefault!: ExampleType[]

  // @Prop() forcedString!: string;
  @Prop() forcedString!: string

  // @Prop({ default: 0 }) numberWithDefault!: number;
  @Prop({ default: 0 }) numberWithDefault!: number

  // @Prop({ required: true }) unionTypeRequired!: someType | null;
  @Prop({ required: true }) unionTypeRequired!: someType | null

  // @Prop({ type: Array, required: true }) arrayTypeRequired!: environment[]
  @Prop({ type: Array, required: true }) arrayTypeRequired!: environment[]

  // @Prop({ required: true }) stringUnionRequired!: "project" | "environment";
  @Prop({ required: true }) stringUnionRequired!: 'project' | 'environment'

  // @Prop({ required: true }) complexUnionRequired!: { b: 6 } | ABC;
  @Prop({ required: true }) complexUnionRequired!: { b: 6 } | ABC

  // @Prop({ required: false, type: String, default: "+ ADD NEW" }) optionalStringWithDefault!: string;
  @Prop({ required: false, type: String, default: '+ ADD NEW' })
  optionalStringWithDefault!: string

  // @Prop({ required: true, type: String }) strUnion!: StrUnion;
  @Prop({ required: true, type: String }) strUnion!: StrUnion

  @Prop({
    type: String,
    default: 'aggressive',
    validator(value: string): boolean {
      return ['aggressive', 'passive'].indexOf(value) !== -1
    },
  })
  readonly validationProp?: Mode

  // @Prop({ required: true, type: Function }) fnProp!: (arg: str) => void;
  @Prop({ required: true, type: Function }) fnProp!: (arg: string) => void

  // @Prop({ required: true, type: Function }) fnProp!: (arg: str) => void;
  @Prop({ required: true }) fnPropDetect!: (arg: string) => void

  @Prop({
    type: String,
    default: 'auto',
    required: false,
  })
  width!: string

  @Watch('prop1', { deep: true, immediate: true })
  onProp1Changed() {
    console.log('Example watcher')
  }

  @Provide() foo = 'foo'
  @Provide('bar') baz = 'bar'

  @Provide('showModal')
  provideMethod(target: string, scopeIds?: string[]) {
    const modal = this.$refs.tableModal as AddVariableModal
    modal.openDialog(target, scopeIds ?? [])
  }

  @Inject() readonly foo!: string
  @Inject('bar') readonly bar!: string
  @Inject({ from: 'optional', default: 'default' }) readonly optional!: string
  @Inject(symbol) readonly baz!: string

  @Inject('showModal')
  readonly injectMethod!: (target: string, ids?: string[]) => void

  @Inject({ from: 'optional', default: 'default' }) readonly optional!: string

  data1 = true

  nullable: string | null = null

  get computed1(): boolean {
    return !!this.prop2
  }

  get someProp(): string {
    return someStore.someValue
  }

  created() {
    console.log('created hook')
  }

  method1(): number {
    console.log('Example method')
  }

  method2(): string {
    console.log('Example method')
  }
}
