export function maskEmail(email: string | null | undefined) {
  if (!email) return null
  const [local, domain] = email.split('@')
  return local && domain ? `${local[0]}•••@${domain}` : null
}
