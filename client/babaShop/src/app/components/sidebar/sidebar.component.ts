import { Component, HostListener, Inject, OnDestroy, OnInit, Renderer2 } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "app/shared/services/auth.service";

declare const $: any;

declare interface RouteInfo {
  path?: string;
  title: string;
  icon: string;
  class?: string;
  roles: string[];
  children?: RouteInfo[];
  expanded?: boolean;
}

export const ROUTES: RouteInfo[] = [
  {
    path: "/dashboard",
    title: "Dashboard",
    icon: "dashboard",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
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
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
      },
      {
        path: "/stocks",
        title: "Stocks",
        icon: "poll",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
      },
      {
        path: "/purchase",
        title: "Purchase",
        icon: "shopping_cart",
        roles: ["SUPER_ADMIN", "ADMIN"],
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
      },
      {
        path: "/order",
        title: "Orders",
        icon: "rate_review",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
      },
      {
        path: "/pos",
        title: "POS",
        icon: "point_of_sale",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
      },
      {
        path: "/returns",
        title: "Returns",
        icon: "undo",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
      },
      {
        path: "/sales-reports",
        title: "Sales & Profit",
        icon: "bar_chart",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
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
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
      },
      {
        path: "/staff-payments",
        title: "Payment & Advance",
        icon: "account_balance_wallet",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
      },
    ],
  },

  {
    title: "Factory",
    icon: "precision_manufacturing",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    children: [
      {
        path: "/factory-production",
        title: "Production Register",
        icon: "construction",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
      },
      {
        path: "/raw-material-register",
        title: "Raw Material Register",
        icon: "inventory",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
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
      },
      {
        path: "/customer",
        title: "Customers",
        icon: "supervised_user_circle",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
      },
      {
        path: "/distributor",
        title: "Distributors",
        icon: "supervisor_account",
        roles: ["SUPER_ADMIN", "ADMIN"],
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
      },
      {
        path: "/settings",
        title: "Settings",
        icon: "settings",
        roles: ["SUPER_ADMIN", "ADMIN"],
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
  private readonly collapseKey = "sidebar_collapsed";
  private sidebarEl: HTMLElement | null = null;
  private mainPanelEl: HTMLElement | null = null;

  constructor(
    private router: Router,
    private auth: AuthService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  ngOnInit() {
    this.userRole = this.auth.getUserRole();
    this.menuItems = this.filterMenuByRole(ROUTES);
    this.sidebarEl = this.document.querySelector(".sidebar");
    this.mainPanelEl = this.document.querySelector(".main-panel");
    this.updateViewportState();
    this.restoreCollapseState();
  }

  ngOnDestroy(): void {
    this.syncBodyClass();
  }

  filterMenuByRole(items: RouteInfo[]): RouteInfo[] {
    return items.reduce((filtered: RouteInfo[], item) => {
      if (item.children?.length) {
        const visibleChildren = item.children.filter((child) =>
          child.roles.includes(this.userRole!),
        );

        if (visibleChildren.length > 0) {
          filtered.push({
            ...item,
            children: visibleChildren,
          });
        }

        return filtered;
      }

      if (item.roles.includes(this.userRole!)) {
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

  toggleMenu(menuItem: RouteInfo) {
    if (this.isCollapsed) return;

    this.menuItems.forEach((item) => {
      if (item !== menuItem) {
        item.expanded = false;
      }
    });

    menuItem.expanded = !menuItem.expanded;
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
