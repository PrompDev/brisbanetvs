export const OPERATIONS_MAILBOXES = Object.freeze([
  "deandre@brisbanetvs.com",
  "kody@brisbanetvs.com",
  "tom@brisbanetvs.com",
]);

export const OPERATIONS_TEST_DOMAIN = "inbound.brisbanetvs.com";

export const OPERATIONS_TEST_MAILBOXES = Object.freeze(
  OPERATIONS_MAILBOXES.map((address) => (
    address.replace("@brisbanetvs.com", `@${OPERATIONS_TEST_DOMAIN}`)
  )),
);

const CANONICAL_MAILBOX_BY_ADDRESS = new Map([
  ...OPERATIONS_MAILBOXES.map((address) => [address, address]),
  ...OPERATIONS_TEST_MAILBOXES.map((address, index) => [address, OPERATIONS_MAILBOXES[index]]),
]);

export function canonicalOperationsMailbox(value) {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return CANONICAL_MAILBOX_BY_ADDRESS.get(address) || null;
}
