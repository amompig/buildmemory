// api.js — fetch 封裝：同源 /api/*、cookie 自動帶；回傳 { ok, status, data } 或 { ok:false, code, ...參數 }
// 網路失敗一律 code:'offline'（前端專用錯誤碼）。不持有狀態。
export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: 'offline' };
  }
  const data = await res.json().catch(() => null);
  if (res.ok) return { ok: true, status: res.status, data };
  return { ok: false, status: res.status, code: data?.error?.code ?? 'invalid', ...data?.error };
}
