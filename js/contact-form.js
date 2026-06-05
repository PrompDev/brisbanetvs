(() => {
  const forms = document.querySelectorAll("form[data-crm-lead]");
  if (!forms.length) return;

  function setStatus(form, kind, message) {
    let status = form.querySelector("[data-form-status]");
    if (!status) {
      status = document.createElement("div");
      status.setAttribute("data-form-status", "");
      status.setAttribute("aria-live", "polite");
      form.appendChild(status);
    }

    const styles = {
      success: "color:#166534;background:#dcfce7;border:1px solid #86efac;",
      error: "color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;",
      info: "color:#1e3a8a;background:#dbeafe;border:1px solid #93c5fd;",
    };

    status.setAttribute("style", `margin-top:0.9rem;font-size:0.95rem;line-height:1.4;padding:0.75rem 0.9rem;border-radius:10px;${styles[kind] || styles.info}`);
    status.textContent = message;
  }

  function normalizePhone(raw) {
    return String(raw || "").trim().replace(/\s+/g, " ");
  }

  function value(fd, ...names) {
    for (const name of names) {
      const found = fd.get(name);
      if (found !== null && !(found instanceof File)) return String(found).trim();
    }
    return "";
  }

  function validate(form) {
    const fd = new FormData(form);
    const name = value(fd, "name", "fullname", "full_name");
    const phone = normalizePhone(value(fd, "phone", "mobile"));
    const email = value(fd, "email");
    const suburb = value(fd, "suburb");
    const service = value(fd, "service");
    const tvSize = value(fd, "tv_size", "tvsize");

    if (!name) return "Please enter your full name.";
    if (!phone) return "Please enter your phone number.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
    if (!suburb) return "Please enter your suburb.";
    if (!service) return "Please choose a service.";
    if (!tvSize) return "Please choose a TV size.";

    for (const file of fd.getAll("images")) {
      if (!(file instanceof File) || !file.name) continue;
      if (!file.type.startsWith("image/")) return `${file.name} is not an image.`;
      if (file.size > 10 * 1024 * 1024) return `${file.name} is too large. Maximum is 10 MB.`;
    }

    return null;
  }

  function appendTracking(formData) {
    formData.set("brand", "BrisbaneTVS");
    formData.set("source", "website");
    formData.set("campaign", "BrisbaneTVS website quote form");
    formData.set("page_url", window.location.href);
    formData.set("user_agent", navigator.userAgent);
  }

  for (const form of forms) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const error = validate(form);
      if (error) {
        setStatus(form, "error", error);
        return;
      }

      const submit = form.querySelector('button[type="submit"], input[type="submit"]');
      const originalText = submit ? submit.textContent : "";
      const body = new FormData(form);
      appendTracking(body);

      if (submit) {
        submit.disabled = true;
        submit.textContent = "Sending...";
      }
      setStatus(form, "info", "Sending your request...");

      try {
        const response = await fetch(form.getAttribute("action") || "/api/website-lead", {
          method: "POST",
          body,
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          setStatus(form, "error", result.error || "Something went wrong. Please try again.");
          return;
        }

        setStatus(form, "success", "Thanks - we received your details and images. We will reply shortly.");
        form.reset();
      } catch (err) {
        setStatus(form, "error", "Network error. Please try again, or call 1300 312 271.");
        console.error(err);
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = originalText;
        }
      }
    });
  }
})();
