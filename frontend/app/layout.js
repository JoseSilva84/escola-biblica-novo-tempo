import './globals.css';

const siteUrl = 'https://novotempo.sevenflowia.tech';
const siteTitle = 'Amigos NT - CRM de Interessados';
const siteDescription = 'CRM de associações, campanhas e automações de WhatsApp para interessados Novo Tempo';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  alternates: {
    canonical: siteUrl
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: 'Amigos NT',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Amigos NT'
      }
    ],
    locale: 'pt_BR',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/logo.png']
  },
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
