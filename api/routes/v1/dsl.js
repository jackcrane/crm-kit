import { formatSearchDslError, parseSearchDsl } from "../../util/search-dsl.js";

export const userSearchFields = {
  id: { type: "string" },
  name: { type: "string" },
  email: { type: "string" },
  createdAt: { type: "date" },
  lifetime_value: { type: "number" },
  isActive: { type: "boolean" },
};

export const post = [
  async (req, res) => {
    try {
      const parsed = parseSearchDsl(req.body, userSearchFields);

      // parsed = {
      //   root: <AST>,
      //   control: { order, limit, offset },
      //   meta: { allowedFields }
      // }

      res.json({
        ok: true,
        query: parsed,
      });
    } catch (err) {
      console.log("err", err);

      const formatted = formatSearchDslError(err);
      if (!formatted) throw err;
      res.status(400).json({
        ok: false,
        error: formatted.machine,
        message: formatted.human,
      });
    }
  },
];
