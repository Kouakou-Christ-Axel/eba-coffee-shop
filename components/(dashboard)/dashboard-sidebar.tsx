'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Calculator,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  Wallet,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';
import type { UserRole } from '@/generated/prisma/client';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  {
    label: 'Vue d’ensemble',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'CASHIER'],
  },
  {
    label: 'Statistiques',
    href: '/dashboard/statistiques',
    icon: BarChart3,
    roles: ['ADMIN'],
  },
  {
    label: 'Dépenses',
    href: '/dashboard/depenses',
    icon: Wallet,
    roles: ['ADMIN'],
  },
  {
    label: 'Caisse',
    href: '/dashboard/caisse',
    icon: ShoppingBag,
    roles: ['ADMIN', 'CASHIER'],
  },
  {
    label: 'Préparation',
    href: '/dashboard/preparation',
    icon: ChefHat,
    roles: ['ADMIN', 'CASHIER', 'KITCHEN'],
  },
  {
    label: 'Commandes',
    href: '/dashboard/commandes',
    icon: ClipboardList,
    roles: ['ADMIN', 'CASHIER'],
  },
  {
    label: 'Clôture',
    href: '/dashboard/cloture',
    icon: Calculator,
    roles: ['ADMIN', 'CASHIER'],
  },
  {
    label: 'Menu',
    href: '/dashboard/menu',
    icon: UtensilsCrossed,
    roles: ['ADMIN'],
  },
  {
    label: 'Paramètres',
    href: '/dashboard/parametres',
    icon: Settings,
    roles: ['ADMIN'],
  },
  {
    label: 'Utilisateurs',
    href: '/dashboard/utilisateurs',
    icon: Users,
    roles: ['ADMIN'],
  },
];

function isItemActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type DashboardSidebarProps = {
  user: {
    name?: string | null;
    email?: string | null;
  };
  role: UserRole;
};

export function DashboardSidebar({ user, role }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 hover:opacity-75 transition-opacity"
        >
          <Image
            src="/assets/logos/eba_n.svg"
            alt="EBA Coffee Shop"
            width={36}
            height={36}
            className="shrink-0"
          />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">
              EBA Coffee
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              {roleLabel(role)}
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {user.name ?? 'Staff'}
                </span>
                {user.email && (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Se déconnecter">
              <LogOut />
              <span>Se déconnecter</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return 'Administration';
    case 'CASHIER':
      return 'Caisse';
    case 'KITCHEN':
      return 'Préparation';
    default:
      return 'Staff';
  }
}
