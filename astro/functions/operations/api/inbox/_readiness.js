const DEFAULT_TEST_DOMAIN = "inbound.brisbanetvs.com";
const SAFE_DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function testDomain(value) {
  const domain = typeof value === "string"
    ? value.trim().toLowerCase()
    : DEFAULT_TEST_DOMAIN;
  return SAFE_DOMAIN.test(domain) ? domain : DEFAULT_TEST_DOMAIN;
}

export function mailboxRoutingReadiness(env = {}) {
  const rootDeliveryActive = env.TEAM_INBOX_ENABLED === "true";
  const testReceiverActive = !rootDeliveryActive && env.MAIL_TEST_RECEIVER_ENABLED === "true";
  const stagedDomain = testDomain(env.MAIL_TEST_RECEIVER_DOMAIN);

  if (rootDeliveryActive) {
    return {
      status: "active",
      rootDeliveryActive: true,
      testReceiverActive: false,
      testDomain: null,
      summary: "Root address routing is active",
      detail: "Cloudflare is receiving mail for the three Brisbane TVs staff addresses.",
    };
  }

  if (testReceiverActive) {
    return {
      status: "test_ready",
      rootDeliveryActive: false,
      testReceiverActive: true,
      testDomain: stagedDomain,
      summary: "Isolated test receiver ready",
      detail: "Root addresses still use the existing business mail provider.",
    };
  }

  return {
    status: "staged",
    rootDeliveryActive: false,
    testReceiverActive: false,
    testDomain: stagedDomain,
    summary: "Inbound activation staged",
    detail: "Existing business mail remains unchanged.",
  };
}
