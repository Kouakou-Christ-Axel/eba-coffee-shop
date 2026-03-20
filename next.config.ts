import type { NextConfig } from 'next';
import { varlockNextConfigPlugin } from '@varlock/nextjs-integration/plugin';

const nextConfig: NextConfig = {};

export default varlockNextConfigPlugin()(nextConfig);
