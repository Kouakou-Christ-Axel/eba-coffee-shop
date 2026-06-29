import React from 'react';
import Navbar from '@/components/layouts/navbar';
import SiteFooter from '@/components/layouts/site-footer';
import InstallPwa from '@/components/pwa/install-pwa';

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <SiteFooter />
      <InstallPwa />
    </>
  );
}

export default PublicLayout;
