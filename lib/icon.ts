// The toolbar button is the mark alone, in the tone the browser's own
// toolbar icons have: light on a dark toolbar, dark on a light one. The
// manifest's default is a gray that reads on both, until a page reports
// which the browser is using.
export const actionSizes = [16, 24, 32, 48] as const;

export function actionIcon(dark: boolean): Record<number, string> {
  const tone = dark ? "on-dark" : "on-light";
  return Object.fromEntries(actionSizes.map((size) => [size, `icon/action-${tone}-${size}.png`]));
}
