import React from 'react';
import Navbar from '@/components/layouts/navbar';
import SiteFooter from '@/components/layouts/site-footer';

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

export default PublicLayout;
