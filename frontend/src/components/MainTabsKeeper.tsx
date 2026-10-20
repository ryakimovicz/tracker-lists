import React, { useState, useRef, useLayoutEffect, Suspense } from 'react';
import { PathdLoader } from './PathdLoader';

const Home = React.lazy(() => import('../pages/Home'));
const Social = React.lazy(() => import('../pages/Social'));
const CreateGuide = React.lazy(() => import('../pages/CreateGuide'));
const Search = React.lazy(() => import('../pages/Search'));
const Profile = React.lazy(() => import('../pages/Profile'));

export type MainTabType = 'home' | 'social' | 'create' | 'search' | 'profile';

interface MainTabsKeeperProps {
  activeTab: MainTabType | null;
  isVisible: boolean;
}

export const MainTabsKeeper: React.FC<MainTabsKeeperProps> = ({ activeTab, isVisible }) => {
  // Track which tabs have been visited so we mount each tab on-demand the first time,
  // but keep it alive in the DOM afterwards for 0ms instantaneous tab switching.
  const [visitedTabs, setVisitedTabs] = useState<Record<MainTabType, boolean>>(() => ({
    home: activeTab === 'home',
    social: activeTab === 'social',
    create: activeTab === 'create',
    search: activeTab === 'search',
    profile: activeTab === 'profile'
  }));

  // Store scroll positions per tab to preserve user reading position exactly like native apps
  const scrollPositionsRef = useRef<Record<MainTabType, number>>({
    home: 0,
    social: 0,
    create: 0,
    search: 0,
    profile: 0
  });

  const prevTabRef = useRef<MainTabType | null>(activeTab);
  const wasVisibleRef = useRef<boolean>(isVisible);

  // Guarantee that whenever a tab is active and visible, it is marked as visited immediately
  React.useEffect(() => {
    if (isVisible && activeTab) {
      setVisitedTabs(prev => prev[activeTab] ? prev : { ...prev, [activeTab]: true });
    }
  }, [activeTab, isVisible]);

  useLayoutEffect(() => {
    const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    // If we are navigating away from main tabs to a sub-route (e.g. /settings), save active tab's scroll
    if (wasVisibleRef.current && !isVisible && prevTabRef.current) {
      scrollPositionsRef.current[prevTabRef.current] = currentScrollY;
      wasVisibleRef.current = false;
      return;
    }

    // If we are returning to main tabs from a sub-route or after login
    if (!wasVisibleRef.current && isVisible && activeTab) {
      wasVisibleRef.current = true;
      prevTabRef.current = activeTab;
      setVisitedTabs(prev => prev[activeTab] ? prev : { ...prev, [activeTab]: true });
      const targetScrollY = scrollPositionsRef.current[activeTab] || 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: 'instant' });
      });
      return;
    }

    wasVisibleRef.current = isVisible;

    if (!activeTab) return;

    const prevTab = prevTabRef.current;
    if (prevTab !== activeTab) {
      // 1. Save scroll position of previous tab
      if (prevTab) {
        scrollPositionsRef.current[prevTab] = currentScrollY;
      }
      prevTabRef.current = activeTab;

      // 2. Mark target tab as visited
      setVisitedTabs(prev => prev[activeTab] ? prev : { ...prev, [activeTab]: true });

      // 3. Restore target tab's scroll position instantly
      const targetScrollY = scrollPositionsRef.current[activeTab] || 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: 'instant' });
      });
    }
  }, [activeTab, isVisible]);

  return (
    <div
      className="main-tabs-keeper-container"
      style={{
        display: isVisible ? 'block' : 'none',
        width: '100%',
        minWidth: 0
      }}
    >
      <div
        id="tab-view-home"
        style={{
          display: activeTab === 'home' ? 'block' : 'none',
          width: '100%'
        }}
      >
        {(visitedTabs.home || activeTab === 'home') && (
          <Suspense fallback={<PathdLoader fullScreen />}>
            <Home />
          </Suspense>
        )}
      </div>

      <div
        id="tab-view-social"
        style={{
          display: activeTab === 'social' ? 'block' : 'none',
          width: '100%'
        }}
      >
        {(visitedTabs.social || activeTab === 'social') && (
          <Suspense fallback={<PathdLoader fullScreen />}>
            <Social />
          </Suspense>
        )}
      </div>

      <div
        id="tab-view-create"
        style={{
          display: activeTab === 'create' ? 'block' : 'none',
          width: '100%'
        }}
      >
        {(visitedTabs.create || activeTab === 'create') && (
          <Suspense fallback={<PathdLoader fullScreen />}>
            <CreateGuide />
          </Suspense>
        )}
      </div>

      <div
        id="tab-view-search"
        style={{
          display: activeTab === 'search' ? 'block' : 'none',
          width: '100%'
        }}
      >
        {(visitedTabs.search || activeTab === 'search') && (
          <Suspense fallback={<PathdLoader fullScreen />}>
            <Search />
          </Suspense>
        )}
      </div>

      <div
        id="tab-view-profile"
        style={{
          display: activeTab === 'profile' ? 'block' : 'none',
          width: '100%'
        }}
      >
        {(visitedTabs.profile || activeTab === 'profile') && (
          <Suspense fallback={<PathdLoader fullScreen />}>
            <Profile />
          </Suspense>
        )}
      </div>
    </div>
  );
};
