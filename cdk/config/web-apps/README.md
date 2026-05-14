# Configuration Management Web Applications

This directory contains two web applications for managing client configurations: a React version and a Vue.js version. Both applications provide the same functionality but use different frontend frameworks to demonstrate different approaches.

## 🏗️ Architecture

### Components
- **API Server**: Python Flask server providing REST API
- **React App**: Modern React application with Material-UI
- **Vue App**: Vue 3 application with Vuetify

### Features
- ✅ Client configuration CRUD operations
- ✅ Real-time validation using JSON schema
- ✅ Tabbed interface for different configuration sections
- ✅ Environment-specific settings management
- ✅ Responsive design for desktop and mobile
- ✅ Error handling and user feedback

## 🚀 Quick Start

### 1. Start the API Server

```bash
# Install Python dependencies
cd config/web-apps
pip install -r requirements.txt

# Start the API server
python api-server.py --debug
```

The API server will be available at `http://localhost:8000`

### 2. React Application

```bash
# Navigate to React app
cd config/web-apps/react-config-app

# Install dependencies
npm install

# Start development server
npm start
```

The React app will be available at `http://localhost:3000`

### 3. Vue.js Application

```bash
# Navigate to Vue app
cd config/web-apps/vue-config-app

# Install dependencies
npm install

# Start development server
npm run serve
```

The Vue app will be available at `http://localhost:8080`

## 📋 API Endpoints

The API server provides the following endpoints:

### Client Management
- `GET /api/clients` - List all clients
- `GET /api/clients/<name>` - Get client configuration
- `POST /api/clients/<name>` - Create new client
- `PUT /api/clients/<name>` - Update client configuration
- `DELETE /api/clients/<name>` - Delete client

### Validation & Schema
- `POST /api/validate` - Validate configuration
- `GET /api/schema` - Get JSON schema

### Utility
- `GET /api/health` - Health check
- `GET /` - API documentation

## 🎨 React Application

### Technology Stack
- **React 18** with TypeScript
- **Material-UI (MUI)** for components
- **React Router** for navigation
- **Context API** for state management

### Key Features
- Type-safe configuration editing
- Real-time validation feedback
- Responsive Material Design
- Comprehensive form validation
- Error boundaries and loading states

### Project Structure
```
react-config-app/
├── public/
├── src/
│   ├── components/
│   │   ├── ClientList.tsx
│   │   ├── ClientEditor.tsx
│   │   └── Navigation.tsx
│   ├── contexts/
│   │   └── ConfigContext.tsx
│   ├── App.tsx
│   └── index.tsx
└── package.json
```

### Development Commands
```bash
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
npm run serve      # Serve production build
```

## 🎯 Vue.js Application

### Technology Stack
- **Vue 3** with Composition API
- **Vuetify 3** for components
- **Vue Router 4** for navigation
- **Axios** for HTTP requests

### Key Features
- Modern Vue 3 Composition API
- Vuetify Material Design components
- Reactive data binding
- Component-based architecture
- Built-in form validation

### Project Structure
```
vue-config-app/
├── public/
├── src/
│   ├── views/
│   │   ├── ClientList.vue
│   │   └── ClientEditor.vue
│   ├── services/
│   │   └── configService.js
│   ├── router/
│   │   └── index.js
│   ├── plugins/
│   │   ├── vuetify.js
│   │   └── webfontloader.js
│   ├── App.vue
│   └── main.js
└── package.json
```

### Development Commands
```bash
npm run serve      # Start development server
npm run build      # Build for production
npm run lint       # Lint and fix files
```

## 🔧 Configuration

### API Server Configuration
The API server can be configured with command-line arguments:

```bash
python api-server.py --help
```

Options:
- `--host`: Host to bind to (default: localhost)
- `--port`: Port to bind to (default: 8000)
- `--debug`: Enable debug mode

### Environment Variables
Both web applications support environment-specific configuration:

**React (.env files)**:
```
REACT_APP_API_BASE=http://localhost:8000
```

**Vue (vue.config.js)**:
```javascript
devServer: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

## 🧪 Testing

### API Testing
Test the API server directly:

```bash
# Health check
curl http://localhost:8000/api/health

# List clients
curl http://localhost:8000/api/clients

# Get client configuration
curl http://localhost:8000/api/clients/harmonest
```

### Frontend Testing
Both applications include development tools for testing:

**React**:
- React Developer Tools
- Built-in error boundaries
- TypeScript compile-time checking

**Vue**:
- Vue Developer Tools
- Vue 3 DevTools support
- ESLint integration

## 🚀 Production Deployment

### Build Applications
```bash
# React
cd react-config-app
npm run build

# Vue
cd vue-config-app
npm run build
```

### Serve Static Files
Both applications generate static files that can be served by any web server:

```bash
# Serve React build
npx serve -s react-config-app/build

# Serve Vue build
npx serve -s vue-config-app/dist
```

### Production API Server
For production, consider using a WSGI server:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 api-server:app
```

## 🔒 Security Considerations

### Development
- API server runs in debug mode for development
- CORS is enabled for all origins
- No authentication required

### Production
- Disable debug mode
- Configure CORS for specific origins
- Add authentication/authorization
- Use HTTPS
- Validate all inputs
- Rate limiting

## 🤝 Contributing

### Adding New Features
1. Update the API server endpoints
2. Update both React and Vue applications
3. Test all functionality
4. Update documentation

### Code Style
- **React**: TypeScript with ESLint
- **Vue**: JavaScript with ESLint
- **Python**: PEP 8 style guide

## 📚 Learning Resources

### React
- [React Documentation](https://react.dev/)
- [Material-UI Documentation](https://mui.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Vue.js
- [Vue 3 Documentation](https://vuejs.org/)
- [Vuetify Documentation](https://vuetifyjs.com/)
- [Vue Router Documentation](https://router.vuejs.org/)

### Comparison
Both applications demonstrate:
- Component-based architecture
- State management patterns
- Form handling and validation
- HTTP client integration
- Responsive design principles

Choose the framework that best fits your team's expertise and project requirements.
