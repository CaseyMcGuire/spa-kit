// @vitest-environment node
import { Linter } from "eslint";
import * as parser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";
import plugin from "../index.js";

const imported = 'import { createSpaRouter } from "@spa-kit/react-router";';
function route(preload: string) {
  return `${imported} createSpaRouter(Routes, { View: { ${preload}, render: () => null } });`;
}
function lint(code: string) {
  return new Linter().verify(code, [{
    files: ["**/*.tsx"],
    languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "@spa-kit": plugin },
    rules: { "@spa-kit/require-preload-context": "error" },
  }], { filename: "routes.tsx" });
}

const valid = [
  route('preload: ctx => ctx, preload: () => null'),
  route('preload: ctx => ctx, ...unknownConfig'),
  route('preload: ctx => ctx, [dynamicKey]: () => null'),
  route('preload: ctx => ctx, get preload() { return importedPreload; }'),
  `${imported} const shared = { preload: ctx => ctx }; createSpaRouter(Routes, { View: { ...shared, preload: () => null } });`,
  `${imported} const shared = { View: { preload: ctx => ctx } }; createSpaRouter(Routes, { ...shared, View: { render: () => null } });`,
  route('preload: ({ params }: ViewContext) => loadQuery(params.id)'),
  route('preload: (context: ViewContext) => context.params.id'),
  route('preload({ params }: ViewContext) { return params.id; }'),
  route('preload: function ({ params }: ViewContext) { return params.id; }'),
  route('preload: () => loadSomething()'),
  route('preload() { return loadSomething(); }'),
  route('preload: async (context: ViewContext) => context.params.id'),
  route('preload: ({ params }: ViewContext = defaultContext) => params.id'),
  route('preload: (...args: [ViewContext]) => args[0].params.id'),
  route('preload: function (this: void, context: ViewContext) { return context.params.id; }'),
  `${imported} createSpaRouter(Routes, { About: { render: () => <About /> } });`,
  'const obj = { preload: (context) => context.id };',
  'function createSpaRouter(routes, config) {} createSpaRouter(Routes, { View: { preload: ctx => ctx.id } });',
  'import { createSpaRouter } from "another-library"; createSpaRouter(Routes, { View: { preload: ctx => ctx.id } });',
  `${imported} function nested(createSpaRouter) { createSpaRouter(Routes, { View: { preload: ctx => ctx.id } }); }`,
  'import * as kit from "@spa-kit/react-router"; function nested(kit) { kit.createSpaRouter(Routes, { View: { preload: ctx => ctx.id } }); }',
  `${imported} const view = { preload: (ctx: ViewContext) => ctx.params.id }; const config = { View: view }; createSpaRouter(Routes, config);`,
  `${imported} const preload = (ctx: ViewContext) => ctx.params.id; createSpaRouter(Routes, { View: { preload } });`,
  `${imported} createSpaRouter(Routes, { View: { loader: ctx => ctx, handle: { preload: ctx => ctx }, render: () => null } });`,
  `${imported} createSpaRouter(Routes, { View: { preload: importedPreload } });`,
];
const invalid = [
  route('...unknownConfig, preload: ctx => ctx'),
  `${imported} const shared = { preload: ctx => ctx }; createSpaRouter(Routes, { View: { preload: () => null, ...shared } });`,
  route('preload: ({ params }) => loadQuery(params.id)'),
  route('preload: context => context.params.id'),
  route('preload({ params }) { return params.id; }'),
  route('preload: function ({ params }) { return params.id; }'),
  route('preload: async context => context.params.id'),
  route('preload: ({ params } = defaultContext) => params.id'),
  route('preload: (...args) => args[0]'),
  route('preload: function (this: void, context) { return context.params.id; }'),
  route('"preload": context => context.params.id'),
  route('["preload"]: context => context.params.id'),
  route('preload: (context => context.params.id) satisfies Preload'),
  'import { createSpaRouter as makeRouter } from "@spa-kit/react-router"; makeRouter(Routes, { View: { preload: context => context } });',
  'import * as kit from "@spa-kit/react-router"; kit.createSpaRouter(Routes, { View: { preload: context => context } });',
  'import * as kit from "@spa-kit/react-router"; kit["createSpaRouter"](Routes, { View: { preload: context => context } });',
  `${imported} const makeRouter = createSpaRouter; makeRouter(Routes, { View: { preload: context => context } });`,
  `${imported} const config = { View: { preload: context => context } } satisfies SpaRouterConfig; createSpaRouter(Routes, config);`,
  `${imported} const view = { preload: context => context }; createSpaRouter(Routes, { View: view });`,
  `${imported} const shared = { preload: context => context }; createSpaRouter(Routes, { View: { ...shared } });`,
  `${imported} const config = { View: { preload: context => context } }; createSpaRouter(Routes, { ...config });`,
  `${imported} const preload = context => context; createSpaRouter(Routes, { View: { preload } });`,
  `${imported} function preload(context) { return context; } createSpaRouter(Routes, { View: { preload } });`,
  `${imported} const preload = context => context; const config = { View: { preload }, Edit: { preload } }; createSpaRouter(Routes, config);`,
];

describe("require-preload-context", () => {
  it.each(valid)("accepts %s", (code) => {
    expect(lint(code)).toEqual([]);
  });
  it.each(invalid)("reports %s", (code) => {
    const messages = lint(code);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      ruleId: "@spa-kit/require-preload-context",
      messageId: "missingContext",
      severity: 2,
    });
    expect(messages[0]).not.toHaveProperty("fix");
  });
  it("does not enable itself when installed", () => {
    const messages = new Linter().verify(route('preload: context => context'), [{
      files: ["**/*.tsx"],
      languageOptions: { parser },
      plugins: { "@spa-kit": plugin },
    }], { filename: "routes.tsx" });
    expect(messages).toEqual([]);
  });
});
