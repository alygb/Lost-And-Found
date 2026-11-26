"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, Mail, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateEmail } from "@/lib/validation";
import AuthShell, { Divider, Field, FormAlert, GoogleButton, SubmitButton } from "@/components/auth/AuthShell";

/** Supabase error text → something a user understands. */
const friendly = (msg: string) => {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email or password is incorrect. Please try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the server. Check your internet connection.";
  return msg;
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const errors = {
    email: validateEmail(email),
    password: mode === "login" && !password ? "Please enter your password." : "",
  };
  const show = (k: keyof typeof errors) => ((touched[k] || submitted) && errors[k]) || "";

  const switchMode = (m: "login" | "forgot") => {
    setMode(m);
    setError("");
    setNotice("");
    setSubmitted(false);
    setTouched({});
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(true);
    if (errors.email || errors.password) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(friendly(error.message));
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitted(true);
    if (errors.email) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return setError(friendly(error.message));
    setNotice(`If an account exists for ${email.trim()}, a reset link is on its way. Check your inbox and spam folder.`);
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setError(friendly(error.message));
      setGoogleLoading(false);
    }
    // On success the browser redirects to Google
  };

  if (mode === "forgot") {
    return (
      <AuthShell
        title="Reset your password"
        subtitle="Enter your account email and we'll send you a link to choose a new password."
        footer={
          <button onClick={() => switchMode("login")} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </button>
        }
      >
        <form noValidate onSubmit={handleForgot} className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          {notice && <FormAlert tone="success">{notice}</FormAlert>}
          <Field
            label="Email address"
            icon={Mail}
            name="email"
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="name@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={show("email")}
            autoFocus
          />
          <SubmitButton loading={loading} loadingText="Sending link…">
            <Send className="h-4 w-4" /> Send reset link
          </SubmitButton>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back 👋"
      subtitle="Sign in to track your reports and claims."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-bold text-brand hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogleLogin} loading={googleLoading} />
      <Divider text="or sign in with email" />

      <form noValidate onSubmit={handleLogin} className="space-y-5">
        {error && <FormAlert>{error}</FormAlert>}
        <Field
          label="Email address"
          icon={Mail}
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          placeholder="name@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={show("email")}
        />
        <Field
          label="Password"
          icon={Lock}
          name="password"
          password
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={show("password")}
          right={
            <button type="button" onClick={() => switchMode("forgot")} className="text-xs font-semibold text-brand hover:underline">
              Forgot password?
            </button>
          }
        />
        <SubmitButton loading={loading} loadingText="Signing in…">
          Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
