const turnstile = require("./lib/turnstile");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return turnstile.json(405, { error: "method_not_allowed" });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return turnstile.json(400, { error: "invalid_json" });
  }

  const action = body.action || "launch";
  const result = await turnstile.verifyToken(body.token, event, { action });
  if (!result.success) return turnstile.errorResponse(result);
  return turnstile.json(200, { success: true });
};
