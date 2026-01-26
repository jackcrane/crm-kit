import React, { useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { BASE } from "../../src/App";
import { Turnstile } from "../shared/turnstile";
import "./login.css";

const APPLICATION_ID = "app_0792f8a84bed4f04bd07311020ee5c37";

const request = async (url, { method = "GET", body } = {}) => {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Application-ID": APPLICATION_ID,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
};

/* -------------------- hooks -------------------- */

export const useAuthConfig = () =>
  useSWR(`${BASE}/auth`, (url) => request(url));

export const useLogin = () =>
  useSWRMutation(`${BASE}/auth/login`, (url, { arg }) =>
    request(url, { method: "POST", body: arg }),
  );

/* -------------------- components -------------------- */

export default function Login() {
  const { data, isLoading, error } = useAuthConfig();
  const [step, setStep] = useState("password");

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data?.loginAvailable)
    return <div>Login is not available for this application.</div>;

  return (
    <div className="container">
      {step === "password" && (
        <PasswordLogin config={data} onChallenge={() => setStep("mfa")} />
      )}
      {step === "mfa" && <MfaLogin />}
    </div>
  );
}

const PasswordLogin = ({ config, onChallenge }) => {
  const [form, setForm] = useState({
    email: "",
    password: "",
    turnstile: "",
  });

  const { trigger: login, isMutating, error } = useLogin();

  const onChange = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async () => {
    const res = await login({
      email: form.email,
      password: form.password,
      "cf-turnstile-response": form.turnstile,
    });

    if (res?.status === "challenge") {
      onChallenge();
    }
  };

  return (
    <div className="container">
      <h3>Log in to your account</h3>

      <input
        className="input"
        placeholder="Email"
        value={form.email}
        onChange={onChange("email")}
      />

      <input
        className="input"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={onChange("password")}
      />

      {config.requiresCaptcha && (
        <Turnstile
          siteKey={config.siteKey}
          onVerify={(v) => setForm((f) => ({ ...f, turnstile: v }))}
        />
      )}

      <button className="button" onClick={onSubmit} disabled={isMutating}>
        {isMutating ? "Logging in…" : "Log in"}
      </button>

      {error && <div className="error">{error.message}</div>}
    </div>
  );
};

const MfaLogin = () => {
  const [form, setForm] = useState({
    mfaCode: "",
  });

  return (
    <div className="container">
      <h3>Log in to your account</h3>
      <input className="input" placeholder="MFA Code" />
      <button className="button">Log in</button>
    </div>
  );
};
