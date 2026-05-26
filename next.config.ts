import { setDefaultResultOrder } from 'node:dns';
import type { NextConfig } from 'next';
import { varlockNextConfigPlugin } from '@varlock/nextjs-integration/plugin';

setDefaultResultOrder('ipv4first');

const nextConfig: NextConfig = {
  allowedDevOrigins: ['eba.otw.ci'],
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default varlockNextConfigPlugin()(nextConfig);
