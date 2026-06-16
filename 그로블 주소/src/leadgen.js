class LeadgenClient {
  constructor(options = {}) {
    this.seq = options.seq || process.env.LEADGEN_SEQ || "";
    this.resultUrl = options.resultUrl || process.env.LEADGEN_RESULT_URL || "";
    this.dryRun = String(options.dryRun ?? process.env.DRY_RUN ?? "true") !== "false";
  }

  isConfigured() {
    return Boolean(this.seq);
  }

  async movePaymentToGroup(payment) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        reason: "leadgen_seq_not_configured"
      };
    }

    const fields = {
      seq: this.seq,
      nm: payment.name || "",
      hp: payment.phone || "",
      em: payment.email || "",
      v_birth: payment.orderId || payment.phone || "",
      result_url: this.resultUrl
    };

    if (this.dryRun) {
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
}

module.exports = {
  LeadgenClient
};
