import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEFAULT_BASE_URL = 'https://app.neobeirut.com';

export function getBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_BASE_URL;
  if (envUrl && envUrl !== 'undefined' && envUrl !== 'null') {
    return envUrl.replace(/\/$/, '');
  }
  return DEFAULT_BASE_URL;
}

export async function getAdminToken() {
  try {
    return await SecureStore.getItemAsync('adminToken');
  } catch (e) {
    console.error('Failed to get admin token:', e);
    return null;
  }
}

export async function saveAdminToken(token) {
  try {
    await SecureStore.setItemAsync('adminToken', token);
  } catch (e) {
    console.error('Failed to save admin token:', e);
  }
}

export async function clearAdminToken() {
  try {
    await SecureStore.deleteItemAsync('adminToken');
  } catch (e) {
    console.error('Failed to delete admin token:', e);
  }
}

export async function getStoredAdminUser() {
  try {
    const data = await SecureStore.getItemAsync('adminUser');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to get admin user data:', e);
    return null;
  }
}

export async function saveStoredAdminUser(user) {
  try {
    await SecureStore.setItemAsync('adminUser', JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save admin user data:', e);
  }
}

export async function clearStoredAdminUser() {
  try {
    await SecureStore.deleteItemAsync('adminUser');
  } catch (e) {
    console.error('Failed to delete admin user data:', e);
  }
}

export async function apiFetch(url, options = {}) {
  const baseUrl = getBaseUrl();
  const token = await getAdminToken();

  const finalUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (token && !headers['x-admin-token']) {
    headers['x-admin-token'] = token;
  }

  const finalOptions = {
    ...options,
    headers,
  };

  console.log(`[API] ${finalOptions.method || 'GET'} -> ${finalUrl}`);
  
  try {
    const response = await fetch(finalUrl, finalOptions);
    
    if (response.status === 401) {
      console.warn('[API] Unauthorized! Clearing token...');
      await clearAdminToken();
      await clearStoredAdminUser();
    }

    return response;
  } catch (error) {
    console.error(`[API] Fetch failed for ${finalUrl}:`, error.message);
    throw error;
  }
}

export async function getJson(url, options = {}) {
  const res = await apiFetch(url, { ...options, method: 'GET' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function postJson(url, body = {}, options = {}) {
  const res = await apiFetch(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function patchJson(url, body = {}, options = {}) {
  const res = await apiFetch(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function deleteJson(url, options = {}) {
  const res = await apiFetch(url, { ...options, method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}
