export const DEFAULT_TEAM_MAILBOX = "deandre@brisbanetvs.com";

export const TEAM_MAILBOXES = Object.freeze([
  Object.freeze({
    id: "deandre",
    name: "DeAndre",
    address: "deandre@brisbanetvs.com",
  }),
  Object.freeze({
    id: "kody",
    name: "Kody",
    address: "kody@brisbanetvs.com",
  }),
  Object.freeze({
    id: "tom",
    name: "Tom",
    address: "tom@brisbanetvs.com",
  }),
]);

const MAILBOX_BY_ID = new Map(TEAM_MAILBOXES.map((mailbox) => [mailbox.id, mailbox]));
const MAILBOX_BY_ADDRESS = new Map(TEAM_MAILBOXES.map((mailbox) => [mailbox.address, mailbox]));

function normalisedMailboxValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function mailboxForAddress(value) {
  return MAILBOX_BY_ADDRESS.get(normalisedMailboxValue(value)) || null;
}

export function requestedMailbox(value) {
  const requested = normalisedMailboxValue(value);
  if (!requested || requested === "all") return null;
  return MAILBOX_BY_ID.get(requested) || MAILBOX_BY_ADDRESS.get(requested) || null;
}

export function isTeamMailboxAddress(value) {
  return Boolean(mailboxForAddress(value));
}

export function mailboxSummaries(countRows = []) {
  const counts = new Map();
  for (const row of Array.isArray(countRows) ? countRows : []) {
    const address = normalisedMailboxValue(row?.address);
    const count = Number(row?.count);
    if (MAILBOX_BY_ADDRESS.has(address) && Number.isSafeInteger(count) && count >= 0) {
      counts.set(address, count);
    }
  }

  return TEAM_MAILBOXES.map((mailbox) => ({
    ...mailbox,
    count: counts.get(mailbox.address) || 0,
  }));
}
