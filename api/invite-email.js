/* Transactional e-mail delivery for admin-created accounts.
 *
 * The Resend token never reaches the browser: the admin route calls this module after the
 * account has been written. If delivery fails, the route removes that account again so the
 * address/name are not left occupied by an invitation nobody received. */

import crypto from 'node:crypto';

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export function makeInitialPassword() {
  // 24 base64url characters (144 bits). It has upper/lower case, numbers and punctuation, and
  // comfortably passes openGym's password policy without being awkward to copy from e-mail.
  return crypto.randomBytes(18).toString('base64url');
}

export async function sendAccountInvite({ apiKey, apiUrl = 'https://api.resend.com/emails', from, to, name, password, appUrl }) {
  const url = String(appUrl).replace(/\/$/, '');
  const subject = 'Tu acceso a openGym';
  const text = [
    `Hola ${name},`, '',
    'Tu cuenta de openGym está lista.', '',
    `Abrir: ${url}`,
    `Usuario: ${name}`,
    `Correo: ${to}`,
    `Contraseña inicial: ${password}`, '',
    'Después de iniciar sesión, cambia la contraseña en Ajustes. No compartas este correo.'
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#17181a">
    <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:18px;padding:32px">
      <h1 style="margin:0 0 8px;font-size:28px">openGym</h1>
      <p>Hola <strong>${escapeHtml(name)}</strong>, tu cuenta está lista.</p>
      <div style="background:#f4f5f7;border-radius:12px;padding:18px;margin:22px 0;line-height:1.8">
        <div><strong>Usuario:</strong> ${escapeHtml(name)}</div>
        <div><strong>Correo:</strong> ${escapeHtml(to)}</div>
        <div><strong>Contraseña inicial:</strong><br><code style="font-size:16px;word-break:break-all">${escapeHtml(password)}</code></div>
      </div>
      <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#2528d8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Entrar a openGym</a></p>
      <p style="font-size:13px;color:#666">Después de iniciar sesión, cambia la contraseña en Ajustes. No compartas este correo.</p>
    </div></body></html>`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(15000)
  });
  let body = {};
  try { body = await response.json(); } catch { /* Resend may return an empty proxy error. */ }
  if (!response.ok || !body.id) {
    const detail = body?.message || body?.error || `mail service returned ${response.status}`;
    throw new Error(String(detail).slice(0, 200));
  }
  return { id: body.id };
}
