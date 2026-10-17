// Sınav sürerken başka sekmeye geçişte onay (Capacitor'daki window.oxCikisSor). Kartlar ekranı bir bekçi
// kaydeder; bekçi geçişi üstlenirse (onay sorar, "Çık" denince git() çağırır) true döner.
let bekci = null;

export function cikisBekcisi(f) {
  bekci = f;
  return () => { if (bekci === f) bekci = null; };
}

export function cikisSor(git) {
  return bekci ? bekci(git) : false;
}
