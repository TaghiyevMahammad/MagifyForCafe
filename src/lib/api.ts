export const getApiUrl = (path: string) => {
  // In Electron production, we need to use absolute URLs because we load from file://
  const isElectron = navigator.userAgent.toLowerCase().includes('electron');
  if (isElectron && window.location.protocol === 'file:') {
    return `http://localhost:3000${path}`;
  }
  return path;
};

export const apiFetch = async (path: string, options?: RequestInit) => {
  const url = getApiUrl(path);
  const response = await fetch(url, options);
  if (response.status === 401) {
    // Handle unauthorized (e.g., token expired)
    localStorage.removeItem('ps_admin_token');
    window.location.href = '/';
  }
  return response;
};
