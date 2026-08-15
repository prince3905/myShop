import { Component, HostListener, Inject, OnDestroy, OnInit, Renderer2 } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "app/shared/services/auth.service";
import { MatDialog } from "@angular/material/dialog";
import { ShopService } from "app/shared/services/shop.service";
import { ShopSyncModalComponent } from "app/shops/shop-sync-modal/shop-sync-modal.component";

declare const $: any;

declare interface RouteInfo {
  path?: string;
  title: string;
  icon: string;
  class?: string;
  roles: string[];
  feature?: string;
  children?: RouteInfo[];
  expanded?: boolean;
}

export const ROUTES: RouteInfo[] = [
  {
    path: "/dashboard",
    title: "Dashboard",
    icon: "dashboard",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    feature: "dashboard.basic",
  },

  {
    title: "Inventory",
    icon: "inventory_2",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    children: [
      {
        path: "/item-list",
        title: "Products",
        icon: "content_paste",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "inventory.products",
      },
      {
        path: "/stocks",
        title: "Stocks",
        icon: "poll",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "inventory.stocks",
      },
      {
        path: "/purchase",
        title: "Purchase",
        icon: "shopping_cart",
        roles: ["SUPER_ADMIN", "ADMIN"],
        feature: "inventory.purchase",
      },
      {
        path: "/barcode-catalog",
        title: "Barcode Catalog",
        icon: "qr_code_2",
        roles: ["SUPER_ADMIN", "ADMIN"],
        feature: "inventory.product_details",
      },
    ],
  },

  {
    title: "Sales",
    icon: "store",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    children: [
      {
        path: "/sale-list",
        title: "Sales",
        icon: "store",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "sales.list",
      },
      {
        path: "/order",
        title: "Orders",
        icon: "rate_review",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "sales.orders",
      },
      {
        path: "/pos",
        title: "POS",
        icon: "point_of_sale",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "sales.pos",
      },
      {
        path: "/returns",
        title: "Returns",
        icon: "undo",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "sales.return",
      },
      {
        path: "/sales-reports",
        title: "Sales & Profit",
        icon: "bar_chart",
        roles: ["SUPER_ADMIN", "ADMIN"],
        feature: "sales.profit",
      },
    ],
  },

  {
    title: "Expenses",
    icon: "receipt_long",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    children: [
      {
        path: "/daily-expense",
        title: "Daily Expense",
        icon: "payments",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "expenses.daily",
      },
      {
        path: "/expense-report",
        title: "Expense Report",
        icon: "receipt_long",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "expenses.report",
      },
    ],
  },

  {
    title: "Staffs & Worker",
    icon: "engineering",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    children: [
      {
        path: "/staff-master",
        title: "Staff List",
        icon: "badge",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "staff.master",
      },
      {
        path: "/staff-daily-work",
        title: "Daily Work",
        icon: "event_note",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "staff.daily_work",
      },
      {
        path: "/staff-payments",
        title: "Payment & Advance",
        icon: "account_balance_wallet",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "staff.payments",
      },
      {
        path: "/staff-payable-summary",
        title: "Payable / Summary",
        icon: "summarize",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "staff.summary",
      },
    ],
  },

  {
    title: "Factory",
    icon: "precision_manufacturing",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    children: [
      {
        path: "/factory-product-master",
        title: "Factory Production",
        icon: "category",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "factory.product_master",
      },
      {
        path: "/factory-verification",
        title: "Factory Verification",
        icon: "fact_check",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "factory.verification",
      },
      {
        path: "/raw-material-purchase",
        title: "Raw Material Purchase",
        icon: "shopping_cart",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "factory.raw_material_purchase",
      },
      {
        path: "/raw-material-register",
        title: "Raw Material Master",
        icon: "inventory",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "factory.raw_material_master",
      },
      {
        path: "/factory-report",
        title: "Factory Report",
        icon: "assessment",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        feature: "factory.report",
      },
    ],
  },

  {
    title: "People",
    icon: "groups",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    children: [
      {
        path: "/users",
        title: "Users",
        icon: "manage_accounts",
        roles: ["SUPER_ADMIN", "ADMIN"],
        feature: "people.users",
      },
      {
        path: "/customer",
        title: "Customers",
        icon: "supervised_user_circle",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "people.customers",
      },
      {
        path: "/distributor",
        title: "Distributors",
        icon: "supervisor_account",
        roles: ["SUPER_ADMIN", "ADMIN"],
        feature: "people.distributors",
      },
    ],
  },

  {
    title: "Account",
    icon: "account_circle",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    children: [
      {
        path: "/profile",
        title: "Profile",
        icon: "manage_accounts",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
        feature: "settings.profile",
      },
      {
        path: "/settings",
        title: "Settings",
        icon: "settings",
        roles: ["SUPER_ADMIN", "ADMIN"],
        feature: "settings.permissions",
      },
    ],
  },

  {
    title: "Fraud Detection",
    icon: "security",
    roles: ["SUPER_ADMIN", "ADMIN"],
    children: [
      {
        path: "/fraud-detection",
        title: "Fraud Alerts",
        icon: "warning",
        roles: ["SUPER_ADMIN", "ADMIN"],
        feature: "fraud.detection",
      },
    ],
  },
];

@Component({
  selector: "app-sidebar",
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.css"],
})
export class SidebarComponent implements OnInit, OnDestroy {
  menuItems: any[];
  userRole: string | null = null;
  isCollapsed = false;
  isMobileViewport = false;
  activeFlyoutKey: string | null = null;
  shops: any[] = [];
  selectedShop: string | null = null;
  isSuperAdmin = false;
  private readonly collapseKey = "sidebar_collapsed";
  private sidebarEl: HTMLElement | null = null;
  private mainPanelEl: HTMLElement | null = null;

  constructor(
    private router: Router,
    private auth: AuthService,
    private shopService: ShopService,
    private dialog: MatDialog,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  ngOnInit() {
    this.userRole = this.auth.getUserRole();
    this.isSuperAdmin = this.userRole === "SUPER_ADMIN";
    this.selectedShop = this.shopService.getSelectedShop();
    this.menuItems = this.filterMenuByRole(ROUTES);
    this.sidebarEl = this.document.querySelector(".sidebar");
    this.mainPanelEl = this.document.querySelector(".main-panel");
    this.updateViewportState();
    this.restoreCollapseState();
    this.expandActiveParentMenu();

    if (this.isSuperAdmin) {
      this.shopService.getAllShops().subscribe((res: any) => {
        this.shops = Array.isArray(res?.data) ? res.data : [];
      });
    }
  }

  getCurrentShopLabel(): string {
    const activeShopId = this.selectedShop || this.shopService.getSelectedShop();
    if (!activeShopId || activeShopId === "null" || activeShopId === "undefined") {
      return "Global View";
    }
    const selected = this.shops.find((shop: any) => shop._id === activeShopId);
    if (!selected) return "Global View";
    return `${selected.name}${selected.shopCode ? ` (${selected.shopCode})` : ""}`;
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

  navigateTo(path: string | null) {
    if (!path) return;
    this.router.navigateByUrl(path);
  }

  private expandActiveParentMenu(): void {
    const currentUrl = this.router.url;
    this.menuItems.forEach((item) => {
      if (item.children?.some((child) => child.path && currentUrl.includes(child.path))) {
        item.expanded = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.syncBodyClass();
  }

  filterMenuByRole(items: RouteInfo[]): RouteInfo[] {
    return items.reduce((filtered: RouteInfo[], item) => {
      if (item.children?.length) {
        const visibleChildren = item.children.filter((child) =>
          child.feature
            ? this.auth.can(child.feature)
            : child.roles.includes(this.userRole!),
        );

        if (visibleChildren.length > 0) {
          filtered.push({
            ...item,
            children: visibleChildren,
          });
        }

        return filtered;
      }

      if (item.feature ? this.auth.can(item.feature) : item.roles.includes(this.userRole!)) {
        filtered.push({ ...item });
      }

      return filtered;
    }, []);
  }

  isMobileMenu() {
    if ($(window).width() > 991) {
      return false;
    }
    return true;
  }

  logout(): void {
    this.auth.removeToken();
    this.auth.removeUser();
    this.auth.removeSelectedShop();
    this.router.navigate(["/login"]);
  }

  onNavLinkClick(): void {
    if (this.isMobileViewport) {
      this.closeMobileDrawer();
    }
  }

  toggleMenu(menuItem: RouteInfo, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    const nextState = !menuItem.expanded;

    this.menuItems.forEach((item) => {
      if (item !== menuItem) {
        item.expanded = false;
      }
    });

    menuItem.expanded = nextState;
  }

  toggleSidebar(): void {
    if (this.isMobileViewport) {
      this.closeMobileDrawer();
      return;
    }

    this.isCollapsed = !this.isCollapsed;
    if (!this.isCollapsed) {
      this.activeFlyoutKey = null;
    }
    localStorage.setItem(this.collapseKey, String(this.isCollapsed));
    this.syncBodyClass();
  }

  getTooltip(title: string): string {
    return this.isCollapsed ? title : "";
  }

  openFlyout(menuItem: RouteInfo, idx: number): void {
    if (!this.isCollapsed || !menuItem?.children?.length) return;
    this.activeFlyoutKey = this.getFlyoutKey(menuItem, idx);
  }

  closeFlyout(menuItem?: RouteInfo, idx?: number): void {
    if (!this.isCollapsed) return;
    if (!menuItem || idx === undefined) {
      this.activeFlyoutKey = null;
      return;
    }
    const key = this.getFlyoutKey(menuItem, idx);
    if (this.activeFlyoutKey === key) {
      this.activeFlyoutKey = null;
    }
  }

  isFlyoutOpen(menuItem: RouteInfo, idx: number): boolean {
    if (!this.isCollapsed) return !!menuItem?.expanded;
    return this.activeFlyoutKey === this.getFlyoutKey(menuItem, idx);
  }

  private restoreCollapseState(): void {
    if (this.isMobileViewport) {
      this.isCollapsed = false;
      localStorage.removeItem(this.collapseKey);
      this.syncBodyClass();
      return;
    }

    const saved = localStorage.getItem(this.collapseKey);
    this.isCollapsed = saved === "true";
    this.syncBodyClass();
  }

  @HostListener("window:resize")
  onWindowResize(): void {
    const wasMobile = this.isMobileViewport;
    this.updateViewportState();

    if (this.isMobileViewport) {
      this.isCollapsed = false;
      this.activeFlyoutKey = null;
      this.syncBodyClass();
    } else if (wasMobile !== this.isMobileViewport) {
      this.restoreCollapseState();
    }
  }

  private getFlyoutKey(menuItem: RouteInfo, idx: number): string {
    return `${menuItem?.title || "menu"}-${idx}`;
  }

  private syncBodyClass(): void {
    if (this.isCollapsed) {
      this.renderer.addClass(this.document.body, "sidebar-mini");
      this.applyCollapsedDimensions();
    } else {
      this.renderer.removeClass(this.document.body, "sidebar-mini");
      this.clearCollapsedDimensions();
    }
  }

  private applyCollapsedDimensions(): void {
    if (this.sidebarEl) {
      this.renderer.setStyle(this.sidebarEl, "width", "80px");
      this.renderer.setStyle(this.sidebarEl, "min-width", "80px");
      this.renderer.setStyle(this.sidebarEl, "max-width", "80px");
    }
    if (this.mainPanelEl) {
      this.renderer.setStyle(this.mainPanelEl, "width", "calc(100% - 80px)");
    }
  }

  private clearCollapsedDimensions(): void {
    if (this.sidebarEl) {
      this.renderer.removeStyle(this.sidebarEl, "width");
      this.renderer.removeStyle(this.sidebarEl, "min-width");
      this.renderer.removeStyle(this.sidebarEl, "max-width");
    }
    if (this.mainPanelEl) {
      this.renderer.removeStyle(this.mainPanelEl, "width");
    }
  }

  private updateViewportState(): void {
    this.isMobileViewport = window.innerWidth <= 991;
  }

  private closeMobileDrawer(): void {
    this.renderer.removeClass(this.document.body, "nav-open");
    this.activeFlyoutKey = null;
    const closeLayer = this.document.getElementsByClassName("close-layer")[0];
    if (closeLayer?.parentNode) {
      closeLayer.parentNode.removeChild(closeLayer);
    }
  }
}
