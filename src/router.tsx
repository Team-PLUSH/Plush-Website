import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createCspNonce } from "./lib/security-headers";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // The CSP nonce must exist when the router is created: TanStack Start
    // captures it for the hydration bootstrap scripts before our stream
    // handler in src/server.ts runs. That handler reuses this nonce for the
    // Content-Security-Policy header. getRouter runs once per SSR request.
    ssr: import.meta.env.SSR ? { nonce: createCspNonce() } : undefined,
  });

  return router;
};
