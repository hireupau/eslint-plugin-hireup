/**
 * Rule for flagging usage of global sails-methods
 * 
 * Based on https://github.com/eslint/eslint/blob/master/lib/rules/no-console.js
 * 
 */

//------------------------------------------------------------------------------
// Rule Definitions
//------------------------------------------------------------------------------

module.exports = {
  rules: {
    "no-sails": {
      meta: {
        docs: {
          description: "No global sails",
          category: "Sink sails",
          recommended: true
        },
        schema: [
          {
            type: "object",
            properties: {
              allow: {
                type: "array",
                items: {
                  type: "string"
                },
                minItems: 1,
                uniqueItems: true
              }
            },
            additionalProperties: false
          }
        ],
        messages: {
          unexpected: "Unexpected sails.{{propertyName}}"
        }
      },
      create(context) {
        const options = context.options[0] || {};
        const allowed = options.allow || [];

        /**
         * Checks whether the given reference is 'console' or not.
         *
         * @param {eslint-scope.Reference} reference - The reference to check.
         * @returns {boolean} `true` if the reference is 'sails'.
         */
        function isSails(reference) {
          const id = reference.identifier;

          return id && id.name === "sails";
        }

        /**
         * Checks whether the property name of the given MemberExpression node
         * is allowed by options or not.
         *
         * @param {ASTNode} node - The MemberExpression node to check.
         * @returns {boolean} `true` if the property name of the node is allowed.
         */
        function isAllowed(node) {
          const propertyName = getStaticPropertyName(node);

          return propertyName && allowed.indexOf(propertyName) !== -1;
        }

        /**
         * Checks whether the given reference is a member access which is not
         * allowed by options or not.
         *
         * @param {eslint-scope.Reference} reference - The reference to check.
         * @returns {boolean} `true` if the reference is a member access which
         *      is not allowed by options.
         */
        function isMemberAccessExceptAllowed(reference) {
          const node = reference.identifier;
          const parent = node.parent;

          return (
            parent.type === "MemberExpression" &&
            parent.object === node &&
            !isAllowed(parent)
          );
        }

        /**
         * Reports the given reference as a violation.
         *
         * @param {eslint-scope.Reference} reference - The reference to report.
         * @returns {void}
         */
        function report(reference) {
          const node = reference.identifier.parent;
          const propertyName = getStaticPropertyName(node);

          context.report({
            node,
            loc: node.loc,
            messageId: "unexpected",
            data: { propertyName }
          });
        }

        return {
          "Program:exit"() {
            const scope = context.getScope();
            const consoleVar = getVariableByName(scope, "sails");
            const shadowed = consoleVar && consoleVar.defs.length > 0;

            /*
                 * 'scope.through' includes all references to undefined
                 * variables. If the variable 'console' is not defined, it uses
                 * 'scope.through'.
                 */
            const references = consoleVar
              ? consoleVar.references
              : scope.through.filter(isSails);

            if (!shadowed) {
              references.filter(isMemberAccessExceptAllowed).forEach(report);
            }
          }
        };
      }
    }
  }
};

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Gets the property name of a given node.
 * The node can be a MemberExpression, a Property, or a MethodDefinition.
 *
 * If the name is dynamic, this returns `null`.
 *
 * For examples:
 *
 *     a.b           // => "b"
 *     a["b"]        // => "b"
 *     a['b']        // => "b"
 *     a[`b`]        // => "b"
 *     a[100]        // => "100"
 *     a[b]          // => null
 *     a["a" + "b"]  // => null
 *     a[tag`b`]     // => null
 *     a[`${b}`]     // => null
 *
 *     let a = {b: 1}            // => "b"
 *     let a = {["b"]: 1}        // => "b"
 *     let a = {['b']: 1}        // => "b"
 *     let a = {[`b`]: 1}        // => "b"
 *     let a = {[100]: 1}        // => "100"
 *     let a = {[b]: 1}          // => null
 *     let a = {["a" + "b"]: 1}  // => null
 *     let a = {[tag`b`]: 1}     // => null
 *     let a = {[`${b}`]: 1}     // => null
 *
 * @param {ASTNode} node - The node to get.
 * @returns {string|null} The property name if static. Otherwise, null.
 */
function getStaticPropertyName(node) {
  let prop;

  switch (node && node.type) {
    case "Property":
    case "MethodDefinition":
      prop = node.key;
      break;

    case "MemberExpression":
      prop = node.property;
      break;
  }

  switch (prop && prop.type) {
    case "Literal":
      return String(prop.value);

    case "TemplateLiteral":
      if (prop.expressions.length === 0 && prop.quasis.length === 1) {
        return prop.quasis[0].value.cooked;
      }
      break;

    case "Identifier":
      if (!node.computed) {
        return prop.name;
      }
      break;
  }

  return null;
}

/**
 * Finds the variable by a given name in a given scope and its upper scopes.
 *
 * @param {eslint-scope.Scope} initScope - A scope to start find.
 * @param {string} name - A variable name to find.
 * @returns {eslint-scope.Variable|null} A found variable or `null`.
 */
function getVariableByName(initScope, name) {
  let scope = initScope;

  while (scope) {
    const variable = scope.set.get(name);

    if (variable) {
      return variable;
    }

    scope = scope.upper;
  }

  return null;
}
