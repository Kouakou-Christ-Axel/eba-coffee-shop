import type { NextConfig } from 'next';
import { varlockNextConfigPlugin } from '@varlock/nextjs-integration/plugin';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default varlockNextConfigPlugin()(nextConfig);
