/* ============================================================
   Booking widget — uses the site's existing design tokens.
   Linked from index.html (which defines :root tokens).
   ============================================================ */

.reserve{background:var(--cream);}
.booking-widget{
  background:var(--white);border:1px solid oklch(24% 0.02 55 / 0.07);
  border-radius:var(--radius-lg);box-shadow:var(--shadow-md);
  overflow:hidden;max-width:1080px;margin-inline:auto;
}

/* ---- Demo banner ---- */
.bw-demo-banner{
  display:flex;gap:var(--space-sm);align-items:center;justify-content:center;
  background:var(--sage-pale);color:var(--sage-deep);
  font-size:var(--text-sm);font-weight:600;padding:10px var(--space-md);text-align:center;
}
.bw-demo-banner .icon{width:16px;height:16px;flex-shrink:0;}
.bw-demo-banner[hidden]{display:none;}

/* ---- Stepper ---- */
.bw-steps{
  display:flex;gap:var(--space-xs);padding:var(--space-lg) var(--space-lg) 0;
  flex-wrap:wrap;
}
.bw-step-tab{
  display:flex;align-items:center;gap:10px;flex:1;min-width:140px;
  padding:10px 6px;color:var(--ink-faint);font-size:var(--text-sm);font-weight:600;
  border-bottom:2px solid oklch(24% 0.02 55 / 0.12);transition:color var(--dur) var(--ease),border-color var(--dur) var(--ease);
}
.bw-step-tab .bw-num{
  width:26px;height:26px;border-radius:50%;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:var(--text-sm);
  background:oklch(24% 0.02 55 / 0.08);color:var(--ink-soft);
  transition:background var(--dur) var(--ease),color var(--dur) var(--ease);
}
.bw-step-tab.is-active{color:var(--ink);border-bottom-color:var(--gold-deep);}
.bw-step-tab.is-active .bw-num{background:var(--ink);color:var(--white);}
.bw-step-tab.is-done .bw-num{background:var(--sage-deep);color:var(--white);}
.bw-step-tab.is-done{color:var(--ink-soft);}

.bw-body{padding:var(--space-lg);}
@media (min-width:760px){.bw-body{padding:var(--space-xl);}}
.bw-panel[hidden]{display:none;}
.bw-panel h3{font-size:var(--text-xl);margin-bottom:var(--space-md);}

/* ---- Layout: calendar + side rail ---- */
.bw-grid{display:grid;gap:var(--space-xl);align-items:start;}
@media (min-width:880px){.bw-grid{grid-template-columns:minmax(0,1fr) 300px;}}

/* ---- Calendar ---- */
.bw-cal{user-select:none;}
.bw-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);}
.bw-cal-nav{
  width:38px;height:38px;border-radius:50%;border:1px solid oklch(24% 0.02 55 / 0.14);
  background:var(--white);color:var(--ink);display:flex;align-items:center;justify-content:center;
  transition:background var(--dur) var(--ease),border-color var(--dur) var(--ease);
}
.bw-cal-nav:hover:not([disabled]){background:var(--sand);border-color:var(--ink);}
.bw-cal-nav[disabled]{opacity:.4;cursor:not-allowed;}
.bw-cal-nav .icon{width:18px;height:18px;}
.bw-months{display:grid;gap:var(--space-xl);}
@media (min-width:560px){.bw-months.two{grid-template-columns:1fr 1fr;}}
.bw-month-title{text-align:center;font-family:var(--font-display);font-weight:600;font-size:var(--text-lg);margin-bottom:var(--space-sm);}
.bw-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;}
.bw-dow span{text-align:center;font-size:var(--text-xs);font-weight:700;color:var(--ink-faint);letter-spacing:.04em;}
.bw-days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
.bw-day{
  aspect-ratio:1/1;border:none;background:transparent;border-radius:var(--radius-sm);
  font-size:var(--text-sm);font-weight:600;color:var(--ink);cursor:pointer;
  display:flex;align-items:center;justify-content:center;position:relative;min-height:38px;
  transition:background var(--dur) var(--ease),color var(--dur) var(--ease);
}
.bw-day.is-empty{visibility:hidden;cursor:default;}
.bw-day:hover:not([disabled]):not(.is-empty){background:var(--sage-pale);}
.bw-day[disabled]{color:oklch(60% 0.02 55 / 0.45);cursor:not-allowed;text-decoration:line-through;}
.bw-day.is-today{box-shadow:inset 0 0 0 1px var(--gold-deep);}
.bw-day.in-range{background:var(--sage-pale);border-radius:0;}
.bw-day.is-start,.bw-day.is-end{background:var(--ink);color:var(--white);}
.bw-day.is-start{border-radius:var(--radius-sm) 0 0 var(--radius-sm);}
.bw-day.is-end{border-radius:0 var(--radius-sm) var(--radius-sm) 0;}
.bw-day.is-start.is-end{border-radius:var(--radius-sm);}
.bw-cal-legend{display:flex;gap:var(--space-md);flex-wrap:wrap;margin-top:var(--space-md);font-size:var(--text-xs);color:var(--ink-faint);}
.bw-cal-legend span{display:inline-flex;align-items:center;gap:6px;}
.bw-swatch{width:12px;height:12px;border-radius:3px;display:inline-block;}
.bw-swatch.sel{background:var(--ink);}
.bw-swatch.un{background:oklch(60% 0.02 55 / 0.25);}

/* ---- Side rail ---- */
.bw-rail{
  background:var(--cream);border:1px solid oklch(24% 0.02 55 / 0.07);
  border-radius:var(--radius-md);padding:var(--space-lg);
}
.bw-rail h4{font-family:var(--font-body);font-size:var(--text-sm);font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:var(--space-md);}
.bw-dates-readout{font-size:var(--text-sm);color:var(--ink-soft);margin-bottom:var(--space-lg);}
.bw-dates-readout strong{color:var(--ink);}

/* ---- Guest counters ---- */
.bw-counter{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);}
.bw-counter .lbl{font-size:var(--text-sm);font-weight:600;color:var(--ink);}
.bw-counter .lbl small{display:block;font-weight:400;color:var(--ink-faint);font-size:var(--text-xs);}
.bw-stepper{display:flex;align-items:center;gap:var(--space-sm);}
.bw-stepper button{
  width:34px;height:34px;border-radius:50%;border:1px solid oklch(24% 0.02 55 / 0.18);
  background:var(--white);color:var(--ink);font-size:var(--text-lg);line-height:1;
  display:flex;align-items:center;justify-content:center;
  transition:background var(--dur) var(--ease),border-color var(--dur) var(--ease);
}
.bw-stepper button:hover:not([disabled]){border-color:var(--ink);background:var(--sand);}
.bw-stepper button[disabled]{opacity:.4;cursor:not-allowed;}
.bw-stepper .val{min-width:24px;text-align:center;font-weight:700;}

/* ---- Price preview ---- */
.bw-price-line{display:flex;justify-content:space-between;font-size:var(--text-sm);color:var(--ink-soft);margin-bottom:var(--space-sm);}
.bw-price-total{display:flex;justify-content:space-between;font-weight:700;color:var(--ink);font-size:var(--text-lg);border-top:1px solid oklch(24% 0.02 55 / 0.1);padding-top:var(--space-md);margin-top:var(--space-md);}

/* ---- Feedback ---- */
.bw-feedback{
  display:none;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:var(--radius-md);
  font-size:var(--text-sm);margin-top:var(--space-md);line-height:1.45;
}
.bw-feedback .icon{width:18px;height:18px;flex-shrink:0;margin-top:1px;}
.bw-feedback.is-shown{display:flex;}
.bw-feedback.ok{background:var(--sage-pale);color:var(--sage-deep);}
.bw-feedback.warn{background:oklch(90% 0.05 75);color:var(--gold-deep);}
.bw-feedback.err{background:oklch(90% 0.04 25);color:var(--error);}

/* ---- Fields ---- */
.bw-fields{display:grid;gap:var(--space-md);}
@media (min-width:620px){.bw-fields.two{grid-template-columns:1fr 1fr;}}
.bw-field label{display:block;font-weight:600;font-size:var(--text-sm);color:var(--ink);margin-bottom:6px;}
.bw-field .req{color:var(--gold-deep);}
.bw-input,.bw-select,.bw-textarea{
  width:100%;font-family:inherit;font-size:var(--text-base);color:var(--ink);background:var(--cream);
  border:1px solid oklch(24% 0.02 55 / 0.16);border-radius:var(--radius-md);padding:12px 14px;min-height:48px;
  transition:border-color var(--dur) var(--ease),box-shadow var(--dur) var(--ease),background var(--dur) var(--ease);
}
.bw-textarea{min-height:84px;resize:vertical;}
.bw-input:focus-visible,.bw-select:focus-visible,.bw-textarea:focus-visible{
  outline:none;border-color:var(--sage-deep);background:var(--white);box-shadow:0 0 0 3px var(--sage-pale);
}
.bw-input[aria-invalid="true"],.bw-select[aria-invalid="true"]{border-color:var(--error);box-shadow:0 0 0 3px oklch(58% 0.16 25 / 0.14);}
.bw-err{display:none;color:var(--error);font-size:var(--text-xs);font-weight:600;margin-top:4px;}
.bw-err.is-shown{display:block;}
.bw-checks{display:grid;gap:var(--space-sm);margin-top:var(--space-md);}
.bw-check{display:flex;gap:10px;align-items:flex-start;font-size:var(--text-sm);color:var(--ink-soft);cursor:pointer;}
.bw-check input{margin-top:3px;width:18px;height:18px;flex-shrink:0;accent-color:var(--sage-deep);}
.bw-check a{color:var(--sage-deep);text-decoration:underline;}

/* ---- Summary + payment ---- */
.bw-summary{background:var(--cream);border-radius:var(--radius-md);padding:var(--space-lg);margin-bottom:var(--space-lg);}
.bw-summary .row{display:flex;justify-content:space-between;font-size:var(--text-sm);color:var(--ink-soft);margin-bottom:10px;}
.bw-summary .row strong{color:var(--ink);}
.bw-summary .total{border-top:1px solid oklch(24% 0.02 55 / 0.12);margin-top:6px;padding-top:var(--space-md);font-size:var(--text-xl);font-weight:700;color:var(--ink);}
.bw-pay-methods{display:grid;gap:var(--space-sm);margin-bottom:var(--space-lg);}
@media (min-width:520px){.bw-pay-methods{grid-template-columns:1fr 1fr;}}
.bw-pay-opt{position:relative;}
.bw-pay-opt input{position:absolute;opacity:0;width:1px;height:1px;}
.bw-pay-opt label{
  display:flex;align-items:center;gap:10px;padding:14px 16px;min-height:56px;cursor:pointer;
  border:1px solid oklch(24% 0.02 55 / 0.16);border-radius:var(--radius-md);background:var(--cream);
  font-weight:600;color:var(--ink-soft);transition:border-color var(--dur) var(--ease),background var(--dur) var(--ease),color var(--dur) var(--ease),box-shadow var(--dur) var(--ease);
}
.bw-pay-opt label:hover{border-color:var(--ink);}
.bw-pay-opt input:checked + label{border-color:var(--ink);background:var(--white);color:var(--ink);box-shadow:var(--shadow-sm);}
.bw-pay-opt input:focus-visible + label{outline:2px solid var(--sage-deep);outline-offset:2px;}
.bw-pay-opt .pay-ic{width:34px;height:22px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border-radius:4px;}
.bw-pay-opt .pay-ic.pp{background:#003087;color:#fff;}
.bw-pay-opt .pay-ic.nlb{background:var(--sage-deep);color:#fff;}
.bw-pay-tag{font-size:var(--text-xs);font-weight:600;color:var(--ink-faint);margin-left:auto;}

#bwPaypal{min-height:1px;}
.bw-actions{display:flex;gap:var(--space-md);flex-wrap:wrap;margin-top:var(--space-lg);}
.bw-actions .btn{flex:1;min-width:140px;}
.bw-spin{
  width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;
  display:none;animation:bw-spin .7s linear infinite;
}
@keyframes bw-spin{to{transform:rotate(360deg);}}
.btn.is-loading .bw-spin{display:inline-block;}
.btn.is-loading .btn-ic{display:none;}

/* ---- Inline success (PayPal capture) ---- */
.bw-success{text-align:center;padding:var(--space-lg) 0;}
.bw-success .bw-success-ic{width:64px;height:64px;border-radius:50%;background:var(--sage-pale);color:var(--sage-deep);display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-md);}
.bw-success .bw-success-ic .icon{width:32px;height:32px;}
.bw-success h3{font-size:var(--text-2xl);margin-bottom:var(--space-xs);}
.bw-success p{color:var(--ink-soft);font-size:var(--text-sm);margin-bottom:var(--space-sm);}
.bw-success .ref{font-family:var(--font-display);font-size:var(--text-2xl);color:var(--ink);letter-spacing:.04em;margin:var(--space-md) 0;}

.bw-hold-timer{font-size:var(--text-xs);color:var(--ink-faint);margin-top:var(--space-md);text-align:center;}
.bw-hold-timer strong{color:var(--gold-deep);}

/* tiny toast for the widget */
.bw-toast{
  position:fixed;left:50%;bottom:90px;transform:translate(-50%,16px);
  background:var(--ink);color:var(--white);padding:13px 20px;border-radius:var(--radius-pill);
  font-size:var(--text-sm);box-shadow:var(--shadow-lg);z-index:260;max-width:90vw;text-align:center;
  opacity:0;visibility:hidden;transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease),visibility var(--dur);
}
.bw-toast.is-visible{opacity:1;visibility:visible;transform:translate(-50%,0);}
@media (min-width:960px){.bw-toast{bottom:32px;}}
