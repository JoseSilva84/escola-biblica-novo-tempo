'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[app:error]', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#020617',
          color: '#f8fafc',
          fontFamily: 'Inter, Arial, sans-serif',
          padding: 24
        }}>
          <section style={{
            width: '100%',
            maxWidth: 560,
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 24,
            background: 'rgba(15,23,42,0.86)',
            boxShadow: '0 28px 90px rgba(0,0,0,0.34)',
            padding: 28,
            textAlign: 'center'
          }}>
            <span style={{
              color: '#93c5fd',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase'
            }}>
              Amigos NT
            </span>
            <h1 style={{ margin: '12px 0 8px', fontSize: 28, lineHeight: 1.1 }}>
              A página não carregou corretamente
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
              Isso pode acontecer durante uma atualização do sistema ou quando algum módulo encontra um erro inesperado.
            </p>
            <button
              onClick={() => reset()}
              style={{
                height: 44,
                border: 0,
                borderRadius: 12,
                background: 'linear-gradient(135deg,#1e3a8a,#2563eb,#0f172a)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 800,
                padding: '0 18px'
              }}
              type="button"
            >
              Tentar carregar novamente
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
