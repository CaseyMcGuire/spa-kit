import type { Rule } from "eslint";

// ESLint's core node types describe JavaScript. These are the additional fields
// used from the TypeScript ESTree parser; no type-checker services are needed.
type TypeScriptNode = Rule.Node & {
  expression?: Rule.Node;
  typeAnnotation?: unknown;
};

const wrappers = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSTypeAssertion", "TSNonNullExpression"]);

function unwrap(node: Rule.Node): Rule.Node {
  let current = node as TypeScriptNode;
  while (wrappers.has(current.type) && current.expression) {
    current = current.expression as TypeScriptNode;
  }
  return current;
}

function propertyName(node: Rule.Node, computed: boolean): string | undefined {
  if (!computed && node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  return undefined;
}

/** Require explicit generated context annotations on route preload inputs. */
export const requirePreloadContext: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require an explicit parameter type on route preloads to preserve render inference",
    },
    schema: [],
    messages: {
      missingContext: "Annotate the preload parameter with its generated route context type to preserve render inference.",
    },
  },
  create(context) {
    const source = context.sourceCode;
    const reported = new Set<Rule.Node>();

    function variableFor(node: Rule.Node) {
      if (node.type !== "Identifier") {
        return undefined;
      }
      let scope: ReturnType<typeof source.getScope> | null = source.getScope(node);
      while (scope) {
        const variable = scope.set.get(node.name);
        if (variable) {
          return variable;
        }
        scope = scope.upper;
      }
      return undefined;
    }

    // Follow immutable bindings in this file only. Imported values, mutable
    // bindings, and dynamically constructed configurations are intentionally opaque.
    function resolve(node: Rule.Node, seen = new Set<Rule.Node>()): Rule.Node {
      const value = unwrap(node);
      if (seen.has(value) || value.type !== "Identifier") {
        return value;
      }
      seen.add(value);
      const variable = variableFor(value);
      const definition = variable?.defs[0];
      if (definition?.type === "FunctionName" && definition.node.type === "FunctionDeclaration") {
        return definition.node as Rule.Node;
      }
      if (definition?.type === "Variable" && definition.parent?.kind === "const" && definition.node.init) {
        return resolve(definition.node.init as Rule.Node, seen);
      }
      return value;
    }

    function isRouterImport(node: Rule.Node, namespace: boolean): boolean {
      const definition = variableFor(node)?.defs[0];
      if (definition?.type !== "ImportBinding" || definition.parent.source.value !== "@spa-kit/react-router") {
        return false;
      }
      const specifier = definition.node;
      if (namespace) {
        return specifier.type === "ImportNamespaceSpecifier";
      }
      return specifier.type === "ImportSpecifier" &&
        propertyName(specifier.imported as Rule.Node, false) === "createSpaRouter";
    }

    function isRouterCall(callee: Rule.Node): boolean {
      const value = resolve(callee);
      if (value.type === "Identifier") {
        return isRouterImport(value, false);
      }
      return value.type === "MemberExpression" &&
        propertyName(value.property as Rule.Node, value.computed) === "createSpaRouter" &&
        isRouterImport(resolve(value.object as Rule.Node), true);
    }

    function checkPreload(node: Rule.Node) {
      const callback = resolve(node);
      if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression" &&
          callback.type !== "FunctionDeclaration") {
        return;
      }
      // A TypeScript `this` parameter is erased and is not the route context.
      const parameter = callback.params.find((param) => param.type !== "Identifier" || param.name !== "this");
      if (!parameter) {
        return;
      }
      const input = (parameter.type === "AssignmentPattern" ? parameter.left : parameter) as TypeScriptNode;
      if (!input.typeAnnotation && !reported.has(input)) {
        reported.add(input);
        context.report({ node: input, messageId: "missingContext" });
      }
    }

    function properties(node: Rule.Node, seen = new Set<Rule.Node>()): Map<string, Rule.Node> | undefined {
      const object = resolve(node);
      if (object.type !== "ObjectExpression" || seen.has(object)) {
        return undefined;
      }
      const path = new Set(seen).add(object);
      const result = new Map<string, Rule.Node>();
      for (const property of object.properties) {
        if (property.type === "SpreadElement") {
          const spread = properties(property.argument as Rule.Node, path);
          if (spread) {
            for (const [name, value] of spread) result.set(name, value);
          } else {
            // An opaque spread may replace any preceding property.
            result.clear();
          }
          continue;
        }
        if (property.type === "Property") {
          const name = propertyName(property.key as Rule.Node, property.computed);
          if (name === undefined) {
            result.clear();
          } else if (property.kind === "init") {
            result.set(name, property.value as Rule.Node);
          } else {
            result.delete(name);
          }
        }
      }
      return result;
    }

    return {
      CallExpression(node) {
        if (!isRouterCall(node.callee as Rule.Node)) {
          return;
        }
        const config = node.arguments[1];
        if (!config || config.type === "SpreadElement") {
          return;
        }
        for (const routeConfig of properties(config as Rule.Node)?.values() ?? []) {
          const callback = properties(routeConfig)?.get("preload");
          if (callback) checkPreload(callback);
        }
      },
    };
  },
};
