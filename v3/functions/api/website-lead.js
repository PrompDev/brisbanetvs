const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowed = new Set([
    "https://brisbanetvs.com",
    "https://www.brisbanetvs.com",
    "https://brisbanetvs.pages.dev",
  ]);

  if (!origin || !allowed.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function clean(value) {
  return String(value || "").trim();
}

function splitName(fullName) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Website", lastName: "Lead" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) };
}

function normalizePhone(raw) {
  const phone = clean(raw).replace(/\s+/g, "");
  if (phone.startsWith("+61")) {
    return { countryCode: "AU", callingCode: "+61", number: `0${phone.slice(3)}` };
  }
  if (phone.startsWith("61")) {
    return { countryCode: "AU", callingCode: "+61", number: `0${phone.slice(2)}` };
  }
  return { countryCode: "AU", callingCode: "+61", number: phone };
}

function fileExt(file) {
  const fromName = clean(file.name).split(".").pop();
  if (fromName && fromName !== file.name) return fromName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const byType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return byType[file.type] || "bin";
}

function safeFileName(file) {
  const base = clean(file.name)
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "upload";
  return `${base}.${fileExt(file)}`;
}

async function parseSubmission(request) {
  const type = request.headers.get("content-type") || "";
  const fields = {};
  const files = [];

  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        if (!value.name || value.size === 0) continue;
        files.push(value);
      } else {
        fields[key] = clean(value);
      }
    }
  } else if (type.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) fields[key] = clean(value);
  } else {
    Object.assign(fields, await request.json());
  }

  return {
    fields: normalizeFields(fields),
    files,
  };
}

function normalizeFields(raw) {
  const name = clean(raw.name || raw.fullname || raw.full_name);
  const email = clean(raw.email);
  const phone = clean(raw.phone || raw.mobile);
  const service = clean(raw.service);
  const tvSize = clean(raw.tv_size || raw.tvsize);

  return {
    brand: "BrisbaneTVS",
    source: "website",
    campaign: clean(raw.campaign) || "BrisbaneTVS website quote form",
    name,
    email,
    phone,
    suburb: clean(raw.suburb),
    service,
    tv_size: tvSize,
    wall: clean(raw.wall),
    message: clean(raw.message || raw.details),
    preferred_date: clean(raw.preferred_date || raw.date),
    page_url: clean(raw.page_url || raw.booking_link || raw.referrer),
    user_agent: clean(raw.user_agent),
  };
}

function validate(fields, files) {
  const required = ["name", "phone", "suburb", "service", "tv_size"];
  for (const key of required) {
    if (!fields[key]) return `Missing field: ${key}`;
  }

  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return "Invalid email address";
  }

  if (files.length > MAX_FILES) return `Too many images. Maximum is ${MAX_FILES}.`;

  for (const file of files) {
    if (!file.type.startsWith("image/")) return `${file.name} is not an image.`;
    if (file.size > MAX_FILE_BYTES) return `${file.name} is too large. Maximum is 10 MB.`;
  }

  return null;
}

async function storeUploads(env, request, fields, files) {
  const uploads = [];
  if (!files.length) return uploads;
  if (!env.LEAD_UPLOADS) {
    throw new Error("LEAD_UPLOADS R2 binding is not configured");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const leadSlug = clean(fields.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lead";

  for (const file of files) {
    const key = `website-leads/${stamp}-${leadSlug}/${crypto.randomUUID()}-${safeFileName(file)}`;
    await env.LEAD_UPLOADS.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        leadName: fields.name,
        phone: fields.phone,
        suburb: fields.suburb,
        source: "brisbanetvs.com",
      },
    });

    uploads.push({
      name: file.name,
      type: file.type,
      size: file.size,
      key,
      url: env.LEAD_UPLOAD_PUBLIC_BASE
        ? `${env.LEAD_UPLOAD_PUBLIC_BASE.replace(/\/$/, "")}/${key}`
        : `${new URL(request.url).origin}/api/lead-upload?key=${encodeURIComponent(key)}`,
    });
  }

  return uploads;
}

async function twentyFetch(env, path, body) {
  const apiUrl = (env.TWENTY_API_URL || "https://api.twenty.com").replace(/\/$/, "");
  const apiKey = env.TWENTY_API_KEY;
  if (!apiKey) throw new Error("TWENTY_API_KEY is not configured");

  const res = await fetch(`${apiUrl}/rest/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error(`Twenty ${path} failed with ${res.status}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

function extractId(response, objectName) {
  const data = response?.data;
  if (!data) return null;
  const firstValue = Object.values(data)[0];
  return firstValue?.id || data?.[objectName]?.id || null;
}

function leadNote(fields, uploads) {
  const lines = [
    `# Website quote request - ${fields.name}`,
    "",
    `- Phone: ${fields.phone}`,
    `- Email: ${fields.email || "Not supplied"}`,
    `- Suburb: ${fields.suburb}`,
    `- Service: ${fields.service}`,
    `- TV size: ${fields.tv_size}`,
    `- Wall: ${fields.wall || "Not supplied"}`,
    `- Preferred date: ${fields.preferred_date || "Not supplied"}`,
    `- Page: ${fields.page_url || "Not supplied"}`,
    "",
    fields.message ? `## Customer message\n${fields.message}` : "",
    uploads.length ? `## Uploaded images\n${uploads.map((u) => `- [${u.name}](${u.url})`).join("\n")}` : "## Uploaded images\nNone supplied",
  ];

  return lines.filter(Boolean).join("\n");
}

async function sendToTwenty(env, fields, uploads) {
  const name = splitName(fields.name);
  const phone = normalizePhone(fields.phone);

  const person = await twentyFetch(env, "people", {
    name,
    emails: {
      primaryEmail: fields.email || "",
      additionalEmails: [],
    },
    phones: {
      primaryPhoneCountryCode: phone.countryCode,
      primaryPhoneCallingCode: phone.callingCode,
      primaryPhoneNumber: phone.number,
      additionalPhones: [],
    },
    city: fields.suburb,
    jobTitle: `${fields.service} lead`,
  });

  const personId = extractId(person, "createPerson");
  const markdown = leadNote(fields, uploads);

  const note = await twentyFetch(env, "notes", {
    title: `BrisbaneTVS quote request - ${fields.service}`,
    body: markdown,
    bodyV2: {
      markdown,
      blocknote: "",
    },
  });

  const noteId = extractId(note, "createNote");
  let noteTarget = null;
  if (personId && noteId) {
    noteTarget = await twentyFetch(env, "noteTargets", {
      noteId,
      personId,
    });
  }

  const attachments = [];
  for (const upload of uploads) {
    attachments.push(await twentyFetch(env, "attachments", {
      name: upload.name,
      fullPath: upload.url,
      type: upload.type || "image",
      personId,
      noteId,
    }));
  }

  return { personId, noteId, noteTargetId: extractId(noteTarget, "createNoteTarget"), attachments };
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request);

  let submission;
  try {
    submission = await parseSubmission(request);
  } catch (err) {
    return jsonResponse({ error: "Invalid submission body" }, 400, headers);
  }

  const validationError = validate(submission.fields, submission.files);
  if (validationError) return jsonResponse({ error: validationError }, 400, headers);

  try {
    const uploads = await storeUploads(env, request, submission.fields, submission.files);
    const twenty = await sendToTwenty(env, submission.fields, uploads);
    return jsonResponse({ ok: true, uploaded_images: uploads.length, twenty }, 201, headers);
  } catch (err) {
    return jsonResponse(
      {
        error: "Could not create Twenty CRM lead",
        detail: err.message,
        upstream: err.details || null,
      },
      err.status || 502,
      headers,
    );
  }
}
