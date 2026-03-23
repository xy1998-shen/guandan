const OWNER_ID_KEY = 'guandan.ownerId';

function createOwnerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `owner_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getOwnerId(): string {
  const cached = localStorage.getItem(OWNER_ID_KEY);
  if (cached && cached.trim().length > 0) {
    return cached;
  }

  const ownerId = createOwnerId();
  localStorage.setItem(OWNER_ID_KEY, ownerId);
  return ownerId;
}
