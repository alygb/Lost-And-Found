"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lock, Mail, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateEmail, validateFullName, validatePassword } from "@/lib/validation";
import AuthShell, { Divider, Field, FormAlert, GoogleButton, SubmitButton } from "@/components/auth/AuthShell";

const friendly = (msg: string) => {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return "An account with this email already exists. Try signing in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the server. Check your internet connection.";
  return msg;
};

/** 0–4 score with a label, for the strength bar. */
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  else if (/\d/.test(pw)) s += 0.5;
  const score = Math.min(4, Math.round(s));
  return {
    score,
    label: ["Too weak", "Weak", "Fair", "Good", "Strong"][score],
    color: ["bg-rose-500", "bg-rose-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"][score],
    text: ["text-rose-600", "text-rose-600", "text-amber-600", "text-blue-600", "text-emerald-600"][score],
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const errors = {
    fullName: validateFullName(form.fullName),
    email: validateEmail(form.email),
    password: validatePassword(form.password),
    confirmPassword: !form.confirmPassword
      ? "Please type your password again."
      : form.confirmPassword !== form.password
        ? "The passwords do not match."
        : "",
  };
  const show = (k: keyof typeof errors) => ((touched[k] || submitted) && errors[k]) || "";
  const pw = strength(form.password);
  const rules = [
    { ok: form.password.length >= 8, text: "8+ characters" },
    { ok: /[A-Za-z]/.test(form.password), text: "A letter" },
    { ok: /\d/.test(form.password), text: "A number" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.fullName.trim() } },
    });

    if (error) {
      setError(friendly(error.message));
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, email: form.email.trim(), full_name: form.fullName.trim() });
    }
    if (data.session) {
      router.push("/dashboard");
      return;
    }
    // Email confirmation is switched on in Supabase
    setNotice("Account created! Check your inbox and click the confirmation link, then sign in.");
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
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
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join free and start recovering lost items across AJK."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogleSignup} loading={googleLoading} />
      <Divider text="or sign up with email" />

      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {error && <FormAlert>{error}</FormAlert>}
        {notice && <FormAlert tone="success">{notice}</FormAlert>}

        <Field
          label="Full name"
          icon={User}
          name="fullName"
          autoComplete="name"
          placeholder="e.g. Ali Khan"
          maxLength={50}
          value={form.fullName}
          onChange={set("fullName")}
          onBlur={touch("fullName")}
          error={show("fullName")}
        />
        <Field
          label="Email address"
          icon={Mail}
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          placeholder="name@gmail.com"
          value={form.email}
          onChange={set("email")}
          onBlur={touch("email")}
          error={show("email")}
        />
        <Field
          label="Password"
          icon={Lock}
          name="password"
          password
          autoComplete="new-password"
          placeholder="8+ characters, letters and numbers"
          value={form.password}
          onChange={set("password")}
          onBlur={touch("password")}
          error={show("password")}
          hint={
            form.password ? (
              <div className="animate-fade-down mt-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${pw.score >= i ? pw.color : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <span className={`w-16 text-right text-xs font-bold ${pw.text}`}>{pw.label}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {rules.map((r) => (
                    <span key={r.text} className={`flex items-center gap-1 text-xs transition-colors ${r.ok ? "text-emerald-600" : "text-slate-400"}`}>
                      <Check className={`h-3.5 w-3.5 transition-transform ${r.ok ? "scale-100" : "scale-75 opacity-50"}`} /> {r.text}
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          }
        />
        <Field
          label="Confirm password"
          icon={Lock}
          name="confirmPassword"
          password
          autoComplete="new-password"
          placeholder="Type it again"
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
          onBlur={touch("confirmPassword")}
          error={show("confirmPassword")}
          hint={
            form.confirmPassword && form.confirmPassword === form.password ? (
              <p className="animate-fade-down mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Passwords match
              </p>
            ) : null
          }
        />

        <SubmitButton loading={loading} loadingText="Creating account…">
          Create account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </SubmitButton>
        <p className="text-center text-xs text-slate-400">Your email and phone number are never shown publicly.</p>
      </form>
    </AuthShell>
  );
}
