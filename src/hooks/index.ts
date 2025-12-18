/**
 * Hooks exports
 * 
 * This exports all custom React hooks.
 */

// Responsive / Device Detection
export { useIsMobile } from '../core/hooks/use-mobile';
export { usePWA } from '../core/hooks/usePWA';
export { 
  useMediaQuery, 
  mediaQueries,
  useIsDarkMode,
  useIsPortrait,
  useIsRetina,
  usePrefersReducedMotion
} from '../core/hooks/useMediaQuery';

// State Management
export { useLocalStorage } from '../core/hooks/useLocalStorage';
export { useDebounce, useDebouncedCallback } from '../core/hooks/useDebounce';

// Navigation
export { useNavigationConfirm } from '../core/hooks/useNavigationConfirm';

// Network
export { useOnlineStatus, useOnlineStatusWithCallback } from '../core/hooks/useOnlineStatus';

// Keyboard
export { useKeyboardShortcut, shortcuts } from '../core/hooks/useKeyboardShortcut';
