export const get = [
  (req, res) => {
    return res.json({
      loginAvailable: true,
      types: [{ type: "password" }],
      siteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY,
    });
  },
];
