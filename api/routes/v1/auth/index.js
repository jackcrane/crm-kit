export const get = [
  async (req, res) => {
    return res.json({
      loginAvailable: req.application.loginAvailable,
      types: [{ type: "password" }],
      siteKey: req.application.cfTurnstileSiteKey,
      requiresCaptcha: req.application.enforceTurnstile,
    });
  },
];
