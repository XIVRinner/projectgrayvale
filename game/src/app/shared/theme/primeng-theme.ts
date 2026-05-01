import { definePreset } from "@primeuix/themes";
import Aura from "@primeuix/themes/aura";

export const GrayValeTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: "#fff6df",
      100: "#fff1cf",
      200: "#ffe899",
      300: "#ffd88c",
      400: "#ffc850",
      500: "#ffc145",
      600: "#f2b84b",
      700: "#d4a54f",
      800: "#aa8039",
      900: "#8b631f",
      950: "#5a3e12"
    },
    surface: {
      0: "#ffffff",
      50: "#ebeff6",
      100: "#cfd7e7",
      200: "#abb8d0",
      300: "#8395b3",
      400: "#637592",
      500: "#4d5f79",
      600: "#3c4a62",
      700: "#2d384b",
      800: "#202836",
      900: "#131a25",
      950: "#090e16"
    }
  }
});
