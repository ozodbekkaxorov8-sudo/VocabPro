export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, typeof data?.detail === "string" ? data.detail : "So‘rov bajarilmadi. Qayta urinib ko‘ring.");
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function json(method: string, data: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

export function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : "Aloqa uzildi. Qayta urinib ko‘ring.";
}
