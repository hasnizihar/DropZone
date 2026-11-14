# DROPZONE Product Landing Page

This directory contains the standalone web landing page for **DROPZONE — Universal Desktop Download Manager for Windows**.

---

## Technical Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Icons**: Lucide React + custom Brand SVGs
- **Deployment**: Vercel (Static Single-Page Application)

---

## Brand Design Tokens

| Token | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Near Black** | `#121417` | Canvas background, card containers, dialog backdrops |
| **Warm Off-White** | `#F5F3EF` | Primary headers, stream titles, readable body |
| **Acid Lime** | `#D4FF5C` | Primary accent, download progress bars, CTA buttons |
| **Graphite Grey** | `#858B93` / `#282C35` | Borders, subtle dividers, secondary metadata captions |

---

## Development & Build Commands

### From Monorepo Root:
```bash
# Start local development server on http://localhost:3000
npm run website:dev

# Compile production bundle to website/dist/
npm run website:build

# Preview compiled production build
npm run website:preview
```

### From `website/` Directory:
```bash
cd website
npm run dev
npm run build
npm run preview
```

---

## Vercel Deployment Configuration

When connecting the GitHub repository (`hasnizihar/DropZone`) to Vercel:

| Setting | Value |
| :--- | :--- |
| **Framework Preset** | `Vite` |
| **Root Directory** | `website` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

Changes pushed to the `website/` directory deploy independently without requiring a new desktop release.

