type ApiProvider = 'tba' | 'nexus';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
interface ProxyRequestOptions {
  apiKeyOverride?: string;
}


export async function proxyGetJson<T>(
  provider: ApiProvider,
  endpoint: string,
  options: ProxyRequestOptions = {}
): Promise<T> {
  const query = new URLSearchParams({
    provider,
    endpoint,
  });

  const response = await fetch(
    `${API_BASE}/provider_proxy?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.apiKeyOverride ? { 'X-Client-Api-Key': options.apiKeyOverride } : {}),
      },
    }
  );

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Proxy request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}
