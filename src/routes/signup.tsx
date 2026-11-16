import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/firebase/AuthForm";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign up — DWONLUOMOVIES" },
      { name: "description", content: "Sign up to your DWONLUOMOVIES viewer account with email or Google." },
      { property: "og:title", content: "Sign up — DWONLUOMOVIES" },
      { property: "og:description", content: "Sign up to your DWONLUOMOVIES viewer account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  return <AuthForm mode="signup" redirect={redirect ?? "/dashboard"} />;
}
