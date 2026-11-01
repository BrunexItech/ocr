const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("oqtekal_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("oqtekal_token", token);
  else localStorage.removeItem("oqtekal_token");
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("oqtekal_role");
}

export function setRole(role: string | null) {
  if (typeof window === "undefined") return;
  if (role) localStorage.setItem("oqtekal_role", role);
  else localStorage.removeItem("oqtekal_role");
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function describeDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    // FastAPI/Pydantic validation errors: [{loc, msg, type}, ...]
    return detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : String(d)))
      .join("; ");
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Only default to JSON when the caller hasn't already set an explicit Content-Type
  // (e.g. login sends application/x-www-form-urlencoded for its URLSearchParams body).
  if (!(options.body instanceof FormData) && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = describeDetail(body.detail, detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  async login(email: string, password: string) {
    const body = new URLSearchParams({ username: email, password });
    return request<{ access_token: string; role: string }>("/api/auth/login", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  async register(email: string, name: string, password: string) {
    return request("/api/auth/register", { method: "POST", body: JSON.stringify({ email, name, password }) });
  },
  async me() {
    return request<{ id: string; email: string; name: string; role: string }>("/api/auth/me");
  },
  async listDocumentTypes() {
    return request<DocumentType[]>("/api/admin/document-types");
  },
  async createDocumentType(body: Partial<DocumentType>) {
    return request<DocumentType>("/api/admin/document-types", { method: "POST", body: JSON.stringify(body) });
  },
  async listUsers() {
    return request<UserOut[]>("/api/admin/users");
  },
  async createUser(body: { email: string; name: string; password: string; role: string }) {
    return request<UserOut>("/api/admin/users", { method: "POST", body: JSON.stringify(body) });
  },
  async updateUser(id: string, body: { role?: string; active?: boolean }) {
    const qs = new URLSearchParams(body as Record<string, string>).toString();
    return request<UserOut>(`/api/admin/users/${id}?${qs}`, { method: "PATCH" });
  },
  async listServiceAccounts() {
    return request<ServiceAccountOut[]>("/api/admin/service-accounts");
  },
  async createServiceAccount(body: { name: string; role: string }) {
    return request<{ id: string; name: string; role: string; api_key: string }>("/api/admin/service-accounts", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  async revokeServiceAccount(id: string) {
    return request<{ ok: boolean }>(`/api/admin/service-accounts/${id}`, { method: "DELETE" });
  },
  async intake(file: File, typeId?: string, title?: string, kind?: string, fileBack?: File) {
    const form = new FormData();
    form.append("file", file);
    if (fileBack) form.append("file_back", fileBack);
    const params = new URLSearchParams();
    if (typeId) params.set("type_id", typeId);
    if (title) params.set("title", title);
    if (kind) params.set("kind", kind);
    const qs = params.toString();
    return request<DocumentOut>(`/api/documents/intake${qs ? `?${qs}` : ""}`, { method: "POST", body: form });
  },
  async listDocuments(status?: string, q?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const qs = params.toString();
    return request<DocumentOut[]>(`/api/documents/${qs ? `?${qs}` : ""}`);
  },
  async renameDocument(id: string, title: string) {
    return request<DocumentOut>(`/api/documents/${id}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },
  async getDocument(id: string, reveal = false) {
    return request<DocumentOut>(`/api/documents/${id}${reveal ? "?reveal=true" : ""}`);
  },
  async deleteDocument(id: string) {
    return request<{ ok: boolean }>(`/api/documents/${id}`, { method: "DELETE" });
  },
  async correctFields(id: string, fields: Record<string, unknown>, note?: string) {
    return request<DocumentOut>(`/api/documents/${id}/fields`, {
      method: "PATCH",
      body: JSON.stringify({ fields, note: note || "Reviewer corrections" }),
    });
  },
  async submitDocument(id: string) {
    return request<DocumentOut>(`/api/documents/${id}/submit`, { method: "POST" });
  },
  async approveDocument(id: string) {
    return request<DocumentOut>(`/api/documents/${id}/approve`, { method: "POST" });
  },
  async rejectDocument(id: string, reason: string) {
    return request<DocumentOut>(`/api/documents/${id}/reject?reason=${encodeURIComponent(reason)}`, { method: "POST" });
  },
  async listIntegrations() {
    return request<IntegrationOut[]>("/api/integrations/");
  },
  async createIntegration(body: { name: string; kind: string; config: Record<string, unknown> }) {
    return request<IntegrationOut>("/api/integrations/", { method: "POST", body: JSON.stringify(body) });
  },
  async pushDocument(id: string, integrationId: string, fields: string[]) {
    return request(`/api/documents/${id}/push`, {
      method: "POST",
      body: JSON.stringify({ integration_id: integrationId, fields }),
    });
  },
  async cropPreview(file: File): Promise<Blob> {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/documents/crop-preview`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.blob();
  },
  async listAudit() {
    return request<AuditEvent[]>("/api/audit/");
  },
  async verifyAudit() {
    return request<{ ok: boolean; count?: number; at?: number; reason?: string }>("/api/audit/verify", { method: "POST" });
  },
  async downloadOriginal(id: string, filename: string) {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/documents/${id}/download/original`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export type DocumentType = {
  id: string;
  code: string;
  name: string;
  domain: string;
  fields_schema: Record<string, { label: string; type: string; required?: boolean; sensitive?: boolean }>;
  default_sensitivity: string;
  retention_days?: number | null;
};

export type UserOut = { id: string; email: string; name: string; role: string; active: boolean };

export type ServiceAccountOut = { id: string; name: string; key_prefix: string; role: string; active: boolean };

export type DocumentOut = {
  id: string;
  tracking_no: string;
  title: string | null;
  status: string;
  type_id: string | null;
  sensitivity: string;
  file_name: string;
  ocr_confidence: number | null;
  fields: Record<string, unknown>;
  field_confidence: Record<string, number>;
  reasons: string[];
  locked: boolean;
  detected_kind: string;
};

export type IntegrationOut = { id: string; name: string; kind: string; config: Record<string, unknown>; active: boolean };

export type AuditEvent = {
  seq: number;
  ts: string;
  user: string;
  role: string;
  action: string;
  document_id: string | null;
  detail: string;
  hash: string;
};

export { ApiError };
