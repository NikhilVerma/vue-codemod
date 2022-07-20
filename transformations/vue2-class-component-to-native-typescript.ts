//@ts-nocheck
import { NodePath } from '@babel/core'
import {
  ArrayExpression,
  arrayExpression,
  arrowFunctionExpression,
  blockStatement,
  booleanLiteral,
  callExpression,
  ClassDeclaration as ClassDeclarationConstructor,
  ClassMethod,
  ClassProperty,
  Decorator,
  exportDefaultDeclaration,
  ExportDefaultDeclaration,
  expressionStatement,
  Identifier,
  identifier,
  ImportDeclaration,
  memberExpression,
  ObjectExpression,
  objectExpression,
  ObjectMethod,
  objectMethod,
  ObjectProperty,
  objectProperty,
  Property,
  property,
  returnStatement,
  spreadElement,
  stringLiteral,
  thisExpression,
  tsAsExpression,
  TSType,
  tsTypeParameterInstantiation,
  tsTypeReference,
  VariableDeclaration,
} from 'jscodeshift'

import type { TSTypeKind } from 'ast-types/gen/kinds'

import type { ASTTransformation, Context } from '../src/wrapAstTransformation'
import wrap from '../src/wrapAstTransformation'
import { transformAST as addImport } from './add-import'

type VueClassProperty = ClassProperty & {
  decorators?: Decorator[]
}

interface ClassDeclaration {
  decorators?: Decorator[]
}
declare module 'ast-types/gen/namedTypes' {
  namespace namedTypes {
    interface ClassProperty {
      decorators?: Decorator[]
    }
  }
}

type VuexMappingItem = { remoteName: string; localName: string }[]

export const transformAST: ASTTransformation = (context: Context) => {
  const componentDecorator = context.root.find(ClassDeclarationConstructor)

  if (componentDecorator.length === 0) {
    return
  }

  removeImports(context)
  classToOptions(context)
}

function removeImports(context: Context) {
  const removableModules = [
    'vue-class-component',
    'vue-property-decorator',
    'vue-mixin-decorator',
    'vuex-class',
    'vue',
    'vuex',
  ]

  const removableImports = context.root.find(
    ImportDeclaration,
    (node: ImportDeclaration) =>
      Boolean(
        node.source?.value &&
          removableModules.includes(String(node.source?.value))
      )
  )

  if (removableImports.length > 0) {
    removableImports.remove()
  }
}

function importModule(name: string, source: string, context: Context) {
  addImport(context, {
    specifier: {
      type: 'named',
      imported: name,
    },
    source: source,
  })
}

const vueHooks = [
  // Vue
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
  // Vue-router
  'beforeRouteEnter',
  'beforeRouteUpdate',
  'beforeRouteLeave',
  // Other
  'render',
]

const supportedDecorators = [
  'Prop',
  'Ref',
  'State',
  'Action',
  'Getter',
  'Mutation',
  'Provide',
  'Inject',
]

const ignoredDecorators = ['Consumer']

function classToOptions(context: Context) {
  const prevDefaultExportDeclaration = context.root.find(
    ExportDefaultDeclaration
  )

  const prevClass = prevDefaultExportDeclaration.find(
    ClassDeclarationConstructor
  )

  let newClassProperties: ObjectExpression['properties'] = []

  if (prevClass.length > 0) {
    ;(prevClass.get(0) as NodePath<ClassDeclaration>).node.decorators?.forEach(
      (d) => {
        if (
          d.expression.type === 'CallExpression' &&
          d.expression.callee.type === 'Identifier' &&
          d.expression.callee.name === 'Component' &&
          d.expression.arguments[0].type === 'ObjectExpression'
        ) {
          newClassProperties = newClassProperties.concat(
            d.expression.arguments[0].properties
          )
        }
      }
    )
  }

  if (
    prevDefaultExportDeclaration.find(ClassMethod, (dec) =>
      Boolean(
        dec.decorators?.[0]?.expression &&
          'callee' in dec.decorators?.[0]?.expression &&
          'name' in dec.decorators?.[0]?.expression.callee &&
          dec.decorators?.[0]?.expression?.callee?.name === 'Emit'
      )
    ).length
  ) {
    throw new Error('@Emit decorator is not supported!')
  }

  const props: Property[] = []
  const data: Property[] = []
  const mixins: string[] = []
  const refs: VueClassProperty[] = []
  const provides: (ClassProperty | ClassMethod)[] = []
  const injects: VueClassProperty[] = []
  let needsPropTypeImport = false

  const vuex = {
    Action: new Map<string, VuexMappingItem>(),
    ActionAlias: new Map<string, VuexMappingItem>(),
    State: new Map<string, VuexMappingItem>(),
    StateAlias: new Map<string, VuexMappingItem>(),
    Getter: new Map<string, VuexMappingItem>(),
    GetterAlias: new Map<string, VuexMappingItem>(),
    Mutation: new Map<string, VuexMappingItem>(),
    MutationAlias: new Map<string, VuexMappingItem>(),
  }

  // We need this object as a reference for vuex accessors (actions/getters/etc) class members decorators
  const vuexNamespaceMap: Record<string, string> = {}

  context.root.find(ClassDeclarationConstructor, (dec) => {
    if (
      dec.superClass?.type === 'CallExpression' &&
      dec.superClass.callee.type === 'Identifier' &&
      dec.superClass.callee.name === 'Mixins' &&
      dec.superClass.arguments[0].type === 'Identifier'
    ) {
      mixins.push(dec.superClass.arguments[0].name)
    }

    return false
  })

  if (context.root.find(VariableDeclaration).length) {
    context.root
      .get(0)
      .node.program.body.filter(
        (item: VariableDeclaration) => item.type === 'VariableDeclaration'
      )
      .forEach((vd: VariableDeclaration) => {
        // We assume there are no multiple declarations like "const a = 1, b = 2" __for vuex namespaces__
        const [declaration] = vd.declarations

        // We're interested in namespace('...') call expressions __only with arguments__
        if (
          declaration.init.type !== 'CallExpression' ||
          !declaration.init.arguments?.[0]?.value ||
          declaration.init.callee.name !== 'namespace'
        )
          return

        vuexNamespaceMap[declaration.id.name] =
          declaration.init.arguments[0].value

        context.root
          .find(
            VariableDeclaration,
            (value) =>
              value.declarations?.[0].init?.callee?.name === 'namespace'
          )
          .remove()
      })
  }

  prevDefaultExportDeclaration.find(ClassProperty).forEach((p) => {
    const prop = p.node

    if (
      prop.decorators &&
      prop.decorators[0] &&
      prop.key.type === 'Identifier'
    ) {
      const firstDecorator = prop.decorators[0]

      let accessorType: string | null = null
      let decoratorName = 'global'

      // @Prop someValue: boolean
      if (firstDecorator.expression.type === 'Identifier') {
        accessorType = firstDecorator.expression.name
        // @Prop({ default: false }) someValue: boolean
      } else if (
        firstDecorator.expression.type === 'CallExpression' &&
        firstDecorator.expression.callee.type === 'Identifier'
      ) {
        accessorType = firstDecorator.expression.callee.name
        // @someModule.Getter('foo') moduleGetterFoo
      } else if (
        firstDecorator.expression.type === 'CallExpression' &&
        firstDecorator.expression.callee.type === 'MemberExpression' &&
        firstDecorator.expression.callee.property.type === 'Identifier'
      ) {
        accessorType = firstDecorator.expression.callee.property.name

        if (firstDecorator.expression.callee.object.type === 'Identifier') {
          decoratorName = firstDecorator.expression.callee.object.name
        }
      }

      const localName = prop.key.name

      const argumentValue =
        firstDecorator.expression.arguments?.[0]?.value || localName

      if (!accessorType) {
        return
      }

      if (!supportedDecorators.includes(accessorType)) {
        // Your decorators to skip
        if (ignoredDecorators.includes(accessorType)) {
          return
        }
        throw new Error(`Decorator ${accessorType} is not supported.`)
      }

      if (accessorType === 'Ref') {
        refs.push(prop)
        return
      } else if (accessorType === 'Provide') {
        provides.push(prop)
        return
      } else if (accessorType === 'Inject') {
        injects.push(prop)
        return
      }

      // Vuex
      const vuexAccessors = ['Action', 'State', 'Getter', 'Mutation']

      if (vuexAccessors.includes(accessorType)) {
        const isAliased = localName !== argumentValue
        const accessor = `${accessorType}${isAliased ? 'Alias' : ''}` as
          | 'Action'
          | 'State'
          | 'Getter'
          | 'Mutation'
          | 'ActionAlias'
          | 'StateAlias'
          | 'GetterAlias'
          | 'MutationAlias'

        if (vuex[accessor]) {
          const existingModule = vuex[accessor].get(decoratorName)
          if (existingModule) {
            existingModule.push({
              remoteName: argumentValue,
              localName,
            })
          } else {
            vuex[accessor].set(decoratorName, [
              {
                remoteName: argumentValue,
                localName,
              },
            ])
          }
        }
      }

      // Prop
      const propDecorator = prop.decorators.find(
        (d) =>
          ('callee' in d.expression &&
            d.expression.callee.type === 'Identifier' &&
            d.expression.callee?.name === 'Prop') ||
          ('name' in d.expression && d.expression.name === 'Prop')
      )

      if (!propDecorator) return

      const decoratorPropArgument =
        propDecorator.expression.type === 'CallExpression'
          ? propDecorator.expression.arguments[0]
          : null

      let requiredProp: ObjectProperty | undefined = undefined
      let type: ArrayExpression | Identifier | null = null

      // @Prop(Boolean)
      if (decoratorPropArgument?.type === 'Identifier') {
        type = identifier(decoratorPropArgument.name)
        // @Prop([Boolean, String])
      } else if (decoratorPropArgument?.type === 'ArrayExpression') {
        type = decoratorPropArgument
        // @Prop({ type: Boolean })
      } else if (decoratorPropArgument?.type === 'ObjectExpression') {
        const typeKind = decoratorPropArgument.properties.find(
          (p) =>
            p.type === 'ObjectProperty' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'type'
        ) as ObjectProperty | undefined

        requiredProp = decoratorPropArgument.properties.find(
          (p) =>
            p.type === 'ObjectProperty' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'required'
        ) as ObjectProperty | undefined

        if (typeKind && typeKind.value.type === 'Identifier') {
          type = identifier(typeKind.value.name)
        }
      }

      const propTsAnnotation = prop.typeAnnotation?.typeAnnotation

      // Explicit type was not found in prop, try to detect it
      if (!type && propTsAnnotation) {
        let primitiveTsType: TSTypeKind | string = propTsAnnotation.type

        if (propTsAnnotation.type === 'TSUnionType') {
          const rawUnionTypes = propTsAnnotation.types
          const rawUnionType = rawUnionTypes[0]

          if (rawUnionType.type === 'TSLiteralType') {
            primitiveTsType = rawUnionType.literal.type
          } else {
            primitiveTsType = rawUnionType.type
          }
        }

        if (
          primitiveTsType === 'TSNumberKeyword' ||
          primitiveTsType === 'NumericLiteral'
        ) {
          type = identifier('Number')
        } else if (
          primitiveTsType === 'TSStringKeyword' ||
          primitiveTsType === 'StringLiteral'
        ) {
          type = identifier('String')
        } else if (
          primitiveTsType === 'TSBooleanKeyword' ||
          primitiveTsType === 'BooleanLiteral'
        ) {
          type = identifier('Boolean')
        } else if (primitiveTsType === 'TSFunctionType') {
          type = identifier('Function')
        } else if (primitiveTsType === 'TSArrayType') {
          type = identifier('Array')
        } else {
          type = identifier('Object')
        }
      }

      let isSimpleIdentifier =
        propTsAnnotation &&
        ['TSNumberKeyword', 'TSStringKeyword', 'TSBooleanKeyword'].includes(
          propTsAnnotation.type
        )

      if (!isSimpleIdentifier) {
        needsPropTypeImport = true
      }

      const isRequired =
        requiredProp && requiredProp.value.type === 'BooleanLiteral'
          ? requiredProp.value.value
          : false

      const propProperties: Property[] = []

      if (type) {
        propProperties.push(
          property(
            'init',
            identifier('type'),
            isSimpleIdentifier || !propTsAnnotation
              ? type
              : tsAsExpression(
                  type,
                  tsTypeReference(
                    identifier('PropType'),
                    tsTypeParameterInstantiation([propTsAnnotation])
                  )
                )
          )
        )
      }

      if (isRequired) {
        propProperties.push(
          property('init', identifier('required'), booleanLiteral(isRequired))
        )
      }

      if (decoratorPropArgument?.type === 'ObjectExpression') {
        const theDefault = decoratorPropArgument.properties?.find(
          (p) =>
            p.type === 'ObjectProperty' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'default'
        )

        const theValidator = decoratorPropArgument.properties?.find(
          (p) =>
            p.type === 'ObjectMethod' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'validator'
        )

        if (theDefault && 'value' in theDefault) {
          propProperties.push(
            property(
              'init',
              identifier('default'),
              arrowFunctionExpression([], theDefault.value)
            )
          )
        }

        if (theValidator) {
          propProperties.push(theValidator)
        }
      }
      const propNode = property(
        'init',
        prop.key,
        objectExpression(propProperties)
      )

      propNode.comments = prop.comments
      props.push(propNode)
    } else if (prop.value) {
      const typeAnnotation = prop.typeAnnotation?.typeAnnotation

      const dataNode = property(
        'init',
        prop.key,
        typeAnnotation ? tsAsExpression(prop.value, typeAnnotation) : prop.value
      )

      dataNode.comments = prop.comments
      data.push(dataNode)
    }
  })

  // Method provides
  prevDefaultExportDeclaration
    .find(ClassMethod, {
      decorators: [
        {
          expression: {
            callee: {
              name: 'Provide',
            },
          },
        },
      ],
    })
    .forEach((c) => {
      provides.push(c.node)
    })

  // Mixins
  if (mixins.length) {
    newClassProperties.push(
      property(
        'init',
        identifier('mixins'),
        arrayExpression(mixins.map((mixin) => identifier(mixin)))
      )
    )
  }

  // Provide
  if (provides.length) {
    const providesArr = Array.from(provides)

    newClassProperties.push(
      objectMethod(
        'method',
        identifier('provide'),
        [],
        blockStatement([
          returnStatement(
            objectExpression(
              providesArr.map((provide) => {
                const provideExpression = provide.decorators?.[0].expression

                if (provideExpression?.type === 'CallExpression') {
                  const args = provideExpression.arguments
                  const firstArg = args[0]

                  return property(
                    'init',
                    firstArg?.type === 'StringLiteral'
                      ? identifier(firstArg.value)
                      : provide.key,
                    memberExpression(thisExpression(), provide.key)
                  )
                }

                console.error('Invalid provide syntax', provide.key)
                throw new Error('Invalid provide syntax')
              })
            )
          ),
        ])
      )
    )

    providesArr.forEach((provide) => {
      if (provide.type === 'ClassProperty' && provide.value) {
        data.push(property('init', provide.key, provide.value))
      }
    })
  }

  // Inject
  if (injects.length) {
    newClassProperties.push(
      property(
        'init',
        identifier('inject'),
        objectExpression(
          Array.from(injects).map((inject) =>
            property('init', inject.key, stringLiteral(inject.key.name))
          )
        )
      )
    )
  }

  // Props
  const hasNameProperty = newClassProperties.some(
    (prop) => 'key' in prop && 'name' in prop.key && prop.key.name === 'name'
  )
  if (prevClass.length > 0 && !hasNameProperty) {
    newClassProperties.push(
      property(
        'init',
        identifier('name'),
        stringLiteral(prevClass.get(0).node.id.name)
      )
    )
  }

  newClassProperties.push(
    ...(props.length
      ? [property('init', identifier('props'), objectExpression(props))]
      : []),
    ...(data.length
      ? [
          property(
            'init',
            identifier('data'),
            arrowFunctionExpression([], objectExpression(data))
          ),
        ]
      : [])
  )

  //@todo - setters don't work
  const computed: any[] = []
  const methods: any[] = []

  // Computed
  vuex.State.forEach((actionArguments, actionName: string) => {
    computed.push(
      spreadElement(
        callExpression(identifier('mapState'), [
          ...(actionName === 'global' ? [] : [stringLiteral(actionName)]),
          arrayExpression(
            actionArguments.map((a) => stringLiteral(a.remoteName))
          ),
        ])
      )
    )
  })

  vuex.StateAlias.forEach((actionArguments, actionName: string) => {
    computed.push(
      spreadElement(
        callExpression(identifier('mapState'), [
          ...(actionName === 'global' ? [] : [stringLiteral(actionName)]),
          objectExpression([
            ...actionArguments.map((arg) =>
              objectProperty(
                identifier(arg.localName),
                stringLiteral(arg.remoteName)
              )
            ),
          ]),
        ])
      )
    )
  })

  vuex.Getter.forEach((actionArguments, actionName: string) => {
    computed.push(
      spreadElement(
        callExpression(identifier('mapGetters'), [
          ...(actionName === 'global' ? [] : [stringLiteral(actionName)]),
          arrayExpression(
            actionArguments.map((a) => stringLiteral(a.remoteName))
          ),
        ])
      )
    )
  })

  vuex.GetterAlias.forEach((actionArguments, actionName: string) => {
    computed.push(
      spreadElement(
        callExpression(identifier('mapGetters'), [
          ...(actionName === 'global' ? [] : [stringLiteral(actionName)]),
          objectExpression([
            ...actionArguments.map((arg) =>
              objectProperty(
                identifier(arg.localName),
                stringLiteral(arg.remoteName)
              )
            ),
          ]),
        ])
      )
    )
  })

  prevDefaultExportDeclaration
    .find(ClassMethod, {
      kind: 'get',
    })
    .forEach((c) => {
      const method = objectMethod('method', c.node.key, [], c.node.body)
      method.async = c.node.async
      method.comments = c.node.comments
      method.returnType = c.node.returnType
      computed.push(method)
    })

  refs.forEach((ref) => {
    let statement: any = memberExpression(
      memberExpression(thisExpression(), identifier('$refs')),
      ref.decorators[0].expression.arguments?.[0]?.value
        ? identifier(ref.decorators[0].expression.arguments?.[0]?.value)
        : ref.key
    )

    if (ref.typeAnnotation) {
      needsPropTypeImport = true
      statement = tsAsExpression(
        statement,
        tsTypeReference(identifier('PropType'))
      )
    }

    const getter = objectMethod(
      'method',
      identifier('get'),
      [],
      blockStatement([returnStatement(statement)])
    )

    const refExpression = property(
      'init',
      ref.key,
      objectExpression([
        property('init', identifier('cache'), booleanLiteral(false)),
        getter,
      ])
    )

    computed.push(refExpression)
  })

  if (computed.length) {
    newClassProperties.push(
      property('init', identifier('computed'), objectExpression(computed))
    )
  }

  // Watch
  const watches: (ObjectProperty | ObjectMethod)[] = []
  prevDefaultExportDeclaration
    .find(ClassMethod, (dec) =>
      Boolean(
        dec.decorators?.[0]?.expression &&
          'callee' in dec.decorators?.[0]?.expression &&
          'name' in dec.decorators?.[0]?.expression.callee &&
          dec.decorators?.[0]?.expression?.callee?.name === 'Watch'
      )
    )
    .map((c) => {
      const watchName = c.node.decorators?.[0].expression.arguments[0].value
      const watchOptions =
        c.node.decorators?.[0].expression.arguments[1]?.properties || []
      const key = watchName.includes('.')
        ? stringLiteral(watchName)
        : identifier(watchName)
      let watch

      // We need a object-style watcher
      if (watchOptions.length) {
        const method = objectMethod(
          'method',
          identifier('handler'),
          c.node.params,
          c.node.body
        )

        method.async = c.node.async
        watch = objectProperty(key, objectExpression([...watchOptions, method]))
      } else {
        watch = objectMethod('method', key, c.node.params, c.node.body)
        watch.async = c.node.async
      }

      watches.push(watch)
    })

  if (watches.length) {
    newClassProperties.push(
      property('init', identifier('watch'), objectExpression(watches))
    )
  }

  // Hooks
  prevDefaultExportDeclaration
    .find(
      ClassMethod,
      (dec) =>
        dec.kind === 'method' && vueHooks.includes((dec.key as Identifier).name)
    )
    .forEach((m) => {
      const method = objectMethod(
        'method',
        m.node.key,
        m.node.params,
        m.node.body
      )

      method.async = m.node.async
      method.comments = m.node.comments
      method.returnType = m.node.returnType
      newClassProperties.push(method)
    })

  // Methods
  vuex.Action.forEach((actionArguments, actionName: string) => {
    if (!vuexNamespaceMap[actionName] && actionName !== 'global') {
      throw new Error(
        `Unknown decorator @${actionName}. Make sure you have "const ${actionName} = namespace('${actionName}'); specified`
      )
    }
    methods.push(
      spreadElement(
        callExpression(identifier('mapActions'), [
          ...(actionName === 'global'
            ? []
            : [stringLiteral(vuexNamespaceMap[actionName])]),
          arrayExpression(
            actionArguments.map((a) => stringLiteral(a.remoteName))
          ),
        ])
      )
    )
  })

  vuex.ActionAlias.forEach((actionArguments, actionName: string) => {
    if (!vuexNamespaceMap[actionName] && actionName !== 'global') {
      throw new Error(
        `Unknown decorator @${actionName}. Make sure you have "const ${actionName} = namespace('${actionName}'); specified`
      )
    }

    methods.push(
      spreadElement(
        callExpression(identifier('mapActions'), [
          ...(actionName === 'global'
            ? []
            : [stringLiteral(vuexNamespaceMap[actionName])]),
          objectExpression([
            ...actionArguments.map((arg) =>
              objectProperty(
                identifier(arg.localName),
                stringLiteral(arg.remoteName)
              )
            ),
          ]),
        ])
      )
    )
  })

  vuex.Mutation.forEach((actionArguments, actionName: string) => {
    methods.push(
      spreadElement(
        callExpression(identifier('mapMutations'), [
          ...(actionName === 'global' ? [] : [stringLiteral(actionName)]),
          arrayExpression(
            actionArguments.map((a) => stringLiteral(a.remoteName))
          ),
        ])
      )
    )
  })

  vuex.MutationAlias.forEach((actionArguments, actionName: string) => {
    methods.push(
      spreadElement(
        callExpression(identifier('mapMutations'), [
          ...(actionName === 'global' ? [] : [stringLiteral(actionName)]),
          objectExpression([
            ...actionArguments.map((arg) =>
              objectProperty(
                identifier(arg.localName),
                stringLiteral(arg.remoteName)
              )
            ),
          ]),
        ])
      )
    )
  })

  prevDefaultExportDeclaration
    .find(ClassMethod, (dec) =>
      Boolean(
        dec.kind === 'method' &&
          'name' in dec.key &&
          dec.key.name &&
          !vueHooks.includes(dec.key.name as string) &&
          ((dec.decorators?.[0]?.expression &&
            'callee' in dec.decorators?.[0]?.expression &&
            'name' in dec.decorators?.[0]?.expression.callee &&
            dec.decorators?.[0]?.expression?.callee?.name !== 'Watch' &&
            dec.decorators?.[0]?.expression?.callee?.name !== 'Emit') ||
            !dec.decorators?.[0]?.expression)
      )
    )
    .forEach((m) => {
      const method = objectMethod(
        'method',
        m.node.key,
        m.node.params,
        m.node.body
      )

      method.async = m.node.async
      method.comments = m.node.comments
      method.typeParameters = m.node.typeParameters
      method.returnType = m.node.returnType
      methods.push(method)
    })

  if (methods.length) {
    newClassProperties.push(
      property('init', identifier('methods'), objectExpression(methods))
    )
  }

  if (vuex.Action.size || vuex.ActionAlias.size) {
    importModule('mapActions', 'vuex', context)
  }

  if (vuex.Getter.size || vuex.GetterAlias.size) {
    importModule('mapGetters', 'vuex', context)
  }

  if (vuex.State.size || vuex.StateAlias.size) {
    importModule('mapState', 'vuex', context)
  }

  if (vuex.Mutation.size || vuex.MutationAlias.size) {
    importModule('mapMutations', 'vuex', context)
  }

  importModule('defineComponent', 'vue', context)

  if (needsPropTypeImport) {
    importModule('PropType', 'vue', context)
  }

  const newDefaultExportDeclaration = exportDefaultDeclaration(
    identifier('default')
  )

  newDefaultExportDeclaration.declaration = expressionStatement(
    callExpression(identifier('defineComponent'), [
      objectExpression(newClassProperties),
    ])
  )

  prevDefaultExportDeclaration.replaceWith(newDefaultExportDeclaration)
}

const vue2TransformAst = wrap(transformAST)

vue2TransformAst.parser = 'tsx'

export default vue2TransformAst

export const parser = 'tsx'
