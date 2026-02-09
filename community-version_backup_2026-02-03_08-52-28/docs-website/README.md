# CitadelAI Documentation Website

Documentation website for CitadelAI Community Edition, served at `docs.citadelai.app`.

## Features

- ✅ Same color scheme as business website
- ✅ Markdown rendering with syntax highlighting
- ✅ Responsive design
- ✅ Dark mode support
- ✅ React Router for navigation

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

The website is built as a Docker image and served via nginx.

```bash
docker build -t docs-website .
```

## Color Scheme

Uses the same color scheme as the business website:
- Primary: `hsl(172, 45%, 32%)` - Teal/Cyan
- Secondary: `hsl(44, 45%, 52%)` - Yellow/Gold
- Background: `hsl(40, 25%, 92%)` - Light beige
- Foreground: `hsl(172, 50%, 15%)` - Dark teal
