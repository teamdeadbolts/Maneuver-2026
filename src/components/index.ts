/**
 * Components exports
 * 
 * This exports all reusable React components.
 */

// PWA Components
export { InstallPrompt } from '../core/components/pwa/InstallPrompt';
export { PWAUpdatePrompt } from '../core/components/pwa/PWAUpdatePrompt';

// Notification Components
export { Toaster } from '../core/components/notification/Toaster';

// Data Transfer Components
export { UniversalFountainGenerator } from '../core/components/data-transfer/UniversalFountainGenerator';
export type { UniversalFountainGeneratorProps } from '../core/components/data-transfer/UniversalFountainGenerator';
export { UniversalFountainScanner } from '../core/components/data-transfer/UniversalFountainScanner';
export type { UniversalFountainScannerProps } from '../core/components/data-transfer/UniversalFountainScanner';

// Navigation Components
export { BottomNavigation } from '../core/components/navigation/BottomNavigation';
export type { BottomNavItem } from '../core/components/navigation/BottomNavigation';
export { AppSidebar } from '../core/components/navigation/AppSidebar';
export { NavMain } from '../core/components/navigation/NavMain';
export type { NavItem } from '../core/components/navigation/NavMain';

// Dashboard Components (2025-style sidebar layout)
// Uses simplified framework versions from dashboard/index.ts
export { AppSidebar as DashboardSidebar, SiteHeader } from '../core/components/dashboard';

// Sidebar UI Components
export {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '../core/components/ui/sidebar';
export type { SidebarContextProps } from '../core/components/ui/sidebar';

// Layout Components
export { MainLayout } from '../core/layouts/MainLayout';
export { default as Dashboard } from '../core/layouts/Dashboard';

// Page Components
export { HomePage } from '../core/pages/HomePage';
export { NotFoundPage } from '../core/pages/NotFoundPage';

// UI Components
export { Button } from '../core/components/ui/button';
export { Input } from '../core/components/ui/input';
export { Label } from '../core/components/ui/label';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../core/components/ui/card';
export { Badge } from '../core/components/ui/badge';
export { Alert, AlertDescription, AlertTitle } from '../core/components/ui/alert';
export { Progress } from '../core/components/ui/progress';
