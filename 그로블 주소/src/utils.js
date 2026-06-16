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

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function isPaidStatus(value) {
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return [
    "paid",
    "payment_completed",
    "completed",
    "complete",
    "success",
    "succeeded",
    "approved",
    "결제완료"
  ].includes(normalized);
}

function safeJsonParse(text) {
  try {
    return [JSON.parse(text), null];
  } catch (error) {
    return [null, error];
  }
}

module.exports = {
  isPaidStatus,
  normalizePhone,
  pickFirst,
  safeJsonParse
};
