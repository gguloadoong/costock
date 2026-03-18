import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CoStock — 주식·코인 통합',
    short_name: 'CoStock',
    description: '주식과 코인을 하나의 앱에서. 실시간 가격, 통합 투자정보.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#0F172A',
    orientation: 'portrait',
    categories: ['finance'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
