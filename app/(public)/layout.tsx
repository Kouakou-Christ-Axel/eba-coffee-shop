import React from 'react';
import Navbar from '@/components/layouts/navbar';
import SiteFooter from '@/components/layouts/site-footer';
import InstallPwa from '@/components/pwa/install-pwa';
import DashboardFab from '@/components/layouts/dashboard-fab';
import { getContactSettings } from '@/lib/contact-settings-db';

async function PublicLayout({ children }: { children: React.ReactNode }) {
  const contact = await getContactSettings();
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <SiteFooter contact={contact} />
      <InstallPwa />
      <DashboardFab />
    </>
  );
}

export default PublicLayout;
