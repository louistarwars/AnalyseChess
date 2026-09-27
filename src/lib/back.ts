// Pile de gestionnaires du bouton « retour » Android : le plus récent est prioritaire.
type Handler = () => boolean;
const handlers: Handler[] = [];

export function pushBackHandler(h: Handler): () => void {
  handlers.push(h);
  return () => {
    const i = handlers.lastIndexOf(h);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function runBackHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i]()) return true;
  return false;
}
