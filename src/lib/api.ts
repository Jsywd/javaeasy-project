export interface FetchResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<FetchResponse<T>> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    
    let data: any = null;
    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      const errorMsg = data?.error || (res.status === 404 ? "ไม่พบข้อมูลที่ต้องการ (404)" : `เซิร์ฟเวอร์เกิดข้อผิดพลาด (${res.status})`);
      return { ok: false, status: res.status, data, error: errorMsg };
    }

    return { ok: true, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || "การเชื่อมต่อเครือข่ายล้มเหลว" };
  }
}
