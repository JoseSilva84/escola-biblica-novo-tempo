import './globals.css';

export const metadata = {
  title: 'Leads NT - CRM de Interessados',
  description: 'CRM de associações, campanhas e automações de WhatsApp para interessados Novo Tempo'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
