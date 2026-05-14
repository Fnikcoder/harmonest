/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}", "./node_modules/tw-elements/dist/js/**/*.js"],
    darkMode: 'class',
    important: true,
    theme: {
        screens: {
            xs: "540px",
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
            '2xl': '1536px',
        },
        container: {
            center: true,
            padding: {
                DEFAULT: '12px',
                sm: '1rem',
                lg: '45px',
                xl: '5rem',
                '2xl': '13rem',
            },

        },

        fontFamily: {
            'dm_sans': ['"DM Sans", sans-serif'],
            'dancing': ['"Dancing Script", cursive'],
            'corbel': ['"Corbel", "Segoe UI", sans-serif'],
            'dm_mono': ['"DM Mono", "Courier New", monospace'],
            'faculty_glyphic': ['"Faculty Glyphic", serif'],
        },


        extend: {
            screens: {
                lg_992: '992px',
            },
            colors: {
                'dark': '#3c4858',
                'black': '#161c2d',
                'dark-footer': '#161c28',
                // Theme-aware colors using CSS custom properties
                'theme-primary': 'var(--color-primary)',
                'theme-secondary': 'var(--color-secondary)',
                'theme-accent': 'var(--color-accent)',
                'theme-background': 'var(--color-background)',
                'theme-surface': 'var(--color-surface)',
                'theme-text-primary': 'var(--color-text-primary)',
                'theme-text-secondary': 'var(--color-text-secondary)',
                'theme-text-accent': 'var(--color-text-accent)',
                'theme-border': 'var(--color-border)',
                // Cozy nest theme colors
                'cozy-brown': '#8b5a3c',
                'cozy-tan': '#d2b48c',
                'warm-gray': '#6b7280',
                // HarmoNest brand colors
                'harmonest-blue': '#3e7cb1',
                'harmonest-dark': '#1d1d1b',
                'harmonest-navy': '#1c39bb',
                'harmonest-beige': '#d2bfa3',
            },

            boxShadow: {
                sm: '0 2px 4px 0 rgb(60 72 88 / 0.15)',
                DEFAULT: '0 0 3px rgb(60 72 88 / 0.15)',
                md: '0 5px 13px rgb(60 72 88 / 0.20)',
                lg: '0 10px 25px -3px rgb(60 72 88 / 0.15)',
                xl: '0 20px 25px -5px rgb(60 72 88 / 0.1), 0 8px 10px -6px rgb(60 72 88 / 0.1)',
                '2xl': '0 25px 50px -12px rgb(60 72 88 / 0.25)',
                inner: 'inset 0 2px 4px 0 rgb(60 72 88 / 0.05)',
                testi: '2px 2px 2px -1px rgb(60 72 88 / 0.15)',
            },

            fontSize: {
                base: ['16px', '28px'],
                lg: ['18px', '28px'],
            },

            spacing: {
                0.75: '0.1875rem',
                3.25: '0.8125rem'
            },

            height: ({
                theme
            }) => ({
                '10.5': '2.625rem',
                '85': '21.25rem',
            }),
            width: ({
                theme
            }) => ({
                '10.5': '2.625rem',
            }),

            maxWidth: ({
                theme,
                breakpoints
            }) => ({
                '1200': '71.25rem',
                '992': '60rem',
                '768': '45rem',
            }),

            zIndex: {
                1: '1',
                2: '2',
                3: '3',
                999: '999',
            },
        },
    },

    plugins: [
        require("@tailwindcss/forms")({
          strategy: 'class', // only generate classes
        }),
    ],
}

