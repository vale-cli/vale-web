import "@/assets/app.css";
import { followSystemTheme } from "@/lib/theme";

followSystemTheme();
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
