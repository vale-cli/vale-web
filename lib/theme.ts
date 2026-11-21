// The extension's pages follow the system's light or dark setting, and
// switch when it does.
export function followSystemTheme(): void {
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    document.documentElement.classList.toggle("dark", dark.matches);
    document.documentElement.style.colorScheme = dark.matches ? "dark" : "light";
  };
  apply();
  dark.addEventListener("change", apply);
}
