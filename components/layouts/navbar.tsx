'use client';
import React, { useRef } from 'react';
import {
  Button,
  Link,
  Navbar as UINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Image from 'next/image';
import { brandConfig } from '@/config/brand.config';
import { usePathname } from 'next/navigation';

const HOME_SCROLL_TRIGGER_PX = 140;
const HOME_NARROW_MAX_WIDTH = '75rem';

function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const isHome = pathname === '/';
  const navbarRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const navbarElement = navbarRef.current;
      if (!navbarElement) {
        return;
      }

      if (!isHome) {
        gsap.set(navbarElement, {
          maxWidth: '100%',
          marginTop: 0,
          borderRadius: 0,
          y: 0,
        });
        return;
      }

      let isExpanded = window.scrollY > HOME_SCROLL_TRIGGER_PX;

      gsap.set(navbarElement, {
        maxWidth: isExpanded ? '100%' : HOME_NARROW_MAX_WIDTH,
        marginTop: isExpanded ? 0 : 10,
        borderRadius: isExpanded ? 0 : 9999,
        y: isExpanded ? 0 : 8,
      });

      const onScroll = () => {
        const shouldExpand = window.scrollY > HOME_SCROLL_TRIGGER_PX;

        if (shouldExpand === isExpanded) {
          return;
        }

        isExpanded = shouldExpand;
        gsap.to(navbarElement, {
          maxWidth: shouldExpand ? '100%' : HOME_NARROW_MAX_WIDTH,
          marginTop: shouldExpand ? 0 : 10,
          borderRadius: shouldExpand ? 0 : 9999,
          y: shouldExpand ? 0 : 8,
          duration: 0.65,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      };

      window.addEventListener('scroll', onScroll, { passive: true });

      return () => {
        window.removeEventListener('scroll', onScroll);
      };
    },
    { dependencies: [isHome], scope: navbarRef }
  );

  const isActive = (href: string) => {
    return href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <UINavbar
      ref={navbarRef}
      isBordered
      className={`fixed left-0 right-0 z-50 w-full mx-auto`}
      classNames={{
        wrapper: 'w-full mx-auto px-4 lg:max-w-300 xl:max-w-380',
      }}
    >
      <NavbarBrand>
        <Image
          src="/assets/logos/eba_n.svg"
          alt="EBA Coffee Shop — café et pâtisserie à Abidjan"
          width={60}
          height={60}
        />
      </NavbarBrand>
      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        {brandConfig.menu.map((item, idx) => {
          const active = isActive(item.href);
          return (
            <NavbarItem key={idx} isActive={active}>
              <Link color={!active ? 'foreground' : 'primary'} href={item.href}>
                {item.label}
              </Link>
            </NavbarItem>
          );
        })}
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem className="hidden lg:flex">
          <Link href="/le-lieu">Nous trouver</Link>
        </NavbarItem>
        <NavbarItem className="hidden lg:flex">
          <Button as={Link} color="primary" href="/contact" variant="flat">
            Commander
          </Button>
        </NavbarItem>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          className="sm:hidden"
        />
        <NavbarMenu className="py-8">
          {brandConfig.menu.map((item, index) => {
            const active = isActive(item.href);
            return (
              <NavbarMenuItem key={`${item}-${index}`}>
                <Link
                  className="w-full"
                  color={!active ? 'foreground' : 'primary'}
                  href={item.href}
                  size="lg"
                  onPress={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </NavbarMenuItem>
            );
          })}
        </NavbarMenu>
      </NavbarContent>
    </UINavbar>
  );
}

export default Navbar;
