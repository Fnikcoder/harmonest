#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const themeName = args[0];
const darkMode = args[1] === 'dark';

if (!themeName) {
  console.log('Usage: node scripts/set-theme.js <theme-name> [dark|light]');
  console.log('Available themes: default, cozy-nest');
  process.exit(1);
}

// Path to theme config file
const configPath = path.join(__dirname, '../src/app/config/theme-config.json');

try {
  // Read current config
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Check if theme exists
  if (!config.themes[themeName]) {
    console.error(`Theme "${themeName}" not found. Available themes: ${Object.keys(config.themes).join(', ')}`);
    process.exit(1);
  }
  
  // Update config
  config.selectedTheme = themeName;
  config.darkMode = darkMode;
  
  // Write updated config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(`✅ Theme set to: ${themeName} (${darkMode ? 'dark' : 'light'} mode)`);
  console.log('You can now build your application with the selected theme.');
  
} catch (error) {
  console.error('Error updating theme config:', error.message);
  process.exit(1);
}
