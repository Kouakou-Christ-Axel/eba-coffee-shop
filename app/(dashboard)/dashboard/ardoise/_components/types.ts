import type { fetchArdoise } from '@/lib/ardoise';

export type Ardoise = Awaited<ReturnType<typeof fetchArdoise>>;
export type ArdoiseGroup = Ardoise['groups'][number];
