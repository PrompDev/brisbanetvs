const inboxRoot = document.querySelector("[data-inbox-root]");

if (inboxRoot) {
  const client = inboxRoot.querySelector("[data-mail-client]");
  const connectionStatus = inboxRoot.querySelector("[data-connection-status]");
  const connectionCopy = inboxRoot.querySelector("[data-connection-copy]");
  const routingState = inboxRoot.querySelector("[data-routing-state]");
  const routingDetail = inboxRoot.querySelector("[data-routing-detail]");
  const readinessIncomingCard = inboxRoot.querySelector("[data-readiness-incoming-card]");
  const readinessIncoming = inboxRoot.querySelector("[data-readiness-incoming]");
  const readinessIncomingDetail = inboxRoot.querySelector("[data-readiness-incoming-detail]");
  const listKicker = inboxRoot.querySelector("[data-list-kicker]");
  const listTitle = inboxRoot.querySelector("[data-list-title]");
  const listCount = inboxRoot.querySelector("[data-list-count]");
  const listFilter = inboxRoot.querySelector("[data-list-filter]");
  const messageList = inboxRoot.querySelector("[data-message-list]");
  const inboxTotal = inboxRoot.querySelector("[data-inbox-total]");
  const draftTotal = inboxRoot.querySelector("[data-draft-total]");
  const searchForm = inboxRoot.querySelector("[data-mail-search]");
  const searchInput = inboxRoot.querySelector("[data-search-input]");
  const clearSearch = inboxRoot.querySelector("[data-clear-search]");
  const refreshButton = inboxRoot.querySelector("[data-refresh-mail]");
  const readerToolbar = inboxRoot.querySelector("[data-reader-toolbar]");
  const readerEmpty = inboxRoot.querySelector("[data-reader-empty]");
  const readerContent = inboxRoot.querySelector("[data-reader-content]");
  const readerMailbox = inboxRoot.querySelector("[data-reader-mailbox]");
  const readerSubject = inboxRoot.querySelector("[data-reader-subject]");
  const readerSummary = inboxRoot.querySelector("[data-reader-summary]");
  const readerThread = inboxRoot.querySelector("[data-reader-thread]");
  const archiveLabel = inboxRoot.querySelector("[data-archive-label]");
  const replyNote = inboxRoot.querySelector("[data-reply-note]");

  const composeDialog = document.querySelector("[data-compose-dialog]");
  const composeForm = composeDialog?.querySelector("[data-compose-form]");
  const composeTitle = composeDialog?.querySelector("[data-compose-title]");
  const composeStatus = composeDialog?.querySelector("[data-compose-status]");
  const discardCompose = composeDialog?.querySelector("[data-discard-compose]");
  const saveDraftButton = composeDialog?.querySelector("[data-save-draft]");
  const sendButton = composeDialog?.querySelector("[data-send-message]");

  const shortDate = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric",
    month: "short",
  });
  const shortTime = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    hour: "numeric",
    minute: "2-digit",
  });
  const fullDate = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const state = {
    folder: "inbox",
    mailbox: "all",
    query: "",
    messages: [],
    drafts: [],
    mailboxes: [
      { id: "deandre", name: "DeAndre", address: "deandre@brisbanetvs.com", count: 0 },
      { id: "kody", name: "Kody", address: "kody@brisbanetvs.com", count: 0 },
      { id: "tom", name: "Tom", address: "tom@brisbanetvs.com", count: 0 },
    ],
    selectedId: null,
    selectedPayload: null,
    draftId: null,
    composerThreadId: "",
    composerInReplyTo: "",
    composerDirty: false,
    routing: { status: "staged", rootDeliveryActive: false, testReceiverActive: false },
    capabilities: { receive: false, createDrafts: true, send: false },
  };

  function createElement(tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function validDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function compactDate(value) {
    const date = validDate(value);
    if (!date) return "Unknown time";
    const now = new Date();
    return date.toDateString() === now.toDateString()
      ? shortTime.format(date)
      : shortDate.format(date);
  }

  function detailedDate(value) {
    const date = validDate(value);
    return date ? fullDate.format(date) : "Unknown time";
  }

  function senderLabel(address) {
    if (typeof address !== "string" || !address.trim()) return "Unknown sender";
    const local = address.split("@")[0] || address;
    return local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || address;
  }

  function senderInitial(address) {
    return senderLabel(address).charAt(0).toUpperCase() || "?";
  }

  function mailboxById(id) {
    return state.mailboxes.find((mailbox) => mailbox.id === id) || null;
  }

  function mailboxByAddress(address) {
    const normalised = typeof address === "string" ? address.toLowerCase() : "";
    return state.mailboxes.find((mailbox) => mailbox.address === normalised) || null;
  }

  function activeMailboxName() {
    return state.mailbox === "all"
      ? "All addresses"
      : mailboxById(state.mailbox)?.name || "Mailbox";
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers: {
        accept: "application/json",
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  }

  function setConnection(message, tone) {
    connectionCopy.textContent = message;
    connectionStatus.classList.remove("is-checking", "is-ready", "is-staged", "is-error");
    connectionStatus.classList.add(`is-${tone}`);
  }

  function applyRoutingState(routing = {}) {
    const status = ["active", "test_ready", "staged"].includes(routing.status)
      ? routing.status
      : "staged";
    state.routing = {
      status,
      rootDeliveryActive: routing.rootDeliveryActive === true,
      testReceiverActive: routing.testReceiverActive === true,
      testDomain: typeof routing.testDomain === "string" ? routing.testDomain : "",
    };
    readinessIncomingCard.classList.remove("is-checking", "is-ready", "is-staged");

    if (status === "active") {
      setConnection("Cloudflare is receiving mail for the Operations inbox.", "ready");
      routingState.textContent = "Root routing active";
      routingDetail.textContent = "Three explicit staff address rules are enabled.";
      readinessIncoming.textContent = "Live";
      readinessIncomingDetail.textContent = "Root staff addresses";
      readinessIncomingCard.classList.add("is-ready");
      return;
    }

    if (status === "test_ready") {
      setConnection(
        "The isolated Cloudflare test receiver is ready. Existing business mail is unchanged.",
        "ready",
      );
      routingState.textContent = "Test receiver ready";
      routingDetail.textContent = "Root addresses still use the existing mail provider.";
      readinessIncoming.textContent = "Test ready";
      readinessIncomingDetail.textContent = state.routing.testDomain || "Isolated receiver";
      readinessIncomingCard.classList.add("is-ready");
      return;
    }

    setConnection("Mailbox dashboard ready. Inbound activation is staged.", "staged");
    routingState.textContent = "Inbound activation staged";
    routingDetail.textContent = "Existing business mail remains unchanged.";
    readinessIncoming.textContent = "Staged";
    readinessIncomingDetail.textContent = "Root mail unchanged";
    readinessIncomingCard.classList.add("is-staged");
  }

  function updateNavigation() {
    inboxRoot.querySelectorAll("[data-folder]").forEach((button) => {
      const active = button.dataset.folder === state.folder;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    inboxRoot.querySelectorAll("[data-mailbox]").forEach((button) => {
      const active = button.dataset.mailbox === state.mailbox;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    listKicker.textContent = activeMailboxName();
    listTitle.textContent = state.folder === "drafts"
      ? "Drafts"
      : state.folder === "archived" ? "Archived" : "Inbox";
    listFilter.textContent = state.query ? `Matching "${state.query}"` : "Newest first";
  }

  function updateMailboxCounts(mailboxes) {
    if (Array.isArray(mailboxes) && mailboxes.length) {
      state.mailboxes = mailboxes;
    }
    const total = state.mailboxes.reduce((sum, mailbox) => sum + (Number(mailbox.count) || 0), 0);
    inboxTotal.textContent = String(total);
    const allCount = inboxRoot.querySelector('[data-mailbox-count="all"]');
    if (allCount) allCount.textContent = String(total);

    state.mailboxes.forEach((mailbox) => {
      const node = inboxRoot.querySelector(`[data-mailbox-count="${mailbox.id}"]`);
      if (node) node.textContent = String(Number(mailbox.count) || 0);
    });
  }

  function groupMessages(messages) {
    const grouped = new Map();
    for (const message of Array.isArray(messages) ? messages : []) {
      const key = message.threadId || message.id;
      const group = grouped.get(key);
      if (group) {
        group.threadCount += 1;
        group.attachmentCount += Number(message.attachmentCount) || 0;
        group.readAt = group.readAt && message.readAt ? group.readAt : null;
      } else {
        grouped.set(key, {
          ...message,
          threadCount: 1,
          attachmentCount: Number(message.attachmentCount) || 0,
        });
      }
    }
    return Array.from(grouped.values());
  }

  function emptyList(title, detail) {
    const item = createElement("li", "mail-empty-list");
    item.append(
      createElement("strong", "", title),
      createElement("span", "", detail),
    );
    return item;
  }

  function renderMessageRows() {
    messageList.replaceChildren();
    const grouped = groupMessages(state.messages);
    listCount.textContent = `${grouped.length} conversation${grouped.length === 1 ? "" : "s"}`;

    if (!grouped.length) {
      messageList.append(emptyList(
        state.query ? "No matching conversations" : state.folder === "archived" ? "Archive is clear" : "Nothing here yet",
        state.query
          ? "Try a different sender, subject or phrase."
          : state.folder === "archived"
            ? "Archived conversations will be kept here."
            : state.routing.rootDeliveryActive
              ? "New customer mail will appear here."
              : state.routing.testReceiverActive
                ? "Messages sent to the isolated test addresses will appear here. Root business mail stays unchanged."
              : "The dashboard is ready. Customer mail will appear after inbound routing is connected.",
      ));
      return;
    }

    grouped.forEach((message) => {
      const item = createElement("li");
      const button = createElement("button", "mail-row");
      button.type = "button";
      button.dataset.messageId = message.id;
      button.classList.toggle("is-unread", !message.readAt);
      button.classList.toggle("is-selected", state.selectedId === message.id);
      button.setAttribute("aria-label", `Open ${message.subject || "message"} from ${message.from || "unknown sender"}`);

      const avatar = createElement("span", "mail-sender-avatar", senderInitial(message.from));
      const main = createElement("span", "mail-row-main");
      const topLine = createElement("span", "mail-row-topline");
      topLine.append(
        createElement("span", "mail-row-sender", senderLabel(message.from)),
        createElement("time", "mail-row-time", compactDate(message.receivedAt)),
      );

      const subjectLine = createElement("span", "mail-row-subjectline");
      subjectLine.append(createElement("span", "mail-row-subject", message.subject || "(No subject)"));
      if (message.threadCount > 1) {
        subjectLine.append(createElement("span", "mail-thread-count", message.threadCount));
      }
      if (message.attachmentCount > 0) {
        subjectLine.append(createElement("span", "mail-attachment-count", `${message.attachmentCount} file${message.attachmentCount === 1 ? "" : "s"}`));
      }

      const preview = createElement("span", "mail-row-preview", message.preview || "No plain-text preview is available.");
      const footLine = createElement("span", "mail-row-footline");
      const mailbox = message.mailbox || mailboxByAddress(message.to);
      footLine.append(
        createElement("span", "mail-row-mailbox", mailbox?.name || message.to || "Mailbox"),
        createElement("span", "mail-row-status", message.readAt ? "Read" : "New"),
      );
      main.append(topLine, subjectLine, preview, footLine);
      button.append(avatar, main);
      item.append(button);
      messageList.append(item);
    });
  }

  function filteredDrafts() {
    const mailbox = mailboxById(state.mailbox);
    const query = state.query.toLowerCase();
    return state.drafts.filter((draft) => {
      if (mailbox && draft.from !== mailbox.address) return false;
      if (!query) return true;
      return [draft.from, draft.to, draft.subject, draft.preview]
        .some((value) => typeof value === "string" && value.toLowerCase().includes(query));
    });
  }

  function renderDraftRows() {
    messageList.replaceChildren();
    const drafts = filteredDrafts();
    listCount.textContent = `${drafts.length} draft${drafts.length === 1 ? "" : "s"}`;

    if (!drafts.length) {
      messageList.append(emptyList(
        state.query ? "No matching drafts" : "No drafts saved",
        state.query ? "Try a different search." : "Start a reply or compose a new message.",
      ));
      return;
    }

    drafts.forEach((draft) => {
      const item = createElement("li");
      const button = createElement("button", "mail-row");
      button.type = "button";
      button.dataset.draftId = draft.id;
      button.setAttribute("aria-label", `Edit draft: ${draft.subject || "No subject"}`);

      const avatar = createElement("span", "mail-sender-avatar", "D");
      const main = createElement("span", "mail-row-main");
      const topLine = createElement("span", "mail-row-topline");
      topLine.append(
        createElement("span", "mail-row-sender", draft.to || "No recipient"),
        createElement("time", "mail-row-time", compactDate(draft.updatedAt)),
      );
      const subjectLine = createElement("span", "mail-row-subjectline");
      subjectLine.append(createElement("span", "mail-row-subject", draft.subject || "(No subject)"));
      const preview = createElement("span", "mail-row-preview", draft.preview || "Open to continue writing.");
      const footLine = createElement("span", "mail-row-footline");
      const mailbox = mailboxByAddress(draft.from);
      footLine.append(
        createElement("span", "mail-row-mailbox", mailbox?.name || draft.from || "DeAndre"),
        createElement("span", "mail-row-status", "Not sent"),
      );
      main.append(topLine, subjectLine, preview, footLine);
      button.append(avatar, main);
      item.append(button);
      messageList.append(item);
    });
  }

  function renderCurrentList() {
    updateNavigation();
    if (state.folder === "drafts") renderDraftRows();
    else renderMessageRows();
  }

  function showListError(message) {
    messageList.replaceChildren(emptyList("Mailbox unavailable", message));
    listCount.textContent = "Could not load";
  }

  async function loadInbox() {
    const params = new URLSearchParams({
      status: state.folder === "archived" ? "archived" : "stored",
      limit: "100",
    });
    if (state.mailbox !== "all") params.set("mailbox", state.mailbox);
    if (state.query && state.folder !== "drafts") params.set("query", state.query);

    try {
      const { response, payload } = await requestJson(`/operations/api/inbox?${params}`);
      if (!response.ok || !payload?.ok) {
        setConnection(
          response.status === 403
            ? "Secure session expired. Sign in again to open mail."
            : "The protected mailbox is temporarily unavailable.",
          "error",
        );
        if (state.folder !== "drafts") {
          showListError(response.status === 403 ? "Sign in again, then refresh this page." : "Please refresh in a moment.");
        }
        return;
      }

      state.messages = Array.isArray(payload.messages) ? payload.messages : [];
      state.capabilities = payload.capabilities || state.capabilities;
      updateMailboxCounts(payload.mailboxes);
      applyRoutingState(payload.routing || {
        status: payload.inboundEnabled === true ? "active" : "staged",
        rootDeliveryActive: payload.inboundEnabled === true,
        testReceiverActive: false,
      });
      replyNote.textContent = payload.capabilities?.send
        ? "Review your reply before sending."
        : "Replies save as drafts while Cloudflare sending is being enabled.";

      if (state.folder !== "drafts") renderCurrentList();
    } catch {
      setConnection("The protected mailbox is temporarily unavailable.", "error");
      if (state.folder !== "drafts") showListError("Please check the connection and refresh.");
    }
  }

  async function loadDrafts() {
    try {
      const { response, payload } = await requestJson("/operations/api/inbox/drafts?limit=100");
      if (!response.ok || !payload?.ok) {
        if (state.folder === "drafts") {
          showListError(response.status === 403 ? "Sign in again to view saved drafts." : "Please refresh in a moment.");
        }
        return;
      }
      state.drafts = Array.isArray(payload.drafts) ? payload.drafts : [];
      draftTotal.textContent = String(Number(payload.total) || state.drafts.length);
      if (state.folder === "drafts") renderCurrentList();
    } catch {
      if (state.folder === "drafts") showListError("Saved drafts could not be loaded.");
    }
  }

  async function refreshAll() {
    refreshButton.classList.add("is-spinning");
    refreshButton.disabled = true;
    await Promise.all([loadInbox(), loadDrafts()]);
    refreshButton.classList.remove("is-spinning");
    refreshButton.disabled = false;
  }

  function closeReader() {
    state.selectedId = null;
    state.selectedPayload = null;
    readerToolbar.hidden = true;
    readerContent.hidden = true;
    readerEmpty.hidden = false;
    readerThread.replaceChildren();
    client.classList.remove("has-reader");
    if (state.folder !== "drafts") renderMessageRows();
  }

  function renderThread(payload) {
    const messages = Array.isArray(payload.thread) && payload.thread.length
      ? payload.thread
      : [payload.message].filter(Boolean);
    const latest = messages[messages.length - 1] || payload.message;
    const mailbox = latest?.mailbox || mailboxByAddress(latest?.to);
    readerMailbox.textContent = mailbox ? `${mailbox.name} - ${mailbox.address}` : latest?.to || "Mailbox";
    readerSubject.textContent = latest?.subject || "(No subject)";
    readerSummary.textContent = `${messages.length} message${messages.length === 1 ? "" : "s"} in this conversation - last received ${detailedDate(latest?.receivedAt)}`;
    archiveLabel.textContent = state.folder === "archived" ? "Restore" : "Archive";
    readerThread.replaceChildren();

    messages.forEach((message) => {
      const article = createElement("article", "mail-thread-message");
      const header = createElement("header", "mail-thread-message-header");
      const avatar = createElement("span", "mail-sender-avatar", senderInitial(message.from));
      const identity = createElement("div");
      identity.append(
        createElement("strong", "", `${senderLabel(message.from)} <${message.from || "unknown"}>`),
        createElement("span", "", `To ${message.to || "Operations mailbox"}`),
      );
      const time = createElement("time", "", detailedDate(message.receivedAt));
      if (message.receivedAt) time.dateTime = message.receivedAt;
      header.append(avatar, identity, time);

      const body = createElement(
        "pre",
        "mail-thread-body",
        message.plainText || "No safe plain-text version is available for this message.",
      );
      article.append(header, body);
      const attachmentCount = Number(message.attachmentCount) || 0;
      if (attachmentCount) {
        article.append(createElement(
          "div",
          "mail-attachment-note",
          `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"} retained privately. Downloads are not enabled yet.`,
        ));
      }
      readerThread.append(article);
    });

    readerEmpty.hidden = true;
    readerToolbar.hidden = false;
    readerContent.hidden = false;
    client.classList.add("has-reader");
  }

  async function updateThread(id, update) {
    const { response, payload } = await requestJson(`/operations/api/inbox/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    });
    return response.ok && payload?.ok ? payload : null;
  }

  async function openMessage(id) {
    if (!id) return;
    state.selectedId = id;
    renderMessageRows();
    readerEmpty.hidden = false;
    readerEmpty.querySelector("h2").textContent = "Opening conversation...";
    readerEmpty.querySelector("p").textContent = "Loading the protected message from Operations.";
    readerToolbar.hidden = true;
    readerContent.hidden = true;
    client.classList.add("has-reader");

    try {
      const { response, payload } = await requestJson(`/operations/api/inbox/${encodeURIComponent(id)}`);
      if (!response.ok || !payload?.ok || !payload.message) {
        readerEmpty.querySelector("h2").textContent = response.status === 403 ? "Secure session expired" : "Conversation unavailable";
        readerEmpty.querySelector("p").textContent = response.status === 403
          ? "Sign in again to read this message."
          : "Return to the list and try again.";
        return;
      }

      state.selectedPayload = payload;
      renderThread(payload);
      const selected = state.messages.find((message) => message.id === id);
      if (selected && !selected.readAt) {
        const updated = await updateThread(id, { read: true });
        if (updated) {
          state.messages = state.messages.map((message) => (
            (updated.threadId ? message.threadId === updated.threadId : message.id === id)
              ? { ...message, readAt: updated.readAt }
              : message
          ));
          renderMessageRows();
        }
      }
    } catch {
      readerEmpty.hidden = false;
      readerToolbar.hidden = true;
      readerContent.hidden = true;
      readerEmpty.querySelector("h2").textContent = "Conversation unavailable";
      readerEmpty.querySelector("p").textContent = "Return to the list and try again.";
    }
  }

  function selectedComposeAddress() {
    return state.mailbox === "all"
      ? "deandre@brisbanetvs.com"
      : mailboxById(state.mailbox)?.address || "deandre@brisbanetvs.com";
  }

  function setComposeStatus(message, error = false) {
    composeStatus.textContent = message;
    composeStatus.classList.toggle("is-error", error);
    composeStatus.classList.toggle("is-dirty", message === "Unsaved changes");
  }

  function setComposerDirty(dirty) {
    state.composerDirty = dirty;
    if (dirty) setComposeStatus("Unsaved changes");
    else if (composeStatus.textContent === "Unsaved changes") setComposeStatus("");
  }

  function openComposer(values = {}, draftId = null) {
    if (!composeDialog || !composeForm) return;
    composeForm.reset();
    state.draftId = draftId;
    state.composerThreadId = values.threadId || "";
    state.composerInReplyTo = values.inReplyTo || "";
    composeTitle.textContent = draftId ? "Edit draft" : values.inReplyTo ? "Reply" : "New message";
    discardCompose.textContent = draftId ? "Close" : "Discard";
    composeForm.elements.from.value = values.from || selectedComposeAddress();
    composeForm.elements.to.value = values.to || "";
    composeForm.elements.subject.value = values.subject || "";
    composeForm.elements.plainText.value = values.plainText || "";
    state.composerDirty = false;
    setComposeStatus("");
    sendButton.disabled = true;
    sendButton.title = "Cloudflare Email Sending must be onboarded before delivery is enabled";
    if (typeof composeDialog.showModal === "function") composeDialog.showModal();
    else composeDialog.setAttribute("open", "");
    window.setTimeout(() => composeForm.elements.to.focus(), 0);
  }

  function closeComposer({ force = false } = {}) {
    if (!composeDialog) return;
    if (
      !force
      && state.composerDirty
      && !window.confirm("Discard unsaved changes?")
    ) return;
    if (composeDialog.open && typeof composeDialog.close === "function") composeDialog.close();
    else composeDialog.removeAttribute("open");
    state.draftId = null;
    state.composerThreadId = "";
    state.composerInReplyTo = "";
    state.composerDirty = false;
    setComposeStatus("");
  }

  async function openDraft(id) {
    if (!id) return;
    try {
      const { response, payload } = await requestJson(`/operations/api/inbox/drafts/${encodeURIComponent(id)}`);
      if (!response.ok || !payload?.ok || !payload.draft) {
        setConnection("That draft could not be opened.", "error");
        return;
      }
      openComposer(payload.draft, payload.draft.id);
    } catch {
      setConnection("That draft could not be opened.", "error");
    }
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (!composeForm || !composeForm.reportValidity()) return;
    saveDraftButton.disabled = true;
    setComposeStatus("Saving...");

    const formData = new FormData(composeForm);
    const draft = {
      from: formData.get("from"),
      to: formData.get("to"),
      subject: formData.get("subject"),
      plainText: formData.get("plainText"),
      threadId: state.composerThreadId,
      inReplyTo: state.composerInReplyTo,
    };
    const path = state.draftId
      ? `/operations/api/inbox/drafts/${encodeURIComponent(state.draftId)}`
      : "/operations/api/inbox/drafts";

    try {
      const { response, payload } = await requestJson(path, {
        method: state.draftId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok || !payload?.ok) {
        setComposeStatus(
          response.status === 403
            ? "Secure session expired. Sign in again."
            : "Draft could not be saved.",
          true,
        );
        return;
      }
      setComposerDirty(false);
      setComposeStatus("Saved. Nothing was sent.");
      await loadDrafts();
      window.setTimeout(() => closeComposer({ force: true }), 450);
    } catch {
      setComposeStatus("Draft could not be saved.", true);
    } finally {
      saveDraftButton.disabled = false;
    }
  }

  async function archiveSelected() {
    if (!state.selectedId) return;
    const archived = state.folder !== "archived";
    const result = await updateThread(state.selectedId, { archived });
    if (!result) {
      setConnection("The conversation could not be updated.", "error");
      return;
    }
    closeReader();
    await loadInbox();
  }

  async function markSelectedUnread() {
    if (!state.selectedId) return;
    const result = await updateThread(state.selectedId, { read: false });
    if (!result) {
      setConnection("The conversation could not be updated.", "error");
      return;
    }
    state.messages = state.messages.map((message) => (
      (result.threadId ? message.threadId === result.threadId : message.id === state.selectedId)
        ? { ...message, readAt: null }
        : message
    ));
    closeReader();
  }

  function activateFolder(folder) {
    if (!["inbox", "drafts", "archived"].includes(folder)) return;
    state.folder = folder;
    closeReader();
    renderCurrentList();
    if (folder === "drafts") loadDrafts();
    else loadInbox();
  }

  function activateMailbox(mailbox) {
    if (mailbox !== "all" && !mailboxById(mailbox)) return;
    state.mailbox = mailbox;
    closeReader();
    renderCurrentList();
    if (state.folder === "drafts") renderDraftRows();
    else loadInbox();
  }

  let searchTimer = null;
  function performSearch() {
    state.query = searchInput.value.trim().slice(0, 120);
    clearSearch.hidden = !state.query;
    if (state.folder === "drafts") renderCurrentList();
    else loadInbox();
  }

  inboxRoot.addEventListener("click", (event) => {
    const folderButton = event.target.closest("[data-folder]");
    if (folderButton) {
      activateFolder(folderButton.dataset.folder);
      return;
    }
    const mailboxButton = event.target.closest("[data-mailbox]");
    if (mailboxButton) {
      activateMailbox(mailboxButton.dataset.mailbox);
      return;
    }
    const messageButton = event.target.closest("[data-message-id]");
    if (messageButton) {
      openMessage(messageButton.dataset.messageId);
      return;
    }
    const draftButton = event.target.closest("[data-draft-id]");
    if (draftButton) openDraft(draftButton.dataset.draftId);
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performSearch();
  });
  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(performSearch, 280);
  });
  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    performSearch();
    searchInput.focus();
  });
  refreshButton.addEventListener("click", refreshAll);
  inboxRoot.querySelector("[data-compose-new]").addEventListener("click", () => openComposer());
  inboxRoot.querySelector("[data-close-reader]").addEventListener("click", closeReader);
  inboxRoot.querySelector("[data-reply-message]").addEventListener("click", () => {
    if (state.selectedPayload?.replyDraft) openComposer(state.selectedPayload.replyDraft);
  });
  inboxRoot.querySelector("[data-archive-thread]").addEventListener("click", archiveSelected);
  inboxRoot.querySelector("[data-mark-unread]").addEventListener("click", markSelectedUnread);
  composeDialog?.querySelector("[data-close-compose]")?.addEventListener("click", () => closeComposer());
  discardCompose?.addEventListener("click", () => closeComposer());
  composeForm?.addEventListener("input", () => setComposerDirty(true));
  composeForm?.addEventListener("change", () => setComposerDirty(true));
  composeForm?.addEventListener("submit", saveDraft);
  composeDialog?.addEventListener("keydown", (event) => {
    if (
      composeDialog.open
      && (event.ctrlKey || event.metaKey)
      && event.key.toLowerCase() === "s"
    ) {
      event.preventDefault();
      composeForm?.requestSubmit(saveDraftButton);
    }
  });
  composeDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeComposer();
  });

  updateNavigation();
  refreshAll();
}
