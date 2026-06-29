import React from 'react';
import Navbar from '@/components/layouts/navbar';
import SiteFooter from '@/components/layouts/site-footer';
import InstallPwa from '@/components/pwa/install-pwa';
import DashboardFab from '@/components/layouts/dashboard-fab';

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <SiteFooter />
      <InstallPwa />
      <DashboardFab />
    </>
  );
}

export default PublicLayout;
