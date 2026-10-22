// Configurazione mancante = accesso negato, mai Bearer undefined.
export function authorizedCron(header: string | null, secret: string | undefined): boolean {
  return !!secret && header === `Bearer ${secret}`;
}
