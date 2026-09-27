// Minimal callable builders with the same public contract as GenerateClientRoutes.
type RawParams = Readonly<Record<string, string | undefined>>;

export const WikiRoutes = {
  Index: Object.assign(() => "/wiki", {
    path: "/wiki",
    applicationId: "wiki",
    routeId: "Index",
    parse: (_params: RawParams, _search: URLSearchParams) => ({ params: {}, query: {} }),
  }),
  View: Object.assign(
    (params: { wikiId: string }, query: { tab?: string } = {}) => {
      const search = new URLSearchParams(query).toString();
      return `/wiki/${encodeURIComponent(params.wikiId)}${search ? `?${search}` : ""}`;
    },
    {
      path: "/wiki/:wikiId",
      applicationId: "wiki",
      routeId: "View",
      parse(params: RawParams, search: URLSearchParams): {
        params: { wikiId: string };
        query: { tab?: string };
      } | null {
        const tabs = search.getAll("tab");
        if (params.wikiId === undefined || tabs.length > 1) {
          return null;
        }
        return {
          params: { wikiId: params.wikiId },
          query: tabs.length === 0 ? {} : { tab: tabs[0]! },
        };
      },
    },
  ),
  Edit: Object.assign((params: { wikiId: string }) => `/wiki/${encodeURIComponent(params.wikiId)}/edit`, {
    path: "/wiki/:wikiId/edit",
    applicationId: "wiki",
    routeId: "Edit",
    parse(params: RawParams, _search: URLSearchParams): {
      params: { wikiId: string };
      query: {};
    } | null {
      return params.wikiId === undefined ? null : { params: { wikiId: params.wikiId }, query: {} };
    },
  }),
} as const;

export const SearchRoutes = {
  Search: {
    path: "/search/:category?",
    applicationId: "search",
    routeId: "Search",
    parse(params: RawParams, search: URLSearchParams): {
      params: { category?: string };
      query: { q: string; tag?: readonly string[] };
    } | null {
      const queries = search.getAll("q");
      if (queries.length !== 1) {
        return null;
      }
      return {
        params: params.category === undefined ? {} : { category: params.category },
        query: {
          q: queries[0]!,
          ...(search.has("tag") ? { tag: search.getAll("tag") } : {}),
        },
      };
    },
  },
} as const;
