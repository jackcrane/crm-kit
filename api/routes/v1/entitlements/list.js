import {
  entitlements as requireEntitlements,
  getEntitlementDefinitions,
} from "../../../util/entitlements.js";

export const get = [
  requireEntitlements(["entitlements:read"]),
  (req, res) => {
    res.json({
      entitlements: getEntitlementDefinitions(),
    });
  },
];
