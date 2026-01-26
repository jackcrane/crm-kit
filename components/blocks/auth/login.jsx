import React, { useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { BASE } from "../../src/App";
import { Turnstile } from "../shared/turnstile";
import "./login.css";

const APPLICATION_ID = "app_3066c79aa1d14d558815ff30d1805bcf";

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

export const useChallenge = () =>
  useSWRMutation(`${BASE}/auth/challenge`, (url, { arg }) =>
    request(url, { method: "POST", body: arg }),
  );

/* -------------------- components -------------------- */

export default function Login() {
  const { data, isLoading, error } = useAuthConfig();
  const [step, setStep] = useState("password");
  const [challenge, setChallenge] = useState(null);
  const [result, setResult] = useState(null);

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data?.loginAvailable)
    return <div>Login is not available for this application.</div>;

  return (
    <>
      {result && step === "success" && (
        <AuthenticatedSummary
          result={result}
          onRestart={() => {
            setResult(null);
            setStep("password");
          }}
        />
      )}

      {step === "password" && (
        <PasswordLogin
          config={data}
          onChallenge={(challengeData) => {
            setResult(null);
            setChallenge(challengeData);
            setStep("mfa");
          }}
          onAuthenticated={(res) => {
            setResult(res);
            setStep("success");
          }}
        />
      )}

      {step === "mfa" && (
        <MfaLogin
          config={data}
          challenge={challenge}
          onAuthenticated={(res) => {
            setResult(res);
            setStep("success");
          }}
          onBack={() => setStep("password")}
        />
      )}
    </>
  );
}

const PasswordLogin = ({ config, onChallenge, onAuthenticated }) => {
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
      onChallenge(res.challenge);
      return;
    }

    onAuthenticated?.(res);
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

const MfaLogin = ({ config, challenge, onAuthenticated, onBack }) => {
  const [form, setForm] = useState({
    mfaCode: "",
    turnstile: "",
  });

  const { trigger: verifyChallenge, isMutating, error } = useChallenge();

  const onChange = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async () => {
    const res = await verifyChallenge({
      nonce: challenge?.nonce,
      response: form.mfaCode,
      "cf-turnstile-response": form.turnstile,
    });

    onAuthenticated?.(res);
  };

  return (
    <div className="container">
      <h3>Enter your MFA code</h3>
      <input
        className="input"
        placeholder="MFA code"
        value={form.mfaCode}
        onChange={onChange("mfaCode")}
      />

      {config?.requiresCaptcha && (
        <Turnstile
          siteKey={config.siteKey}
          onVerify={(v) => setForm((f) => ({ ...f, turnstile: v }))}
        />
      )}

      <button
        className="button"
        onClick={onSubmit}
        disabled={isMutating || !form.mfaCode || !challenge?.nonce}
      >
        {isMutating ? "Verifying…" : "Submit code"}
      </button>

      <button className="linkButton" type="button" onClick={onBack}>
        Back to login
      </button>

      {error && <div className="error">{error.message}</div>}
    </div>
  );
};

const AuthenticatedSummary = ({ result, onRestart }) => (
  <div className="container">
    <h3>Logged in</h3>
    <div className="callout">
      <div>
        <strong>User:</strong> {result?.user?.email}
      </div>
      <div className="tokenRow">
        <strong>Token:</strong> <code className="token">{result?.token}</code>
      </div>
    </div>
    <button className="button" onClick={onRestart}>
      Log in again
    </button>
  </div>
);
