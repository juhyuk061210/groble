function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function normalizePhone(value) {
  if (!value) return "";
  let digits = String(value).replace(/\D/g, "");

  if (digits.startsWith("82") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }

  return digits;
}

function pickFirst(obj, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => {
      if (!current || typeof current !== "object") return undefined;
      return current[part];
    }, obj);

    if (value !== undefined && value !== null && value !== "") return value;
  }

  return undefined;
}

function isPaidStatus(value) {
  if (!value) return false;
  const status = String(value).toLowerCase();
  return [
    "paid",
    "payment_completed",
    "completed",
    "complete",
    "success",
    "succeeded",
    "approved"
  ].includes(status);
}

function extractPayment(payload) {
  const status = pickFirst(payload, [
    "status",
    "payment_status",
    "event.status",
    "data.status",
    "data.payment_status",
    "payment.status"
  ]);

  const name = pickFirst(payload, [
    "buyer_name",
    "buyer.name",
    "customer_name",
    "customer.name",
    "name",
    "data.buyer_name",
    "data.buyer.name",
    "data.customer.name"
  ]);

  const phoneRaw = pickFirst(payload, [
    "buyer_phone",
    "buyer.phone",
    "customer_phone",
    "customer.phone",
    "phone",
    "mobile",
    "data.buyer_phone",
    "data.buyer.phone",
    "data.customer.phone"
  ]);

  const orderId = pickFirst(payload, [
    "order_id",
    "orderId",
    "merchant_uid",
    "payment_id",
    "id",
    "data.order_id",
    "data.orderId",
    "data.merchant_uid",
    "data.payment_id",
    "data.id"
  ]);

  const product = pickFirst(payload, [
    "product_name",
    "product.name",
    "item_name",
    "data.product_name",
    "data.product.name",
    "data.item_name"
  ]);

  return {
    name: name || "",
    orderId: orderId ? String(orderId) : "",
    phone: normalizePhone(phoneRaw),
    phoneRaw: phoneRaw || "",
    product: product || "",
    status: status || ""
  };
}

async function sendToLeadgen(payment, env) {
  const fields = {
    seq: env.LEADGEN_SEQ,
    nm: payment.name || "",
    hp: payment.phone || "",
    em: payment.email || "",
    v_birth: payment.orderId || payment.phone || "",
    result_url: env.LEADGEN_RESULT_URL || ""
  };

  if (String(env.DRY_RUN || "true") !== "false") {
    return {
      dryRun: true,
      sentToLeadgen: fields
    };
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  const response = await fetch("https://leadgeny.kr/check/", {
    method: "POST",
    body: formData
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Leadgen request failed: ${response.status} ${text}`);
  }

  return {
    ok: true,
    status: response.status,
    body: text.slice(0, 500)
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "groble-webhook",
        leadgenConfigured: Boolean(env.LEADGEN_SEQ),
        dryRun: String(env.DRY_RUN || "true") !== "false"
      });
    }

    if (request.method !== "POST" || url.pathname !== "/webhook/groble") {
      return json({ ok: false, error: "not_found" }, 404);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const payment = extractPayment(payload);

    if (!isPaidStatus(payment.status)) {
      return json({
        ok: true,
        skipped: true,
        reason: "not_paid_status",
        status: payment.status
      });
    }

    if (!payment.phone) {
      return json({
        ok: true,
        matched: false,
        reason: "missing_phone",
        payment
      });
    }

    if (!env.LEADGEN_SEQ) {
      return json({
        ok: true,
        matched: false,
        reason: "leadgen_seq_not_configured",
        payment
      });
    }

    const moveResult = await sendToLeadgen(payment, env);

    return json({
      ok: true,
      matched: true,
      payment,
      moveResult
    });
  }
};
