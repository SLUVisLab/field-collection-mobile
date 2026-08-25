// HTTP client for the Gather custom API (replaces Atlas Device Sync).
// Base URL + API key come from Expo public env vars (see .env / .env.example).
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const API_KEY = process.env.EXPO_PUBLIC_GATHER_HUB_API_KEY;

const baseHeaders = () => ({
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
});

async function request(path, options = {}) {
  if (!BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...baseHeaders(), ...(options.headers || {}) },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data && data.error) || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

// Survey designs — read + write.
export async function getDesigns() {
  const data = await request('/surveys/designs', { method: 'GET' });
  return data?.documents ?? [];
}

export async function upsertDesign(design) {
  if (!design?._id) {
    throw new Error('upsertDesign requires a design with an _id');
  }
  return request(`/surveys/designs/${design._id}`, {
    method: 'PUT',
    body: JSON.stringify(design),
  });
}

// Survey results — write only.
export async function postResult(result) {
  return request('/surveys/results', {
    method: 'POST',
    body: JSON.stringify(result),
  });
}

export default { getDesigns, upsertDesign, postResult };
