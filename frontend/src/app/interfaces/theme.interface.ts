export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    accent: string;
  };
  border: string;
  shadow: string;
  gradient?: {
    from: string;
    to: string;
  };
}

export interface ThemeTypography {
  fontFamily: {
    primary: string;
    secondary: string;
    accent?: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
    '6xl': string;
  };
  fontWeight: {
    light: string;
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

export interface ThemeBorderRadius {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  preview?: string; // URL to preview image
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  customCSS?: string; // Additional custom CSS
}

export interface ThemeState {
  currentTheme: string;
  darkMode: boolean;
  availableThemes: ThemeConfig[];
}

export type ThemeMode = 'light' | 'dark';
