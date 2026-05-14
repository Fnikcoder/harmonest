# Dynamic Theme System Documentation

## Overview

The HarmoNest application now includes a comprehensive dynamic theme system that allows users to switch between different website designs and color schemes in real-time. The system supports both light and dark modes for each theme.

## Features

- **Multiple Theme Support**: Switch between different design themes (Default, Cozy Nest)
- **Dark/Light Mode**: Each theme supports both dark and light modes
- **Real-time Switching**: Changes apply instantly without page reload
- **Persistent Settings**: Theme preferences are saved in localStorage
- **CSS Custom Properties**: Uses CSS variables for seamless theme transitions
- **Responsive Design**: All themes work across different screen sizes
- **TypeScript Support**: Fully typed interfaces and services

## Architecture

### Core Components

1. **ThemeService** (`src/app/services/theme.service.ts`)
   - Manages theme state and switching logic
   - Handles localStorage persistence
   - Applies CSS custom properties dynamically

2. **Theme Interfaces** (`src/app/interfaces/theme.interface.ts`)
   - TypeScript interfaces for theme configuration
   - Defines color schemes, typography, and spacing

3. **ThemeSwitcherComponent** (`src/app/components/theme-switcher/theme-switcher.component.ts`)
   - UI component for theme selection
   - Slide-out panel with theme previews
   - Dark mode toggle

4. **Theme CSS** (`src/assets/scss/themes/_themes.scss`)
   - CSS custom properties and theme-specific styles
   - Utility classes for theme-aware components

## Available Themes

### 1. Default Theme
- **Colors**: Red primary, slate secondary, blue accent
- **Typography**: DM Sans primary, Dancing Script secondary
- **Style**: Clean and modern design
- **Use Case**: General purpose, professional look

### 2. Cozy Nest Theme
- **Colors**: Warm brown primary, gray secondary, blue accent
- **Typography**: Inter primary, Playfair Display secondary, Poppins accent
- **Style**: Warm and inviting hospitality design
- **Use Case**: Hospitality, vacation rentals, cozy atmosphere

## Usage

### Basic Theme Switching

```typescript
import { ThemeService } from './services/theme.service';

constructor(private themeService: ThemeService) {}

// Switch to a specific theme
switchToCozyNest() {
  this.themeService.setTheme('cozy-nest');
}

// Toggle dark mode
toggleDarkMode() {
  this.themeService.toggleDarkMode();
}

// Get current theme
getCurrentTheme() {
  return this.themeService.getCurrentTheme();
}
```

### Using Theme-Aware CSS Classes

```html
<!-- Use theme-aware background colors -->
<div class="bg-theme-primary text-white">Primary colored section</div>
<div class="bg-theme-surface border-theme">Card with theme colors</div>

<!-- Use theme-aware text colors -->
<h1 class="text-theme-primary">Primary text color</h1>
<p class="text-theme-secondary">Secondary text color</p>

<!-- Use theme-aware fonts -->
<h1 class="font-theme-primary">Primary font family</h1>
<h2 class="font-theme-secondary">Secondary font family</h2>
```

### Using CSS Custom Properties

```scss
.my-component {
  background-color: var(--color-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  font-family: var(--font-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}
```

## Theme Configuration

### Adding a New Theme

1. **Define Theme Configuration**:
```typescript
const newTheme: ThemeConfig = {
  id: 'my-theme',
  name: 'My Custom Theme',
  description: 'A custom theme description',
  colors: {
    light: {
      primary: '#your-color',
      secondary: '#your-color',
      // ... other colors
    },
    dark: {
      // ... dark mode colors
    }
  },
  typography: {
    fontFamily: {
      primary: '"Your Font", sans-serif',
      secondary: '"Your Secondary Font", serif'
    },
    // ... other typography settings
  },
  // ... spacing and border radius
};
```

2. **Add to ThemeService**:
```typescript
// In theme.service.ts, add to availableThemes array
private availableThemes: ThemeConfig[] = [
  // ... existing themes
  newTheme
];
```

3. **Add Theme-Specific Styles** (optional):
```scss
// In _themes.scss
.theme-my-theme {
  // Custom styles specific to your theme
  .hero-section {
    background: linear-gradient(/* your gradient */);
  }
  
  .btn-primary {
    // Custom button styles
  }
}
```

## Components Integration

### Theme Demo Component

The `ThemeDemoComponent` showcases the theme system functionality:
- Displays current theme information
- Provides quick theme switching buttons
- Shows sample components with theme colors
- Demonstrates theme-aware styling

### Enhanced Switcher Component

The existing `SwitcherComponent` has been enhanced to:
- Use the new ThemeService for dark mode toggling
- Include the new ThemeSwitcherComponent
- Maintain backward compatibility

## File Structure

```
src/
├── app/
│   ├── interfaces/
│   │   └── theme.interface.ts          # Theme type definitions
│   ├── services/
│   │   └── theme.service.ts            # Core theme service
│   ├── components/
│   │   ├── theme-switcher/             # Theme selection UI
│   │   ├── theme-demo/                 # Demo component
│   │   └── switcher/                   # Enhanced switcher
└── assets/
    └── scss/
        └── themes/
            └── _themes.scss            # Theme CSS and utilities
```

## CSS Custom Properties Reference

### Colors
- `--color-primary`: Primary brand color
- `--color-secondary`: Secondary color
- `--color-accent`: Accent color
- `--color-background`: Main background color
- `--color-surface`: Card/surface background color
- `--color-text-primary`: Primary text color
- `--color-text-secondary`: Secondary text color
- `--color-text-accent`: Accent text color
- `--color-border`: Border color
- `--color-shadow`: Shadow color

### Typography
- `--font-primary`: Primary font family
- `--font-secondary`: Secondary font family
- `--font-accent`: Accent font family

### Spacing
- `--spacing-xs` to `--spacing-3xl`: Consistent spacing values

### Border Radius
- `--radius-none` to `--radius-full`: Border radius values

## Best Practices

1. **Use Theme-Aware Classes**: Always use theme-aware CSS classes or custom properties instead of hardcoded colors.

2. **Test Both Modes**: Ensure your components work well in both light and dark modes.

3. **Consistent Spacing**: Use the spacing custom properties for consistent layouts.

4. **Semantic Colors**: Use semantic color names (primary, secondary, accent) rather than specific color values.

5. **Graceful Fallbacks**: Provide fallback values for CSS custom properties:
   ```scss
   color: var(--color-primary, #ef4444);
   ```

## Browser Support

The theme system uses CSS custom properties (CSS variables) which are supported in:
- Chrome 49+
- Firefox 31+
- Safari 9.1+
- Edge 16+

For older browsers, consider using a CSS custom properties polyfill.

## Performance Considerations

- Theme switching is optimized to only update CSS custom properties
- No page reload required for theme changes
- Minimal DOM manipulation
- Efficient localStorage usage for persistence

## Troubleshooting

### Theme Not Applying
1. Check if CSS custom properties are properly defined
2. Verify theme ID exists in available themes
3. Ensure theme CSS is imported in styles.scss

### Dark Mode Issues
1. Check if dark mode classes are properly applied to html element
2. Verify dark mode color definitions in theme configuration
3. Ensure components use theme-aware classes

### Performance Issues
1. Minimize custom CSS in theme configurations
2. Use CSS custom properties instead of dynamic style injection
3. Avoid frequent theme switching in production

## Future Enhancements

- Theme marketplace for user-created themes
- Advanced theme customization UI
- Theme preview without applying
- Automatic theme switching based on time of day
- Integration with system dark mode preferences
- Theme-specific animations and transitions
