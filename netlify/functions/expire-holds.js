"use strict";

/**
 * Scheduled function (every 5 min via netlify.toml) that releases expired
 * payment holds so their dates become bookable again. Also callable
 * manually via GET for testing.
 */

var store = require("./lib/store");

exports.handler = async function () {
  try {
    var released = await store.expireHolds();
    if (released) console.log("[expire-holds] released " + released + " expired hold(s)");
    return { statusCode: 200, body: JSON.stringify({ released: released }) };
  } catch (e) {
    console.error("expire-holds error", e && e.message);
    return { statusCode: 500, body: JSON.stringify({ error: "server_error" }) };
  }
};
