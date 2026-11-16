import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/firebase/AuthForm";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — DWONLUOMOVIES" },
      { name: "description", content: "Sign in to your DWONLUOMOVIES viewer account with email or Google." },
      { property: "og:title", content: "Sign in — DWONLUOMOVIES" },
      { property: "og:description", content: "Sign in to your DWONLUOMOVIES viewer account." },
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
