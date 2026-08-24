'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { performClientLogout } from '../../services/Auth/logoutClient';

function isLikelyLogoutMenuItem(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const menuItem = target.closest('[role="menuitem"]');
  if (!(menuItem instanceof HTMLElement)) {
    return null;
  }

  const normalizedText = (menuItem.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (
    normalizedText.includes('logout') ||
    normalizedText.includes('log out') ||
    normalizedText.includes('sign out') ||
    normalizedText.includes('退出') ||
    normalizedText.includes('登出')
  ) {
    return menuItem;
  }

  return null;
}

export function GlobalLogoutBridge() {
  const router = useRouter();

  useEffect(() => {
    let loggingOut = false;

    const doLogout = async () => {
      await performClientLogout({ router, replace: true });
    };

    const handleClick = (event: MouseEvent) => {
      const menuItem = isLikelyLogoutMenuItem(event.target);
      if (!menuItem || loggingOut) {
        return;
      }

      loggingOut = true;
      event.preventDefault();
      event.stopPropagation();
      void doLogout();
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [router]);

  return null;
}
