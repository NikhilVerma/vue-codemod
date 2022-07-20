import { defineSnapshotTest } from 'jscodeshift/src/testUtils'
import transform from '../vue2-class-component-to-native-typescript'
import fs from 'fs'
import path from 'path'

const testComponent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../__testfixtures__/vue2-class-component-to-native-typescript/TestComponent.input.ts'
  ),
  'utf8'
)

defineSnapshotTest(
  transform,
  { parser: 'tsx' },
  testComponent,
  'removes vue-class-component'
)
