// EasyParcel (MY) helpers. Their API is form-encoded over a single endpoint
// with an `ac` action query param. Demo host for sandbox testing.

export const easyparcelBaseUrl = () => {
  const config = useRuntimeConfig();
  return config.easyparcelSandbox
    ? "https://demo.connect.easyparcel.my"
    : "https://connect.easyparcel.my";
};

export const easyparcelApiKey = (): string => {
  const config = useRuntimeConfig();
  const key = config.easyparcelApiKey as string;
  if (!key) throw createError({ statusCode: 500, message: "EasyParcel not configured" });
  return key;
};

// POST a flat record as application/x-www-form-urlencoded and parse JSON.
export const easyparcelPost = async (
  action: string,
  fields: Record<string, string>,
): Promise<any> => {
  const form = new URLSearchParams(fields);
  const res = await fetch(`${easyparcelBaseUrl()}/?ac=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[easyparcel] ${action} HTTP ${res.status}:`, text.slice(0, 500));
    throw createError({ statusCode: 502, message: "Shipping provider error" });
  }
  const data = await res.json().catch(async () => {
    const text = await res.text().catch(() => "");
    console.error(`[easyparcel] ${action} non-JSON response:`, text.slice(0, 500));
    throw createError({ statusCode: 502, message: "Shipping provider error" });
  });
  return data;
};
