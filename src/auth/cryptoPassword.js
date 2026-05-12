const enc = new TextEncoder();

export async function hashPassword(password, salt) {
  const data = enc.encode(`${salt}\n${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
