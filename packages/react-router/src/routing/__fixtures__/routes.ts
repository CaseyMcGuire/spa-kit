// Minimal callable builders with the same public contract as GenerateClientRoutes.
declare const routeContextBrand: unique symbol;
type ParsedRouteValues<Params, QueryString, Identity extends readonly [string, string]> = {
  params: Params;
  queryString: QueryString;
  readonly [routeContextBrand]: Identity;
};

type RawParams = Readonly<Record<string, string | undefined>>;

export const WikiRoutes = {
  Index: Object.assign(() => "/wiki", {
    path: "/wiki",
    applicationId: "wiki",
    routeId: "Index",
    hasAccessHandler: true,
    parse: (_params: RawParams, _search: URLSearchParams) => ({ params: {}, queryString: {} } as ParsedRouteValues<{}, {}, readonly ["wiki", "Index"]>),
  }),
  View: Object.assign(
    (params: { wikiId: string }, queryString: { tab?: string } = {}) => {
      const search = new URLSearchParams(queryString).toString();
      return `/wiki/${encodeURIComponent(params.wikiId)}${search ? `?${search}` : ""}`;
    },
    {
      path: "/wiki/:wikiId",
      applicationId: "wiki",
      routeId: "View",
      hasAccessHandler: true,
      parse(params: RawParams, search: URLSearchParams):
        ParsedRouteValues<{ wikiId: string }, { tab?: string }, readonly ["wiki", "View"]> | null {
        const tabs = search.getAll("tab");
        if (params.wikiId === undefined || tabs.length > 1) {
          return null;
        }
        return {
          params: { wikiId: params.wikiId },
          queryString: tabs.length === 0 ? {} : { tab: tabs[0]! },
        } as ParsedRouteValues<{ wikiId: string }, { tab?: string }, readonly ["wiki", "View"]>;
      },
    },
  ),
  Edit: Object.assign((params: { wikiId: string }) => `/wiki/${encodeURIComponent(params.wikiId)}/edit`, {
    path: "/wiki/:wikiId/edit",
    applicationId: "wiki",
    routeId: "Edit",
    hasAccessHandler: true,
    parse(params: RawParams, _search: URLSearchParams):
      ParsedRouteValues<{ wikiId: string }, {}, readonly ["wiki", "Edit"]> | null {
      return params.wikiId === undefined ? null :
        { params: { wikiId: params.wikiId }, queryString: {} } as ParsedRouteValues<{ wikiId: string }, {}, readonly ["wiki", "Edit"]>;
    },
  }),
} as const;

export const SearchRoutes = {
  Search: {
    path: "/search/:category?",
    applicationId: "search",
    routeId: "Search",
    hasAccessHandler: true,
    parse(params: RawParams, search: URLSearchParams):
      ParsedRouteValues<{ category?: string }, { q: string; tag?: readonly string[] }, readonly ["search", "Search"]> | null {
      const queries = search.getAll("q");
      if (queries.length !== 1) {
        return null;
      }
      return {
        params: params.category === undefined ? {} : { category: params.category },
        queryString: {
          q: queries[0]!,
          ...(search.has("tag") ? { tag: search.getAll("tag") } : {}),
        },
      } as ParsedRouteValues<{ category?: string }, { q: string; tag?: readonly string[] }, readonly ["search", "Search"]>;
    },
  },
} as const;

// Match spa-routing 0.5.0's generated public aliases.
export type IndexContext = NonNullable<ReturnType<typeof WikiRoutes.Index.parse>>;
export type ViewContext = NonNullable<ReturnType<typeof WikiRoutes.View.parse>>;
export type EditContext = NonNullable<ReturnType<typeof WikiRoutes.Edit.parse>>;
export type SearchContext = NonNullable<ReturnType<typeof SearchRoutes.Search.parse>>;
