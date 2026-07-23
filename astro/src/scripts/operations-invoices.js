import qrcode from "qrcode-generator";

const builder = document.querySelector("[data-invoice-builder]");

if (builder) {
  const STORAGE_KEY = "brisbane-operations-invoice-draft-v1";
  const STEP_ORDER = ["details", "items", "review"];
  const PAYMENT_PLACEHOLDERS = {
    paymentUrl: "https://brisbanetvs.com/pay",
    bankAccountName: "Brisbane TVs",
    bankBsb: "000-000",
    bankAccountNumber: "00000000",
  };
  const currency = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  });
  const dateFormat = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const form = builder.querySelector("[data-invoice-form]");
  const lineItems = builder.querySelector("[data-line-items]");
  const lineTemplate = builder.querySelector("[data-line-item-template]");
  const message = builder.querySelector("[data-form-message]");
  const draftStatus = builder.querySelector("[data-draft-status]");
  const previousButton = builder.querySelector("[data-previous-step]");
  const nextButton = builder.querySelector("[data-next-step]");
  const printButton = builder.querySelector("[data-print-invoice]");
  const addLineButton = builder.querySelector("[data-add-line]");
  const resetButton = builder.querySelector("[data-reset-draft]");
  const abnField = builder.querySelector("[data-abn-field]");
  const stepButtons = Array.from(builder.querySelectorAll("[data-step-target]"));
  const stepPanels = Array.from(builder.querySelectorAll("[data-step-panel]"));
  const brisbaneDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const field = (name) => form.elements.namedItem(name);
  const isoDate = (date) => {
    const parts = Object.fromEntries(
      brisbaneDate.formatToParts(date).map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const addIsoDays = (value, days) => {
    const next = new Date(`${value}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  };
  const createLine = () => ({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    description: "",
    quantity: "1",
    unitPrice: "",
  });
  const initialState = () => {
    const today = isoDate(new Date());
    return {
      currentStep: "details",
      customerName: "",
      customerBusiness: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      invoiceNumber: "",
      issueDate: today,
      dueDate: addIsoDays(today, 7),
      gstRegistered: false,
      supplierAbn: "",
      customerNote: "",
      paymentInstructions: "",
      paymentUrl: PAYMENT_PLACEHOLDERS.paymentUrl,
      bankName: "",
      bankAccountName: PAYMENT_PLACEHOLDERS.bankAccountName,
      bankBsb: PAYMENT_PLACEHOLDERS.bankBsb,
      bankAccountNumber: PAYMENT_PLACEHOLDERS.bankAccountNumber,
      paymentReference: "",
      items: [createLine()],
    };
  };

  const cleanText = (value, limit) => String(value || "").slice(0, limit);
  const cleanDate = (value, fallback) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : fallback;
  const cleanNumber = (value, fallback = "") => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? String(number) : fallback;
  };

  function normaliseState(value) {
    const defaults = initialState();
    if (!value || typeof value !== "object") return defaults;
    const incomingItems = Array.isArray(value.items) ? value.items.slice(0, 50) : [];
    const items = incomingItems.map((item) => ({
      id: cleanText(item?.id, 100) || createLine().id,
      description: cleanText(item?.description, 180),
      quantity: cleanNumber(item?.quantity, "1"),
      unitPrice: cleanNumber(item?.unitPrice),
    }));
    return {
      currentStep: STEP_ORDER.includes(value.currentStep) ? value.currentStep : "details",
      customerName: cleanText(value.customerName, 120),
      customerBusiness: cleanText(value.customerBusiness, 120),
      customerEmail: cleanText(value.customerEmail, 320),
      customerPhone: cleanText(value.customerPhone, 40),
      customerAddress: cleanText(value.customerAddress, 400),
      invoiceNumber: cleanText(value.invoiceNumber, 40),
      issueDate: cleanDate(value.issueDate, defaults.issueDate),
      dueDate: cleanDate(value.dueDate, defaults.dueDate),
      gstRegistered: value.gstRegistered === true,
      supplierAbn: cleanText(value.supplierAbn, 14),
      customerNote: cleanText(value.customerNote, 800),
      paymentInstructions: cleanText(value.paymentInstructions, 800),
      paymentUrl: cleanText(value.paymentUrl, 500) || defaults.paymentUrl,
      bankName: cleanText(value.bankName, 100),
      bankAccountName: cleanText(value.bankAccountName, 120) || defaults.bankAccountName,
      bankBsb: cleanText(value.bankBsb, 12) || defaults.bankBsb,
      bankAccountNumber: cleanText(value.bankAccountNumber, 24) || defaults.bankAccountNumber,
      paymentReference: cleanText(value.paymentReference, 80),
      items: items.length ? items : [createLine()],
    };
  }

  function loadState() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? normaliseState(JSON.parse(stored)) : initialState();
    } catch {
      return initialState();
    }
  }

  let state = loadState();

  function syncFieldsFromState() {
    [
      "customerName",
      "customerBusiness",
      "customerEmail",
      "customerPhone",
      "customerAddress",
      "invoiceNumber",
      "issueDate",
      "dueDate",
      "supplierAbn",
      "customerNote",
      "paymentInstructions",
      "paymentUrl",
      "bankName",
      "bankAccountName",
      "bankBsb",
      "bankAccountNumber",
      "paymentReference",
    ].forEach((name) => {
      field(name).value = state[name];
    });
    field("gstRegistered").checked = state.gstRegistered;
    abnField.hidden = !state.gstRegistered;
  }

  function syncStateFromFields() {
    [
      "customerName",
      "customerBusiness",
      "customerEmail",
      "customerPhone",
      "customerAddress",
      "invoiceNumber",
      "issueDate",
      "dueDate",
      "supplierAbn",
      "customerNote",
      "paymentInstructions",
      "paymentUrl",
      "bankName",
      "bankAccountName",
      "bankBsb",
      "bankAccountNumber",
      "paymentReference",
    ].forEach((name) => {
      state[name] = field(name).value.trim();
    });
    state.gstRegistered = field("gstRegistered").checked;
  }

  function saveState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const time = new Intl.DateTimeFormat("en-AU", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date());
      draftStatus.querySelector("small").textContent = `Saved in this tab at ${time}`;
    } catch {
      draftStatus.querySelector("small").textContent = "This browser blocked tab storage";
    }
  }

  function numberValue(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function completeItems() {
    return state.items
      .map((item) => ({
        ...item,
        description: item.description.trim(),
        quantityValue: numberValue(item.quantity, 0),
        unitPriceValue: numberValue(item.unitPrice, 0),
      }))
      .filter((item) => (
        item.description
        && item.quantityValue > 0
        && item.unitPrice !== ""
        && Number.isFinite(Number(item.unitPrice))
        && Number(item.unitPrice) >= 0
      ));
  }

  function totals() {
    const subtotal = completeItems().reduce(
      (sum, item) => sum + Math.round(item.quantityValue * item.unitPriceValue * 100) / 100,
      0,
    );
    return {
      subtotal,
      gst: state.gstRegistered ? subtotal / 11 : 0,
      total: subtotal,
    };
  }

  function formatDate(value) {
    if (!value) return "—";
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
  }

  function setText(selector, value) {
    const element = builder.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setOptionalText(selector, wrapSelector, value) {
    const element = builder.querySelector(selector);
    const wrap = builder.querySelector(wrapSelector);
    if (!element || !wrap) return;
    const hasValue = Boolean(String(value || "").trim());
    element.textContent = hasValue ? value : "";
    wrap.hidden = !hasValue;
  }

  function safePaymentUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function renderPaymentBlock(number) {
    const paymentUrl = safePaymentUrl(state.paymentUrl);
    builder.querySelectorAll("[data-preview-payment-link]").forEach((link) => {
      if (paymentUrl) {
        link.href = paymentUrl;
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    });

    const qr = qrcode(0, "M");
    qr.addData(paymentUrl || PAYMENT_PLACEHOLDERS.paymentUrl);
    qr.make();
    builder.querySelector("[data-preview-payment-qr]").src = qr.createDataURL(8, 4);

    const bankNameWrap = builder.querySelector("[data-preview-bank-name-wrap]");
    setText("[data-preview-bank-name]", state.bankName);
    bankNameWrap.hidden = !state.bankName;
    setText("[data-preview-bank-account-name]", state.bankAccountName);
    setText("[data-preview-bank-bsb]", state.bankBsb);
    setText("[data-preview-bank-account-number]", state.bankAccountNumber);
    setText("[data-preview-payment-reference]", state.paymentReference || number);

    const usingPlaceholderDetails = (
      state.paymentUrl === PAYMENT_PLACEHOLDERS.paymentUrl
      || state.bankBsb === PAYMENT_PLACEHOLDERS.bankBsb
      || state.bankAccountNumber === PAYMENT_PLACEHOLDERS.bankAccountNumber
    );
    setText(
      "[data-review-payment]",
      usingPlaceholderDetails
        ? "Placeholder details — replace before issue"
        : "QR, card and bank transfer included",
    );
  }

  function renderLineItems() {
    lineItems.replaceChildren();
    state.items.forEach((item, index) => {
      const fragment = lineTemplate.content.cloneNode(true);
      const row = fragment.querySelector(".invoice-line-item");
      const description = fragment.querySelector("[data-line-description]");
      const quantity = fragment.querySelector("[data-line-quantity]");
      const price = fragment.querySelector("[data-line-price]");
      const remove = fragment.querySelector("[data-remove-line]");
      row.dataset.lineId = item.id;
      description.value = item.description;
      quantity.value = item.quantity;
      price.value = item.unitPrice;
      remove.disabled = state.items.length === 1;
      remove.title = state.items.length === 1 ? "An invoice needs at least one line" : "Remove line item";
      remove.addEventListener("click", () => {
        if (state.items.length === 1) return;
        state.items.splice(index, 1);
        renderLineItems();
        renderPreview();
        saveState();
      });
      [
        [description, "description"],
        [quantity, "quantity"],
        [price, "unitPrice"],
      ].forEach(([input, key]) => {
        input.addEventListener("input", () => {
          state.items[index][key] = input.value;
          renderPreview();
          saveState();
        });
      });
      lineItems.append(fragment);
    });
  }

  function renderPreviewItems(items) {
    const body = builder.querySelector("[data-preview-items]");
    body.replaceChildren();
    if (!items.length) {
      const row = document.createElement("tr");
      row.className = "invoice-preview-empty";
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "Line items will appear here.";
      row.append(cell);
      body.append(row);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement("tr");
      const description = document.createElement("td");
      const quantity = document.createElement("td");
      const price = document.createElement("td");
      const tax = document.createElement("td");
      const amount = document.createElement("td");
      description.textContent = item.description;
      quantity.textContent = item.quantityValue.toLocaleString("en-AU", { maximumFractionDigits: 2 });
      price.textContent = currency.format(item.unitPriceValue);
      tax.textContent = state.gstRegistered ? "10%" : "—";
      amount.textContent = currency.format(item.quantityValue * item.unitPriceValue);
      row.append(description, quantity, price, tax, amount);
      body.append(row);
    });
  }

  function renderPreview() {
    const items = completeItems();
    const summary = totals();
    const customerContact = [state.customerEmail, state.customerPhone].filter(Boolean).join(" · ");
    const documentTitle = state.gstRegistered ? "Tax Invoice" : "Invoice";
    const number = state.invoiceNumber || "Draft";

    setText("[data-preview-title]", documentTitle);
    setText("[data-preview-number]", number);
    setText("[data-preview-state]", state.invoiceNumber ? state.invoiceNumber : "Draft");
    setText("[data-preview-customer]", state.customerName || "Customer name");
    setOptionalText("[data-preview-business]", "[data-preview-business]", state.customerBusiness);
    setText("[data-preview-contact]", customerContact);
    setText("[data-preview-address]", state.customerAddress);
    setText("[data-preview-issue]", formatDate(state.issueDate));
    setText("[data-preview-due]", formatDate(state.dueDate));

    const previewAbn = builder.querySelector("[data-preview-abn]");
    previewAbn.textContent = state.gstRegistered && state.supplierAbn ? `ABN ${state.supplierAbn}` : "";
    previewAbn.hidden = !previewAbn.textContent;

    renderPreviewItems(items);
    setText("[data-preview-subtotal]", currency.format(summary.subtotal - summary.gst));
    setText("[data-preview-gst]", currency.format(summary.gst));
    setText("[data-preview-total]", currency.format(summary.total));
    setText("[data-preview-amount-due]", currency.format(summary.total));
    setText("[data-preview-bottom-due]", currency.format(summary.total));
    setText("[data-editor-total]", currency.format(summary.total));
    builder.querySelector("[data-preview-gst-row]").hidden = !state.gstRegistered;

    renderPaymentBlock(number);
    setOptionalText("[data-preview-notes]", "[data-preview-notes-wrap]", state.customerNote);
    setOptionalText("[data-preview-payment]", "[data-preview-payment-wrap]", state.paymentInstructions);

    setText("[data-review-customer]", state.customerName || "Not added");
    setText("[data-review-date]", state.issueDate ? formatDate(state.issueDate) : "Not added");
    setText(
      "[data-review-items]",
      items.length ? `${items.length} complete line item${items.length === 1 ? "" : "s"}` : "No complete line items",
    );
    setText("[data-review-total]", currency.format(summary.total));
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
    if (text) message.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearFieldErrors() {
    form.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute("aria-invalid"));
    showMessage("");
  }

  function markInvalid(input) {
    input.setAttribute("aria-invalid", "true");
  }

  function validAbn(value) {
    return /^\d{11}$/.test(value.replace(/\s/g, ""));
  }

  function validateDetails() {
    clearFieldErrors();
    const missing = [];
    if (!state.customerName) {
      markInvalid(field("customerName"));
      missing.push("customer name");
    }
    if (!state.issueDate) {
      markInvalid(field("issueDate"));
      missing.push("issue date");
    }
    if (!state.dueDate) {
      markInvalid(field("dueDate"));
      missing.push("due date");
    }
    if (state.issueDate && state.dueDate && state.dueDate < state.issueDate) {
      markInvalid(field("dueDate"));
      showMessage("The due date cannot be earlier than the issue date.");
      return false;
    }
    if (state.gstRegistered && !validAbn(state.supplierAbn)) {
      markInvalid(field("supplierAbn"));
      showMessage("Add the 11 digit supplier ABN before preparing a tax invoice.");
      return false;
    }
    if (missing.length) {
      showMessage(`Add the ${missing.join(", ")} before continuing.`);
      return false;
    }
    return true;
  }

  function validateItems() {
    clearFieldErrors();
    let hasIncompleteItem = false;
    state.items.forEach((item, index) => {
      const description = item.description.trim();
      const quantity = numberValue(item.quantity, 0);
      const hasPrice = item.unitPrice !== "";
      const validPrice = hasPrice && Number.isFinite(Number(item.unitPrice)) && Number(item.unitPrice) >= 0;
      const touched = Boolean(description || hasPrice || item.quantity !== "1");
      if (!touched || (description && quantity > 0 && validPrice)) return;
      hasIncompleteItem = true;
      const row = lineItems.children[index];
      if (!description) row?.querySelector("[data-line-description]")?.setAttribute("aria-invalid", "true");
      if (quantity <= 0) row?.querySelector("[data-line-quantity]")?.setAttribute("aria-invalid", "true");
      if (!validPrice) row?.querySelector("[data-line-price]")?.setAttribute("aria-invalid", "true");
    });
    if (hasIncompleteItem) {
      showMessage("Complete or remove each started line item before reviewing the invoice.");
      return false;
    }
    const items = completeItems();
    if (!items.length) {
      showMessage("Add at least one complete line item with a description, quantity and unit price.");
      return false;
    }
    if (!safePaymentUrl(state.paymentUrl)) {
      markInvalid(field("paymentUrl"));
      showMessage("Add a valid http or https payment link so the invoice QR code can be generated.");
      return false;
    }
    if (items.some((item) => item.unitPriceValue < 0)) {
      showMessage("Line item prices cannot be negative.");
      return false;
    }
    return true;
  }

  function canEnterStep(step) {
    if (step === "details") return true;
    if (!validateDetails()) return false;
    if (step === "review" && !validateItems()) return false;
    return true;
  }

  function renderStep() {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    stepPanels.forEach((panel) => {
      panel.hidden = panel.dataset.stepPanel !== state.currentStep;
    });
    stepButtons.forEach((button, index) => {
      const active = button.dataset.stepTarget === state.currentStep;
      button.classList.toggle("is-active", active);
      button.classList.toggle("is-complete", index < currentIndex);
      if (active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });

    previousButton.hidden = currentIndex === 0;
    nextButton.hidden = currentIndex === STEP_ORDER.length - 1;
    printButton.hidden = currentIndex !== STEP_ORDER.length - 1;
    nextButton.textContent = state.currentStep === "details" ? "Continue to line items" : "Review invoice";
    clearFieldErrors();
    saveState();
  }

  function goToStep(step) {
    syncStateFromFields();
    if (!canEnterStep(step)) return;
    state.currentStep = step;
    renderPreview();
    renderStep();
    builder.querySelector(".invoice-steps").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("input", (event) => {
    if (event.target.closest("[data-line-items]")) return;
    syncStateFromFields();
    if (event.target.name === "gstRegistered") {
      abnField.hidden = !state.gstRegistered;
      if (!state.gstRegistered) field("supplierAbn").removeAttribute("aria-invalid");
    }
    event.target.removeAttribute("aria-invalid");
    renderPreview();
    saveState();
  });

  addLineButton.addEventListener("click", () => {
    state.items.push(createLine());
    renderLineItems();
    renderPreview();
    saveState();
    lineItems.lastElementChild?.querySelector("[data-line-description]")?.focus();
  });

  nextButton.addEventListener("click", () => {
    syncStateFromFields();
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    const valid = state.currentStep === "details" ? validateDetails() : validateItems();
    if (!valid) return;
    goToStep(STEP_ORDER[currentIndex + 1]);
  });

  previousButton.addEventListener("click", () => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    state.currentStep = STEP_ORDER[Math.max(0, currentIndex - 1)];
    renderStep();
    builder.querySelector(".invoice-steps").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  stepButtons.forEach((button) => {
    button.addEventListener("click", () => goToStep(button.dataset.stepTarget));
  });

  resetButton.addEventListener("click", () => {
    if (!globalThis.confirm("Reset this browser-only invoice draft?")) return;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    state = initialState();
    syncFieldsFromState();
    renderLineItems();
    renderPreview();
    renderStep();
    field("customerName").focus();
  });

  printButton.addEventListener("click", () => {
    syncStateFromFields();
    if (!validateDetails() || !validateItems()) return;
    renderPreview();
    globalThis.print();
  });

  syncFieldsFromState();
  renderLineItems();
  renderPreview();
  renderStep();
}
