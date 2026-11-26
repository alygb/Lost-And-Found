"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validatePassword } from "@/lib/validation";
import AuthShell, { Field, FormAlert, SubmitButton } from "@/components/auth/AuthShell";

/** Landing page for the "reset password" email link. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // The link signs the user in with a short-lived recovery session
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setState((s) => (s === "checking" || s === "invalid" ? "ready" : s));
    });
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setState((s) => (s === "checking" ? (data.session ? "ready" : "invalid") : s));
    }, 1200);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const errors = {
    password: validatePassword(password),
    confirm: !confirm ? "Please type your new password again." : confirm !== password ? "The passwords do not match." : "",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(true);
    if (errors.password || errors.confirm) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setState("done");
    setTimeout(() => router.push("/dashboard"), 1800);
  };

  return (
    <AuthShell
      title={state === "done" ? "Password updated" : "Choose a new password"}
      subtitle={state === "done" ? "Taking you to your dashboard…" : "Pick a strong password you haven't used before."}
      footer={
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      {state === "checking" && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand" /> Checking your reset link…
        </div>
      )}

      {state === "invalid" && (
        <FormAlert>
          This reset link is invalid or has expired. Go back to sign in and use <strong>Forgot password?</strong> to get a new one.
        </FormAlert>
      )}

      {state === "done" && (
        <div className="animate-scale-in flex flex-col items-center rounded-2xl bg-emerald-50 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-7 w-7" />
          </span>
          <p className="mt-4 font-bold text-emerald-800">Your password has been changed.</p>
        </div>
      )}

      {state === "ready" && (
        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          <Field
            label="New password"
            icon={Lock}
            name="password"
            password
            autoComplete="new-password"
            placeholder="8+ characters, letters and numbers"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={submitted ? errors.password : ""}
            autoFocus
          />
          <Field
            label="Confirm new password"
            icon={Lock}
            name="confirm"
            password
            autoComplete="new-password"
            placeholder="Type it again"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={submitted ? errors.confirm : ""}
          />
          <SubmitButton loading={loading} loadingText="Saving…">
            Save new password <ArrowRight className="h-4 w-4" />
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
