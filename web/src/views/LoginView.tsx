const MESSAGES: Record<string, string> = {
  refus: 'Connexion refusée sur Discord. Tu peux réessayer quand tu veux.',
  etat: 'La connexion a expiré ou a été interrompue. Réessaie.',
  'aucun-serveur': 'Tu n’es membre d’aucun serveur suivi par Vocalog. Demande à son administrateur.',
  connexion: 'Discord n’a pas répondu comme prévu. Réessaie dans un instant.',
};

/** Shown when a login is required and nobody is logged in. */
export function LoginView() {
  const reason = new URLSearchParams(window.location.search).get('erreur');
  const message = reason ? MESSAGES[reason] : undefined;
  return (
    <section class="card login" aria-labelledby="login-title">
      <p class="eyebrow">Vocalog</p>
      <h1 id="login-title">Connexion</h1>
      <p>Les statistiques vocales sont réservées aux membres des serveurs suivis. Connecte-toi avec ton compte Discord : seuls ton identifiant, ton nom et la liste de tes serveurs sont lus, et rien d’autre n’est conservé.</p>
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
