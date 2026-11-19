const MESSAGES: Record<string, string> = {
  refus: 'Connexion refusée sur Discord. Tu peux réessayer quand tu veux.',
  etat: 'La connexion a expiré ou a été interrompue. Réessaie.',
  'aucun-serveur': 'Tu n’es membre d’aucun serveur suivi par Vocalog. Demande à son administrateur.',
  connexion: 'Discord n’a pas répondu comme prévu. Réessaie dans un instant.',
};

/** The fixed message for a login error code from the URL. Anything unknown (the link can be crafted) gives none. */
export function messageFor(reason: string | null): string | undefined {
  return reason !== null && Object.hasOwn(MESSAGES, reason) ? MESSAGES[reason] : undefined;
}

/** Shown when a login is required and nobody is logged in. */
export function LoginView() {
  const message = messageFor(new URLSearchParams(window.location.search).get('erreur'));
  return (
    <section class="card login" aria-labelledby="login-title">
      <p class="eyebrow">Vocalog</p>
      <h1 id="login-title">Connexion</h1>
      {message && (
        <p class="notice" role="alert">
          {message}
        </p>
      )}
      <a class="button" href="/auth/login">
        Se connecter avec Discord
      </a>
    </section>
  );
}
