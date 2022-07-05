import type { JSCodeshift, Transform, Core, Options } from 'jscodeshift'

export type Context = {
  root: ReturnType<Core>
  j: JSCodeshift
  filename: string
}

export type ASTTransformation = {
  (context: Context, params?: Options): void
}

export default function astTransformationToJSCodeshiftModule(transformAST: ASTTransformation): Transform {
  const transform: Transform = (file, api, options: Options) => {
    const j = api.jscodeshift
    const root = j(file.source)

    transformAST({ root, j, filename: file.path }, options)

    return root.toSource({ lineTerminator: '\n' })
  }

  return transform
}
