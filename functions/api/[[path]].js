// Cloudflare Pages adapter for the existing Netlify-style functions.
// Keeps the original backend logic in /netlify/functions unchanged.

import * as adminLogin from '../../netlify/functions/admin-login.js';
import * as adminApi from '../../netlify/functions/admin.js';
import * as availability from '../../netlify/functions/availability.js';
import * as bookingStatus from '../../netlify/functions/booking-status.js';
import * as createBooking from '../../netlify/functions/create-booking.js';
import * as expireHolds from '../../netlify/functions/expire-holds.js';
import * as nlbCallback from '../../netlify/functions/nlb-callback.js';
import * as nlbInitiate from '../../netlify/functions/nlb-initiate.js';
import * as nlbReturn from '../../netlify/functions/nlb-return.js';
import * as paypalCaptureOrder from '../../netlify/functions/paypal-capture-order.js';
import * as paypalCreateOrder from '../../netlify/functions/paypal-create-order.js';
import * as settings from '../../netlify/functions/settings.js';
import * as turnstileConfig from '../../netlify/functions/turnstile-config.js';
import * as turnstileVerify from '../../netlify/functions/turnstile-verify.js';

const handlers = {
  'admin-login': adminLogin,
  admin: adminApi,
  availability,
  'booking-status': bookingStatus,
  'create-booking': createBooking,
  'expire-holds': expireHolds,
  'nlb-callback': nlbCallback,
  'nlb-initiate': nlbInitiate,
  'nlb-return': nlbReturn,
  'paypal-capture-order': paypalCaptureOrder,
  'paypal-create-order': paypalCreateOrder,
  settings,
  'turnstile-config': turnstileConfig,
  'turnstile-verify': turnstileVerify,
};

export async function onRequest(context) {
  copyEnvToProcess(context.env);

  const pathParam = context.params.path;
  const path = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam || '');
  const functionName = path.split('/')[0];
  const mod = handlers[functionName];

  if (!mod) {
    return jsonResponse({ error: 'not_found', message: `No API function for /api/${path}` }, 404);
  }

  const handler = mod.handler || (mod.default && mod.default.handler) || mod.default;
  if (typeof handler !== 'function') {
    return jsonResponse({ error: 'server_error', message: `Handler not found for ${functionName}` }, 500);
  }

  const event = await toNetlifyEvent(context.request);

  try {
    const result = await handler(event, {});
    return fromNetlifyResponse(result);
  } catch (error) {
    console.error(`Cloudflare adapter error in ${functionName}:`, error && (error.stack || error.message || error));
    return jsonResponse({ error: 'server_error' }, 500);
  }
}

function copyEnvToProcess(env = {}) {
  // The existing Netlify functions read from process.env.
  // Cloudflare gives env vars on context.env, so mirror them before calling the original code.
  if (typeof process !== 'undefined') {
    process.env = process.env || {};
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') process.env[key] = value;
    }
  }
}

async function toNetlifyEvent(request) {
  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const queryStringParameters = {};
  url.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
  });

  let body = '';
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    body = await request.text();
  }

  return {
    httpMethod: request.method.toUpperCase(),
    headers,
    multiValueHeaders: {},
    queryStringParameters,
    multiValueQueryStringParameters: {},
    path: url.pathname,
    rawUrl: request.url,
    body,
    isBase64Encoded: false,
    requestContext: {
      http: {
        method: request.method.toUpperCase(),
        path: url.pathname,
        sourceIp: headers['cf-connecting-ip'] || headers['x-forwarded-for'] || '',
      },
      identity: {},
    },
  };
}

function fromNetlifyResponse(result) {
  if (result instanceof Response) return result;

  const status = result && result.statusCode ? result.statusCode : 200;
  const headers = new Headers((result && result.headers) || {});

  // Netlify functions sometimes return multiValueHeaders for Set-Cookie.
  if (result && result.multiValueHeaders) {
    for (const [key, values] of Object.entries(result.multiValueHeaders)) {
      if (Array.isArray(values)) values.forEach((value) => headers.append(key, value));
    }
  }

  return new Response((result && result.body) || '', { status, headers });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
