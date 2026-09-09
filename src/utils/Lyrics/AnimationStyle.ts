// Reading inline style does not query computed style or force layout. Avoid
// rewriting settled gradients/glow values on every animation frame.
export function setAnimationStyle(element: {style: Pick<CSSStyleDeclaration,
  "getPropertyValue" | "setProperty">}, property: string, value: string) {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
}
