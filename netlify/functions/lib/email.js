"use strict";

/**
 * Transactional email via Resend (https://resend.com) using fetch.
 * If RESEND_API_KEY is absent, runs in demo mode: nothing is sent, the
 * payload is logged (without secrets) and returned for inspection.
 * API key is never exposed to the frontend.
 */

var cfg = require("./config");

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(n, cur) {
  return (cur || "EUR") + " " + Number(n || 0).toFixed(2);
}

function guestHtml(b) {
  var paid = b.payment_status === "paid";
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1A1A1A">',
    '<h2 style="font-family:Georgia,serif">Reservation ' + (paid ? "confirmed" : "received") + "</h2>",
    "<p>Dear " + esc(b.guest_name) + ",</p>",
    "<p>Thank you for booking <strong>Merdz Spa &amp; Fitness Sky Apartments</strong>. Here are your details:</p>",
    '<table style="width:100%;border-collapse:collapse">',
    row("Reservation reference", esc(b.public_booking_reference)),
    row("Check-in", esc(b.check_in)),
    row("Check-out", esc(b.check_out)),
    row("Nights", esc(b.number_of_nights)),
    row("Guests", esc(b.adults) + " adult(s)" + (b.children ? ", " + esc(b.children) + " child(ren)" : "")),
    row("Total", money(b.total_amount, b.currency)),
    row("Amount paid", paid ? money(b.total_amount, b.currency) : money(0, b.currency)),
    row("Payment method", esc(b.payment_method || "—")),
    row("Payment status", esc(b.payment_status)),
    "</table>",
    "<h3 style=\"font-family:Georgia,serif\">Arrival</h3>",
    "<p>Address: Ul. 1615 C, Kula 19, Apt. 183, Cevahir Sky City, Skopje. We will contact you before arrival with check-in instructions and key handover.</p>",
    "<p>Questions? Call/WhatsApp <a href=\"tel:+38972224378\">072 224 378</a>.</p>",
    "<p style=\"color:#777;font-size:13px\">Merdz Spa &amp; Fitness Sky Apartments · Skopje</p>",
    "</div>"
  ].join("");

  function row(k, v) {
    return '<tr><td style="padding:6px 0;color:#666">' + k + '</td><td style="padding:6px 0;text-align:right;font-weight:600">' + v + "</td></tr>";
  }
}

function ownerHtml(b) {
  return [
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">',
    "<h2>New reservation: " + esc(b.public_booking_reference) + "</h2>",
    "<p><strong>" + esc(b.guest_name) + "</strong> &lt;" + esc(b.guest_email) + "&gt; · " + esc(b.guest_phone || "") + " · " + esc(b.guest_country || "") + "</p>",
    "<p>" + esc(b.check_in) + " → " + esc(b.check_out) + " (" + esc(b.number_of_nights) + " nights), " +
      esc(b.adults) + " adult(s)" + (b.children ? " + " + esc(b.children) + " child(ren)" : "") + "</p>",
    "<p>Total <strong>" + money(b.total_amount, b.currency) + "</strong> · " + esc(b.payment_method) + " · " + esc(b.payment_status) + " / " + esc(b.booking_status) + "</p>",
    b.special_requests ? "<p><em>Special requests:</em> " + esc(b.special_requests) + "</p>" : "",
    "</div>"
  ].join("");
}

async function send(to, subject, html) {
  if (cfg.demoFlags().email) {
    console.log("[email:demo] would send", JSON.stringify({ to: to, subject: subject }));
    return { demo: true, to: to, subject: subject, html: html };
  }
  var res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + cfg.env("RESEND_API_KEY"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: cfg.env("EMAIL_FROM", "Merdz Sky Wellness <onboarding@resend.dev>"),
      to: [to],
      subject: subject,
      html: html
    })
  });
  if (!res.ok) {
    var t = await res.text();
    console.error("[email] send failed", res.status, t.slice(0, 200));
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

async function sendBookingEmails(b) {
  var out = { guest: null, owner: null };
  try {
    out.guest = await send(b.guest_email, "Your reservation " + b.public_booking_reference + " — Merdz Sky Wellness", guestHtml(b));
  } catch (e) { out.guest = { error: true }; }
  var owner = cfg.env("OWNER_EMAIL");
  if (owner) {
    try {
      out.owner = await send(owner, "New booking " + b.public_booking_reference, ownerHtml(b));
    } catch (e) { out.owner = { error: true }; }
  }
  return out;
}

module.exports = { sendBookingEmails: sendBookingEmails };
