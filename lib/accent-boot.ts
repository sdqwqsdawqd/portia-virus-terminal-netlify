// Why: the SSR boot screen would paint teal (and animate regardless of the motion setting) before hydration, so this runs in <head> first.
// Never interpolate a runtime or user value into the string; with a future Content-Security-Policy it needs a hash or nonce.
export const accentIds = ["teal", "ice", "amber", "red"] as const;
// «Анимации»: on by default, off only by the visitor's choice (the OS setting is ignored). Resolved to html[data-motion="full" | "reduce"].
export const motionModes = ["on", "off"] as const;

export const accentBootScript =
  `(function(){var d=document.documentElement,s={};try{s=JSON.parse(localStorage.getItem("portia-desktop-settings-v1")||"{}")||{}}catch(e){}` +
  `if(${JSON.stringify(accentIds)}.indexOf(s.accent)>-1)d.dataset.accent=s.accent;` +
  `d.dataset.motion=s.motion==="off"?"reduce":"full"})()`;
