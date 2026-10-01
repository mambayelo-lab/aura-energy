import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { resolveTabProduct, isAllowedPath, PRODUCT_HOME } from "@/lib/product-host";

import appCss from "../styles.css?url";
// Polices hébergées avec l'application (aucune dépendance à Google Fonts).
import interCss from "@fontsource-variable/inter/index.css?url";
import soraCss from "@fontsource-variable/sora/index.css?url";
import lexendCss from "@fontsource-variable/lexend/index.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster as SonnerToaster } from "sonner";
import { I18nProvider } from "@/lib/i18n";
import { PersonaProvider } from "@/lib/persona";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <pre className="mt-3 text-left text-xs bg-gray-100 text-red-700 rounded p-3 overflow-auto max-h-40 max-w-full">
          {error?.message}{"\n"}{error?.stack?.split("\n").slice(0,6).join("\n")}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AURA — Decision Intelligence" },
      { name: "description", content: "AURA est votre copilote décisionnel. Comprendre, structurer et arbitrer vos décisions stratégiques." },
      { name: "author", content: "AURA" },
      { property: "og:title", content: "AURA — Decision Intelligence" },
      { property: "og:description", content: "AURA est votre copilote décisionnel. Comprendre, structurer et arbitrer vos décisions stratégiques." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "AURA — Decision Intelligence" },
      { name: "twitter:description", content: "AURA est votre copilote décisionnel. Comprendre, structurer et arbitrer vos décisions stratégiques." },
    ],
    links: [
      { rel: "stylesheet", href: interCss },
      { rel: "stylesheet", href: soraCss },
      { rel: "stylesheet", href: lexendCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/aura-mark.svg",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Étanchéité par adresse : une page d'un autre produit renvoie à l'accueil du produit servi.
function ProductHostGuard() {
  const location = useRouterState({ select: state => state.location });
  const navigate = useNavigate();
  useEffect(() => {
    const product = resolveTabProduct(window.location, window.sessionStorage);
    if (!product) return;
    if (location.pathname === "/" || !isAllowedPath(product, location.pathname)) {
      navigate({ to: PRODUCT_HOME[product], replace: true });
    }
  }, [location.href, location.pathname, navigate]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PersonaProvider>
          <ProductHostGuard />
          <Outlet />
          <SonnerToaster />
        </PersonaProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
