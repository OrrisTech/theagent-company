import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { EventHorizonShader } from "@/components/EventHorizonShader";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        await authApi.signInEmail({ email: email.trim(), password });
        return;
      }
      await authApi.signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("auth.authFailed"));
    },
  });

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === "sign_in" || (name.trim().length > 0 && password.trim().length >= 8));

  if (isSessionLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("auth.loading")}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0">
      {/* Full-screen shader background */}
      <div className="absolute inset-0 z-0">
        <EventHorizonShader />
      </div>

      {/* Form overlay */}
      <div className="relative z-10 flex items-center justify-center min-h-full px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl shadow-black/50 px-8 py-10">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="h-4 w-4 text-neutral-400" />
            <span className="text-sm font-medium text-neutral-200">{t("auth.paperclip")}</span>
          </div>

          <h1 className="text-xl font-semibold text-white">
            {mode === "sign_in" ? t("auth.signInTitle") : t("auth.createAccountTitle")}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {mode === "sign_in"
              ? t("auth.signInSubtitle")
              : t("auth.signUpSubtitle")}
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (mutation.isPending) return;
              if (!canSubmit) {
                setError(t("auth.fillAllFields"));
                return;
              }
              mutation.mutate();
            }}
          >
            {mode === "sign_up" && (
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">{t("teamMember.identity.name")}</label>
                <input
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-orange-500/50 placeholder:text-neutral-500"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            )}
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">{t("channels.types.email")}</label>
              <input
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-orange-500/50 placeholder:text-neutral-500"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoFocus={mode === "sign_in"}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">{t("auth.password")}</label>
              <input
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-orange-500/50 placeholder:text-neutral-500"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button
              type="submit"
              disabled={mutation.isPending}
              aria-disabled={!canSubmit || mutation.isPending}
              className={`w-full bg-orange-600 hover:bg-orange-500 text-white border-0 ${!canSubmit && !mutation.isPending ? "opacity-50" : ""}`}
            >
              {mutation.isPending
                ? t("auth.working")
                : mode === "sign_in"
                  ? t("auth.signIn")
                  : t("auth.createAccount")}
            </Button>
          </form>

          <div className="mt-5 text-sm text-neutral-400">
            {mode === "sign_in" ? t("auth.needAccount") : t("auth.alreadyHaveAccount")}{" "}
            <button
              type="button"
              className="font-medium text-white underline underline-offset-2"
              onClick={() => {
                setError(null);
                setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              }}
            >
              {mode === "sign_in" ? t("auth.createOne") : t("auth.signIn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
