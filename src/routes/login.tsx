import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/firebase/AuthForm";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — VJ EMMA.SITE" },
      { name: "description", content: "Sign in to your VJ EMMA.SITE viewer account with email or Google." },
      { property: "og:title", content: "Sign in — VJ EMMA.SITE" },
      { property: "og:description", content: "Sign in to your VJ EMMA.SITE viewer account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return <AuthForm mode="login" redirect={redirect ?? "/dashboard"} />;
}
