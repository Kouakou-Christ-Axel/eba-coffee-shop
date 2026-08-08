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
import NextLink from 'next/link';
import { Receipt, ShoppingBag } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';
import { DASHBOARD_ROLES } from '@/config/constants';
import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { useHasOrderHistory } from '@/lib/hooks/use-order-history';
import NavbarCartButton from '@/components/layouts/navbar-cart-button';
import NavbarOrdersButton from '@/components/layouts/navbar-orders-button';

const HOME_SCROLL_TRIGGER_PX = 140;
const HOME_NARROW_MAX_WIDTH = '75rem';

function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const isHome = pathname === '/';
  const navbarRef = useRef<HTMLElement | null>(null);
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const hasDashboardAccess =
    !!userRole && (DASHBOARD_ROLES as string[]).includes(userRole);
  const hasOrders = useHasOrderHistory();

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
      // Menu mobile CONTRÔLÉ : sans ces deux props, les `onPress` des liens ne
      // referment pas le panneau et il reste ouvert par-dessus la page après
      // un clic — le chemin mobile vers /carte était bloqué.
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      className={`fixed left-0 right-0 z-50 w-full mx-auto`}
      classNames={{
        wrapper: 'w-full mx-auto px-4 lg:max-w-300 xl:max-w-380',
      }}
    >
      <NavbarBrand>
        <NextLink href="/" aria-label="EBA Coffee Shop — accueil">
          <Image
            src="/assets/logos/eba_n.svg"
            alt="EBA Coffee Shop — café et pâtisserie à Abidjan"
            width={60}
            height={60}
            loading="eager"
          />
        </NextLink>
      </NavbarBrand>
      {/* Les six liens n'apparaissent qu'à partir de `md` : à 640 px ils
          débordaient une fois le panier et le CTA ajoutés. Entre 640 et 767 px
          on garde donc le burger — et le CTA « Commander », qui compte
          davantage sur ce format que six liens éditoriaux à l'étroit.
          Typographie et espacement resserrés jusqu'à `lg`. */}
      <NavbarContent className="hidden gap-3 md:flex lg:gap-4" justify="center">
        {brandConfig.menu.map((item) => {
          const active = isActive(item.href);
          return (
            <NavbarItem key={item.href} isActive={active}>
              <Link
                className="whitespace-nowrap text-sm lg:text-base"
                color={!active ? 'foreground' : 'primary'}
                href={item.href}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </NavbarItem>
          );
        })}
      </NavbarContent>
      <NavbarContent justify="end" className="gap-2">
        {/* Raccourcis commerciaux : visibles à TOUS les breakpoints, y compris
            à côté du burger sur mobile. Chacun rend son propre `NavbarItem` et
            ne laisse rien derrière lui tant qu'il n'a rien à montrer (pas
            d'historique / panier vide). */}
        <NavbarOrdersButton />
        <NavbarCartButton />

        {/* CTA principal : dès `sm` (le trafic est massivement mobile) et vers
            /carte — c'est là qu'on commande, pas sur /contact. */}
        <NavbarItem className="hidden sm:flex lg:hidden">
          <Button
            as={Link}
            color="primary"
            href="/carte"
            radius="full"
            size="sm"
          >
            Commander
          </Button>
        </NavbarItem>
        <NavbarItem className="hidden lg:flex">
          <Button
            as={Link}
            color="primary"
            href="/carte"
            radius="full"
            startContent={<ShoppingBag className="h-4 w-4" aria-hidden />}
          >
            Commander
          </Button>
        </NavbarItem>

        {/* Le staff garde son raccourci sans faire disparaître le CTA client.
            Seulement à partir de `xl` : à 1024 px, liens + panier + CTA +
            Dashboard ne tiennent pas. En dessous, DashboardFab prend le relais
            (son `xl:hidden` est aligné sur ce seuil). */}
        {hasDashboardAccess && (
          <NavbarItem className="hidden xl:flex">
            <Button
              as={Link}
              color="primary"
              href="/dashboard"
              variant="flat"
              radius="full"
            >
              Dashboard
            </Button>
          </NavbarItem>
        )}

        <NavbarMenuToggle
          aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="md:hidden"
        />
      </NavbarContent>

      <NavbarMenu className="gap-2 py-8">
        {/* CTA en tête du panneau : premier élément sous le pouce. */}
        <NavbarMenuItem>
          <Button
            as={Link}
            className="w-full"
            color="primary"
            href="/carte"
            size="lg"
            radius="full"
            startContent={<ShoppingBag className="h-5 w-5" aria-hidden />}
            onPress={() => setIsMenuOpen(false)}
          >
            Voir la carte &amp; commander
          </Button>
        </NavbarMenuItem>

        {brandConfig.menu.map((item) => {
          const active = isActive(item.href);
          return (
            <NavbarMenuItem key={item.href}>
              <Link
                className="w-full"
                color={!active ? 'foreground' : 'primary'}
                href={item.href}
                size="lg"
                aria-current={active ? 'page' : undefined}
                onPress={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          );
        })}

        {hasOrders && (
          <NavbarMenuItem>
            <Link
              className="w-full"
              color={isActive('/mes-commandes') ? 'primary' : 'foreground'}
              href="/mes-commandes"
              size="lg"
              aria-current={isActive('/mes-commandes') ? 'page' : undefined}
              onPress={() => setIsMenuOpen(false)}
            >
              <Receipt className="mr-2 h-4 w-4" aria-hidden />
              Mes commandes
            </Link>
          </NavbarMenuItem>
        )}

        <NavbarMenuItem className="mt-4">
          <Button
            as={Link}
            className="w-full"
            href={hasDashboardAccess ? '/dashboard' : '/login'}
            // Bordé et non plein : lisible comme une action, sans concurrencer
            // le CTA « Voir la carte » en tête de panneau.
            variant="bordered"
            radius="full"
            onPress={() => setIsMenuOpen(false)}
          >
            {hasDashboardAccess ? 'Dashboard' : 'Connexion'}
          </Button>
        </NavbarMenuItem>
      </NavbarMenu>
    </UINavbar>
  );
}

export default Navbar;
