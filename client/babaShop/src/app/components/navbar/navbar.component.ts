import { Component, OnDestroy, OnInit, ElementRef } from "@angular/core";
import { ROUTES } from "../sidebar/sidebar.component";
import { ShopService } from "../../shared/services/shop.service";
import { AuthService } from "../../shared/services/auth.service";
import { Location } from "@angular/common";
import { NavigationEnd, Router } from "@angular/router";
import { Subject } from "rxjs";
import { filter, takeUntil } from "rxjs/operators";
import { MatDialog } from "@angular/material/dialog";
import { ShopSyncModalComponent } from "app/shops/shop-sync-modal/shop-sync-modal.component";

interface NavbarLink {
  title: string;
  path: string | null;
  icon: string;
  feature?: string;
}

interface BreadcrumbItem {
  label: string;
  path: string | null;
  active: boolean;
}

interface RouteMeta {
  title: string;
  path: string;
  parentTitle: string | null;
}

@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrls: ["./navbar.component.css"],
})
export class NavbarComponent implements OnInit {
  shops: any[] = [];
  selectedShop: string | null = null;
  isSuperAdmin: boolean = false;
  navLinks: NavbarLink[] = [];
  location: Location;
  mobile_menu_visible: any = 0;
  private toggleButton: any;
  private sidebarVisible: boolean;
  private listTitles: RouteMeta[] = [];
  private readonly destroy$ = new Subject<void>();

  constructor(
    location: Location,
    private element: ElementRef,
    private router: Router,
    private shopService: ShopService,
    private authService: AuthService,
    private dialog: MatDialog,
  ) {
    this.location = location;
    this.sidebarVisible = false;
  }

  openShopSyncModal(): void {
    const dialogRef = this.dialog.open(ShopSyncModalComponent, {
      width: "580px",
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((didSync) => {
      if (didSync) {
        window.location.reload();
      }
    });
  }

  ngOnInit() {
    this.listTitles = this.flattenRoutes(ROUTES);
    const navbar: HTMLElement = this.element.nativeElement;
    this.toggleButton = navbar.getElementsByClassName("navbar-toggler")[0];
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.sidebarClose();
      var $layer: any = document.getElementsByClassName("close-layer")[0];
      if ($layer) {
        $layer.remove();
        this.mobile_menu_visible = 0;
      }
    });
    this.isSuperAdmin = this.authService.getUserRole() === "SUPER_ADMIN";
    this.selectedShop = this.shopService.getSelectedShop();
    this.navLinks = this.getRoleBasedLinks();
    this.shopService.selectedShop$.pipe(takeUntil(this.destroy$)).subscribe((shopId) => {
      this.selectedShop = shopId;
    });

    if (this.isSuperAdmin) {
      this.loadShops();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadShops() {
    this.shopService.getAllShops().subscribe((res: any) => {
      this.shops = Array.isArray(res?.data) ? res.data : [];
    });
  }

  onShopChange(shopId: string) {
    const selectedShopObj = this.shops.find((shop: any) => shop._id === shopId);
    this.shopService.setSelectedShop(shopId, selectedShopObj?.shopCode || null);
    window.location.reload();
  }

  clearShopSelection() {
    this.shopService.clearSelectedShop();
    window.location.reload();
  }

  isGlobalReadOnlyMode(): boolean {
    return this.authService.isGlobalReadOnlyMode();
  }

  getScopeModeLabel(): string {
    if (this.isSuperAdmin && !this.selectedShop) {
      return "Global Mode";
    }
    return "Shop Mode";
  }

  getCurrentShopLabel(): string {
    if (!this.selectedShop) {
      return this.isSuperAdmin ? "Global View" : "No Shop";
    }
    const selected = this.shops.find((shop: any) => shop._id === this.selectedShop);
    if (!selected) return this.selectedShop;
    return `${selected.name}${selected.shopCode ? ` (${selected.shopCode})` : ""}`;
  }

  navigateTo(path: string | null) {
    if (!path) return;
    this.router.navigateByUrl(path);
  }

  private getRoleBasedLinks(): NavbarLink[] {
    const superAdminLinks: NavbarLink[] = [
      { title: "Subscriptions", path: "/settings", icon: "credit_card", feature: "settings.system" },
      { title: "Sales & Profit", path: "/sales-reports", icon: "analytics", feature: "sales.profit" },
      { title: "Settings", path: "/settings", icon: "settings", feature: "settings.profile" },
    ];

    const standardLinks: NavbarLink[] = [
      { title: "Products", path: "/item-list", icon: "inventory_2", feature: "inventory.products" },
      { title: "Sales", path: "/sale-list", icon: "point_of_sale", feature: "sales.list" },
      { title: "Purchase", path: "/stocks", icon: "shopping_cart", feature: "inventory.stocks" },
      { title: "Customers", path: "/customer", icon: "people", feature: "people.customers" },
      { title: "Sales & Profit", path: "/sales-reports", icon: "analytics", feature: "sales.profit" },
    ];

    const links = this.isSuperAdmin ? superAdminLinks : standardLinks;
    return links.filter((link) => !link.feature || this.authService.can(link.feature));
  }

  sidebarOpen() {
    const toggleButton = this.toggleButton;
    const body = document.getElementsByTagName("body")[0];
    setTimeout(function () {
      toggleButton.classList.add("toggled");
    }, 500);

    body.classList.add("nav-open");

    this.sidebarVisible = true;
  }
  sidebarClose() {
    const body = document.getElementsByTagName("body")[0];
    this.toggleButton.classList.remove("toggled");
    this.sidebarVisible = false;
    body.classList.remove("nav-open");
  }
  onTogglerTouchStart(event: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.sidebarToggle();
  }

  sidebarToggle(event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    const $toggle = document.getElementsByClassName("navbar-toggler")[0];
    const body = document.getElementsByTagName("body")[0];

    if (this.mobile_menu_visible === 1 || body.classList.contains("nav-open")) {
      body.classList.remove("nav-open");
      const $layer: any = document.getElementsByClassName("close-layer")[0];
      if ($layer && $layer.parentNode) {
        $layer.parentNode.removeChild($layer);
      }
      if ($toggle) {
        $toggle.classList.remove("toggled");
      }
      this.mobile_menu_visible = 0;
      this.sidebarVisible = false;
    } else {
      if ($toggle) {
        $toggle.classList.add("toggled");
      }

      const $layer = document.createElement("div");
      $layer.setAttribute("class", "close-layer visible");
      $layer.style.cursor = "pointer";

      const closeHandler = (e: Event) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        body.classList.remove("nav-open");
        this.mobile_menu_visible = 0;
        this.sidebarVisible = false;
        if ($layer && $layer.parentNode) {
          $layer.parentNode.removeChild($layer);
        }
        if ($toggle) {
          $toggle.classList.remove("toggled");
        }
      };

      $layer.onclick = closeHandler;
      $layer.ontouchstart = closeHandler;

      const mainPanel = document.getElementsByClassName("main-panel")[0];
      const wrapper = document.getElementsByClassName("wrapper-full-page")[0];

      if (mainPanel) {
        mainPanel.appendChild($layer);
      } else if (wrapper) {
        wrapper.appendChild($layer);
      } else {
        body.appendChild($layer);
      }

      body.classList.add("nav-open");
      this.mobile_menu_visible = 1;
      this.sidebarVisible = true;
    }
  }

  getTitle() {
    const currentPath = this.getCurrentPath();
    if (!currentPath || currentPath === "/") return "Home";

    const exactMatch = this.listTitles.find((item) => item.path === currentPath);
    if (exactMatch?.title) return exactMatch.title;

    const prefixMatch = [...this.listTitles]
      .filter((item) => item.path && currentPath.startsWith(`${item.path}/`))
      .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
    if (prefixMatch?.title) return prefixMatch.title;

    return currentPath;
  }

  showBackButton(): boolean {
    const currentPath = this.getCurrentPath();
    return currentPath !== "/dashboard" && currentPath !== "/";
  }

  goBack(): void {
    this.location.back();
  }

  getBreadcrumbs(): BreadcrumbItem[] {
    const currentPath = this.getCurrentPath();
    const crumbs: BreadcrumbItem[] = [
      {
        label: "Dashboard",
        path: "/dashboard",
        active: currentPath === "/dashboard",
      },
    ];

    if (!currentPath || currentPath === "/" || currentPath === "/dashboard") {
      return crumbs;
    }

    const segments = currentPath.split("/").filter(Boolean);
    const moduleTitle = this.getModuleTitle(segments[0], currentPath);
    if (moduleTitle && moduleTitle !== "Dashboard") {
      crumbs.push({ label: moduleTitle, path: null, active: false });
    }

    const bestRoute = this.getBestRouteMeta(currentPath);
    if (bestRoute) {
      if (
        bestRoute.parentTitle &&
        bestRoute.parentTitle !== "Dashboard" &&
        !crumbs.some((crumb) => crumb.label === bestRoute.parentTitle)
      ) {
        crumbs.push({ label: bestRoute.parentTitle, path: null, active: false });
      }
      crumbs.push({
        label: bestRoute.title,
        path: bestRoute.path === currentPath ? null : bestRoute.path,
        active: bestRoute.path === currentPath,
      });

      const routeSegCount = bestRoute.path.split("/").filter(Boolean).length;
      const trailingSegments = segments.slice(routeSegCount);
      trailingSegments.forEach((segment, index) => {
        crumbs.push({
          label: this.formatSegment(segment),
          path: null,
          active: index === trailingSegments.length - 1,
        });
      });
      return this.deduplicateBreadcrumbs(this.compactBreadcrumbLabels(crumbs));
    }

    let runningPath = "";

    segments.forEach((segment, index) => {
      runningPath += `/${segment}`;
      const matched = this.listTitles.find((item) => item.path === runningPath);
      const label = matched?.title || this.formatSegment(segment);
      const isLast = index === segments.length - 1;
      const segmentPath = isLast ? null : runningPath;

      crumbs.push({
        label,
        path: segmentPath,
        active: isLast,
      });
    });

    return this.deduplicateBreadcrumbs(this.compactBreadcrumbLabels(crumbs));
  }

  onBreadcrumbClick(path: string | null): void {
    if (!path) return;
    this.router.navigateByUrl(path);
  }

  private getCurrentPath(): string {
    const rawPath = this.location.prepareExternalUrl(this.location.path()) || "";
    const cleanPath = rawPath.startsWith("#") ? rawPath.slice(1) : rawPath;
    return cleanPath.split("?")[0].split("#")[0];
  }

  private formatSegment(segment: string): string {
    if (/^[a-f0-9]{24}$/i.test(segment)) {
      return `${segment.slice(0, 6)}...${segment.slice(-4)}`;
    }
    return segment.replace(/-/g, " ");
  }

  private compactBreadcrumbLabels(crumbs: BreadcrumbItem[]): BreadcrumbItem[] {
    return crumbs.map((crumb, index) => {
      if (index === 0) return crumb;
      return {
        ...crumb,
        label: crumb.label
          .split(" ")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
      };
    });
  }

  private deduplicateBreadcrumbs(crumbs: BreadcrumbItem[]): BreadcrumbItem[] {
    const unique: BreadcrumbItem[] = [];
    crumbs.forEach((crumb) => {
      const last = unique[unique.length - 1];
      if (last && last.label.toLowerCase() === crumb.label.toLowerCase()) {
        unique[unique.length - 1] = {
          ...last,
          active: last.active || crumb.active,
          path: crumb.path ?? last.path,
        };
        return;
      }
      unique.push(crumb);
    });
    return unique;
  }

  private flattenRoutes(routes: any[]): RouteMeta[] {
    const flat: RouteMeta[] = [];
    routes.forEach((route) => {
      if (route?.path) {
        flat.push({
          title: route.title,
          path: route.path,
          parentTitle: null,
        });
      }
      if (Array.isArray(route?.children)) {
        route.children.forEach((child: any) => {
          if (child?.path) {
            flat.push({
              title: child.title,
              path: child.path,
              parentTitle: route.title || null,
            });
          }
        });
      }
    });
    return flat;
  }

  private getBestRouteMeta(path: string): RouteMeta | null {
    const exact = this.listTitles.find((item) => item.path === path);
    if (exact) return exact;
    const prefix = [...this.listTitles]
      .filter((item) => path.startsWith(`${item.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0];
    return prefix || null;
  }

  private getModuleTitle(firstSegment: string, currentPath: string): string | null {
    const moduleMap: Record<string, string> = {
      dashboard: "Dashboard",
      "item-list": "Inventory",
      "add-items": "Inventory",
      "add-detail": "Inventory",
      "item-details": "Inventory",
      stocks: "Inventory",
      purchase: "Inventory",
      "sale-list": "Sales",
      order: "Sales",
      pos: "Sales",
      returns: "Sales",
      users: "People",
      customer: "People",
      distributor: "People",
      profile: "Account",
      settings: "Account",
      shops: "Shops",
    };

    if (moduleMap[firstSegment]) return moduleMap[firstSegment];
    const bestRoute = this.getBestRouteMeta(currentPath);
    return bestRoute?.parentTitle || null;
  }
}
