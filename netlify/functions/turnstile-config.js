const turnstile = require("./lib/turnstile");

exports.handler = async function () {
  return turnstile.json(200, turnstile.publicConfig());
};
