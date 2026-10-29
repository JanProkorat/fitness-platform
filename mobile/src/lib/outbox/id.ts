type CryptoLike = { randomUUID?: () => string };

/** A v4 UUID for ClientRequestId and client-chosen entry ids; uses the platform generator when there is one. */
export function newClientId(): string {
  const platform = (globalThis as { crypto?: CryptoLike }).crypto;
  if (platform?.randomUUID) return platform.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random % 4) + 8).toString(16);
  });
}
