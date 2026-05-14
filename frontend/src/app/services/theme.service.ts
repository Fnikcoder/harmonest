import { Injectable } from '@angular/core';
import themeConfig from '../config/theme-config.json';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_STORAGE_KEY = 'harmonest-theme';
  private readonly DARK_MODE_STORAGE_KEY = 'harmonest-dark-mode';

  private currentTheme = themeConfig.selectedTheme;
  private isDarkMode = themeConfig.darkMode;

  constructor() {
    this.initializeTheme();
  }

  private initializeTheme(): void {
    // Use theme from JSON config or localStorage
    const savedTheme = localStorage.getItem(this.THEME_STORAGE_KEY) || this.currentTheme;
    const savedDarkMode = localStorage.getItem(this.DARK_MODE_STORAGE_KEY) === 'true' || this.isDarkMode;

    this.applyTheme(savedTheme, savedDarkMode);
  }

  public toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem(this.DARK_MODE_STORAGE_KEY, this.isDarkMode.toString());
    this.applyTheme(this.currentTheme, this.isDarkMode);
  }

  public setDarkMode(isDark: boolean): void {
    this.isDarkMode = isDark;
    localStorage.setItem(this.DARK_MODE_STORAGE_KEY, isDark.toString());
    this.applyTheme(this.currentTheme, isDark);
  }

  public setTheme(themeId: string): void {
    this.currentTheme = themeId;
    localStorage.setItem(this.THEME_STORAGE_KEY, themeId);
    this.applyTheme(themeId, this.isDarkMode);
  }

  private applyTheme(themeId: string, isDark: boolean): void {
    const theme = themeConfig.themes[themeId as keyof typeof themeConfig.themes];
    if (!theme) return;

    const colors = isDark ? theme.colors.dark : theme.colors.light;
    const root = document.documentElement;

    // Apply CSS custom properties
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-text-primary', colors.textPrimary);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-text-accent', colors.textAccent);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-shadow', colors.shadow);

    // Apply typography
    root.style.setProperty('--font-primary', theme.fonts.primary);
    root.style.setProperty('--font-secondary', theme.fonts.secondary);

    // Apply dark/light mode classes
    const htmlElement = document.documentElement;
    if (isDark) {
      htmlElement.classList.add('dark');
      htmlElement.classList.remove('light');
    } else {
      htmlElement.classList.add('light');
      htmlElement.classList.remove('dark');
    }

    // Apply theme class
    htmlElement.className = htmlElement.className.replace(/theme-\w+/g, '');
    htmlElement.classList.add(`theme-${themeId}`);
  }

  public getCurrentTheme(): string {
    return this.currentTheme;
  }

  public isDarkModeEnabled(): boolean {
    return this.isDarkMode;
  }
}
