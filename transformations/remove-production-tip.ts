import wrap from '../src/wrapAstTransformation'
import type { ASTTransformation } from '../src/wrapAstTransformation'

export const transformAST: ASTTransformation = ({ root, j }) => {
  const productionTipAssignment = root.find(
    j.AssignmentExpression,
    (n) =>
      j.MemberExpression.check(n.left) &&
      //@ts-expect-error
      n.left.property.name === 'productionTip' &&
      //@ts-expect-error
      n.left.object.property.name === 'config' &&
      //@ts-expect-error
      n.left.object.object.name === 'Vue'
  )
  productionTipAssignment.remove()
}

export default wrap(transformAST)
export const parser = 'babylon'
