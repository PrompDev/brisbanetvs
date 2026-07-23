export const OPERATIONS_MAILBOXES = Object.freeze([
  "deandre@brisbanetvs.com",
  "kody@brisbanetvs.com",
  "tom@brisbanetvs.com",
]);

const OPERATIONS_MAILBOX_SET = new Set(OPERATIONS_MAILBOXES);

export function canonicalOperationsMailbox(value) {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return OPERATIONS_MAILBOX_SET.has(address) ? address : null;
}
