import './globals.css';

export const metadata = {
  title: 'Amigos NT - CRM de Interessados',
  description: 'CRM de associações, campanhas e automações de WhatsApp para interessados Novo Tempo',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
