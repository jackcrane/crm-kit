import React, { useState } from "react";
import useSWRMutation from "swr/mutation";
import { BASE } from "../../src/App";
import "./login.css";
import useSWR from "swr";
import { Turnstile } from "../shared/turnstile";

const applicationId = "app_0792f8a84bed4f04bd07311020ee5c37";

const mutator = async (url, { arg }) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Application-ID": applicationId,
    },
    body: JSON.stringify(arg),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw error;
  }

  return res.json();
};

const fetcher = async (url) => {
  const res = await fetch(url, {
    headers: {
      "X-Application-ID": applicationId,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw error;
  }
  return res.json();
};

const useAuthConfig = () => {
  const { data, isLoading, error } = useSWR(`${BASE}/auth`, fetcher);
  return { data, isLoading, error };
};

export const useLogin = () => {
  const { trigger, data, error, isMutating } = useSWRMutation(
    `${BASE}/auth/login`,
    mutator,
  );

  return {
    login: trigger,
    data,
    error,
    loading: isMutating,
  };
};

export default function Login() {
  const { data, isLoading, error } = useAuthConfig();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (data.loginAvailable === false) {
    return <div>Login is not available for this application.</div>;
  }

  return (
    <div className="container">
      <PasswordLogin config={data} />
    </div>
  );
}

const PasswordLogin = ({ config }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileResponse, setTurnstileResponse] = useState("");
  const { login, loading, error } = useLogin();

  const onSubmit = async () => {
    await login({
      email,
      password,
      "cf-turnstile-response": turnstileResponse,
    });
  };

  return (
    <div className="container">
      <h3>Log in to your account</h3>

      <input
        type="text"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="input"
      />

      {config.requiresCaptcha && (
        <Turnstile onVerify={setTurnstileResponse} siteKey={config.siteKey} />
      )}

      <button onClick={onSubmit} disabled={loading} className="button">
        {loading ? "Logging in…" : "Log in"}
      </button>

      {error && <div className="error">{error.message}</div>}
    </div>
  );
};
