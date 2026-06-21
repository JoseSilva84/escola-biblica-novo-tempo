import './globals.css';

export const metadata = {
  title: 'SEVENFLOW - Painel de Controle',
  description: 'Painel de controle com prioridade operacional oriunda de machine learning'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
