const crypto = require("crypto");
const fs = require("fs/promises");
const http = require("http");
const path = require("path");

const { LeadgenClient } = require("./leadgen");
const { isPaidStatus, normalizePhone, pickFirst, safeJsonParse } = require("./utils");

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, "..", "data");
const PROCESSED_FILE = path.join(DATA_DIR, "processed-orders.jsonl");
const UNMATCHED_FILE = path.join(DATA_DIR, "unmatched-payments.jsonl");
const EVENTS_FILE = path.join(DATA_DIR, "webhook-events.jsonl");

const leadgen = new LeadgenClient();

function loadEnvFile() {
  const envPath = path.resolve(__dirname, "..", ".env");

  try {
    const text = require("fs").readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const index = trimmed.indexOf("=");
      if (index === -1) continue;

      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function appendJsonl(file, value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

async function hasProcessedOrder(orderId) {
  if (!orderId) return false;

  try {
    const text = await fs.readFile(PROCESSED_FILE, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .some((line) => {
        const [entry] = safeJsonParse(line);
        return entry?.orderId === orderId;
      });
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function verifySecret(req, rawBody) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;

  const directSecret = req.headers["x-webhook-secret"];
  if (directSecret && crypto.timingSafeEqual(Buffer.from(String(directSecret)), Buffer.from(secret))) {
    return true;
  }

  const signature = req.headers["x-groble-signature"] || req.headers["x-hub-signature-256"];
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = String(signature).replace(/^sha256=/, "");

  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
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

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function handleGrobleWebhook(req, res) {
  const rawBody = await readBody(req);

  if (!verifySecret(req, rawBody)) {
    return sendJson(res, 401, { ok: false, error: "invalid_webhook_secret" });
  }

  const [payload, parseError] = safeJsonParse(rawBody.toString("utf8"));
  if (parseError) {
    return sendJson(res, 400, { ok: false, error: "invalid_json" });
  }

  const payment = extractPayment(payload);
  await appendJsonl(EVENTS_FILE, {
    receivedAt: new Date().toISOString(),
    payment,
    payload
  });

  if (!isPaidStatus(payment.status)) {
    return sendJson(res, 200, {
      ok: true,
      skipped: true,
      reason: "not_paid_status",
      status: payment.status
    });
  }

  if (!payment.phone) {
    await appendJsonl(UNMATCHED_FILE, {
      reason: "missing_phone",
      payment,
      receivedAt: new Date().toISOString()
    });

    return sendJson(res, 200, {
      ok: true,
      matched: false,
      reason: "missing_phone"
    });
  }

  if (await hasProcessedOrder(payment.orderId)) {
    return sendJson(res, 200, {
      ok: true,
      duplicate: true,
      orderId: payment.orderId
    });
  }

  if (!leadgen.isConfigured()) {
    await appendJsonl(UNMATCHED_FILE, {
      reason: "leadgen_seq_not_configured",
      payment,
      receivedAt: new Date().toISOString()
    });

    return sendJson(res, 200, {
      ok: true,
      matched: false,
      reason: "leadgen_seq_not_configured",
      payment
    });
  }

  const moveResult = await leadgen.movePaymentToGroup(payment);

  await appendJsonl(PROCESSED_FILE, {
    orderId: payment.orderId,
    phone: payment.phone,
    movedAt: new Date().toISOString()
  });

  return sendJson(res, 200, {
    ok: true,
    matched: true,
    payment,
    moveResult
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "groble-leadgen-webhook",
        leadgenConfigured: leadgen.isConfigured(),
        dryRun: leadgen.dryRun
      });
    }

    if (req.method === "POST" && url.pathname === "/webhook/groble") {
      return handleGrobleWebhook(req, res);
    }

    return sendJson(res, 404, { ok: false, error: "not_found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      ok: false,
      error: "internal_server_error",
      message: error.message
    });
  }
});

server.listen(PORT, () => {
  console.log(`Groble webhook server listening on http://localhost:${PORT}`);
  console.log(`Webhook path: http://localhost:${PORT}/webhook/groble`);
});
