// Why: the SSR boot screen would paint teal before hydration applies the saved accent, so this runs in <head> first.
// Never interpolate a runtime or user value into the string; with a future Content-Security-Policy it needs a hash or nonce.
export const accentIds = ["teal", "ice", "amber", "red"] as const;

export const accentBootScript =
  `try{var a=JSON.parse(localStorage.getItem("portia-desktop-settings-v1")||"{}").accent;` +
  `if(${JSON.stringify(accentIds)}.indexOf(a)>-1)document.documentElement.dataset.accent=a}catch(e){}`;
