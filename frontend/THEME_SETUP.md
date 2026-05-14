# Theme System Setup

## Overview

The HarmoNest application now includes a dynamic theme system that allows you to set different themes before building the application. The theme configuration is stored in a JSON file and applied at build time.

## Available Themes

1. **Default Theme** - Clean and modern design with red primary colors
2. **Cozy Nest Theme** - Warm and inviting hospitality design with brown/tan colors

## How to Use

### Method 1: Using NPM Scripts (Recommended)

```bash
# Build with default theme (light mode)
npm run build:default

# Build with default theme (dark mode)
npm run build:default-dark

# Build with cozy nest theme (light mode)
npm run build:cozy-nest

# Build with cozy nest theme (dark mode)
npm run build:cozy-nest-dark
```

### Method 2: Manual Theme Setting

```bash
# Set theme manually then build
npm run set-theme cozy-nest light
npm run build

# Or set dark mode
npm run set-theme cozy-nest dark
npm run build
```

### Method 3: Direct Script Usage

```bash
# Set theme using the script directly
node scripts/set-theme.js cozy-nest light
node scripts/set-theme.js default dark
```

## Theme Configuration

The theme configuration is stored in `src/app/config/theme-config.json`. You can modify this file to:

1. **Change the default theme**: Update the `selectedTheme` property
2. **Change default mode**: Update the `darkMode` property
3. **Add new themes**: Add new theme objects to the `themes` section
4. **Modify colors**: Update the color values in existing themes

### Example Configuration

```json
{
  "selectedTheme": "cozy-nest",
  "darkMode": false,
  "themes": {
    "cozy-nest": {
      "id": "cozy-nest",
      "name": "Cozy Nest",
      "description": "Warm and inviting hospitality design",
      "colors": {
        "light": {
          "primary": "#8b5a3c",
          "secondary": "#6b7280",
          "accent": "#3b82f6",
          "background": "#ffffff",
          "surface": "#f9fafb",
          "textPrimary": "#1f2937",
          "textSecondary": "#6b7280",
          "textAccent": "#8b5a3c",
          "border": "#e5e7eb",
          "shadow": "rgba(139, 90, 60, 0.15)"
        },
        "dark": {
          // Dark mode colors...
        }
      },
      "fonts": {
        "primary": "\"Inter\", sans-serif",
        "secondary": "\"Playfair Display\", serif"
      }
    }
  }
}
```

## Adding New Themes

1. **Add theme to JSON config**:
   - Open `src/app/config/theme-config.json`
   - Add your new theme object to the `themes` section

2. **Add theme-specific CSS** (optional):
   - Open `src/assets/scss/themes/_themes.scss`
   - Add a new section like `.theme-your-theme-name { /* styles */ }`

3. **Update build scripts** (optional):
   - Add new npm scripts to `package.json` for your theme

## CSS Custom Properties

The theme system uses CSS custom properties that are automatically applied:

- `--color-primary`: Primary brand color
- `--color-secondary`: Secondary color
- `--color-accent`: Accent color
- `--color-background`: Main background
- `--color-surface`: Card/surface background
- `--color-text-primary`: Primary text color
- `--color-text-secondary`: Secondary text color
- `--color-text-accent`: Accent text color
- `--color-border`: Border color
- `--color-shadow`: Shadow color
- `--font-primary`: Primary font family
- `--font-secondary`: Secondary font family

## Using Theme Colors in Components

```scss
.my-component {
  background-color: var(--color-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  font-family: var(--font-primary);
}
```

```html
<div class="bg-theme-primary text-theme-text-primary">
  Themed content
</div>
```

## Runtime Theme Switching

Users can still switch between light and dark modes at runtime using the toggle in the top-left corner. The theme selection (default vs cozy-nest) is set at build time.

## Troubleshooting

1. **Theme not applying**: Make sure the theme ID in the JSON config matches exactly
2. **Build errors**: Ensure the JSON file is valid and all required properties are present
3. **Colors not showing**: Check that CSS custom properties are being used correctly

## Development

For development, you can change the theme in the JSON file and restart the dev server:

```bash
# Change theme in src/app/config/theme-config.json
npm start
```

The theme will be applied when the application loads.
