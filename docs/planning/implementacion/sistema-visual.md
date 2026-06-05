# Sistema visual de BBJobs

> Paleta de colores, logo, tipografía y reglas de aplicación del frontend.
> Este documento es la fuente de verdad para FASE 13 en adelante.
> Inspirado en la identidad de Talency (empresa madre), pero con identidad propia de BBJobs.

---

## 1. Logo

### Archivo
- Path en repo: `frontend/public/logo.png` (a copiar desde `logo.png` en la raíz del proyecto durante FASE 13).
- El símbolo es una figura humana estilizada en color teal (con dos triángulos naranja pastel a sus costados), evocando movimiento, dinamismo y crecimiento profesional.

### Reglas de uso

| Contexto | Aplicación |
|----------|-----------|
| Header de la web | Logo (símbolo) + texto **"BBJobs"** al costado en `--primary` (teal). Tamaño: 32-40px de alto. |
| Favicon | Solo el símbolo, exportado a PNG cuadrado 512px. Convertir a `.ico` para favicon. |
| Footer | Versión chica del logo + texto. |
| Pantallas de loading | Solo el símbolo, animado opcionalmente (rotación suave o pulse). |
| Emails (Resend) | Logo en el header de cada template, alineado a la izquierda. Versión hospedada en R2 o como inline. |

### Componente React (FASE 13)

```tsx
// frontend/components/brand/BBJobsLogo.tsx
import Image from "next/image";

interface BBJobsLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function BBJobsLogo({ size = "md", showText = true, className }: BBJobsLogoProps) {
  const dim = { sm: 24, md: 36, lg: 48 }[size];
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Image src="/logo.png" alt="BBJobs" width={dim} height={dim} priority />
      {showText && (
        <span className="font-bold text-primary text-xl tracking-tight">
          BBJobs
        </span>
      )}
    </div>
  );
}
```

---

## 2. Paleta de colores

> Formato HSL para variables CSS (compatibilidad con shadcn/ui y manipulación de luminosidad).
> Hex equivalente listado al lado.

### 2.1. Colores raíz

| Token | HSL | Hex aprox | Uso |
|-------|-----|-----------|-----|
| `--primary` | `188 68% 38%` | `#1E8EA3` | Color principal — botones primarios, links destacados, headers, logo. |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Texto/iconos sobre fondo `--primary`. |
| `--secondary` | `26 35% 74%` | `#D4B7A2` | Color secundario — naranja pastel, acentos suaves, badges. |
| `--secondary-foreground` | `215 25% 15%` | `#1C2230` | Texto sobre fondo `--secondary`. |
| `--accent` | `188 68% 95%` | `#E6F4F7` | Fondos sutiles, hover states, áreas destacadas. |
| `--accent-foreground` | `188 68% 30%` | `#187B8E` | Texto sobre fondo `--accent`. |
| `--destructive` | `0 84% 60%` | `#EE4444` | Errores, acciones destructivas (eliminar, cancelar). |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre `--destructive`. |
| `--muted` | `210 40% 96%` | `#F1F5F9` | Fondos secundarios, áreas de menor importancia. |
| `--muted-foreground` | `215 16% 47%` | `#64748B` | Texto secundario, captions, metadata. |
| `--background` | `210 40% 99%` | `#FAFBFD` | Fondo de la página. |
| `--foreground` | `215 25% 15%` | `#1C2230` | Texto principal. |
| `--border` | `214 32% 91%` | `#DDE3EC` | Bordes generales. |
| `--input` | `214 32% 91%` | `#DDE3EC` | Bordes de inputs. |
| `--ring` | `188 68% 38%` | `#1E8EA3` | Outline al hacer foco (mismo que primary). |

### 2.2. Componentes UI

| Token | HSL | Uso |
|-------|-----|-----|
| `--card` | `0 0% 100%` | Fondo de cards. |
| `--card-foreground` | `215 25% 15%` | Texto en cards. |
| `--popover` | `0 0% 100%` | Fondo de popovers, tooltips, dropdowns. |
| `--popover-foreground` | `215 25% 15%` | Texto en popovers. |

### 2.3. Sidebar (para panel admin y portales)

| Token | HSL | Uso |
|-------|-----|-----|
| `--sidebar-background` | `0 0% 98%` | Fondo del sidebar. |
| `--sidebar-foreground` | `240 5.3% 26.1%` | Texto del sidebar. |
| `--sidebar-primary` | `188 68% 38%` | Item activo / link activo del sidebar. |
| `--sidebar-accent` | `240 4.8% 95.9%` | Hover state del sidebar. |

### 2.4. Paleta de marca (referencia rápida)

```ts
// frontend/tailwind.config.ts — sección theme.extend.colors
export const brandColors = {
  talency: {
    teal: "#1E8EA3",     // primary
    orange: "#D4B7A2",   // secondary (naranja pastel)
    dark: "#0F172A",     // foreground
  },
};
```

---

## 3. Configuración Tailwind + globals.css

### 3.1. `frontend/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --primary: 188 68% 38%;
    --primary-foreground: 0 0% 100%;
    --secondary: 26 35% 74%;
    --secondary-foreground: 215 25% 15%;
    --accent: 188 68% 95%;
    --accent-foreground: 188 68% 30%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --background: 210 40% 99%;
    --foreground: 215 25% 15%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 188 68% 38%;
    --card: 0 0% 100%;
    --card-foreground: 215 25% 15%;
    --popover: 0 0% 100%;
    --popover-foreground: 215 25% 15%;
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 188 68% 38%;
    --sidebar-accent: 240 4.8% 95.9%;
    --radius: 0.5rem;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

### 3.2. `frontend/tailwind.config.ts` — extender colors

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        talency: {
          teal: "#1E8EA3",
          orange: "#D4B7A2",
          dark: "#0F172A",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};
export default config;
```

---

## 4. Tipografía

| Uso | Fuente | Peso | Tamaño |
|-----|--------|------|--------|
| Body | Inter (vía `next/font/google`) | 400 | 16px base |
| Headings | Inter | 600–700 | h1: 36-48px, h2: 28-32px, h3: 22-24px |
| Monospace | JetBrains Mono | 400 | 14px (códigos, IDs) |

### Implementación

```ts
// frontend/app/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

---

## 5. Reglas de aplicación

### 5.1. Colores

- **Primary (teal)** se usa con moderación: 1-2 CTAs principales por pantalla, no inundar.
- **Secondary (naranja pastel)** es un acento, no un protagonista. Bien para badges, "destacado", elementos decorativos sutiles.
- **Accent (teal claro)** para hover states y áreas suaves.
- **Background** SIEMPRE muy claro (casi blanco con tinte azulado). Nunca colores fuertes de fondo.
- Texto principal SIEMPRE `--foreground` (gris oscuro casi negro). Nunca negro puro.
- Texto secundario en `--muted-foreground` (gris medio).

### 5.2. Estados de UI

| Estado | Color |
|--------|-------|
| Default | `--primary` |
| Hover | `--primary` con `opacity-90` |
| Focus | `outline` `--ring` |
| Disabled | `opacity-50` + `cursor-not-allowed` |
| Loading | spinner en `--primary` |

### 5.3. Badges de estado (JobPosting, Application, etc.)

| Estado | Color de fondo | Color de texto |
|--------|----------------|-----------------|
| `published` / `active` | `bg-primary` o `bg-accent` | `text-primary-foreground` o `text-accent-foreground` |
| `pending` | `bg-yellow-100` | `text-yellow-900` |
| `paused` | `bg-muted` | `text-muted-foreground` |
| `closed` / `expired` | `bg-secondary` | `text-secondary-foreground` |
| `discarded` / `rejected` | `bg-destructive/10` | `text-destructive` |
| `featured` ✨ | `bg-secondary` con borde sutil | `text-secondary-foreground` |

### 5.4. Spacing y radius

- Border radius default: `0.5rem` (`rounded-md`).
- Cards: `rounded-lg`.
- Botones: `rounded-md`.
- Avatares: `rounded-full`.

### 5.5. Sombras

Mínimas y sutiles. Usar las default de Tailwind (`shadow-sm`, `shadow`, `shadow-md`). No usar sombras coloreadas (no "neon glow", no "elevated colored").

---

## 6. Mobile first

- Diseñar pensando en pantalla de 360-414px de ancho primero.
- Breakpoints Tailwind por defecto: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`.
- El header en mobile se convierte en hamburger menu.
- Las cards de búsquedas en mobile son full-width, en desktop son grid de 2-3 columnas.

---

## 7. Accesibilidad

- Contraste mínimo WCAG AA: 4.5:1 para texto normal, 3:1 para texto grande.
- Foco visible en todos los elementos interactivos (usar `--ring`).
- `aria-label` en botones con solo icono.
- Skip-to-content link en el header.
- Soporte de teclado completo en menús, dialogs, etc. (shadcn/ui lo da por defecto).

---

## 8. Modo oscuro

**Por ahora F1: solo modo claro.** El planeamiento de modo oscuro queda para F2.

Si en F2 se agrega, se definen las variables `:root.dark { ... }` con la paleta invertida apropiadamente.

---

*Documento de sistema visual — guía para FASE 13 (frontend scaffold) en adelante.*
