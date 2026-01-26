import fetch from "node-fetch";

async function validateTurnstile(secret, token, remoteip) {
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  formData.append("remoteip", remoteip);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error("Turnstile validation error:", error);
    return false;
  }
}

export { validateTurnstile };
