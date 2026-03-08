const crypto = require("crypto")

const MOBILE_MONEY_PROVIDER_CONFIG = {
  momo: {
    method: "momo",
    slug: "mtn",
    providerCode: "mtn_momo",
    providerLabel: "MTN Mobile Money",
    callbackPath: "/payments/mobile-money/mtn/callback",
    webhookPath: "/payments/mobile-money/mtn/webhook",
  },
  airtel: {
    method: "airtel",
    slug: "airtel",
    providerCode: "airtel_money",
    providerLabel: "Airtel Money",
    callbackPath: "/payments/mobile-money/airtel/callback",
    webhookPath: "/payments/mobile-money/airtel/webhook",
  },
}

const MOBILE_MONEY_ROUTE_ALIASES = {
  mtn: "momo",
  momo: "momo",
  "mtn-momo": "momo",
  airtel: "airtel",
  "airtel-money": "airtel",
}

const _randomSuffix = () => crypto.randomBytes(3).toString("hex")

const isMobileMoneyMethod = (method) => Object.prototype.hasOwnProperty.call(MOBILE_MONEY_PROVIDER_CONFIG, String(method || "").toLowerCase())

const resolveMobileMoneyProviderFromMethod = (method) => {
  const normalizedMethod = String(method || "").trim().toLowerCase()
  return MOBILE_MONEY_PROVIDER_CONFIG[normalizedMethod] || null
}

const resolveMobileMoneyProviderFromRoute = (slug) => {
  const normalizedSlug = String(slug || "").trim().toLowerCase()
  const method = MOBILE_MONEY_ROUTE_ALIASES[normalizedSlug]
  if (!method) return null
  return resolveMobileMoneyProviderFromMethod(method)
}

const createMobileMoneyPaymentSessionStub = ({ order, buyer }) => {
  const provider = resolveMobileMoneyProviderFromMethod(order?.paymentMethod)
  if (!provider) {
    throw new Error(`Unsupported mobile money method: ${String(order?.paymentMethod || "")}`)
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const providerReference = `mm_${provider.slug}_${Date.now()}_${_randomSuffix()}`
  const amount = Math.round(Number(order?.amountDueToday) || 0)
  const currency = String(order?.currency || "RWF").toUpperCase()
  const buyerName = buyer?.fullName || order?.buyerName || "Buyer"

  const message =
    `${provider.providerLabel} payment request created in stub mode. ` +
    "No live collection has been initiated yet. Connect the provider API to send a payment prompt to the buyer."

  return {
    provider: "mobile_money",
    paymentRail: "mobile_money",
    method: provider.method,
    status: "pending_provider_integration",
    redirectUrl: null,
    clientAction: {
      type: "show_instructions",
      url: null,
      message,
    },
    mobileMoney: {
      stub: true,
      provider: provider.slug,
      providerCode: provider.providerCode,
      providerLabel: provider.providerLabel,
      reference: providerReference,
      orderId: String(order?._id),
      orderNumber: String(order?.orderNumber || ""),
      amount,
      currency,
      expiresAt,
      buyer: {
        name: buyerName,
        email: buyer?.email || null,
      },
      instructions: [
        `Collect ${amount.toLocaleString()} ${currency} from the buyer via ${provider.providerLabel}.`,
        "Capture the provider transaction reference and map it to the order.",
        `POST provider webhook events to ${provider.webhookPath} (stub endpoint in this project).`,
        `Optionally return the browser/user to ${provider.callbackPath} after authorization.`,
      ],
      integration: {
        callbackPath: provider.callbackPath,
        webhookPath: provider.webhookPath,
        nextStep: "Replace this stub with the real provider collection API call and signature verification.",
      },
    },
  }
}

const _getProviderPayoutConfig = (provider) => {
  const upperSlug = String(provider?.slug || "").toUpperCase()
  const providerUrl =
    process.env[`MOBILE_MONEY_${upperSlug}_PAYOUT_URL`] ||
    process.env.MOBILE_MONEY_PAYOUT_API_URL ||
    ""
  const providerToken =
    process.env[`MOBILE_MONEY_${upperSlug}_PAYOUT_TOKEN`] ||
    process.env.MOBILE_MONEY_PAYOUT_API_TOKEN ||
    ""

  return {
    url: String(providerUrl || "").trim(),
    token: String(providerToken || "").trim(),
    mode: String(process.env.MOBILE_MONEY_PAYOUT_MODE || "").trim().toLowerCase() || "stub",
  }
}

const createMobileMoneyPayoutTransfer = async ({ order, farmer, method }) => {
  const provider = resolveMobileMoneyProviderFromMethod(method || order?.paymentMethod)
  if (!provider) {
    throw new Error(`Unsupported mobile money payout method: ${String(method || order?.paymentMethod || "")}`)
  }

  const amount = Math.round(Number(order?.depositAmount) || Number(order?.amountDueToday) || 0)
  if (amount <= 0) {
    throw new Error("Payout amount must be greater than zero")
  }

  const destinationMsisdn = String(farmer?.phoneNumber || "").trim()
  if (!destinationMsisdn) {
    throw new Error("Farmer phone number is required for mobile money payout")
  }

  const currency = String(order?.currency || "RWF").toUpperCase()
  const reference = `mm_payout_${provider.slug}_${Date.now()}_${_randomSuffix()}`
  const requestPayload = {
    reference,
    amount,
    currency,
    destinationMsisdn,
    orderId: String(order?._id || ""),
    orderNumber: String(order?.orderNumber || ""),
    farmerId: String(order?.farmer || ""),
    buyerId: String(order?.buyer || ""),
    payoutType: "escrow_release",
  }

  const config = _getProviderPayoutConfig(provider)
  if (!config.url || config.mode === "stub") {
    return {
      provider: "mobile_money",
      paymentRail: "mobile_money",
      method: provider.method,
      executionMode: "stub",
      status: "submitted",
      providerCode: provider.providerCode,
      providerLabel: provider.providerLabel,
      externalReference: reference,
      request: requestPayload,
      response: {
        stub: true,
        note:
          "Mobile money payout executed in stub mode. Configure MOBILE_MONEY_PAYOUT_API_URL (or provider-specific URL) and token to use live provider payouts.",
      },
    }
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    },
    body: JSON.stringify({
      provider: provider.slug,
      ...requestPayload,
    }),
  })

  let responseBody = null
  try {
    responseBody = await response.json()
  } catch (error) {
    responseBody = { raw: await response.text().catch(() => null) }
  }

  if (!response.ok) {
    const err = new Error(`Mobile money payout provider responded with ${response.status}`)
    err.code = `MM_PAYOUT_${response.status}`
    err.details = responseBody
    err.request = requestPayload
    throw err
  }

  return {
    provider: "mobile_money",
    paymentRail: "mobile_money",
    method: provider.method,
    executionMode: "live",
    status: "submitted",
    providerCode: provider.providerCode,
    providerLabel: provider.providerLabel,
    externalReference:
      responseBody?.reference ||
      responseBody?.transactionId ||
      responseBody?.id ||
      reference,
    request: requestPayload,
    response: responseBody,
  }
}

module.exports = {
  createMobileMoneyPaymentSessionStub,
  createMobileMoneyPayoutTransfer,
  isMobileMoneyMethod,
  resolveMobileMoneyProviderFromMethod,
  resolveMobileMoneyProviderFromRoute,
}
