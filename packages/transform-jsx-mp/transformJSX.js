const t = require('@babel/types');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { parserOption } = require('./options');
const isJSXClassDeclaration = require('./isJSXClassDeclaration');
const { parse } = require('./parser');
const { generateElement, generateCodeByExpression } = require('./codegen');

/**
 * Seperate JSX code into parts.
 * @param code {String} JSX Code.
 * @return result {JSXParts}
 */
function transformJSX(code) {
  const ast = babelParser.parse(code, parserOption);
  // TODO: Refactor not to modified ast to remove render method.
  const template = getTemplate(ast);
  const jsCode = getComponentJSCode(ast);
  return {
    template,
    jsCode,
  };
}

/**
 * Get axml template from babel AST.
 * @param ast {ASTElement} Babel AST structure.
 * @return {String} Template in axml format.
 */
function getTemplate(ast) {
  let template = '';
  traverse(ast, {
    ClassDeclaration(classDeclarationPath) {
      if (isJSXClassDeclaration(classDeclarationPath)) {
        const renderPath = getRenderMethod(classDeclarationPath);
        if (renderPath) {
          // Rule restrict: allow one return statement.
          const [, error] = renderPath.node.body.body.filter(s => t.isReturnStatement(s));
          if (error) {
            // TODO: 报错需要带文件和行列信息
            throw Error( 'Only one return is allow in render method.')
          }

          const renderBody = renderPath.get('body');
          const returnElement = findReturnElement(renderBody).node;

          if (t.isJSXElement(returnElement)) {
            const ast = parse(returnElement);
            template = generateElement(ast);
          } else {
            throw new Error('Render method only return JSXElement.')
          }

          // Remove render method path at last.
          renderPath.remove();
        }
      }
    },
  });

  return template;
}

/**
 * Get the render function.
 * @param path {NodePath} A nodePath that contains a render function.
 * @return {NodePath} Path to render function.
 */
function getRenderMethod(path) {
  let renderMethod = null;

  path.traverse({
    /**
     * Example:
     *   class {
     *     render() {}
     *   }
     */
    ClassMethod(classMethodPath) {
      const { node } = classMethodPath;

      if (t.isIdentifier(node.key, { name: 'render' })) {
        renderMethod = classMethodPath;
      }
    },
    /**
     * Example:
     *   class {
     *     render = function() {}
     *     render = () => {}
     *   }
     */
    ClassProperty(path) {
      // TODO: support border cases.
    },
  });

  return renderMethod;
}

/**
 * Find reutrn statement element.
 * @param path {NodePath}
 * @return {NodePath}
 */
function findReturnElement(path) {
  let result = null;
  path.traverse({
    ReturnStatement(returnStatementPath) {
      result = returnStatementPath.get('argument');
    },
  });
  return result;
}

/**
 * Get miniapp component js code from babel AST.
 * @param ast {ASTElement} Babel AST structure.
 * @return {String} Miniapp component js code.
 */
function getComponentJSCode(ast) {
  traverse(ast, {
    /**
     * 1. Add import declaration of helper lib.
     * 2. Rename scope's Component to other id.
     * 3. Add Component call expression.
     */
    Program(path) {
      const importedIdentifier = t.identifier('createComponent');
      const localIdentifier = t.identifier('__create_component__');

      // import { createComponent as __create_component__ } from "/__helpers/component";
      path.node.body.unshift(
        t.importDeclaration(
          [t.importSpecifier(localIdentifier, importedIdentifier)],
          t.stringLiteral('/__helpers/component')
        )
      );

      // Rename Component ref.
      if (path.scope.hasBinding('Component')) {
        path.scope.rename('Component', '_Component');
      }

      // Component(__create_component__(__class_def__));
      path.node.body.push(
        t.expressionStatement(
          t.callExpression(
            t.identifier('Component'),
            [
              t.callExpression(
                t.identifier('__create_component__'),
                [t.identifier('__class_def__')]
              )
            ],
          )
        )
      )
    },

    ExportDefaultDeclaration(path) {
      const declarationPath = path.get('declaration');
      if (isJSXClassDeclaration(declarationPath)) {
        const { id, superClass, body, decorators } = declarationPath.node;
        path.replaceWith(
          t.variableDeclaration('var', [
            t.variableDeclarator(
              t.identifier('__class_def__'),
              t.classExpression(id, superClass, body, decorators)
            )
          ])
        );
      }
    }
  });

  return generateCodeByExpression(ast);
}

module.exports = transformJSX;
