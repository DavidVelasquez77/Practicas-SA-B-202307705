import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ronin Auth',
  description:
    'Sistema de autenticación y autorización con NestJS y Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}